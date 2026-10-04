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

const config = {
  port: Number(process.env.AUTH_PORT || 4001),
  mongoUri: need("MONGO_URI"),
  privateKey: pem("JWT_PRIVATE_KEY"),
  publicKey: pem("JWT_PUBLIC_KEY"),
  kid: process.env.JWT_KID || "legalvault-1",
  issuer: process.env.JWT_ISSUER || "legalvault-auth",
  audience: process.env.JWT_AUDIENCE || "legalvault-app",
  accessTtl: process.env.ACCESS_TTL || "15m",
  refreshTtlDays: 7,
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
};

module.exports = config;
