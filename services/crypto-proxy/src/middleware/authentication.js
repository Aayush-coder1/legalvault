const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const config = require("../config");

// Cache public key from auth-service JWKS (simple, refresh every 10 min).
let cached = { pem: null, kid: null, at: 0 };

async function getPublicKey() {
  if (cached.pem && Date.now() - cached.at < 10 * 60 * 1000) return cached;
  const res = await fetch(config.jwksUrl);
  if (!res.ok) throw new Error("Cannot fetch JWKS");
  const { keys } = await res.json();
  const jwk = keys[0];
  const pem = crypto.createPublicKey({ key: jwk, format: "jwk" }).export({ format: "pem", type: "spki" });
  cached = { pem, kid: jwk.kid, at: Date.now() };
  return cached;
}

// Checks signature + exp + iss + aud + alg=RS256. No JWT = no access.
async function authentication(req, res, next) {
  try {
    const token = req.cookies?.accessToken || (req.headers.authorization || "").replace("Bearer ", "");
    if (!token) return res.status(401).json({ success: false, error: { code: "NO_TOKEN", message: "Login required" } });
    const { pem } = await getPublicKey();
    const payload = jwt.verify(token, pem, {
      algorithms: ["RS256"],
      issuer: config.issuer,
      audience: config.audience,
    });
    req.auth = { userId: payload.userId, tenantId: payload.tenantId };
    next();
  } catch {
    return res.status(401).json({ success: false, error: { code: "BAD_TOKEN", message: "Invalid or expired token" } });
  }
}

module.exports = authentication;
