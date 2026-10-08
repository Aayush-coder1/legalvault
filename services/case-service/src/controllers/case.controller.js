const { forward } = require("../services/cryptoClient");

const STATUS = ["open", "in-progress", "closed"];
const ID_RE = /^[A-Za-z0-9_-]{6,64}$/;
const MAX_TITLE = 160;
const MAX_NUM = 64;
const MAX_DESC = 5000;

function checkCase(req, res, next) {
  if (req.method === "POST" || req.method === "PUT") {
    const { title, caseNumber, status, description } = req.body || {};
    if (req.method === "POST" && (!title || !caseNumber)) {
      return res.status(400).json({ success: false, error: { code: "BAD_INPUT", message: "title, caseNumber required" } });
    }
    if (title !== undefined && (typeof title !== "string" || !title.trim() || title.length > MAX_TITLE)) {
      return res.status(400).json({ success: false, error: { code: "BAD_INPUT", message: `title 1-${MAX_TITLE} chars` } });
    }
    if (caseNumber !== undefined && (typeof caseNumber !== "string" || !caseNumber.trim() || caseNumber.length > MAX_NUM)) {
      return res.status(400).json({ success: false, error: { code: "BAD_INPUT", message: `caseNumber 1-${MAX_NUM} chars` } });
    }
    if (description !== undefined && (typeof description !== "string" || description.length > MAX_DESC)) {
      return res.status(400).json({ success: false, error: { code: "BAD_INPUT", message: `description max ${MAX_DESC} chars` } });
    }
    if (status && !STATUS.includes(status)) {
      return res.status(400).json({ success: false, error: { code: "BAD_STATUS", message: "status must be open|in-progress|closed" } });
    }
  }
  next();
}

function checkId(req, res, next) {
  for (const k of ["caseId", "noteId"]) {
    if (req.params[k] && !ID_RE.test(req.params[k])) {
      return res.status(400).json({ success: false, error: { code: "BAD_ID", message: "Invalid id" } });
    }
  }
  next();
}

function passQuery(req, allowed) {
  const out = [];
  for (const k of allowed) {
    if (req.query[k] !== undefined && req.query[k] !== "") out.push(`${k}=${encodeURIComponent(String(req.query[k]))}`);
  }
  return out.length ? `?${out.join("&")}` : "";
}

function enc(p) { return encodeURIComponent(p); }

async function createCase(req, res) { return forward(req, res, "/cases/save", "POST", req.body); }
async function listCases(req, res) { return forward(req, res, `/cases${passQuery(req, ["limit", "cursor", "search", "status", "sort"])}`, "GET"); }
async function getCase(req, res) { return forward(req, res, `/cases/${enc(req.params.caseId)}`, "GET"); }
async function updateCase(req, res) { return forward(req, res, `/cases/${enc(req.params.caseId)}`, "PUT", req.body); }
async function deleteCase(req, res) { return forward(req, res, `/cases/${enc(req.params.caseId)}`, "DELETE"); }

async function createNote(req, res) {
  const { text, title } = req.body || {};
  if (typeof text !== "string" || !text.trim() || text.length > 20000) {
    return res.status(400).json({ success: false, error: { code: "BAD_INPUT", message: "text 1-20000 chars required" } });
  }
  if (title !== undefined && (typeof title !== "string" || title.length > MAX_TITLE)) {
    return res.status(400).json({ success: false, error: { code: "BAD_INPUT", message: `title max ${MAX_TITLE} chars` } });
  }
  return forward(req, res, `/cases/${enc(req.params.caseId)}/notes`, "POST", req.body);
}
async function listNotes(req, res) { return forward(req, res, `/cases/${enc(req.params.caseId)}/notes${passQuery(req, ["limit", "cursor"])}`, "GET"); }
async function updateNote(req, res) { return forward(req, res, `/notes/${enc(req.params.noteId)}`, "PUT", req.body); }
async function deleteNote(req, res) { return forward(req, res, `/notes/${enc(req.params.noteId)}`, "DELETE"); }

module.exports = { checkCase, checkId, createCase, listCases, getCase, updateCase, deleteCase, createNote, listNotes, updateNote, deleteNote };
