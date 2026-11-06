const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { createTelemetry, sanitizeRoute, RingBuffer } = require("..");

const quiet = { onError: () => {} };

function listen(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, "127.0.0.1", () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` }));
  });
}

function fakeRes() {
  const res = { statusCode: 200, headers: {}, body: undefined };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; };
  return res;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- sanitizeRoute ---------------- */

test("sanitizeRoute strips ids, query strings and free text", () => {
  assert.equal(sanitizeRoute("/cases/65f0c1a2b3c4d5e6f7a8b9c0/notes?x=1&token=abc"), "/cases/:id/notes");
  assert.equal(sanitizeRoute("/files/3f2c4b1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f"), "/files/:id");
  assert.equal(sanitizeRoute("/users/12345"), "/users/:id");
  assert.equal(sanitizeRoute("/auth/login"), "/auth/login");
  assert.equal(sanitizeRoute("/search/john%40law.com"), "/search/:param");
  assert.equal(sanitizeRoute("/x/" + "a".repeat(30)), "/x/:id");
  assert.equal(sanitizeRoute(undefined), "/");
  assert.ok(sanitizeRoute("/" + "abc/".repeat(60)).length <= 96);
});

/* ---------------- ring buffer ---------------- */

test("RingBuffer returns events after a cursor and reports overwritten ones", () => {
  const rb = new RingBuffer(10);
  for (let i = 0; i < 25; i++) rb.push({ n: i });
  assert.equal(rb.size, 10);
  const all = rb.since(0);
  assert.equal(all.events.length, 10);
  assert.equal(all.events[0].seq, 16);
  assert.equal(all.dropped, 15);
  const tail = rb.since(22);
  assert.deepEqual(tail.events.map((e) => e.seq), [23, 24, 25]);
  assert.equal(tail.dropped, 0);
  assert.equal(rb.since(25).events.length, 0);
  assert.equal(rb.since(25).seq, 25);
  assert.equal(rb.since(0, 3).events.length, 3);
});

/* ---------------- middleware ---------------- */

test("middleware records method, sanitized route, status, latency and source", async () => {
  const t = createTelemetry({ service: "case-service", ...quiet });
  const mw = t.middleware();
  const { server, url } = await listen((req, res) => {
    mw(req, res, () => {
      setTimeout(() => {
        res.statusCode = req.url.startsWith("/missing") ? 404 : 201;
        res.setHeader("content-length", "2");
        res.end("ok");
      }, 15);
    });
  });
  try {
    await fetch(`${url}/cases/65f0c1a2b3c4d5e6f7a8b9c0?secret=1`, { method: "POST", body: "{}", headers: { "x-forwarded-by": "legalvault-gateway" } });
    await fetch(`${url}/missing`, { headers: { "x-lv-source": "file-service" } });
    await fetch(`${url}/health`);
    await fetch(`${url}/cases`, { method: "OPTIONS" });
    await wait(20);
    const { events } = t.buffer.since(0);
    assert.equal(events.length, 2, "health checks and CORS preflights must not be recorded");
    const [a, b] = events;
    assert.equal(a.method, "POST");
    assert.equal(a.route, "/cases/:id");
    assert.equal(a.status, 201);
    assert.equal(a.source, "api-gateway");
    assert.equal(a.target, "case-service");
    assert.equal(a.dir, "in");
    assert.equal(a.reqBytes, 2);
    assert.equal(a.resBytes, 2);
    assert.ok(a.latencyMs >= 10, `latency ${a.latencyMs}`);
    assert.ok(a.id.startsWith("case-service:"));
    assert.equal(b.status, 404);
    assert.equal(b.source, "file-service");
    assert.ok(!JSON.stringify(events).includes("secret"), "query strings never stored");
  } finally {
    server.close();
  }
});

test("unknown x-lv-source values fall back to client", async () => {
  const t = createTelemetry({ service: "auth-service", ...quiet });
  const mw = t.middleware();
  const { server, url } = await listen((req, res) => mw(req, res, () => res.end("x")));
  try {
    await fetch(`${url}/auth/me`, { headers: { "x-lv-source": "<script>" } });
    await fetch(`${url}/auth/me`, { headers: { "x-lv-source": "auth-service" } }); // self is not a source
    await wait(10);
    assert.deepEqual(t.buffer.since(0).events.map((e) => e.source), ["client", "client"]);
  } finally {
    server.close();
  }
});

test("middleware never blocks or fails the request when recording throws", async () => {
  let errorsSeen = 0;
  const t = createTelemetry({ service: "file-service", onError: () => { errorsSeen++; } });
  // Sabotage the buffer: every push throws.
  t.buffer.push = () => { throw new Error("disk on fire"); };
  const mw = t.middleware();
  const { server, url } = await listen((req, res) => mw(req, res, () => res.end("fine")));
  try {
    const r = await fetch(`${url}/files`);
    assert.equal(r.status, 200);
    assert.equal(await r.text(), "fine");
    await wait(10);
    assert.ok(errorsSeen >= 1);
  } finally {
    server.close();
  }
});

test("middleware calls next exactly once even when req is malformed", () => {
  const t = createTelemetry({ service: "case-service", ...quiet });
  const mw = t.middleware();
  let calls = 0;
  // A req/res with nothing on them: instrumentation fails, request continues.
  mw({}, {}, () => { calls++; });
  mw(null, null, () => { calls++; });
  assert.equal(calls, 2);
});

test("disabled telemetry is a pure pass-through", async () => {
  const t = createTelemetry({ service: "case-service", enabled: false, ...quiet });
  let calls = 0;
  t.middleware()({ headers: {} }, {}, () => { calls++; });
  assert.equal(calls, 1);
  assert.equal(t.record({ method: "GET" }), null);
  const res = fakeRes();
  t.recentHandler()({ headers: {}, query: {} }, res);
  assert.equal(res.body.data.enabled, false);
  assert.deepEqual(res.body.data.events, []);
});

test("aborted requests are recorded as 499", async () => {
  const t = createTelemetry({ service: "file-service", ...quiet });
  const mw = t.middleware();
  const { server, url } = await listen((req, res) => mw(req, res, () => { /* never responds */ }));
  try {
    const ctrl = new AbortController();
    const p = fetch(`${url}/files/upload`, { signal: ctrl.signal }).catch(() => null);
    await wait(30);
    ctrl.abort();
    await p;
    await wait(30);
    const [ev] = t.buffer.since(0).events;
    assert.equal(ev.status, 499);
  } finally {
    server.closeAllConnections();
    server.close();
  }
});

/* ---------------- outbound ---------------- */

test("wrapFetch labels and times calls to sibling services, and computes self time", async () => {
  const upstream = await listen((req, res) => {
    setTimeout(() => {
      const body = req.headers["x-lv-source"] || "none";
      res.setHeader("content-length", String(Buffer.byteLength(body)));
      res.end(body);
    }, 25);
  });
  const t = createTelemetry({ service: "case-service", targets: { [upstream.url]: "crypto-proxy" }, ...quiet });
  const tracked = t.wrapFetch(fetch);
  const mw = t.middleware();
  const front = await listen((req, res) => mw(req, res, async () => {
    const r = await tracked(`${upstream.url}/crypto/cases?x=1`, { method: "POST", body: "abc", headers: { "content-type": "application/json" } });
    res.end(await r.text());
  }));
  try {
    const r = await fetch(`${front.url}/cases`);
    assert.equal(await r.text(), "case-service", "x-lv-source header added for sibling calls");
    await wait(20);
    const events = t.buffer.since(0).events;
    const out = events.find((e) => e.dir === "out");
    const inb = events.find((e) => e.dir === "in");
    assert.equal(out.target, "crypto-proxy");
    assert.equal(out.route, "/crypto/cases");
    assert.equal(out.method, "POST");
    assert.equal(out.status, 200);
    assert.equal(out.reqBytes, 3);
    assert.ok(out.latencyMs >= 20);
    assert.ok(inb.selfMs < inb.latencyMs, "self time excludes the outbound call");
    assert.ok(inb.selfMs <= inb.latencyMs - out.latencyMs + 1);
  } finally {
    upstream.server.close();
    front.server.close();
  }
});

test("wrapFetch leaves third-party calls untouched and does not mutate caller headers", async () => {
  const t = createTelemetry({ service: "case-service", targets: { "http://crypto.local:4004": "crypto-proxy" }, ...quiet });
  let seen;
  const fake = async (url, o) => { seen = o; return { status: 200, headers: new Headers() }; };
  const tracked = t.wrapFetch(fake);
  const callerHeaders = { a: "1" };
  await tracked("https://example.com/x", { headers: callerHeaders });
  assert.equal(seen.headers, callerHeaders);
  assert.equal(seen.headers["x-lv-source"], undefined);
  await tracked("http://crypto.local:4004/crypto/x", { headers: callerHeaders });
  assert.equal(seen.headers["x-lv-source"], "case-service");
  assert.deepEqual(callerHeaders, { a: "1" }, "caller object not mutated");
  assert.equal(t.buffer.since(0).events.length, 1);
});

test("wrapFetch records network failures and timeouts, then rethrows the original error", async () => {
  const t = createTelemetry({ service: "file-service", targets: { "http://crypto.local:4004": "crypto-proxy" }, ...quiet });
  const boom = Object.assign(new Error("fetch failed"), { cause: { code: "ECONNREFUSED" } });
  const tracked = t.wrapFetch(async () => { throw boom; });
  await assert.rejects(tracked("http://crypto.local:4004/crypto/files"), (e) => e === boom);
  const timeoutErr = Object.assign(new Error("Upstream timeout"), { code: "UPSTREAM_TIMEOUT", status: 504 });
  const tracked2 = t.wrapFetch(async () => { throw timeoutErr; });
  await assert.rejects(tracked2("http://crypto.local:4004/crypto/files"), (e) => e === timeoutErr);
  const [a, b] = t.buffer.since(0).events;
  assert.equal(a.status, 0);
  assert.equal(a.error, "ECONNREFUSED");
  assert.equal(b.status, 504);
  assert.equal(b.error, "timeout");
});

test("outbound calls made while serving /health are not recorded", async () => {
  const t = createTelemetry({ service: "case-service", targets: { "http://crypto.local:4004": "crypto-proxy" }, ...quiet });
  const tracked = t.wrapFetch(async () => ({ status: 200, headers: new Headers() }));
  const mw = t.middleware();
  const { server, url } = await listen((req, res) => mw(req, res, async () => {
    await tracked("http://crypto.local:4004/health");
    res.end("ok");
  }));
  try {
    await fetch(`${url}/readyz`);
    await wait(10);
    assert.equal(t.buffer.since(0).events.length, 0);
  } finally {
    server.close();
  }
});

test("trackOperation times external operations and preserves results and errors", async () => {
  const t = createTelemetry({ service: "crypto-proxy", ...quiet });
  const v = await t.trackOperation({ target: "b2", method: "PUT", route: "PutObject", reqBytes: 1024 }, async () => 42);
  assert.equal(v, 42);
  const err = Object.assign(new Error("denied"), { name: "AccessDenied", $metadata: { httpStatusCode: 403 } });
  await assert.rejects(t.trackOperation({ target: "b2", method: "GET", route: "GetObject" }, async () => { throw err; }), (e) => e === err);
  const [ok, bad] = t.buffer.since(0).events;
  assert.deepEqual([ok.target, ok.route, ok.status, ok.reqBytes], ["b2", "PutObject", 200, 1024]);
  assert.deepEqual([bad.status, bad.error], [403, "AccessDenied"]);
});

test("attachS3 adds a middleware that never records object keys", async () => {
  const t = createTelemetry({ service: "crypto-proxy", ...quiet });
  let mw;
  const client = { middlewareStack: { add: (fn) => { mw = fn; } } };
  assert.equal(t.attachS3(client), true);
  const handler = mw(async () => ({ output: "ok" }), { commandName: "PutObjectCommand" });
  const out = await handler({ input: { Key: "tenant-1/case-2/file-3", ContentLength: 2048 } });
  assert.equal(out.output, "ok");
  const [ev] = t.buffer.since(0).events;
  assert.equal(ev.route, "PutObject");
  assert.equal(ev.method, "PUT");
  assert.equal(ev.reqBytes, 2048);
  assert.ok(!JSON.stringify(ev).includes("tenant-1"));
});

test("attachMongo records command name + collection only, and skips handshakes", () => {
  const t = createTelemetry({ service: "auth-service", ...quiet });
  const { EventEmitter } = require("node:events");
  const client = new EventEmitter();
  assert.equal(t.attachMongo(client), true);
  client.emit("commandStarted", { commandName: "hello", connectionId: 1, requestId: 1, command: {} });
  client.emit("commandSucceeded", { commandName: "hello", connectionId: 1, requestId: 1, duration: 1 });
  client.emit("commandStarted", { commandName: "find", connectionId: 1, requestId: 2, command: { find: "users", filter: { email: "a@b.c" } } });
  client.emit("commandSucceeded", { commandName: "find", connectionId: 1, requestId: 2, duration: 7.5 });
  client.emit("commandStarted", { commandName: "insert", connectionId: 2, requestId: 3, command: { insert: "users" } });
  client.emit("commandFailed", { commandName: "insert", connectionId: 2, requestId: 3, duration: 3, failure: { codeName: "DuplicateKey" } });
  const events = t.buffer.since(0).events;
  assert.equal(events.length, 2);
  assert.deepEqual([events[0].target, events[0].route, events[0].latencyMs, events[0].status], ["mongodb", "find users", 7.5, 200]);
  assert.deepEqual([events[1].status, events[1].error], [500, "DuplicateKey"]);
  assert.ok(!JSON.stringify(events).includes("a@b.c"));
});

/* ---------------- recent handler ---------------- */

test("recentHandler serves events since a cursor", () => {
  const t = createTelemetry({ service: "case-service", token: "", ...quiet });
  for (let i = 0; i < 5; i++) t.record({ method: "GET", route: "/cases", status: 200, latencyMs: i });
  const res = fakeRes();
  t.recentHandler()({ headers: {}, query: { since: "2" } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["cache-control"], "no-store");
  assert.equal(res.body.data.service, "case-service");
  assert.equal(res.body.data.bootId, t.bootId);
  assert.deepEqual(res.body.data.events.map((e) => e.seq), [3, 4, 5]);
  assert.equal(res.body.data.seq, 5);
});

test("recentHandler enforces TELEMETRY_TOKEN when configured", () => {
  const t = createTelemetry({ service: "case-service", token: "s3cret", ...quiet });
  const denied = fakeRes();
  t.recentHandler()({ headers: { "x-telemetry-token": "wrong" }, query: {} }, denied);
  assert.equal(denied.statusCode, 401);
  const missing = fakeRes();
  t.recentHandler()({ headers: {}, query: {} }, missing);
  assert.equal(missing.statusCode, 401);
  const ok = fakeRes();
  t.recentHandler()({ headers: { "x-telemetry-token": "s3cret" }, query: {} }, ok);
  assert.equal(ok.statusCode, 200);
});

test("live listeners receive events and a throwing listener cannot break recording", () => {
  const t = createTelemetry({ service: "api-gateway", ...quiet });
  const got = [];
  t.emitter.on("event", () => { throw new Error("bad listener"); });
  t.emitter.on("event", (e) => got.push(e));
  const ev = t.record({ method: "GET", route: "/x", status: 200, latencyMs: 1 });
  assert.ok(ev);
  assert.equal(t.buffer.size, 1);
});

test("the vendored copies in every service are identical to this canonical file", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const root = path.join(__dirname, "..", "..", "..");
  const canonical = fs.readFileSync(path.join(__dirname, "..", "index.js"), "utf8");
  for (const svc of ["api-gateway", "auth-service", "case-service", "file-service", "crypto-proxy"]) {
    const p = path.join(root, "services", svc, "src", "telemetry", "index.js");
    assert.ok(fs.existsSync(p), `${svc} is missing its telemetry copy (run: node scripts/sync-telemetry.js)`);
    const copy = fs.readFileSync(p, "utf8");
    assert.ok(copy.endsWith(canonical), `${svc} telemetry copy is out of date (run: node scripts/sync-telemetry.js)`);
  }
});

test("requests marked x-lv-telemetry: skip (telemetry plumbing) are not recorded", async () => {
  const t = createTelemetry({ service: "auth-service", ...quiet });
  const mw = t.middleware();
  const { server, url } = await listen((req, res) => mw(req, res, () => res.end("x")));
  try {
    await fetch(`${url}/auth/me`, { headers: { "x-lv-telemetry": "skip" } });
    await fetch(`${url}/auth/me`);
    await wait(10);
    assert.equal(t.buffer.since(0).events.length, 1);
  } finally {
    server.close();
  }
});

test("outbound time is attributed via x-request-id when async context is lost (multer-style callbacks)", async () => {
  const t = createTelemetry({ service: "file-service", targets: { "http://crypto.local:4004": "crypto-proxy" }, ...quiet });
  const tracked = t.wrapFetch(async () => { await wait(40); return { status: 201, headers: new Headers() }; });
  const mw = t.middleware();
  const { EventEmitter } = require("node:events");
  const detached = new EventEmitter(); // emits outside the request's async context
  const { server, url } = await listen((req, res) => {
    req.requestId = "rid-123";
    mw(req, res, () => {
      detached.once("go", async () => {
        await tracked("http://crypto.local:4004/crypto/files/upload", { method: "POST", headers: { "x-request-id": "rid-123" } });
        res.end("ok");
      });
    });
  });
  try {
    const p = fetch(`${url}/files/upload`, { method: "POST" });
    await wait(20);
    setImmediate(() => detached.emit("go"));
    await p;
    await wait(10);
    const inb = t.buffer.since(0).events.find((e) => e.dir === "in");
    assert.ok(inb.latencyMs >= 40);
    assert.ok(inb.selfMs < inb.latencyMs - 30, `self ${inb.selfMs} vs latency ${inb.latencyMs}`);
  } finally {
    server.close();
  }
});
