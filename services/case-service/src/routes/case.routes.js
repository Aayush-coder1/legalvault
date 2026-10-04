const express = require("express");
const c = require("../controllers/case.controller");

const router = express.Router();

router.post("/cases", c.checkCase, c.createCase);
router.get("/cases", c.listCases);
router.get("/cases/:caseId", c.getCase);
router.put("/cases/:caseId", c.checkCase, c.updateCase);
router.delete("/cases/:caseId", c.deleteCase);

router.post("/cases/:caseId/notes", c.createNote);
router.get("/cases/:caseId/notes", c.listNotes);
router.put("/cases/:caseId/notes/:noteId", c.updateNote);
router.delete("/cases/:caseId/notes/:noteId", c.deleteNote);
// flat aliases (used by frontend)
router.put("/notes/:noteId", c.updateNote);
router.delete("/notes/:noteId", c.deleteNote);

module.exports = router;
