const config = require("../config");

// S3 client settings come from env (bucket/region). Real S3 only.
// Only crypto-proxy uploads locked files; this file keeps the same key rule.
function s3Key(tenantId, caseId, fileId) {
  return `${tenantId}/${caseId}/${fileId}`;
}

module.exports = { bucket: config.s3Bucket, region: config.awsRegion, s3Key };
