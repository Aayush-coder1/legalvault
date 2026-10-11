const path = require("path");
// Load repo-root .env first (npm --prefix runs us from the service dir),
// then a local .env if present (fills only keys still missing).
require("dotenv").config({ path: path.join(__dirname, "..", "..", "..", "..", ".env") });
require("dotenv").config();

function need(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env: ${name} (see .env.example)`);
    process.exit(1);
  }
  return v;
}

// Normalize PEM stored with escaped \n in env
function pem(name) {
  return need(name).replace(/\\n/g, "\n");
}

// "7d" / "7" / 7 -> 7 (days). Falls back to `fb` on garbage like NaN.
function parseDays(v, fb) {
  if (v === undefined || v === null || v === "") return fb;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) && n > 0 ? n : fb;
}

function parseMs(v, fb) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fb;
}

const config = {
  port: Number(process.env.PORT || process.env.AUTH_PORT || 4001),
  mongoUri: need("MONGO_URI"),
  privateKey: pem("JWT_PRIVATE_KEY"),
  publicKey: pem("JWT_PUBLIC_KEY"),
  kid: process.env.JWT_KID || "legalvault-1",
  issuer: process.env.JWT_ISSUER || "legalvault-auth",
  audience: process.env.JWT_AUDIENCE || "legalvault-app",
  accessTtl: process.env.ACCESS_TTL || "15m",
  accessTtlMs: parseMs(process.env.ACCESS_TTL_MS, 15 * 60 * 1000),
  refreshTtlDays: parseDays(process.env.REFRESH_TTL_DAYS ?? process.env.REFRESH_TTL, 7),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
};

module.exports = config;
