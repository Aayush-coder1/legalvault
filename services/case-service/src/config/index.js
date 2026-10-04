const path = require("path");
// Load repo-root .env first (npm --prefix runs us from the service dir),
// then a local .env if present (fills only keys still missing).
require("dotenv").config({ path: path.join(__dirname, "..", "..", "..", "..", ".env") });
require("dotenv").config();

function need(name) {
  const v = process.env[name];
  if (!v && name === "MONGO_URI") return ""; // case-service uses crypto-proxy for storage; mongo optional
  if (!v) {
    console.error(`Missing env: ${name} (see .env.example)`);
    process.exit(1);
  }
  return v;
}

module.exports = {
  port: Number(process.env.CASE_PORT || 4002),
  jwksUrl: process.env.JWKS_URL || "http://localhost:4001/auth/jwks.json",
  issuer: process.env.JWT_ISSUER || "legalvault-auth",
  audience: process.env.JWT_AUDIENCE || "legalvault-app",
  cryptoUrl: process.env.CRYPTO_PROXY_URL || "http://localhost:4004",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
};
