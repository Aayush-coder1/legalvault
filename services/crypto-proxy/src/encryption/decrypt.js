// Reverse of encrypt.js
function decrypt(tenantKey, bundle) {
  const crypto = require("crypto");
  const d = crypto.createDecipheriv("aes-256-gcm", tenantKey, Buffer.from(bundle.iv, "base64"));
  d.setAuthTag(Buffer.from(bundle.tag, "base64"));
  const text = Buffer.concat([d.update(Buffer.from(bundle.ciphertext, "base64")), d.final()]).toString("utf8");
  return JSON.parse(text);
}

module.exports = { decrypt };
