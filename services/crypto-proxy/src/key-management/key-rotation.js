const crypto = require("crypto");
const TenantKey = require("./TenantKey");
const { getKey, wrap, packWrapped, invalidateTenant } = require("./key-manager");

// Rotation: new writes use v+1, old data still opens with old version.
async function rotateKey(tenantId) {
  const latest = await getKey(tenantId);
  const raw = crypto.randomBytes(32);
  // mark old as old
  await TenantKey.updateMany({ tenantId }, { status: "old" });
  try {
    const row = await TenantKey.create({ tenantId, version: latest.version + 1, keyB64: packWrapped(wrap(raw)), status: "active" });
    invalidateTenant(tenantId);
    return { version: row.version };
  } catch (e) {
    if (e && e.code === 11000) {
      // Concurrent rotation won — return the winner instead of 500.
      const winner = await getKey(tenantId);
      invalidateTenant(tenantId);
      return { version: winner.version };
    }
    throw e;
  }
}

module.exports = { rotateKey };
