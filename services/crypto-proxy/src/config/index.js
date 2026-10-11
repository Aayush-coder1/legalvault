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

function masterKey() {
  const raw = need("CRYPTO_MASTER_KEY").trim();
  let buf;
  try {
    buf = Buffer.from(raw, "base64");
  } catch {
    console.error("CRYPTO_MASTER_KEY must be base64 (32 bytes)");
    process.exit(1);
  }
  if (buf.length !== 32) {
    console.error(`CRYPTO_MASTER_KEY must decode to 32 bytes (got ${buf.length})`);
    process.exit(1);
  }
  return buf;
}

module.exports = {
  port: Number(process.env.PORT || process.env.CRYPTO_PORT || 4004),
  mongoUri: need("MONGO_URI"),
  jwksUrl: process.env.JWKS_URL || "http://localhost:4001/auth/jwks.json",
  issuer: process.env.JWT_ISSUER || "legalvault-auth",
  audience: process.env.JWT_AUDIENCE || "legalvault-app",
  masterKey: masterKey(), // 32 bytes, validated
  // Backblaze B2 (S3-compatible). Endpoint looks like:
  // https://s3.us-west-004.backblazeb2.com  (see bucket's "S3 Endpoint" in B2 console)
  b2Endpoint: need("B2_ENDPOINT"),
  b2Region: process.env.B2_REGION || "us-east-1",
  b2KeyId: need("B2_KEY_ID"),
  b2AppKey: need("B2_APP_KEY"),
  b2Bucket: need("B2_BUCKET"),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
};
