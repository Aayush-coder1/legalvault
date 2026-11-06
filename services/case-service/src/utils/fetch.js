// Small fetch helper with timeout. No extra deps (Node 22 global fetch).
// Calls to sibling services are timed + labelled for the live topology;
// third-party URLs pass through untouched (see telemetry/index.js wrapFetch).
const telemetry = require("../telemetry/setup");

const trackedFetch = telemetry.wrapFetch((url, opts) => fetch(url, opts));

async function fetchWithTimeout(url, opts = {}, timeoutMs = 10000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await trackedFetch(url, { ...opts, signal: opts.signal || ctrl.signal });
  } catch (e) {
    if (e && e.name === "AbortError") {
      const err = new Error(`Upstream timeout after ${timeoutMs}ms`);
      err.code = "UPSTREAM_TIMEOUT";
      err.status = 504;
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}

async function readJsonSafe(res, fallback) {
  try {
    return await res.json();
  } catch {
    return fallback;
  }
}

module.exports = { fetchWithTimeout, readJsonSafe };
