// Simple input checks (no extra library).
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

function checkSignup(req, res, next) {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ success: false, error: { code: "BAD_INPUT", message: "name, email, password required" } });
  if (typeof name !== "string" || !name.trim() || name.length > 120) return res.status(400).json({ success: false, error: { code: "BAD_INPUT", message: "name 1-120 chars" } });
  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) return res.status(400).json({ success: false, error: { code: "BAD_EMAIL", message: "Valid email required" } });
  if (typeof password !== "string" || password.length < 8 || password.length > 128) return res.status(400).json({ success: false, error: { code: "WEAK_PASSWORD", message: "Password 8-128 chars" } });
  next();
}

function checkLogin(req, res, next) {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ success: false, error: { code: "BAD_INPUT", message: "email, password required" } });
  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) return res.status(400).json({ success: false, error: { code: "BAD_EMAIL", message: "Valid email required" } });
  if (typeof password !== "string" || password.length > 128) return res.status(400).json({ success: false, error: { code: "BAD_INPUT", message: "Invalid password" } });
  next();
}

module.exports = { checkSignup, checkLogin };
