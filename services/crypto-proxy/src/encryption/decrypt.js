// Reverse of encrypt.js
function decrypt(tenantKey, bundle) {
  const crypto = require("crypto");
  if (!bundle || typeof bundle.ciphertext !== "string" || typeof bundle.iv !== "string" || typeof bundle.tag !== "string") {
    const e = new Error("Corrupt record");
    e.status = 422;
    throw e;
  }
  const d = crypto.createDecipheriv("aes-256-gcm", tenantKey, Buffer.from(bundle.iv, "base64"), { authTagLength: 16 });
  d.setAuthTag(Buffer.from(bundle.tag, "base64"));
  const text = Buffer.concat([d.update(Buffer.from(bundle.ciphertext, "base64")), d.final()]).toString("utf8");
  return JSON.parse(text);
}

module.exports = { decrypt };
