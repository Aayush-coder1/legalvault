const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const config = require("../config");

// Sign short-lived access token (RS256). Payload has userId + tenantId.
function signAccessToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), tenantId: user.tenantId },
    config.privateKey,
    {
      algorithm: "RS256",
      keyid: config.kid,
      issuer: config.issuer,
      audience: config.audience,
      expiresIn: config.accessTtl,
    }
  );
}

// Verify access token strictly (alg, iss, aud, exp).
function verifyAccessToken(token) {
  return jwt.verify(token, config.publicKey, {
    algorithms: ["RS256"],
    issuer: config.issuer,
    audience: config.audience,
  });
}

// Opaque refresh token (stored hashed in DB).
function newRefreshToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Public key as JWK for JWKS endpoint.
function publicKeyToJwk() {
  const key = crypto.createPublicKey(config.publicKey);
  const jwk = key.export({ format: "jwk" });
  return { ...jwk, kid: config.kid, alg: "RS256", use: "sig" };
}

module.exports = { signAccessToken, verifyAccessToken, newRefreshToken, hashToken, publicKeyToJwk };
