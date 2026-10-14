/**
 * DANGER — wipe-all: deletes EVERYTHING.
 *
 *  - MongoDB: drops the entire database named in MONGO_URI
 *    (users/accounts, encrypted cases + notes, file metadata, tenant keys).
 *  - Backblaze B2: deletes every object in B2_BUCKET, including all
 *    versions and delete markers (bucket itself is kept).
 *
 * Credentials come from the repo-root `.env` (never printed, never committed).
 *
 * Usage (repo root, needs mongoose + @aws-sdk/client-s3 + dotenv — all present
 * in services/crypto-proxy/node_modules):
 *
 *   # dry run — only prints counts, deletes nothing
 *   $env:NODE_PATH="$PWD/services/crypto-proxy/node_modules"; node scripts/wipe-all.js
 *
 *   # actually delete
 *   $env:NODE_PATH="$PWD/services/crypto-proxy/node_modules"; node scripts/wipe-all.js --yes
 */
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const YES = process.argv.includes("--yes");

function need(name) {
  const v = (process.env[name] || "").trim();
  if (!v) {
    console.error(`Missing env: ${name} (see .env.example)`);
    process.exit(1);
  }
  return v;
}

async function wipeMongo() {
  const mongoose = require("mongoose");
  const uri = need("MONGO_URI");
  console.log("Mongo: connecting…");
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;
  console.log(`Mongo: database "${db.databaseName}"`);

  const cols = await db.listCollections().toArray();
  if (cols.length === 0) {
    console.log("Mongo: no collections — already empty.");
  } else {
    for (const c of cols) {
      const n = await db.collection(c.name).estimatedDocumentCount().catch(() => -1);
      console.log(`Mongo: collection "${c.name}" — ${n} doc(s)`);
    }
  }

  if (!YES) {
    console.log("Mongo: DRY RUN — pass --yes to drop the database.");
  } else if (cols.length > 0) {
    await db.dropDatabase();
    console.log(`Mongo: database "${db.databaseName}" dropped (all accounts + data gone).`);
  }
  await mongoose.disconnect();
  return cols.length;
}

async function wipeB2() {
  const { S3Client, ListObjectsV2Command, ListObjectVersionsCommand, DeleteObjectsCommand } =
    require("@aws-sdk/client-s3");

  let endpoint = need("B2_ENDPOINT").trim();
  if (!/^https?:\/\//i.test(endpoint)) endpoint = "https://" + endpoint;
  const Bucket = need("B2_BUCKET");
  const s3 = new S3Client({
    endpoint,
    region: process.env.B2_REGION || "us-east-005",
    credentials: { accessKeyId: need("B2_KEY_ID"), secretAccessKey: need("B2_APP_KEY") },
    maxAttempts: 3,
  });

  // Gather every version + delete marker (covers versioned buckets where a
  // plain DeleteObjects would only hide objects behind delete markers).
  let keyMarkers = undefined;
  let versionMarkers = undefined;
  const all = [];
  for (;;) {
    const out = await s3.send(new ListObjectVersionsCommand({
      Bucket, KeyMarker: keyMarkers, VersionIdMarker: versionMarkers, MaxKeys: 1000,
    })).catch(async (e) => {
      // Bucket without versioning support: fall back to plain v2 listing.
      if (e && (e.name === "NotImplemented" || e.name === "InvalidArgument")) return { fallback: true };
      throw e;
    });
    if (out.fallback) break;
    for (const v of out.Versions || []) all.push({ Key: v.Key, VersionId: v.VersionId });
    for (const d of out.DeleteMarkers || []) all.push({ Key: d.Key, VersionId: d.VersionId });
    if (!out.IsTruncated) break;
    keyMarkers = out.NextKeyMarker;
    versionMarkers = out.NextVersionIdMarker;
  }

  // Fallback path: non-versioned listing.
  if (all.length === 0) {
    let token = undefined;
    for (;;) {
      const out = await s3.send(new ListObjectsV2Command({ Bucket, ContinuationToken: token, MaxKeys: 1000 }));
      for (const o of out.Contents || []) all.push({ Key: o.Key });
      if (!out.IsTruncated) break;
      token = out.NextContinuationToken;
    }
  }

  console.log(`B2: bucket "${Bucket}" — ${all.length} object(s)/version(s) found.`);
  if (!YES) {
    console.log("B2: DRY RUN — pass --yes to delete them.");
    return all.length;
  }
  let deleted = 0;
  for (let i = 0; i < all.length; i += 1000) {
    const batch = all.slice(i, i + 1000);
    const res = await s3.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects: batch, Quiet: true } }));
    deleted += batch.length - ((res.Errors && res.Errors.length) || 0);
    if (res.Errors && res.Errors.length) {
      for (const e of res.Errors.slice(0, 5)) console.error(`B2: delete error ${e.Key}: ${e.Message}`);
    }
  }
  const left = await s3.send(new ListObjectsV2Command({ Bucket, MaxKeys: 1 }));
  console.log(`B2: deleted ${deleted}, remaining ${(left.KeyCount ?? 0)} — bucket is ${left.KeyCount ? "NOT empty" : "empty"}.`);
  return left.KeyCount ?? 0;
}

(async () => {
  console.log(`wipe-all ${YES ? "(LIVE — deleting)" : "(dry run)"}`);
  try {
    await wipeMongo();
    await wipeB2();
    console.log("Done.");
  } catch (e) {
    console.error("FAILED:", e && e.message);
    process.exit(1);
  }
})();
