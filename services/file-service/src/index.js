const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const config = require("./config");
const verifyJwt = require("./middleware/auth");
const fileRoutes = require("./routes/file.routes");

const app = express();
app.use(cookieParser());
app.use(cors({ origin: config.frontendUrl, credentials: true }));
// NOTE: multer handles multipart; json only for /files/note route
app.get("/health", (req, res) => res.json({ ok: true, service: "file" }));
app.use("/", verifyJwt, fileRoutes);

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  res.status(status).json({ success: false, error: { code: "ERROR", message: err.message } });
});

app.listen(config.port, () => console.log(`file-service on :${config.port}`));
