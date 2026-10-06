const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const config = require("../config");
const { fetchWithTimeout } = require("../utils/fetch");

const CACHE_TTL_MS = 10 * 60 * 1000;
const NEG_TTL_MS = 30 * 1000;

let cache = { byKid: new Map(), at: 0, negAt: 0 };
let inflight = null;

async function refreshKeys() {
  if (inflight) return inflight;
  inflight = (async () => {
    const res = await fetchWithTimeout(config.jwksUrl, {}, 5000);
    if (!res.ok) throw new Error(`JWKS fetch failed (${res.status})`);
    const body = await res.json().catch(() => null);
    const keys = body && Array.isArray(body.keys) ? body.keys : null;
    if (!keys || keys.length === 0) throw new Error("JWKS empty");
    const byKid = new Map();
    for (const jwk of keys) {
      const pem = crypto.createPublicKey({ key: jwk, format: "jwk" }).export({ format: "pem", type: "spki" });
      if (jwk.kid) byKid.set(jwk.kid, pem);
      if (!byKid.has("__default")) byKid.set("__default", pem);
    }
    cache = { byKid, at: Date.now(), negAt: 0 };
    return cache;
  })();
  try {
    return await inflight;
  } catch (e) {
    cache.negAt = Date.now();
    throw e;
  } finally {
    inflight = null;
  }
}

async function getKey(kid) {
  const fresh = Date.now() - cache.at < CACHE_TTL_MS;
  if (fresh && cache.byKid.size > 0) {
    if (kid && cache.byKid.has(kid)) return cache.byKid.get(kid);
    if (!kid) return cache.byKid.get("__default");
  } else if (Date.now() - cache.negAt < NEG_TTL_MS && cache.byKid.size > 0) {
    const hit = (kid && cache.byKid.get(kid)) || cache.byKid.get("__default");
    if (hit) return hit;
  }
  const c = await refreshKeys();
  if (kid && c.byKid.has(kid)) return c.byKid.get(kid);
  if (!kid) return c.byKid.get("__default");
  throw new Error("JWKS key id not found");
}

function extractToken(req) {
  if (req.cookies && req.cookies.accessToken) return req.cookies.accessToken;
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (m) return m[1].trim();
  return "";
}

// Verify JWT (sig + exp + iss + aud + RS256). Tenant comes from token, not body.
async function verifyJwt(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ success: false, error: { code: "NO_TOKEN", message: "Login required" } });
    const decoded = jwt.decode(token, { complete: true });
    const pem = await getKey(decoded && decoded.header && decoded.header.kid);
    const p = jwt.verify(token, pem, { algorithms: ["RS256"], issuer: config.issuer, audience: config.audience });
    req.auth = { userId: p.userId, tenantId: p.tenantId, token };
    next();
  } catch (e) {
    const expired = e && e.name === "TokenExpiredError";
    return res.status(401).json({
      success: false,
      error: { code: expired ? "TOKEN_EXPIRED" : "BAD_TOKEN", message: expired ? "Session expired, please refresh" : "Invalid or expired token" },
    });
  }
}

module.exports = verifyJwt;
