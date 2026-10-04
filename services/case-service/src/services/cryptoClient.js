const config = require("../config");

// Forward to crypto-proxy with same auth (tenant is enforced there too).
async function forward(req, res, path, method = "GET", body) {
  const url = `${config.cryptoUrl}/crypto${path}`;
  const headers = { "Content-Type": "application/json" };
  if (req.auth?.token) headers.Authorization = `Bearer ${req.auth.token}`;
  if (req.headers.cookie) headers.Cookie = req.headers.cookie;
  const r = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({ success: false, error: { code: "PROXY_FAIL", message: "crypto-proxy error" } }));
  return res.status(r.status).json(data);
}

module.exports = { forward };
