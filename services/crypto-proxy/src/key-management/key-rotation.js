const crypto = require("crypto");
const TenantKey = require("./TenantKey");
const { getKey } = require("./key-manager");

// Rotation: new writes use v+1, old data still opens with old version.
async function rotateKey(tenantId) {
  const latest = await getKey(tenantId);
  const raw = crypto.randomBytes(32);
  // reuse wrap from key-manager by re-creating via create (simple: store raw wrapped same way)
  const keyManager = require("./key-manager");
  // mark old as old
  await TenantKey.updateMany({ tenantId }, { status: "old" });
  const wrap = packOf(raw);
  const row = await TenantKey.create({ tenantId, version: latest.version + 1, keyB64: wrap, status: "active" });
  return { version: row.version };
}

function packOf(raw) {
  // keep in same wrapped format as key-manager (duplicate tiny logic to stay simple)
  const config = require("../config");
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", config.masterKey, iv);
  const enc = Buffer.concat([c.update(raw), c.final()]);
  const w = { enc: enc.toString("base64"), iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64") };
  return Buffer.from(JSON.stringify(w)).toString("base64");
}

module.exports = { rotateKey };
