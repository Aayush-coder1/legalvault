const mongoose = require("mongoose");

// One row per tenant key version. Old versions stay readable for rotation.
const tenantKeySchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    version: { type: Number, required: true },
    keyB64: { type: String, required: true }, // wrapped with master key in key-manager
    status: { type: String, default: "active" }, // active | old
  },
  { timestamps: true }
);
tenantKeySchema.index({ tenantId: 1, version: 1 }, { unique: true });

module.exports = mongoose.model("TenantKey", tenantKeySchema);
