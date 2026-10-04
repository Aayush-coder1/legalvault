const config = require("../config");
const { checkFile, sendToCrypto } = require("../services/file.service");

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
    const fake = { originalname: (title || "note") + ".txt", mimetype: "text/plain", size: Buffer.byteLength(text), buffer: Buffer.from(text) };
    checkFile(fake);
    const { status, data } = await sendToCrypto(req, { caseId, file: fake });
    return res.status(status).json(data);
  } catch (e) { next(e); }
}

async function forward(req, res, path, method = "GET") {
  const url = `${config.cryptoUrl}/crypto${path}`;
  const headers = {};
  if (req.auth?.token) headers.Authorization = `Bearer ${req.auth.token}`;
  if (req.headers.cookie) headers.Cookie = req.headers.cookie;
  const r = await fetch(url, { method, headers });
  if (path.includes("/download")) {
    // stream decrypted bytes back
    const buf = Buffer.from(await r.arrayBuffer());
    const ct = r.headers.get("content-type") || "application/octet-stream";
    const cd = r.headers.get("content-disposition") || "attachment";
    if (!r.ok) return res.status(r.status).json({ success: false, error: { code: "DL_FAIL", message: "Download failed" } });
    res.setHeader("Content-Type", ct);
    res.setHeader("Content-Disposition", cd);
    return res.send(buf);
  }
  const data = await r.json().catch(() => ({ success: false, error: { code: "PROXY_FAIL", message: "crypto-proxy error" } }));
  return res.status(r.status).json(data);
}

async function listByCase(req, res) {
  const q = req.query.caseId ? `?caseId=${encodeURIComponent(req.query.caseId)}` : "";
  return forward(req, res, `/files${q}`, "GET");
}
async function download(req, res) { return forward(req, res, `/files/${req.params.fileId}/download`, "GET"); }
async function remove(req, res) {
  const url = `${config.cryptoUrl}/crypto/files/${req.params.fileId}`;
  const headers = {};
  if (req.auth?.token) headers.Authorization = `Bearer ${req.auth.token}`;
  if (req.headers.cookie) headers.Cookie = req.headers.cookie;
  const r = await fetch(url, { method: "DELETE", headers });
  const data = await r.json().catch(() => ({ success: false, error: { code: "PROXY_FAIL", message: "crypto-proxy error" } }));
  return res.status(r.status).json(data);
}

module.exports = { upload, uploadNote, listByCase, download, remove };
