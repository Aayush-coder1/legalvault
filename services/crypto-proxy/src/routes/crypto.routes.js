const express = require("express");
const c = require("../controllers/crypto.controller");
const auth = require("../middleware/authentication");
const { rotateKey } = require("../key-management/key-rotation");
const { getTenant } = require("../tenants/tenant-manager");

const router = express.Router();
router.use(auth);

// cases
router.post("/cases/save", c.createCase);
router.get("/cases", c.listCases);
router.get("/cases/:caseId", c.getCase);
router.put("/cases/:caseId", c.updateCase);
router.delete("/cases/:caseId", c.deleteCase);

// notes
router.post("/cases/:caseId/notes", c.createNote);
router.get("/cases/:caseId/notes", c.listNotes);
router.put("/notes/:noteId", c.updateNote);
router.delete("/notes/:noteId", c.deleteNote);

// files (locked bytes in S3)
router.post("/files/upload", express.json({ limit: "60mb" }), c.uploadFile);
router.get("/files", c.listFiles);
router.get("/files/:fileId/download", c.downloadFile);
router.delete("/files/:fileId", c.deleteFile);

// key rotation
router.post("/keys/rotate", async (req, res, next) => {
  try {
    const { tenantId } = getTenant(req);
    const out = await rotateKey(tenantId);
    res.json({ success: true, data: out });
  } catch (e) { next(e); }
});

module.exports = router;
