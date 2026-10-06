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
  maxAttempts: 3,
  requestHandler: {
    requestTimeout: 30000,
    connectionTimeout: 5000,
  },
});

// B2 stores ONLY locked files. Path: tenantId/caseId/fileId.
function s3Key(tenantId, caseId, fileId) {
  const safe = (s) => String(s || "").replace(/[^A-Za-z0-9_-]/g, "");
  return `${safe(tenantId)}/${safe(caseId)}/${safe(fileId)}`;
}

async function withTimeout(promise, ms, what) {
  let t;
  const timeout = new Promise((_, rej) => {
    t = setTimeout(() => {
      const e = new Error(`${what} timeout after ${ms}ms`);
      e.status = 504;
      e.code = "S3_TIMEOUT";
      rej(e);
    }, ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(t);
  }
}

async function putLocked(key, buffer, contentType) {
  await withTimeout(
    b2.send(new PutObjectCommand({
      Bucket: config.b2Bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType || "application/octet-stream",
      ContentLength: buffer.length,
    })),
    60000,
    "S3 upload"
  );
}

async function getLocked(key) {
  const out = await withTimeout(b2.send(new GetObjectCommand({ Bucket: config.b2Bucket, Key: key })), 60000, "S3 download");
  const chunks = [];
  let total = 0;
  for await (const c of out.Body) {
    chunks.push(c);
    total += c.length;
    if (total > 60 * 1024 * 1024) {
      const e = new Error("File too big to download");
      e.status = 413;
      throw e;
    }
  }
  return Buffer.concat(chunks);
}

async function delLocked(key) {
  await withTimeout(b2.send(new DeleteObjectCommand({ Bucket: config.b2Bucket, Key: key })), 30000, "S3 delete");
}

async function headBucket() {
  const { HeadBucketCommand } = require("@aws-sdk/client-s3");
  await withTimeout(b2.send(new HeadBucketCommand({ Bucket: config.b2Bucket })), 8000, "S3 head");
}

module.exports = { s3Key, putLocked, getLocked, delLocked, headBucket };
