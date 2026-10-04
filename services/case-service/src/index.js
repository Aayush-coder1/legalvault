const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const config = require("./config");
const verifyJwt = require("./middleware/auth");
const caseRoutes = require("./routes/case.routes");

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: config.frontendUrl, credentials: true }));

app.get("/health", (req, res) => res.json({ ok: true, service: "case" }));
app.use("/", verifyJwt, caseRoutes);

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  res.status(500).json({ success: false, error: { code: "ERROR", message: err.message } });
});

app.listen(config.port, () => console.log(`case-service on :${config.port}`));
