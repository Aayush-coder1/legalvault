const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const config = require("./config");
const cryptoRoutes = require("./routes/crypto.routes");

const app = express();
app.use(express.json({ limit: "60mb" }));
app.use(cookieParser());
app.use(cors({ origin: config.frontendUrl, credentials: true }));

app.get("/health", (req, res) => res.json({ ok: true, service: "crypto-proxy" }));
app.use("/crypto", cryptoRoutes);

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  res.status(status).json({ success: false, error: { code: "ERROR", message: err.message } });
});

mongoose.connect(config.mongoUri).then(() => {
  console.log("crypto-proxy: mongo connected");
  app.listen(config.port, () => console.log(`crypto-proxy on :${config.port}`));
}).catch((e) => {
  console.error("Missing env or mongo down:", e.message);
  process.exit(1);
});
