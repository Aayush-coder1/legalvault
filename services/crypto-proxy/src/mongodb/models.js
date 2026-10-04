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

const fileMetaSchema = new mongoose.Schema(
  {
    fileId: { type: String, required: true, unique: true },
    tenantId: { type: String, required: true, index: true },
    caseId: { type: String, required: true, index: true },
    fileName: String,
    mimeType: String,
    sizeBytes: Number,
    s3Key: String, // tenantId/caseId/fileId
    keyVersion: Number,
    encBundle: Object, // envelope bundle WITHOUT ciphertext (ciphertext lives in S3)
  },
  { timestamps: true }
);

const EncryptedDoc = mongoose.model("EncryptedDoc", docSchema);
const FileMeta = mongoose.model("FileMeta", fileMetaSchema);

module.exports = { EncryptedDoc, FileMeta };
