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

async function listByKind(tenantId, kind, caseId, opts = {}) {
  const limit = Math.min(Math.max(Number(opts.limit) || 50, 1), 100);
  const q = { tenantId, kind };
  if (caseId) q.caseId = caseId;
  if (opts.cursor) {
    const d = new Date(opts.cursor);
    if (!Number.isNaN(d.getTime())) q.updatedAt = { $lt: d };
  }
  if (opts.search && kind === "case") {
    // Encrypted bodies can't be searched server-side; search by recency window.
    // Client filters decrypted titles; limit keeps the decrypt-all loop bounded.
  }
  const docs = await EncryptedDoc.find(q, { encryptedData: 1, itemId: 1, tenantId: 1, keyVersion: 1, updatedAt: 1, caseId: 1 })
    .sort({ updatedAt: -1 })
    .limit(limit + 1)
    .lean();
  const { getKeyByVersion: byVer } = require("../key-management/key-manager");
  const keyCache = {};
  const out = [];
  const page = docs.slice(0, limit);
  for (const doc of page) {
    let bundle = doc.encryptedData;
    if (!bundle || !bundle.ciphertext || !bundle.iv || !bundle.tag) {
      const e = new Error("Corrupt record");
      e.status = 422;
      throw e;
    }
    if (!keyCache[doc.keyVersion]) keyCache[doc.keyVersion] = await byVer(tenantId, doc.keyVersion);
    const plain = decrypt(keyCache[doc.keyVersion], doc.encryptedData);
    out.push({ ...plain, id: doc.itemId, tenantId: doc.tenantId, keyVersion: doc.keyVersion });
  }
  const nextCursor = docs.length > limit ? page[page.length - 1].updatedAt.toISOString() : null;
  return { items: out, nextCursor };
}

function newId() {
  return new mongoose.Types.ObjectId().toString();
}

module.exports = { saveItem, readItem, listByKind, newId };
