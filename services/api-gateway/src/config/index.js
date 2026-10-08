const path = require("path");
// Load repo-root .env first (npm --prefix runs us from the service dir),
// then a local .env if present (fills only keys still missing).
require("dotenv").config({ path: path.join(__dirname, "..", "..", "..", ".env") });
require("dotenv").config();

function need(name, fallback) {
  const v = process.env[name] || fallback;
  if (!v) {
    console.error(`Missing env: ${name} (see .env.example)`);
    process.exit(1);
  }
  return v;
}

module.exports = {
  port: Number(process.env.GATEWAY_PORT || 4000),
  authUrl: (process.env.AUTH_URL || "http://localhost:4001").replace(/\/$/, ""),
  caseUrl: (process.env.CASE_URL || "http://localhost:4002").replace(/\/$/, ""),
  fileUrl: (process.env.FILE_URL || "http://localhost:4003").replace(/\/$/, ""),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  timeoutMs: Number(process.env.GATEWAY_TIMEOUT_MS || 30000),
  bodyLimit: Number(process.env.GATEWAY_BODY_LIMIT_MB || 30) * 1024 * 1024,
};
