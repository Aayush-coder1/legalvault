const auth = require("../services/auth.service");
const { verifyAccessToken } = require("../services/token.service");
const config = require("../config");

function setCookies(res, session) {
  res.cookie("accessToken", session.accessToken, auth.cookieOpts(config.accessTtlMs));
  res.cookie("refreshToken", session.refreshToken, auth.cookieOpts(config.refreshTtlDays * 24 * 60 * 60 * 1000));
}

function clearCookies(res) {
  const base = auth.cookieOpts(0);
  const opts = { path: "/", httpOnly: base.httpOnly, secure: base.secure, sameSite: base.sameSite };
  res.clearCookie("accessToken", opts);
  res.clearCookie("refreshToken", opts);
}

function extractToken(req) {
  if (req.cookies && req.cookies.accessToken) return req.cookies.accessToken;
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

// Refresh token can arrive via HttpOnly cookie (primary), JSON body
// (cross-site / third-party-cookie-blocked browsers), or Authorization
// Bearer header (gateway-forwarded clients). Accept all three.
function extractRefreshToken(req) {
  if (req.cookies && req.cookies.refreshToken) return req.cookies.refreshToken;
  if (req.body && typeof req.body.refreshToken === "string" && req.body.refreshToken) {
    return req.body.refreshToken.trim();
  }
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  // Only treat Bearer as refresh token on /refresh + /logout routes;
  // /me uses access tokens, so callers must not mix them.
  if (m && (/\/refresh\/?$/.test(req.path) || /\/logout\/?$/.test(req.path))) return m[1].trim();
  return "";
}

async function signup(req, res, next) {
  try {
    const session = await auth.signup(req.body);
    setCookies(res, session);
    // Also return tokens in the body: browsers that block cross-site
    // (third-party) cookies still need Bearer fallback to stay logged in.
    res.status(201).json({ success: true, data: { user: session.user, accessToken: session.accessToken, refreshToken: session.refreshToken } });
  } catch (e) { next(e); }
}

async function login(req, res, next) {
  try {
    const session = await auth.login(req.body);
    setCookies(res, session);
    res.json({ success: true, data: { user: session.user, accessToken: session.accessToken, refreshToken: session.refreshToken } });
  } catch (e) { next(e); }
}

async function refresh(req, res, next) {
  try {
    const token = extractRefreshToken(req);
    if (!token) return res.status(401).json({ success: false, error: { code: "NO_REFRESH", message: "No refresh token" } });
    const session = await auth.refresh(token);
    setCookies(res, session);
    res.json({ success: true, data: { user: session.user, accessToken: session.accessToken, refreshToken: session.refreshToken } });
  } catch (e) { next(e); }
}

async function logout(req, res, next) {
  try {
    await auth.logout((req.cookies && req.cookies.refreshToken) || extractRefreshToken(req));
    clearCookies(res);
    res.json({ success: true, data: { ok: true } });
  } catch (e) { next(e); }
}

async function me(req, res) {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ success: false, error: { code: "NO_TOKEN", message: "Not logged in" } });
    const p = verifyAccessToken(token);
    const User = require("../models/User");
    const user = await User.findById(p.userId);
    if (!user) return res.status(401).json({ success: false, error: { code: "NO_USER", message: "User gone" } });
    res.json({ success: true, data: { user: { id: user._id.toString(), name: user.name, email: user.email, tenantId: user.tenantId } } });
  } catch {
    res.status(401).json({ success: false, error: { code: "BAD_TOKEN", message: "Invalid or expired token" } });
  }
}

module.exports = { signup, login, refresh, logout, me };
