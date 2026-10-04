const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const config = require("./config");
const authRoutes = require("./routes/auth.routes");

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: config.frontendUrl, credentials: true }));

app.get("/health", (req, res) => res.json({ ok: true, service: "auth" }));
app.use("/auth", authRoutes);

// Simple error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  res.status(status).json({ success: false, error: { code: "ERROR", message: err.message } });
});

mongoose.connect(config.mongoUri).then(() => {
  console.log("auth-service: mongo connected");
  app.listen(config.port, () => console.log(`auth-service on :${config.port}`));
}).catch((e) => {
  console.error("Missing env or mongo down:", e.message);
  process.exit(1);
});
