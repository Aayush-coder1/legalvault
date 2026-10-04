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
  port: Number(process.env.CRYPTO_PORT || 4004),
  mongoUri: need("MONGO_URI"),
  jwksUrl: process.env.JWKS_URL || "http://localhost:4001/auth/jwks.json",
  issuer: process.env.JWT_ISSUER || "legalvault-auth",
  audience: process.env.JWT_AUDIENCE || "legalvault-app",
  masterKey: Buffer.from(need("CRYPTO_MASTER_KEY"), "base64"), // 32 bytes
  awsRegion: need("AWS_REGION"),
  s3Bucket: need("S3_BUCKET"),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
};
