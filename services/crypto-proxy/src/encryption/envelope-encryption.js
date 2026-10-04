const crypto = require("crypto");

// Envelope encryption for files: random DEK per file, DEK locked by tenant key.
// Master/tenant key is used less, each file has own key.
function lockBuffer(tenantKey, buffer) {
  const dek = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", dek, iv);
  const ciphertext = Buffer.concat([c.update(buffer), c.final()]);

  const dekIv = crypto.randomBytes(12);
  const kc = crypto.createCipheriv("aes-256-gcm", tenantKey, dekIv);
  const encDek = Buffer.concat([kc.update(dek), kc.final()]);

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: c.getAuthTag().toString("base64"),
    encDek: encDek.toString("base64"),
    dekIv: dekIv.toString("base64"),
    dekTag: kc.getAuthTag().toString("base64"),
  };
}

function unlockBuffer(tenantKey, bundle) {
  const kd = crypto.createDecipheriv("aes-256-gcm", tenantKey, Buffer.from(bundle.dekIv, "base64"));
  kd.setAuthTag(Buffer.from(bundle.dekTag, "base64"));
  const dek = Buffer.concat([kd.update(Buffer.from(bundle.encDek, "base64")), kd.final()]);
  const d = crypto.createDecipheriv("aes-256-gcm", dek, Buffer.from(bundle.iv, "base64"));
  d.setAuthTag(Buffer.from(bundle.tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(bundle.ciphertext, "base64")), d.final()]);
}

module.exports = { lockBuffer, unlockBuffer };
