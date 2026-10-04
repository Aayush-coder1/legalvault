const config = require("../config");

// B2 (S3-compatible) settings come from env (bucket/endpoint). Real B2 only.
// Only crypto-proxy uploads locked files; this file keeps the same key rule.
function s3Key(tenantId, caseId, fileId) {
  return `${tenantId}/${caseId}/${fileId}`;
}

module.exports = { bucket: config.b2Bucket, endpoint: config.b2Endpoint, s3Key };
