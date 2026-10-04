const mongoose = require("mongoose");
const { getKey, getKeyByVersion } = require("../key-management/key-manager");
const { encrypt } = require("../encryption/encrypt");
const { decrypt } = require("../encryption/decrypt");
const { getTenant, assertTenant } = require("../tenants/tenant-manager");
const { EncryptedDoc } = require("./models");

// Save (create/update) a case or note: lock with tenant key, store locked only.
async function saveItem(req, kind, itemId, plain) {
  const { tenantId } = getTenant(req);
  const { key, version } = await getKey(tenantId);
  const bundle = encrypt(key, plain);
  const caseId = kind === "case" ? itemId : plain.caseId || req.params.caseId;
  await EncryptedDoc.findOneAndUpdate(
    { tenantId, itemId },
    { tenantId, caseId, kind, encryptedData: bundle, keyVersion: version },
    { upsert: true }
  );
  return { itemId, keyVersion: version };
}

async function readItem(req, itemId) {
  const { tenantId } = getTenant(req);
  const doc = await EncryptedDoc.findOne({ tenantId, itemId });
  if (!doc) throw Object.assign(new Error("Not found"), { status: 404 });
  assertTenant(req, doc.tenantId);
  const key = await getKeyByVersion(tenantId, doc.keyVersion);
  const plain = decrypt(key, doc.encryptedData);
  return { ...plain, id: doc.itemId, tenantId: doc.tenantId, keyVersion: doc.keyVersion };
}

async function listByKind(tenantId, kind, caseId) {
  const q = { tenantId, kind };
  if (caseId) q.caseId = caseId;
  const docs = await EncryptedDoc.find(q).sort({ updatedAt: -1 });
  const { getKeyByVersion: byVer } = require("../key-management/key-manager");
  const keyCache = {};
  const out = [];
  for (const doc of docs) {
    if (!keyCache[doc.keyVersion]) keyCache[doc.keyVersion] = await byVer(tenantId, doc.keyVersion);
    const plain = decrypt(keyCache[doc.keyVersion], doc.encryptedData);
    out.push({ ...plain, id: doc.itemId, tenantId: doc.tenantId, keyVersion: doc.keyVersion });
  }
  return out;
}

function newId() {
  return new mongoose.Types.ObjectId().toString();
}

module.exports = { saveItem, readItem, listByKind, newId };
