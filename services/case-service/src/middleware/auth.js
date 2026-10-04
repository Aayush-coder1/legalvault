const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const config = require("../config");

let cached = { pem: null, at: 0 };

async function getKey() {
  if (cached.pem && Date.now() - cached.at < 10 * 60 * 1000) return cached.pem;
  const res = await fetch(config.jwksUrl);
  const { keys } = await res.json();
  const pem = crypto.createPublicKey({ key: keys[0], format: "jwk" }).export({ format: "pem", type: "spki" });
  cached = { pem, at: Date.now() };
  return pem;
}

// Verify JWT (sig + exp + iss + aud + RS256). Tenant comes from token, not body.
async function verifyJwt(req, res, next) {
  try {
    const token = req.cookies?.accessToken || (req.headers.authorization || "").replace("Bearer ", "");
    if (!token) return res.status(401).json({ success: false, error: { code: "NO_TOKEN", message: "Login required" } });
    const pem = await getKey();
    const p = jwt.verify(token, pem, { algorithms: ["RS256"], issuer: config.issuer, audience: config.audience });
    req.auth = { userId: p.userId, tenantId: p.tenantId, token };
    next();
  } catch {
    return res.status(401).json({ success: false, error: { code: "BAD_TOKEN", message: "Invalid or expired token" } });
  }
}

module.exports = verifyJwt;
