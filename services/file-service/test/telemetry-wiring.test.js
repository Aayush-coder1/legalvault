// Verifies the telemetry wiring in file-service keeps the existing fetch helper
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
  assert.equal(telemetry.service, "file-service");
  assert.equal(telemetry.resolveTarget("http://127.0.0.1:1/auth/jwks.json"), "auth-service");
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
