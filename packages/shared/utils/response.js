// Common API envelope: { success, data?, error? }
function ok(res, data) {
  return res.json({ success: true, data });
}

function fail(res, code, message, status = 400) {
  return res.status(status).json({ success: false, error: { code, message } });
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { ok, fail, asyncHandler };
