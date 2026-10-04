const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const config = require("../config");

// Backblaze B2 via its S3-compatible API. Same SDK, custom endpoint.
// keyId = B2 Application Key ID, secret = B2 Application Key.
// Tolerates endpoint pasted with or without https:// (B2 console shows bare hostname).
let endpoint = (config.b2Endpoint || "").trim();
if (endpoint && !/^https?:\/\//i.test(endpoint)) endpoint = "https://" + endpoint;
const b2 = new S3Client({
  endpoint,
  region: config.b2Region,
  credentials: {
    accessKeyId: config.b2KeyId,
    secretAccessKey: config.b2AppKey,
  },
});

// B2 stores ONLY locked files. Path: tenantId/caseId/fileId.
function s3Key(tenantId, caseId, fileId) {
  return `${tenantId}/${caseId}/${fileId}`;
}

async function putLocked(key, buffer) {
  await b2.send(new PutObjectCommand({ Bucket: config.b2Bucket, Key: key, Body: buffer }));
}

async function getLocked(key) {
  const out = await b2.send(new GetObjectCommand({ Bucket: config.b2Bucket, Key: key }));
  const chunks = [];
  for await (const c of out.Body) chunks.push(c);
  return Buffer.concat(chunks);
}

async function delLocked(key) {
  await b2.send(new DeleteObjectCommand({ Bucket: config.b2Bucket, Key: key }));
}

module.exports = { s3Key, putLocked, getLocked, delLocked };
