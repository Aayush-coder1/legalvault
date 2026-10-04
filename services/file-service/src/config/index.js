require("dotenv").config();

function need(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env: ${name} (see .env.example)`);
    process.exit(1);
  }
  return v;
}

module.exports = {
  port: Number(process.env.FILE_PORT || 4003),
  jwksUrl: process.env.JWKS_URL || "http://localhost:4001/auth/jwks.json",
  issuer: process.env.JWT_ISSUER || "legalvault-auth",
  audience: process.env.JWT_AUDIENCE || "legalvault-app",
  cryptoUrl: process.env.CRYPTO_PROXY_URL || "http://localhost:4004",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  // S3 settings live in crypto-proxy (only it touches S3). Kept here for docs parity.
  awsRegion: process.env.AWS_REGION || "",
  s3Bucket: process.env.S3_BUCKET || "",
};
