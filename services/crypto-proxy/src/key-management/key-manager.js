const crypto = require("crypto");
const TenantKey = require("./TenantKey");
const config = require("../config");

// Wrap tenant key with master key (so DB leak alone is not enough).
function wrap(raw32) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", config.masterKey, iv);
  const enc = Buffer.concat([c.update(raw32), c.final()]);
  return { enc: enc.toString("base64"), iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64") };
}

function unwrap(w) {
  const d = crypto.createDecipheriv("aes-256-gcm", config.masterKey, Buffer.from(w.iv, "base64"));
  d.setAuthTag(Buffer.from(w.tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(w.enc, "base64")), d.final()]);
}

function packWrapped(w) {
  return Buffer.from(JSON.stringify(w)).toString("base64");
}
function unpackWrapped(s) {
  return JSON.parse(Buffer.from(s, "base64").toString());
}

// Get latest key for tenant, create on first use.
async function getKey(tenantId) {
  let row = await TenantKey.findOne({ tenantId }).sort({ version: -1 });
  if (!row) {
    const raw = crypto.randomBytes(32);
    row = await TenantKey.create({ tenantId, version: 1, keyB64: packWrapped(wrap(raw)), status: "active" });
    return { key: raw, version: 1 };
  }
  const w = unpackWrapped(row.keyB64);
  return { key: unwrap(w), version: row.version };
}

async function getKeyByVersion(tenantId, version) {
  const row = await TenantKey.findOne({ tenantId, version });
  if (!row) throw new Error("Key version not found");
  return unwrap(unpackWrapped(row.keyB64));
}

async function createKey(tenantId) {
  return getKey(tenantId);
}

async function revokeKey(tenantId) {
  await TenantKey.updateMany({ tenantId }, { status: "old" });
}

module.exports = { getKey, getKeyByVersion, createKey, revokeKey };
