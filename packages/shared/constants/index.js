// Shared constants (mirror frontend lib/config/constants.ts)
const CASE_STATUS = ["open", "in-progress", "closed"];
const MAX_FILE_MB = 25;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
  "text/plain",
];

module.exports = { CASE_STATUS, MAX_FILE_MB, MAX_FILE_BYTES, ALLOWED_MIME };
