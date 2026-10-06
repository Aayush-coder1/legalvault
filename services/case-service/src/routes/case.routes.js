const express = require("express");
const c = require("../controllers/case.controller");

const router = express.Router();

router.post("/cases", c.checkCase, c.createCase);
router.get("/cases", c.listCases);
router.get("/cases/:caseId", c.checkId, c.getCase);
router.put("/cases/:caseId", c.checkId, c.checkCase, c.updateCase);
router.delete("/cases/:caseId", c.checkId, c.deleteCase);

router.post("/cases/:caseId/notes", c.checkId, c.createNote);
router.get("/cases/:caseId/notes", c.checkId, c.listNotes);
router.put("/cases/:caseId/notes/:noteId", c.checkId, c.updateNote);
router.delete("/cases/:caseId/notes/:noteId", c.checkId, c.deleteNote);
// flat aliases (used by frontend)
router.put("/notes/:noteId", c.checkId, c.updateNote);
router.delete("/notes/:noteId", c.checkId, c.deleteNote);

module.exports = router;
