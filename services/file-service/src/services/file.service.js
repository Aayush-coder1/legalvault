const config = require("../config");

// File rules: type + size + no empty + safe name.
const ALLOWED = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
  "text/plain",
];
const MAX_BYTES = 25 * 1024 * 1024;

function checkFile(file) {
  if (!file || file.size === 0) throw Object.assign(new Error("Empty file"), { status: 400 });
  if (file.size > MAX_BYTES) throw Object.assign(new Error("File too big (max 25MB)"), { status: 400 });
  if (!ALLOWED.includes(file.mimetype)) throw Object.assign(new Error("File type not allowed"), { status: 400 });
  if (file.originalname.includes("..") || file.originalname.includes("/")) {
    throw Object.assign(new Error("Bad file name"), { status: 400 });
  }
}

// Forward to crypto-proxy (it locks the file then puts it in S3).
async function sendToCrypto(req, { caseId, file }) {
  const url = `${config.cryptoUrl}/crypto/files/upload`;
  const headers = { "Content-Type": "application/json" };
  if (req.auth?.token) headers.Authorization = `Bearer ${req.auth.token}`;
  if (req.headers.cookie) headers.Cookie = req.headers.cookie;
  const r = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      caseId,
      fileName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      dataBase64: file.buffer.toString("base64"),
    }),
  });
  const data = await r.json().catch(() => ({ success: false, error: { code: "PROXY_FAIL", message: "crypto-proxy error" } }));
  return { status: r.status, data };
}

module.exports = { checkFile, sendToCrypto };
