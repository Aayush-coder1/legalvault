const config = require("../config");
const { fetchWithTimeout, readJsonSafe } = require("../utils/fetch");

// Forward to crypto-proxy with same auth (tenant is enforced there too).
async function forward(req, res, path, method = "GET", body) {
  const url = `${config.cryptoUrl}/crypto${path}`;
  const headers = { "Content-Type": "application/json", "x-request-id": req.requestId || "" };
  if (req.auth?.token) headers.Authorization = `Bearer ${req.auth.token}`;
  if (req.headers.cookie) headers.Cookie = req.headers.cookie;
  if (req.headers["idempotency-key"]) headers["idempotency-key"] = String(req.headers["idempotency-key"]).slice(0, 128);
  let r;
  try {
    r = await fetchWithTimeout(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    }, 15000);
  } catch (e) {
    const status = e.status || 502;
    return res.status(status).json({
      success: false,
      error: { code: e.code || "PROXY_UNREACHABLE", message: "crypto-proxy unavailable, try again" },
    });
  }
  const data = await readJsonSafe(r, { success: false, error: { code: "PROXY_FAIL", message: "crypto-proxy error" } });
  return res.status(r.status).json(data);
}

module.exports = { forward };
