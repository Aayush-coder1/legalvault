// Simple input checks (no extra library).
function checkSignup(req, res, next) {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ success: false, error: { code: "BAD_INPUT", message: "name, email, password required" } });
  if (password.length < 8) return res.status(400).json({ success: false, error: { code: "WEAK_PASSWORD", message: "Password min 8 chars" } });
  next();
}

function checkLogin(req, res, next) {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ success: false, error: { code: "BAD_INPUT", message: "email, password required" } });
  next();
}

module.exports = { checkSignup, checkLogin };
