const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true },
    tenantId: { type: String, required: true, index: true },
    refreshTokens: [{ _id: false, tokenHash: String, expiresAt: Date }],
  },
  { timestamps: true }
);
userSchema.index({ "refreshTokens.tokenHash": 1 });

// Drop expired sessions on save so the array never grows stale.
userSchema.pre("save", function dropExpired(next) {
  if (Array.isArray(this.refreshTokens)) {
    const now = new Date();
    this.refreshTokens = this.refreshTokens.filter((r) => r.expiresAt && r.expiresAt > now).slice(-5);
  }
  next();
});

module.exports = mongoose.model("User", userSchema);
