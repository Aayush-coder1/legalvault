const crypto = require("crypto");

// Envelope encryption for files: random DEK per file, DEK locked by tenant key.
// Master/tenant key is used less, each file has own key.
function lockBuffer(tenantKey, buffer) {
  const dek = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", dek, iv, { authTagLength: 16 });
  const ciphertext = Buffer.concat([c.update(buffer), c.final()]);

  const dekIv = crypto.randomBytes(12);
  const kc = crypto.createCipheriv("aes-256-gcm", tenantKey, dekIv, { authTagLength: 16 });
  const encDek = Buffer.concat([kc.update(dek), kc.final()]);
  dek.fill(0);

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
  if (!bundle || !bundle.dekIv || !bundle.dekTag || !bundle.encDek || !bundle.iv || !bundle.tag || !bundle.ciphertext) {
    const e = new Error("Corrupt file bundle");
    e.status = 422;
    throw e;
  }
  const kd = crypto.createDecipheriv("aes-256-gcm", tenantKey, Buffer.from(bundle.dekIv, "base64"), { authTagLength: 16 });
  kd.setAuthTag(Buffer.from(bundle.dekTag, "base64"));
  const dek = Buffer.concat([kd.update(Buffer.from(bundle.encDek, "base64")), kd.final()]);
  const d = crypto.createDecipheriv("aes-256-gcm", dek, Buffer.from(bundle.iv, "base64"), { authTagLength: 16 });
  d.setAuthTag(Buffer.from(bundle.tag, "base64"));
  const out = Buffer.concat([d.update(Buffer.from(bundle.ciphertext, "base64")), d.final()]);
  dek.fill(0);
  return out;
}

module.exports = { lockBuffer, unlockBuffer };
