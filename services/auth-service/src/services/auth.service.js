const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../models/User");
const { signAccessToken, newRefreshToken, hashToken } = require("./token.service");
const config = require("../config");

function cookieOpts(ms) {
  const secure = process.env.NODE_ENV === "production";
  return { httpOnly: true, secure, sameSite: "lax", maxAge: ms, path: "/" };
}

function normEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function signup({ name, email, password }) {
  const cleanEmail = normEmail(email);
  const cleanName = String(name || "").trim().slice(0, 120);
  const exists = await User.findOne({ email: cleanEmail });
  if (exists) throw Object.assign(new Error("Email already used"), { status: 409 });
  const passwordHash = await bcrypt.hash(password, 10);
  // Each signup = own tenant (law firm). Simple rule.
  const tenantId = new mongoose.Types.ObjectId().toString();
  const user = await User.create({ name: cleanName, email: cleanEmail, passwordHash, tenantId, refreshTokens: [] });
  return issueSession(user);
}

async function login({ email, password }) {
  const user = await User.findOne({ email: normEmail(email) });
  if (!user) throw Object.assign(new Error("Invalid email or password"), { status: 401 });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw Object.assign(new Error("Invalid email or password"), { status: 401 });
  return issueSession(user);
}

async function issueSession(user) {
  const accessToken = signAccessToken(user);
  const refreshToken = newRefreshToken();
  const days = Number.isFinite(config.refreshTtlDays) && config.refreshTtlDays > 0 ? config.refreshTtlDays : 7;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  // Atomic push + trim to last 5 (avoids read-modify-save races on issue).
  const updated = await User.findByIdAndUpdate(
    user._id,
    { $push: { refreshTokens: { $each: [{ tokenHash: hashToken(refreshToken), expiresAt }], $slice: -5 } } },
    { new: true }
  );
  return { accessToken, refreshToken, user: toPublic(updated || user) };
}

async function refresh(refreshToken) {
  const tokenHash = hashToken(refreshToken);
  const user = await User.findOne({ "refreshTokens.tokenHash": tokenHash });
  if (!user) throw Object.assign(new Error("Invalid refresh token"), { status: 401 });
  const entry = user.refreshTokens.find((r) => r.tokenHash === tokenHash);
  if (!entry || entry.expiresAt < new Date()) {
    // Clean up the stale hash so it can't be replayed.
    await User.updateOne({ _id: user._id }, { $pull: { refreshTokens: { tokenHash } } });
    throw Object.assign(new Error("Refresh token expired"), { status: 401 });
  }
  // Rotate atomically: claim the old hash first. Null = concurrent refresh already won.
  const claimed = await User.findOneAndUpdate(
    { _id: user._id, "refreshTokens.tokenHash": tokenHash },
    { $pull: { refreshTokens: { tokenHash } } },
    { new: true }
  );
  if (!claimed) throw Object.assign(new Error("Invalid refresh token"), { status: 401 });
  return issueSession(claimed);
}

async function logout(refreshToken) {
  if (!refreshToken) return;
  const tokenHash = hashToken(refreshToken);
  await User.updateOne({ "refreshTokens.tokenHash": tokenHash }, { $pull: { refreshTokens: { tokenHash } } });
}

function toPublic(user) {
  return { id: user._id.toString(), name: user.name, email: user.email, tenantId: user.tenantId };
}

module.exports = { signup, login, refresh, logout, toPublic, cookieOpts };
