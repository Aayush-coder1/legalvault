const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const config = require("./config");
const cryptoRoutes = require("./routes/crypto.routes");

const app = express();
app.disable("x-powered-by");
app.use((req, res, next) => {
  req.requestId = req.headers["x-request-id"] || crypto.randomUUID();
  res.setHeader("x-request-id", req.requestId);
  next();
});
app.use(express.json({ limit: "60mb" }));
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
  res.on("finish", () => console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - t}ms rid=${req.requestId}`));
  next();
});

app.get("/health", (req, res) => res.json({ ok: true, service: "crypto-proxy" }));
app.get("/readyz", async (req, res) => {
  const mongo = mongoose.connection.readyState === 1;
  let b2 = false;
  try {
    const { headBucket } = require("./s3/s3-proxy");
    await headBucket();
    b2 = true;
  } catch {
    b2 = false;
  }
  const ok = mongo; // B2 reported but not blocking (preserves boot when B2 blips)
  res.status(ok ? 200 : 503).json({ ok, service: "crypto-proxy", mongo, b2, uptime: process.uptime() });
});
app.use("/crypto", cryptoRoutes);
app.use((req, res) => res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Not found" } }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  const code = status === 404 ? "NOT_FOUND"
    : status === 401 ? "BAD_TOKEN"
    : status === 403 ? "FORBIDDEN"
    : status === 409 ? "CONFLICT"
    : status === 413 ? "TOO_LARGE"
    : status === 422 ? "CORRUPT"
    : status === 502 || status === 504 ? "UPSTREAM_FAIL"
    : "ERROR";
  const message = status >= 500 ? "Internal error" : (err.message || "Request failed");
  console.error(`rid=${req.requestId} ${req.method} ${req.path} ${status} ${err.message}`);
  res.status(status).json({ success: false, error: { code, message } });
});

mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000, socketTimeoutMS: 20000, maxPoolSize: 20 }).then(() => {
  console.log("crypto-proxy: mongo connected");
  const server = app.listen(config.port, () => console.log(`crypto-proxy on :${config.port}`));
  for (const sig of ["SIGTERM", "SIGINT"]) {
    process.on(sig, () => {
      console.log(`crypto-proxy ${sig}, draining...`);
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
