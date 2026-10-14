const express = require("express");
const crypto = require("crypto");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const config = require("./config");

const app = express();
app.disable("x-powered-by");

// request-id (same as other services)
app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();
  res.setHeader("x-request-id", req.requestId);
  next();
});

app.use(cookieParser());
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-request-id", "x-forwarded-by"],
  exposedHeaders: ["x-request-id"],
  maxAge: 86400,
}));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});
app.use((req, res, next) => {
  const t = Date.now();
  res.on("finish", () => console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - t}ms rid=${req.requestId}`));
  next();
});

// Tiny per-IP rate limiter (gateway-level; services enforce their own too)
const hits = new Map();
function rateLimit({ windowMs, max }) {
  return (req, res, next) => {
    const now = Date.now();
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const arr = (hits.get(ip) || []).filter((t) => now - t < windowMs);
    arr.push(now);
    hits.set(ip, arr);
    if (arr.length > max) return res.status(429).json({ success: false, error: { code: "TOO_MANY", message: "Too many requests, try later" } });
    next();
  };
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, arr] of hits) {
    const kept = arr.filter((t) => now - t < 15 * 60 * 1000);
    if (kept.length) hits.set(ip, kept);
    else hits.delete(ip);
  }
}, 60 * 1000).unref();

app.get("/health", (req, res) => res.json({ ok: true, service: "gateway" }));
// Deep readiness: dials each upstream's /readyz (not just /health) so one
// browser hit wakes the whole chain — auth (incl. mongo), case/file (which in
// turn dial crypto-proxy). On Render's free tier a sleeping service takes
// ~30-60s to boot, longer than one probe timeout, so callers (the frontend
// warmup) retry this endpoint until `ok` is true; every attempt keeps the
// sleeping services booting.
async function probeUpstream(base) {
  const url = `${base.replace(/\/$/, "")}/readyz`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
    const body = await r.json().catch(() => null);
    return { ok: r.ok && body?.ok !== false, status: r.status };
  } catch (e) {
    const cause = e && e.cause ? ` (${e.cause.code || e.cause.message})` : "";
    return { ok: false, error: `${e && e.message}${cause}` };
  }
}
app.get("/readyz", async (req, res) => {
  const [auth, caseSvc, fileSvc] = await Promise.all([
    probeUpstream(config.authUrl),
    probeUpstream(config.caseUrl),
    probeUpstream(config.fileUrl),
  ]);
  const ok = auth.ok && caseSvc.ok && fileSvc.ok;
  res.status(ok ? 200 : 503).json({
    ok,
    service: "gateway",
    uptime: process.uptime(),
    upstreams: { auth: config.authUrl, case: config.caseUrl, file: config.fileUrl },
    reachability: { auth, case: caseSvc, file: fileSvc },
  });
});

app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 }));

// Read raw body (JSON + multipart) so we can forward untouched.
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > config.bodyLimit) {
        const e = new Error("Body too large");
        e.status = 413;
        req.destroy();
        reject(e);
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const HOP = new Set(["host", "connection", "content-length", "transfer-encoding", "keep-alive", "upgrade"]);
const RES_HOP = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
  // Gateway owns CORS: strip upstream CORS headers so a stale FRONTEND_URL
  // on auth/case/file can never overwrite the gateway's correct ACAO and
  // break the browser with a wrong Access-Control-Allow-Origin.
  "access-control-allow-origin",
  "access-control-allow-credentials",
  "access-control-allow-methods",
  "access-control-allow-headers",
  "access-control-expose-headers",
]);

function proxyTo(targetBase) {
  return async (req, res, next) => {
    const rid = req.requestId;
    const targetUrl = targetBase + req.originalUrl;
    try {
      const body = req.method === "GET" || req.method === "HEAD" ? undefined : await readBody(req);
      const headers = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (!HOP.has(k.toLowerCase()) && v !== undefined) headers[k] = v;
      }
      headers["x-request-id"] = rid;
      headers["x-forwarded-by"] = "legalvault-gateway";

      const upstream = await fetch(targetUrl, {
        method: req.method,
        headers,
        body,
        signal: AbortSignal.timeout(config.timeoutMs),
      });

      const buf = Buffer.from(await upstream.arrayBuffer());
      res.status(upstream.status);
      upstream.headers.forEach((v, k) => {
        if (!RES_HOP.has(k.toLowerCase())) {
          try { res.setHeader(k, v); } catch { /* ignore bad header */ }
        }
      });
      // Express drops multi Set-Cookie via forEach join; restore raw if present
      const setCookie = upstream.headers.getSetCookie ? upstream.headers.getSetCookie() : null;
      if (setCookie && setCookie.length) res.setHeader("set-cookie", setCookie);
      res.send(buf);
    } catch (e) {
      if (e && e.status === 413) return res.status(413).json({ success: false, error: { code: "TOO_LARGE", message: "Body too large" } });
      const timeout = e && (e.name === "TimeoutError" || e.name === "AbortError");
      // Surface the underlying reason (ENOTFOUND = bad hostname, ECONNREFUSED =
      // wrong port / service down) — "fetch failed" alone hides it.
      const cause = e && e.cause ? ` cause=${e.cause.code || e.cause.message}` : "";
      console.error(`rid=${rid} ${req.method} ${req.originalUrl} -> ${targetUrl} ${timeout ? "UPSTREAM_TIMEOUT" : "BAD_GATEWAY"} ${e && e.message}${cause}`);
      const err = new Error(timeout ? "Upstream timeout" : "Upstream unavailable");
      err.status = timeout ? 504 : 502;
      err.code = timeout ? "UPSTREAM_TIMEOUT" : "BAD_GATEWAY";
      next(err);
    }
  };
}

// Single entry point: route by prefix, preserve path downstream.
// Targets come from env (AUTH_URL / CASE_URL / FILE_URL) — see render.yaml.
app.use("/auth", proxyTo(config.authUrl));
app.use(["/cases", "/notes"], proxyTo(config.caseUrl));
app.use("/files", proxyTo(config.fileUrl));

app.use((req, res) => res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Not found" } }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  const code = status === 413 ? "TOO_LARGE" : err.code || "ERROR";
  const message = status >= 500 && status !== 502 && status !== 504 ? "Internal error" : (err.message || "Request failed");
  console.error(`rid=${req.requestId} ${req.method} ${req.originalUrl} ${status} ${err.message}`);
  res.status(status).json({ success: false, error: { code, message } });
});

const server = app.listen(config.port, () => console.log(`api-gateway on :${config.port}`));
process.on("unhandledRejection", (e) => console.error("unhandledRejection:", e && e.message));
process.on("uncaughtException", (e) => console.error("uncaughtException:", e && e.message));
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    console.log(`api-gateway ${sig}, draining...`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
