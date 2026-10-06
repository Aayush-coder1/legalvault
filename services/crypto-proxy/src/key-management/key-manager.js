const crypto = require("crypto");
const TenantKey = require("./TenantKey");
const config = require("../config");

// Wrap tenant key with master key (so DB leak alone is not enough).
function wrap(raw32) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", config.masterKey, iv, { authTagLength: 16 });
  const enc = Buffer.concat([c.update(raw32), c.final()]);
  return { enc: enc.toString("base64"), iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64") };
}

function unwrap(w) {
  const d = crypto.createDecipheriv("aes-256-gcm", config.masterKey, Buffer.from(w.iv, "base64"), { authTagLength: 16 });
  d.setAuthTag(Buffer.from(w.tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(w.enc, "base64")), d.final()]);
}

function packWrapped(w) {
  return Buffer.from(JSON.stringify(w)).toString("base64");
}
function unpackWrapped(s) {
  return JSON.parse(Buffer.from(s, "base64").toString());
}

// Short-lived in-process key cache (perf). Invalidated on rotate.
const KEY_CACHE_TTL = 5 * 60 * 1000;
const KEY_CACHE_MAX = 500;
const keyCache = new Map(); // `${tenantId}:${version|latest}` -> { key, version, at }
function cacheGet(k) {
  const e = keyCache.get(k);
  if (!e) return null;
  if (Date.now() - e.at > KEY_CACHE_TTL) { keyCache.delete(k); return null; }
  return e;
}
function cacheSet(k, v) {
  if (keyCache.size >= KEY_CACHE_MAX) {
    const oldest = keyCache.keys().next().value;
    keyCache.delete(oldest);
  }
  keyCache.set(k, { ...v, at: Date.now() });
}
function invalidateTenant(tenantId) {
  for (const k of keyCache.keys()) {
    if (k === tenantId || k.startsWith(tenantId + ":")) keyCache.delete(k);
  }
}

// Get latest key for tenant, create on first use (race-safe via unique index + retry).
async function getKey(tenantId) {
  const hit = cacheGet(tenantId);
  if (hit) return { key: hit.key, version: hit.version };
  let row = await TenantKey.findOne({ tenantId }).sort({ version: -1 });
  if (!row) {
    const raw = crypto.randomBytes(32);
    const packed = packWrapped(wrap(raw));
    try {
      row = await TenantKey.create({ tenantId, version: 1, keyB64: packed, status: "active" });
      cacheSet(tenantId, { key: raw, version: 1 });
      cacheSet(`${tenantId}:1`, { key: raw, version: 1 });
      return { key: raw, version: 1 };
    } catch (e) {
      if (!(e && e.code === 11000)) throw e;
      row = await TenantKey.findOne({ tenantId }).sort({ version: -1 });
    }
    // Another process won the race — fall through to read what won.
  }
  const ck = `${tenantId}:${row.version}`;
  const vhit = cacheGet(ck);
  if (vhit) {
    cacheSet(tenantId, { key: vhit.key, version: row.version });
    return { key: vhit.key, version: row.version };
  }
  const w = unpackWrapped(row.keyB64);
  const key = unwrap(w);
  cacheSet(ck, { key, version: row.version });
  cacheSet(tenantId, { key, version: row.version });
  return { key, version: row.version };
}

async function getKeyByVersion(tenantId, version) {
  const ck = `${tenantId}:${version}`;
  const hit = cacheGet(ck);
  if (hit) return hit.key;
  const row = await TenantKey.findOne({ tenantId, version });
  if (!row) {
    const err = new Error("Key version not found");
    err.status = 404;
    throw err;
  }
  const key = unwrap(unpackWrapped(row.keyB64));
  cacheSet(ck, { key, version });
  return key;
}

async function createKey(tenantId) {
  return getKey(tenantId);
}

async function revokeKey(tenantId) {
  await TenantKey.updateMany({ tenantId }, { status: "old" });
}

module.exports = { getKey, getKeyByVersion, createKey, revokeKey, invalidateTenant, wrap, packWrapped };
