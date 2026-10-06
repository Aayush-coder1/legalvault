const proxy = require("../mongodb/mongodb-proxy");
const { EncryptedDoc, FileMeta, Idempotency } = require("../mongodb/models");
const { getKey } = require("../key-management/key-manager");
const { lockBuffer, unlockBuffer } = require("../encryption/envelope-encryption");
const { getTenant, assertTenant } = require("../tenants/tenant-manager");
const { s3Key, putLocked, getLocked, delLocked } = require("../s3/s3-proxy");
const crypto = require("crypto");

const ALLOWED_STATUS = ["open", "in-progress", "closed"];
const CASE_FIELDS = ["title", "caseNumber", "description", "status"];
const NOTE_FIELDS = ["title", "text", "caseId"];
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

function pick(obj, fields) {
  const out = {};
  for (const f of fields) if (obj[f] !== undefined) out[f] = obj[f];
  return out;
}

function sanitizeFilename(name) {
  const base = String(name || "file").split(/[/\\]/).pop().slice(0, 180);
  const clean = base.replace(/[\r\n"]/g, "").trim() || "file";
  const ascii = clean.replace(/[^\x20-\x7E]/g, "_");
  return { clean, header: `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(clean)}` };
}

async function withIdempotency(req, tenantId, kind, fn) {
  const key = req.headers["idempotency-key"];
  if (!key || typeof key !== "string" || key.length > 128) return fn(null);
  const existing = await Idempotency.findOne({ tenantId, key }).lean();
  if (existing) {
    return { idempotent: true, itemId: existing.itemId };
  }
  const itemId = proxy.newId();
  try {
    await Idempotency.create({ tenantId, key, itemId, kind });
  } catch (e) {
    if (e && e.code === 11000) {
      const winner = await Idempotency.findOne({ tenantId, key }).lean();
      return { idempotent: true, itemId: winner.itemId };
    }
    throw e;
  }
  return fn(itemId);
}

// ---- Cases ----
async function createCase(req, res, next) {
  try {
    const { title, caseNumber, description, status } = req.body || {};
    if (!title || !caseNumber) return res.status(400).json({ success: false, error: { code: "BAD_INPUT", message: "title, caseNumber required" } });
    if (String(title).length > 160 || String(caseNumber).length > 64) return res.status(400).json({ success: false, error: { code: "BAD_INPUT", message: "title/caseNumber too long" } });
    if (description !== undefined && String(description).length > 5000) return res.status(400).json({ success: false, error: { code: "BAD_INPUT", message: "description too long" } });
    if (status && !ALLOWED_STATUS.includes(status)) return res.status(400).json({ success: false, error: { code: "BAD_STATUS", message: "status must be open|in-progress|closed" } });
    const { tenantId } = getTenant(req);
    const out = await withIdempotency(req, tenantId, "case", async (idemId) => {
      const itemId = idemId || proxy.newId();
      const now = new Date().toISOString();
      const body = pick({ title, caseNumber, description: description || "", status: status || "open", createdAt: now, updatedAt: now }, [...CASE_FIELDS, "createdAt", "updatedAt"]);
      await proxy.saveItem(req, "case", itemId, body);
      return { itemId };
    });
    if (out && out.idempotent) {
      const data = await proxy.readItem(req, out.itemId);
      return res.json({ success: true, data });
    }
    const data = await proxy.readItem(req, out.itemId);
    res.status(201).json({ success: true, data });
  } catch (e) { next(e); }
}

async function listCases(req, res, next) {
  try {
    const { tenantId } = getTenant(req);
    const { items, nextCursor } = await proxy.listByKind(tenantId, "case", undefined, { limit: req.query.limit, cursor: req.query.cursor });
    if (req.query.limit !== undefined || req.query.cursor !== undefined) {
      return res.json({ success: true, data: items, nextCursor });
    }
    res.json({ success: true, data: items });
  } catch (e) { next(e); }
}

async function getCase(req, res, next) {
  try {
    const data = await proxy.readItem(req, req.params.caseId);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

async function updateCase(req, res, next) {
  try {
    const old = await proxy.readItem(req, req.params.caseId);
    const patch = pick(req.body || {}, CASE_FIELDS);
    if (patch.status && !ALLOWED_STATUS.includes(patch.status)) return res.status(400).json({ success: false, error: { code: "BAD_STATUS", message: "status must be open|in-progress|closed" } });
    const merged = { ...old, ...patch, id: undefined, tenantId: undefined, keyVersion: undefined, updatedAt: new Date().toISOString() };
    await proxy.saveItem(req, "case", req.params.caseId, merged);
    const data = await proxy.readItem(req, req.params.caseId);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

async function deleteCase(req, res, next) {
  try {
    const { tenantId } = getTenant(req);
    // delete case + its notes
    await EncryptedDoc.deleteOne({ tenantId, itemId: req.params.caseId });
    await EncryptedDoc.deleteMany({ tenantId, caseId: req.params.caseId, kind: "note" });
    // delete every file from the bucket first, then drop its metadata.
    // A failed bucket delete keeps its metadata so a retry can clean it up.
    const files = await FileMeta.find({ tenantId, caseId: req.params.caseId }).lean();
    const results = await Promise.allSettled(files.map(async (f) => {
      await delLocked(f.s3Key);
      await FileMeta.deleteOne({ _id: f._id });
      return f.fileId;
    }));
    const failed = [];
    let deleted = 0;
    results.forEach((r, i) => {
      if (r.status === "fulfilled") deleted += 1;
      else failed.push({ fileId: files[i].fileId, fileName: files[i].fileName, error: (r.reason && r.reason.message) || "delete failed" });
    });
    res.json({
      success: failed.length === 0,
      data: { ok: failed.length === 0, deletedFiles: deleted, failedFiles: failed },
    });
  } catch (e) { next(e); }
}

// ---- Notes (stored as kind=note, linked by caseId) ----
async function createNote(req, res, next) {
  try {
    const { text, title } = req.body || {};
    if (!text || typeof text !== "string" || text.length > 20000) return res.status(400).json({ success: false, error: { code: "BAD_INPUT", message: "text 1-20000 chars required" } });
    await proxy.readItem(req, req.params.caseId); // ensure case belongs to tenant
    const { tenantId } = getTenant(req);
    const out = await withIdempotency(req, tenantId, "note", async (idemId) => {
      const noteId = idemId || proxy.newId();
      const now = new Date().toISOString();
      await proxy.saveItem(req, "note", noteId, { caseId: req.params.caseId, title: String(title || "note").slice(0, 160), text, createdAt: now, updatedAt: now });
      return { itemId: noteId };
    });
    const data = await proxy.readItem(req, out.itemId);
    res.status(out.idempotent ? 200 : 201).json({ success: true, data });
  } catch (e) { next(e); }
}

async function listNotes(req, res, next) {
  try {
    const { tenantId } = getTenant(req);
    await proxy.readItem(req, req.params.caseId);
    const { items, nextCursor } = await proxy.listByKind(tenantId, "note", req.params.caseId, { limit: req.query.limit, cursor: req.query.cursor });
    if (req.query.limit !== undefined || req.query.cursor !== undefined) {
      return res.json({ success: true, data: items, nextCursor });
    }
    res.json({ success: true, data: items });
  } catch (e) { next(e); }
}

async function updateNote(req, res, next) {
  try {
    const old = await proxy.readItem(req, req.params.noteId);
    const patch = pick(req.body || {}, ["title", "text"]);
    if (patch.text !== undefined && (typeof patch.text !== "string" || patch.text.length > 20000)) {
      return res.status(400).json({ success: false, error: { code: "BAD_INPUT", message: "text max 20000 chars" } });
    }
    const merged = { ...old, ...patch, id: undefined, tenantId: undefined, keyVersion: undefined, caseId: old.caseId, updatedAt: new Date().toISOString() };
    await proxy.saveItem(req, "note", req.params.noteId, merged);
    res.json({ success: true, data: await proxy.readItem(req, req.params.noteId) });
  } catch (e) { next(e); }
}

async function deleteNote(req, res, next) {
  try {
    const { tenantId } = getTenant(req);
    await EncryptedDoc.deleteOne({ tenantId, itemId: req.params.noteId });
    res.json({ success: true, data: { ok: true } });
  } catch (e) { next(e); }
}

// ---- Files (envelope-encrypted bytes in S3, metadata in Mongo) ----
// Frontend EvidenceKind: pdf | image | video | note (derived from MIME).
function kindOf(mimeType) {
  if (!mimeType) return "pdf";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType === "text/plain") return "note";
  return "pdf"; // safe default the UI can always render
}

async function uploadFile(req, res, next) {
  try {
    const { caseId, fileName, mimeType, sizeBytes, dataBase64 } = req.body || {};
    if (!caseId || !fileName || !dataBase64) return res.status(400).json({ success: false, error: { code: "BAD_INPUT", message: "caseId, fileName, dataBase64 required" } });
    if (String(fileName).length > 180) return res.status(400).json({ success: false, error: { code: "BAD_INPUT", message: "fileName too long" } });
    const approxBytes = Math.floor(String(dataBase64).length * 3 / 4);
    if (approxBytes > MAX_UPLOAD_BYTES + 1024 * 1024) return res.status(413).json({ success: false, error: { code: "TOO_LARGE", message: "File too big (max 25MB)" } });
    await proxy.readItem(req, caseId); // tenant owns case?
    const { tenantId } = getTenant(req);
    const { key, version } = await getKey(tenantId);
    let buffer;
    try {
      buffer = Buffer.from(dataBase64, "base64");
    } catch {
      return res.status(400).json({ success: false, error: { code: "BAD_INPUT", message: "Invalid base64" } });
    }
    if (buffer.length > MAX_UPLOAD_BYTES) return res.status(413).json({ success: false, error: { code: "TOO_LARGE", message: "File too big (max 25MB)" } });
    if (sizeBytes !== undefined && Number(sizeBytes) !== buffer.length) {
      return res.status(400).json({ success: false, error: { code: "SIZE_MISMATCH", message: "sizeBytes does not match payload" } });
    }
    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
    const bundle = lockBuffer(key, buffer);
    buffer.fill(0);
    const out = await withIdempotency(req, tenantId, "file", async (idemId) => ({ itemId: idemId || proxy.newId() }));
    const fileId = out.itemId;
    const key_ = s3Key(tenantId, caseId, fileId);
    let s3ok = false;
    try {
      await putLocked(key_, Buffer.from(bundle.ciphertext, "base64"), mimeType);
      s3ok = true;
    } catch (s3e) {
      s3e.status = 502;
      throw s3e;
    } finally {
      if (!s3ok) await Idempotency.deleteOne({ tenantId, itemId: fileId }).catch(() => null);
    }
    const { ciphertext, ...rest } = bundle; // ciphertext lives in S3 only
    try {
      await FileMeta.create({ fileId, tenantId, caseId, fileName: String(fileName).slice(0, 180), mimeType, sizeBytes: buffer.length, sha256, s3Key: key_, keyVersion: version, encBundle: rest });
    } catch (dbErr) {
      // Compensate orphan S3 object if metadata write fails.
      await delLocked(key_).catch(() => null);
      throw dbErr;
    }
    res.status(out.idempotent ? 200 : 201).json({ success: true, data: { id: fileId, tenantId, caseId, fileName, mimeType, kind: kindOf(mimeType), sizeBytes, uploadDate: new Date().toISOString() } });
  } catch (e) { next(e); }
}

async function listFiles(req, res, next) {
  try {
    const { tenantId } = getTenant(req);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const q = { tenantId };
    if (req.query.caseId) q.caseId = req.query.caseId;
    if (req.query.cursor) {
      const d = new Date(req.query.cursor);
      if (!Number.isNaN(d.getTime())) q.createdAt = { $lt: d };
    }
    const rows = await FileMeta.find(q, { fileId: 1, tenantId: 1, caseId: 1, fileName: 1, mimeType: 1, sizeBytes: 1, createdAt: 1 }).sort({ createdAt: -1 }).limit(limit + 1).lean();
    const page = rows.slice(0, limit);
    const nextCursor = rows.length > limit ? page[page.length - 1].createdAt.toISOString() : null;
    const data = page.map((f) => ({ id: f.fileId, tenantId: f.tenantId, caseId: f.caseId, fileName: f.fileName, mimeType: f.mimeType, kind: kindOf(f.mimeType), sizeBytes: f.sizeBytes, uploadDate: f.createdAt }));
    if (req.query.limit !== undefined || req.query.cursor !== undefined) {
      return res.json({ success: true, data, nextCursor });
    }
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

// Batch counts for dashboard (kills N+1 fan-out).
async function fileCounts(req, res, next) {
  try {
    const { tenantId } = getTenant(req);
    const ids = String(req.query.caseIds || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 100);
    if (!ids.length) return res.json({ success: true, data: {} });
    const rows = await FileMeta.aggregate([
      { $match: { tenantId, caseId: { $in: ids } } },
      { $group: { _id: "$caseId", n: { $sum: 1 } } },
    ]);
    const out = {};
    for (const r of rows) out[r._id] = r.n;
    res.json({ success: true, data: out });
  } catch (e) { next(e); }
}

async function downloadFile(req, res, next) {
  try {
    const { tenantId } = getTenant(req);
    const meta = await FileMeta.findOne({ fileId: req.params.fileId, tenantId }).lean();
    if (!meta) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "File not found" } });
    assertTenant(req, meta.tenantId);
    const { getKeyByVersion } = require("../key-management/key-manager");
    let key;
    try {
      key = await getKeyByVersion(tenantId, meta.keyVersion);
    } catch {
      return res.status(422).json({ success: false, error: { code: "KEY_MISSING", message: "Decryption key unavailable" } });
    }
    const cipherBytes = await getLocked(meta.s3Key);
    const bundle = { ...meta.encBundle, ciphertext: cipherBytes.toString("base64") };
    let plain;
    try {
      plain = unlockBuffer(key, bundle);
    } catch {
      return res.status(422).json({ success: false, error: { code: "DECRYPT_FAIL", message: "File failed integrity check" } });
    }
    const { header } = sanitizeFilename(meta.fileName);
    res.setHeader("Content-Type", meta.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", header);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Length", plain.length);
    res.send(plain);
  } catch (e) { next(e); }
}

async function deleteFile(req, res, next) {
  try {
    const { tenantId } = getTenant(req);
    const meta = await FileMeta.findOne({ fileId: req.params.fileId, tenantId });
    if (!meta) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "File not found" } });
    try {
      await delLocked(meta.s3Key);
    } catch (s3e) {
      // Keep metadata so a retry can clean up (consistent with deleteCase).
      return res.status(502).json({ success: false, error: { code: "S3_FAIL", message: "Storage delete failed, try again" } });
    }
    await FileMeta.deleteOne({ fileId: req.params.fileId, tenantId });
    res.json({ success: true, data: { ok: true } });
  } catch (e) { next(e); }
}

module.exports = { createCase, listCases, getCase, updateCase, deleteCase, createNote, listNotes, updateNote, deleteNote, uploadFile, listFiles, fileCounts, downloadFile, deleteFile };
