const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const config = require("./config");
const authRoutes = require("./routes/auth.routes");

const app = express();
app.disable("x-powered-by");
app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();
  res.setHeader("x-request-id", req.requestId);
  next();
});
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
app.use(cors({ origin: config.frontendUrl, credentials: true }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

// Tiny in-memory rate limiter for auth endpoints (per-IP, rolling window).
const hits = new Map();
function rateLimit({ windowMs, max }) {
  return (req, res, next) => {
    const now = Date.now();
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const arr = (hits.get(ip) || []).filter((t) => now - t < windowMs);
    arr.push(now);
    hits.set(ip, arr);
    if (arr.length > max) return res.status(429).json({ success: false, error: { code: "TOO_MANY", message: "Too many attempts, try later" } });
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

app.use((req, res, next) => {
  const t = Date.now();
  res.on("finish", () => console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - t}ms rid=${req.requestId}`));
  next();
});

app.get("/health", (req, res) => res.json({ ok: true, service: "auth" }));
app.get("/readyz", (req, res) => {
  const mongo = mongoose.connection.readyState === 1;
  res.status(mongo ? 200 : 503).json({ ok: mongo, service: "auth", mongo, uptime: process.uptime() });
});
app.use("/auth", rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }), authRoutes);
app.use((req, res) => res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Not found" } }));

// Simple error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  console.error(`rid=${req.requestId} ${req.method} ${req.path} ${status} ${err.message}`);
  const message = status >= 500 ? "Internal error" : (err.message || "Request failed");
  res.status(status).json({ success: false, error: { code: status === 429 ? "TOO_MANY" : "ERROR", message } });
});

mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000, socketTimeoutMS: 20000, maxPoolSize: 20 }).then(() => {
  console.log("auth-service: mongo connected");
  const server = app.listen(config.port, () => console.log(`auth-service on :${config.port}`));
  for (const sig of ["SIGTERM", "SIGINT"]) {
    process.on(sig, () => {
      console.log(`auth-service ${sig}, draining...`);
      server.close(() => mongoose.disconnect().finally(() => process.exit(0)));
      setTimeout(() => process.exit(0), 5000).unref();
    });
  }
}).catch((e) => {
  console.error("Missing env or mongo down:", e.message);
  process.exit(1);
});
process.on("unhandledRejection", (e) => console.error("unhandledRejection:", e && e.message));
process.on("uncaughtException", (e) => console.error("uncaughtException:", e && e.message));
