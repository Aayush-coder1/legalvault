const path = require("path");
// Load repo-root .env first (npm --prefix runs us from the service dir),
// then a local .env if present (fills only keys still missing).
require("dotenv").config({ path: path.join(__dirname, "..", "..", "..", "..", ".env") });
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
  port: Number(process.env.PORT || process.env.GATEWAY_PORT || 4000),
  mongoUri: process.env.MONGO_URI || "",
  authUrl: (process.env.AUTH_URL || "http://localhost:4001").replace(/\/$/, ""),
  caseUrl: (process.env.CASE_URL || "http://localhost:4002").replace(/\/$/, ""),
  fileUrl: (process.env.FILE_URL || "http://localhost:4003").replace(/\/$/, ""),
  // Only used to read crypto-proxy's telemetry (the gateway never proxies to it).
  cryptoUrl: (process.env.CRYPTO_PROXY_URL || "http://localhost:4004").replace(/\/$/, ""),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  timeoutMs: Number(process.env.GATEWAY_TIMEOUT_MS || 30000),
  bodyLimit: Number(process.env.GATEWAY_BODY_LIMIT_MB || 30) * 1024 * 1024,
  telemetry: {
    // Read upstream buffers this often while at least one dashboard is open.
    pollMs: Math.max(250, Number(process.env.TELEMETRY_POLL_MS || 1000)),
    // Sliding window for p50/p95/p99 + error rates.
    windowMs: Math.max(10000, Number(process.env.TELEMETRY_WINDOW_MS || 60000)),
    // Live stream requires a logged-in LegalVault user (verified via auth /auth/me).
    requireAuth: process.env.TELEMETRY_REQUIRE_AUTH !== "false",
    maxClients: Math.max(1, Number(process.env.TELEMETRY_MAX_CLIENTS || 25)),
    token: process.env.TELEMETRY_TOKEN || "",
    // Persist telemetry events to MongoDB (telemetry_events collection, 7-day TTL).
    mongoStore: process.env.TELEMETRY_MONGO_STORE !== "false",
  },
};
