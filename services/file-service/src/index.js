const express = require("express");
const crypto = require("crypto");
const multer = require("multer");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const config = require("./config");
const verifyJwt = require("./middleware/auth");
const fileRoutes = require("./routes/file.routes");

const app = express();
app.disable("x-powered-by");
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
  res.on("finish", () => console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - t}ms rid=${req.requestId}`));
  next();
});
// NOTE: multer handles multipart; json only for /files/note route
app.get("/health", (req, res) => res.json({ ok: true, service: "file" }));
// Deep readiness: dials crypto-proxy so a single gateway /readyz fans out and
// wakes the whole chain (gateway -> file -> crypto). A waking crypto still
// returns non-ok, but the request itself boots it on Render's free tier.
app.get("/readyz", async (req, res) => {
  let crypto = { ok: false };
  try {
    const { fetchWithTimeout } = require("./utils/fetch");
    const r = await fetchWithTimeout(`${config.cryptoUrl.replace(/\/$/, "")}/health`, {}, 6000);
    crypto = { ok: r.ok, status: r.status };
  } catch (e) {
    crypto = { ok: false, error: (e && e.message) || "unreachable" };
  }
  res.status(crypto.ok ? 200 : 503).json({ ok: crypto.ok, service: "file", uptime: process.uptime(), crypto });
});
app.use("/", verifyJwt, fileRoutes);
app.use((req, res) => res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Not found" } }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || (err instanceof multer.MulterError ? 413 : 500);
  const code = status === 413 || err.code === "LIMIT_FILE_SIZE" ? "TOO_LARGE"
    : status === 504 || err.code === "UPSTREAM_TIMEOUT" ? "UPSTREAM_TIMEOUT"
    : err.code || "ERROR";
  const message = status >= 500 ? "Internal error"
    : err.code === "LIMIT_FILE_SIZE" ? "File too big (max 25MB)"
    : (err.message || "Request failed");
  console.error(`rid=${req.requestId} ${req.method} ${req.path} ${status} ${err.message}`);
  res.status(status).json({ success: false, error: { code, message } });
});

const server = app.listen(config.port, () => console.log(`file-service on :${config.port}`));
process.on("unhandledRejection", (e) => console.error("unhandledRejection:", e && e.message));
process.on("uncaughtException", (e) => console.error("uncaughtException:", e && e.message));
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    console.log(`file-service ${sig}, draining...`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
