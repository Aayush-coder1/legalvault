// Thin helpers over key-manager (kept as separate file per docs).
const manager = require("./key-manager");

async function tenantKey(tenantId) {
  return manager.getKey(tenantId);
}

module.exports = { tenantKey };
