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
app.use(cors({ origin: config.frontendUrl, credentials: true }));
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
app.get("/readyz", (req, res) => res.json({
  ok: true,
  service: "gateway",
  uptime: process.uptime(),
  upstreams: { auth: config.authUrl, case: config.caseUrl, file: config.fileUrl },
}));

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
const RES_HOP = new Set(["content-encoding", "content-length", "transfer-encoding", "connection", "keep-alive"]);

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
      console.error(`rid=${rid} ${req.method} ${req.originalUrl} -> ${targetUrl} ${timeout ? "UPSTREAM_TIMEOUT" : "BAD_GATEWAY"} ${e && e.message}`);
      const err = new Error(timeout ? "Upstream timeout" : "Upstream unavailable");
      err.status = timeout ? 504 : 502;
      err.code = timeout ? "UPSTREAM_TIMEOUT" : "BAD_GATEWAY";
      next(err);
    }
  };
}

// Single entry point: route by prefix, preserve path downstream.
app.use("/auth", proxyTo(config.authUrl));                    // -> :4001/auth/...
app.use(["/cases", "/notes"], proxyTo(config.caseUrl));       // -> :4002/cases..., /notes...
app.use("/files", proxyTo(config.fileUrl));                   // -> :4003/files...

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
