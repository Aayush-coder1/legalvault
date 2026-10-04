const express = require("express");
const multer = require("multer");
const c = require("../controllers/file.controller");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const router = express.Router();

router.post("/files/upload", upload.single("file"), c.upload);
router.post("/files/note", express.json(), c.uploadNote);
router.get("/files", c.listByCase);
router.get("/files/:fileId/download", c.download);
router.delete("/files/:fileId", c.remove);

module.exports = router;
