const config = require("../config");
const { checkFile, sendToCrypto } = require("../services/file.service");
const { fetchWithTimeout, readJsonSafe } = require("../utils/fetch");

const ID_RE = /^[A-Za-z0-9_-]{6,64}$/;
const MAX_NOTE_CHARS = 20000;

async function upload(req, res, next) {
  try {
    const file = req.file;
    const { caseId } = req.body || {};
    if (!caseId) return res.status(400).json({ success: false, error: { code: "BAD_INPUT", message: "caseId required" } });
    checkFile(file);
    const { status, data } = await sendToCrypto(req, { caseId, file });
    return res.status(status).json(data);
  } catch (e) { next(e); }
}

// Create text note as a file (mime text/plain) — goes through same lock+S3 path.
async function uploadNote(req, res, next) {
  try {
    const { caseId, text, title } = req.body || {};
    if (!caseId || !text) return res.status(400).json({ success: false, error: { code: "BAD_INPUT", message: "caseId, text required" } });
    if (typeof text !== "string" || text.length > MAX_NOTE_CHARS) {
      return res.status(400).json({ success: false, error: { code: "BAD_INPUT", message: `text max ${MAX_NOTE_CHARS} chars` } });
    }
    const safeTitle = String(title || "note").slice(0, 120).replace(/[\r\n"/\\]/g, "");
    const fake = { originalname: safeTitle + ".txt", mimetype: "text/plain", size: Buffer.byteLength(text), buffer: Buffer.from(text) };
    checkFile(fake);
    const { status, data } = await sendToCrypto(req, { caseId, file: fake });
    return res.status(status).json(data);
  } catch (e) { next(e); }
}

async function proxyFetch(req, url, method) {
  const headers = { "x-request-id": req.requestId || "" };
  if (req.auth?.token) headers.Authorization = `Bearer ${req.auth.token}`;
  if (req.headers.cookie) headers.Cookie = req.headers.cookie;
  if (req.headers["idempotency-key"]) headers["idempotency-key"] = String(req.headers["idempotency-key"]).slice(0, 128);
  try {
    return await fetchWithTimeout(url, { method, headers }, method === "GET" ? 30000 : 15000);
  } catch (e) {
    return { __timeout: true, status: e.status || 502, err: e };
  }
}

async function forward(req, res, path, method = "GET") {
  const url = `${config.cryptoUrl}/crypto${path}`;
  const r = await proxyFetch(req, url, method);
  if (r.__timeout) {
    return res.status(r.status).json({ success: false, error: { code: r.err.code || "PROXY_UNREACHABLE", message: "crypto-proxy unavailable, try again" } });
  }
  if (path.includes("/download")) {
    if (!r.ok) {
      await r.arrayBuffer().catch(() => null);
      const code = r.status === 404 ? "NOT_FOUND" : "DL_FAIL";
      return res.status(r.status).json({ success: false, error: { code, message: code === "NOT_FOUND" ? "File not found" : "Download failed" } });
    }
    // Stream bytes through without double-buffer surprises on errors above.
    const buf = Buffer.from(await r.arrayBuffer());
    const ct = r.headers.get("content-type") || "application/octet-stream";
    const cd = r.headers.get("content-disposition") || "attachment";
    res.setHeader("Content-Type", ct);
    res.setHeader("Content-Disposition", cd);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Length", buf.length);
    return res.send(buf);
  }
  const data = await readJsonSafe(r, { success: false, error: { code: "PROXY_FAIL", message: "crypto-proxy error" } });
  return res.status(r.status).json(data);
}

async function listByCase(req, res) {
  const params = [];
  if (req.query.caseId) params.push(`caseId=${encodeURIComponent(req.query.caseId)}`);
  for (const k of ["limit", "cursor"]) {
    if (req.query[k] !== undefined && req.query[k] !== "") params.push(`${k}=${encodeURIComponent(String(req.query[k]))}`);
  }
  const q = params.length ? `?${params.join("&")}` : "";
  return forward(req, res, `/files${q}`, "GET");
}
async function counts(req, res) {
  const q = req.query.caseIds ? `?caseIds=${encodeURIComponent(String(req.query.caseIds))}` : "";
  return forward(req, res, `/files/counts${q}`, "GET");
}
async function download(req, res) {
  if (!ID_RE.test(req.params.fileId || "")) {
    return res.status(400).json({ success: false, error: { code: "BAD_ID", message: "Invalid id" } });
  }
  return forward(req, res, `/files/${encodeURIComponent(req.params.fileId)}/download`, "GET");
}
async function remove(req, res) {
  if (!ID_RE.test(req.params.fileId || "")) {
    return res.status(400).json({ success: false, error: { code: "BAD_ID", message: "Invalid id" } });
  }
  const url = `${config.cryptoUrl}/crypto/files/${encodeURIComponent(req.params.fileId)}`;
  const r = await proxyFetch(req, url, "DELETE");
  if (r.__timeout) {
    return res.status(r.status).json({ success: false, error: { code: r.err.code || "PROXY_UNREACHABLE", message: "crypto-proxy unavailable, try again" } });
  }
  const data = await readJsonSafe(r, { success: false, error: { code: "PROXY_FAIL", message: "crypto-proxy error" } });
  return res.status(r.status).json(data);
}

module.exports = { upload, uploadNote, listByCase, counts, download, remove };
