const proxy = require("../mongodb/mongodb-proxy");
const { EncryptedDoc, FileMeta } = require("../mongodb/models");
const { getKey } = require("../key-management/key-manager");
const { lockBuffer, unlockBuffer } = require("../encryption/envelope-encryption");
const { getTenant, assertTenant } = require("../tenants/tenant-manager");
const { s3Key, putLocked, getLocked, delLocked } = require("../s3/s3-proxy");

const ALLOWED_STATUS = ["open", "in-progress", "closed"];

// ---- Cases ----
async function createCase(req, res, next) {
  try {
    const { title, caseNumber, description, status } = req.body || {};
    if (!title || !caseNumber) return res.status(400).json({ success: false, error: { code: "BAD_INPUT", message: "title, caseNumber required" } });
    if (status && !ALLOWED_STATUS.includes(status)) return res.status(400).json({ success: false, error: { code: "BAD_STATUS", message: "status must be open|in-progress|closed" } });
    const { tenantId } = getTenant(req);
    const itemId = proxy.newId();
    const now = new Date().toISOString();
    await proxy.saveItem(req, "case", itemId, { title, caseNumber, description: description || "", status: status || "open", createdAt: now, updatedAt: now });
    const data = await proxy.readItem(req, itemId);
    res.status(201).json({ success: true, data });
  } catch (e) { next(e); }
}

async function listCases(req, res, next) {
  try {
    const { tenantId } = getTenant(req);
    const data = await proxy.listByKind(tenantId, "case");
    res.json({ success: true, data });
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
    const merged = { ...old, ...req.body, id: undefined, tenantId: undefined, keyVersion: undefined, updatedAt: new Date().toISOString() };
    await proxy.saveItem(req, "case", req.params.caseId, merged);
    const data = await proxy.readItem(req, req.params.caseId);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

async function deleteCase(req, res, next) {
  try {
    const { tenantId } = getTenant(req);
    // delete case + its notes + its files metadata (S3 objects too)
    await EncryptedDoc.deleteOne({ tenantId, itemId: req.params.caseId });
    await EncryptedDoc.deleteMany({ tenantId, caseId: req.params.caseId, kind: "note" });
    const files = await FileMeta.find({ tenantId, caseId: req.params.caseId });
    for (const f of files) { try { await delLocked(f.s3Key); } catch {} }
    await FileMeta.deleteMany({ tenantId, caseId: req.params.caseId });
    res.json({ success: true, data: { ok: true } });
  } catch (e) { next(e); }
}

// ---- Notes (stored as kind=note, linked by caseId) ----
async function createNote(req, res, next) {
  try {
    const { text, title } = req.body || {};
    if (!text) return res.status(400).json({ success: false, error: { code: "BAD_INPUT", message: "text required" } });
    await proxy.readItem(req, req.params.caseId); // ensure case belongs to tenant
    const noteId = proxy.newId();
    const now = new Date().toISOString();
    await proxy.saveItem(req, "note", noteId, { caseId: req.params.caseId, title: title || "note", text, createdAt: now, updatedAt: now });
    const data = await proxy.readItem(req, noteId);
    res.status(201).json({ success: true, data });
  } catch (e) { next(e); }
}

async function listNotes(req, res, next) {
  try {
    const { tenantId } = getTenant(req);
    await proxy.readItem(req, req.params.caseId);
    const data = await proxy.listByKind(tenantId, "note", req.params.caseId);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

async function updateNote(req, res, next) {
  try {
    const old = await proxy.readItem(req, req.params.noteId);
    const merged = { ...old, ...req.body, id: undefined, tenantId: undefined, keyVersion: undefined, updatedAt: new Date().toISOString() };
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
async function uploadFile(req, res, next) {
  try {
    const { caseId, fileName, mimeType, sizeBytes, dataBase64 } = req.body || {};
    if (!caseId || !fileName || !dataBase64) return res.status(400).json({ success: false, error: { code: "BAD_INPUT", message: "caseId, fileName, dataBase64 required" } });
    await proxy.readItem(req, caseId); // tenant owns case?
    const { tenantId } = getTenant(req);
    const { key, version } = await getKey(tenantId);
    const buffer = Buffer.from(dataBase64, "base64");
    const bundle = lockBuffer(key, buffer);
    const fileId = proxy.newId();
    const key_ = s3Key(tenantId, caseId, fileId);
    await putLocked(key_, Buffer.from(bundle.ciphertext, "base64"));
    const { ciphertext, ...rest } = bundle; // ciphertext lives in S3 only
    await FileMeta.create({ fileId, tenantId, caseId, fileName, mimeType, sizeBytes, s3Key: key_, keyVersion: version, encBundle: rest });
    res.status(201).json({ success: true, data: { id: fileId, tenantId, caseId, fileName, mimeType, sizeBytes, uploadDate: new Date().toISOString() } });
  } catch (e) { next(e); }
}

async function listFiles(req, res, next) {
  try {
    const { tenantId } = getTenant(req);
    const q = { tenantId };
    if (req.query.caseId) q.caseId = req.query.caseId;
    const rows = await FileMeta.find(q).sort({ createdAt: -1 });
    res.json({ success: true, data: rows.map((f) => ({ id: f.fileId, tenantId: f.tenantId, caseId: f.caseId, fileName: f.fileName, mimeType: f.mimeType, sizeBytes: f.sizeBytes, uploadDate: f.createdAt })) });
  } catch (e) { next(e); }
}

async function downloadFile(req, res, next) {
  try {
    const { tenantId } = getTenant(req);
    const meta = await FileMeta.findOne({ fileId: req.params.fileId, tenantId });
    if (!meta) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "File not found" } });
    assertTenant(req, meta.tenantId);
    const { getKeyByVersion } = require("../key-management/key-manager");
    const key = await getKeyByVersion(tenantId, meta.keyVersion);
    const cipherBytes = await getLocked(meta.s3Key);
    const bundle = { ...meta.encBundle, ciphertext: cipherBytes.toString("base64") };
    const plain = unlockBuffer(key, bundle);
    res.setHeader("Content-Type", meta.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${meta.fileName}"`);
    res.send(plain);
  } catch (e) { next(e); }
}

async function deleteFile(req, res, next) {
  try {
    const { tenantId } = getTenant(req);
    const meta = await FileMeta.findOne({ fileId: req.params.fileId, tenantId });
    if (!meta) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "File not found" } });
    try { await delLocked(meta.s3Key); } catch {}
    await FileMeta.deleteOne({ fileId: req.params.fileId, tenantId });
    res.json({ success: true, data: { ok: true } });
  } catch (e) { next(e); }
}

module.exports = { createCase, listCases, getCase, updateCase, deleteCase, createNote, listNotes, updateNote, deleteNote, uploadFile, listFiles, downloadFile, deleteFile };
