const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const config = require("../config");

const s3 = new S3Client({ region: config.awsRegion });

// S3 stores ONLY locked files. Path: tenantId/caseId/fileId.
function s3Key(tenantId, caseId, fileId) {
  return `${tenantId}/${caseId}/${fileId}`;
}

async function putLocked(key, buffer) {
  await s3.send(new PutObjectCommand({ Bucket: config.s3Bucket, Key: key, Body: buffer }));
}

async function getLocked(key) {
  const out = await s3.send(new GetObjectCommand({ Bucket: config.s3Bucket, Key: key }));
  const chunks = [];
  for await (const c of out.Body) chunks.push(c);
  return Buffer.concat(chunks);
}

async function delLocked(key) {
  await s3.send(new DeleteObjectCommand({ Bucket: config.s3Bucket, Key: key }));
}

module.exports = { s3Key, putLocked, getLocked, delLocked };
