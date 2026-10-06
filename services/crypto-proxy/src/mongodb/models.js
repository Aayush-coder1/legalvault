const mongoose = require("mongoose");

// MongoDB only sees locked data + tenantId + caseId + keyVersion.
const docSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    caseId: { type: String, index: true }, // set for notes; for cases = itemId
    itemId: { type: String, required: true },
    kind: { type: String, required: true }, // case | note
    encryptedData: { type: Object, required: true }, // {ciphertext,iv,tag}
    keyVersion: { type: Number, required: true },
  },
  { timestamps: true }
);
docSchema.index({ tenantId: 1, itemId: 1 }, { unique: true });
docSchema.index({ tenantId: 1, kind: 1, updatedAt: -1 });
docSchema.index({ tenantId: 1, kind: 1, caseId: 1, updatedAt: -1 });

const fileMetaSchema = new mongoose.Schema(
  {
    fileId: { type: String, required: true, unique: true },
    tenantId: { type: String, required: true, index: true },
    caseId: { type: String, required: true, index: true },
    fileName: String,
    mimeType: String,
    sizeBytes: Number,
    sha256: String, // integrity link between S3 bytes and metadata
    s3Key: String, // tenantId/caseId/fileId
    keyVersion: Number,
    encBundle: Object, // envelope bundle WITHOUT ciphertext (ciphertext lives in S3)
  },
  { timestamps: true }
);
fileMetaSchema.index({ tenantId: 1, caseId: 1, createdAt: -1 });

// Idempotency: retry-safe creates (client sends Idempotency-Key header).
const idemSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true },
    key: { type: String, required: true },
    itemId: { type: String, required: true },
    kind: { type: String, required: true },
  },
  { timestamps: true }
);
idemSchema.index({ tenantId: 1, key: 1 }, { unique: true });
idemSchema.index({ createdAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

const EncryptedDoc = mongoose.model("EncryptedDoc", docSchema);
const FileMeta = mongoose.model("FileMeta", fileMetaSchema);
const Idempotency = mongoose.model("Idempotency", idemSchema);

module.exports = { EncryptedDoc, FileMeta, Idempotency };
