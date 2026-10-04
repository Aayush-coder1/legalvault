const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../models/User");
const { signAccessToken, newRefreshToken, hashToken } = require("./token.service");
const config = require("../config");

function cookieOpts(ms) {
  const secure = process.env.NODE_ENV === "production";
  return { httpOnly: true, secure, sameSite: "lax", maxAge: ms, path: "/" };
}

async function signup({ name, email, password }) {
  const exists = await User.findOne({ email });
  if (exists) throw Object.assign(new Error("Email already used"), { status: 409 });
  const passwordHash = await bcrypt.hash(password, 10);
  // Each signup = own tenant (law firm). Simple rule.
  const tenantId = new mongoose.Types.ObjectId().toString();
  const user = await User.create({ name, email, passwordHash, tenantId, refreshTokens: [] });
  return issueSession(user);
}

async function login({ email, password }) {
  const user = await User.findOne({ email });
  if (!user) throw Object.assign(new Error("Invalid email or password"), { status: 401 });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw Object.assign(new Error("Invalid email or password"), { status: 401 });
  return issueSession(user);
}

async function issueSession(user) {
  const accessToken = signAccessToken(user);
  const refreshToken = newRefreshToken();
  const expiresAt = new Date(Date.now() + config.refreshTtlDays * 24 * 60 * 60 * 1000);
  user.refreshTokens.push({ tokenHash: hashToken(refreshToken), expiresAt });
  // Keep only last 5 sessions
  user.refreshTokens = user.refreshTokens.slice(-5);
  await user.save();
  return { accessToken, refreshToken, user: toPublic(user) };
}

async function refresh(refreshToken) {
  const tokenHash = hashToken(refreshToken);
  const user = await User.findOne({ "refreshTokens.tokenHash": tokenHash });
  if (!user) throw Object.assign(new Error("Invalid refresh token"), { status: 401 });
  const entry = user.refreshTokens.find((r) => r.tokenHash === tokenHash);
  if (!entry || entry.expiresAt < new Date()) {
    throw Object.assign(new Error("Refresh token expired"), { status: 401 });
  }
  // Rotate: remove old, issue new
  user.refreshTokens = user.refreshTokens.filter((r) => r.tokenHash !== tokenHash);
  await user.save();
  return issueSession(user);
}

async function logout(refreshToken) {
  if (!refreshToken) return;
  const tokenHash = hashToken(refreshToken);
  await User.updateOne({}, { $pull: { refreshTokens: { tokenHash } } });
}

function toPublic(user) {
  return { id: user._id.toString(), name: user.name, email: user.email, tenantId: user.tenantId };
}

module.exports = { signup, login, refresh, logout, toPublic, cookieOpts };
