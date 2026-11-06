// Verifies the telemetry wiring in crypto-proxy keeps the existing fetch helper
// semantics (timeouts, errors, pass-through) and records sibling calls.
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function listen(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, "127.0.0.1", () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` }));
  });
}

let sibling;
let telemetry;
let fetchWithTimeout;

test.before(async () => {
  sibling = await listen((req, res) => {
    if (req.url === "/slow") return setTimeout(() => res.end("late"), 500);
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ source: req.headers["x-lv-source"] || null }));
  });
  // Point the service's config at the fake sibling before loading it.
  process.env.CRYPTO_PROXY_URL = sibling.url;
  process.env.JWKS_URL = "http://127.0.0.1:1/auth/jwks.json";
  process.env.MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:1/test";
  process.env.CRYPTO_MASTER_KEY = Buffer.alloc(32, 7).toString("base64");
  process.env.B2_ENDPOINT = "https://s3.example.invalid";
  process.env.B2_KEY_ID = "test";
  process.env.B2_APP_KEY = "test";
  process.env.B2_BUCKET = "test";
  telemetry = require("../src/telemetry/setup");
  ({ fetchWithTimeout } = require("../src/utils/fetch"));
});

test.after(() => sibling.server.close());

test("service name and sibling targets are configured", () => {
  assert.equal(telemetry.service, "crypto-proxy");
  assert.equal(telemetry.resolveTarget("http://127.0.0.1:1/auth/jwks.json"), "auth-service");
  assert.equal(telemetry.resolveTarget(process.env.CRYPTO_PROXY_URL), null, "crypto-proxy never labels itself");
  assert.equal(telemetry.resolveTarget("https://api.backblazeb2.com/x"), null);
});

test("fetchWithTimeout still returns normal responses", async () => {
  const res = await fetchWithTimeout(`${sibling.url}/anything`, {}, 2000);
  assert.equal(res.status, 200);
  assert.ok(await res.json());
});

test("fetchWithTimeout still throws UPSTREAM_TIMEOUT (504) on timeout", async () => {
  await assert.rejects(fetchWithTimeout(`${sibling.url}/slow`, {}, 50), (e) => e.code === "UPSTREAM_TIMEOUT" && e.status === 504);
});

test("fetchWithTimeout still surfaces connection errors", async () => {
  await assert.rejects(fetchWithTimeout("http://127.0.0.1:1/auth/jwks.json", {}, 2000));
  await wait(5);
  const failed = telemetry.buffer.since(0).events.filter((e) => e.target === "auth-service");
  assert.ok(failed.length >= 1);
  assert.equal(failed[failed.length - 1].status, 0);
});

test("B2 (S3 SDK) commands are timed without recording object keys", async () => {
  const s3 = require("../src/s3/s3-proxy");
  const before = telemetry.buffer.seq;
  // The endpoint does not resolve, so the SDK fails fast; the original error must still reach the caller.
  await assert.rejects(s3.putLocked(s3.s3Key("tenant-abc", "case-def", "file-ghi"), Buffer.from("locked bytes"), "application/octet-stream"));
  const evs = telemetry.buffer.since(before).events.filter((e) => e.target === "b2");
  assert.ok(evs.length >= 1, "B2 call recorded");
  const ev = evs[evs.length - 1];
  assert.equal(ev.route, "PutObject");
  assert.equal(ev.method, "PUT");
  assert.equal(ev.reqBytes, 12);
  assert.ok(ev.error);
  assert.ok(!JSON.stringify(evs).includes("tenant-abc"), "object keys never recorded");
});
