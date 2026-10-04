const { forward } = require("../services/cryptoClient");

const STATUS = ["open", "in-progress", "closed"];

function checkCase(req, res, next) {
  if (req.method === "POST" || req.method === "PUT") {
    const { title, caseNumber, status } = req.body || {};
    if (req.method === "POST" && (!title || !caseNumber)) {
      return res.status(400).json({ success: false, error: { code: "BAD_INPUT", message: "title, caseNumber required" } });
    }
    if (status && !STATUS.includes(status)) {
      return res.status(400).json({ success: false, error: { code: "BAD_STATUS", message: "status must be open|in-progress|closed" } });
    }
  }
  next();
}

async function createCase(req, res) { return forward(req, res, "/cases/save", "POST", req.body); }
async function listCases(req, res) { return forward(req, res, "/cases", "GET"); }
async function getCase(req, res) { return forward(req, res, `/cases/${req.params.caseId}`, "GET"); }
async function updateCase(req, res) { return forward(req, res, `/cases/${req.params.caseId}`, "PUT", req.body); }
async function deleteCase(req, res) { return forward(req, res, `/cases/${req.params.caseId}`, "DELETE"); }

async function createNote(req, res) { return forward(req, res, `/cases/${req.params.caseId}/notes`, "POST", req.body); }
async function listNotes(req, res) { return forward(req, res, `/cases/${req.params.caseId}/notes`, "GET"); }
async function updateNote(req, res) { return forward(req, res, `/notes/${req.params.noteId}`, "PUT", req.body); }
async function deleteNote(req, res) { return forward(req, res, `/notes/${req.params.noteId}`, "DELETE"); }

module.exports = { checkCase, createCase, listCases, getCase, updateCase, deleteCase, createNote, listNotes, updateNote, deleteNote };
