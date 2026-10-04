const crypto = require("crypto");

// Lock small JSON (cases, notes) directly with tenant key (AES-256-GCM).
function encrypt(tenantKey, obj) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", tenantKey, iv);
  const text = JSON.stringify(obj);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return {
    ciphertext: enc.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

module.exports = { encrypt };
