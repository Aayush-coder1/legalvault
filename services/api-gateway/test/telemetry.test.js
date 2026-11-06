const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const { createTelemetry } = require("../src/telemetry");
const { TelemetryHub, toEdgeEvent, summarize, percentile } = require("../src/telemetry/hub");
const { createTelemetryRouter } = require("../src/telemetry/routes");

const quiet = { onError: () => {} };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function listen(app) {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` }));
  });
}

/** A fake upstream service: real telemetry middleware + recent endpoint. */
async function fakeService(name, { token = "" } = {}) {
  const tel = createTelemetry({ service: name, token, ...quiet });
  const app = express();
  app.use(tel.middleware());
  app.get("/telemetry/recent", tel.recentHandler());
  app.all("/fail", (req, res) => res.status(500).json({ ok: false }));
  app.all("/denied", (req, res) => res.status(403).json({ ok: false }));
  app.all("*", (req, res) => setTimeout(() => res.json({ ok: true, service: name }), 5));
  const s = await listen(app);
  return { ...s, tel, name };
}

/* ---------------- edge mapping ---------------- */

test("toEdgeEvent: inbound events become source -> service edges", () => {
  const e = toEdgeEvent({ id: "a", dir: "in", source: "api-gateway", target: "case-service", status: 200, latencyMs: 12, selfMs: 4, reqBytes: 10, resBytes: 20, ts: 1 });
  assert.deepEqual([e.from, e.to, e.ms, e.self, e.bytes], ["api-gateway", "case-service", 12, 4, 30]);
  const c = toEdgeEvent({ id: "b", dir: "in", source: "weird", target: "auth-service", status: 200 });
  assert.equal(c.from, "client");
});

test("toEdgeEvent: successful calls to siblings are not double counted, external calls and failed hops are", () => {
  assert.equal(toEdgeEvent({ id: "1", dir: "out", service: "case-service", target: "crypto-proxy", status: 200 }), null);
  assert.equal(toEdgeEvent({ id: "2", dir: "out", service: "case-service", target: "crypto-proxy", status: 404 }), null);
  const failed = toEdgeEvent({ id: "3", dir: "out", service: "api-gateway", target: "file-service", status: 0, error: "ECONNREFUSED" });
  assert.deepEqual([failed.from, failed.to, failed.err], ["api-gateway", "file-service", "ECONNREFUSED"]);
  const b2 = toEdgeEvent({ id: "4", dir: "out", service: "crypto-proxy", target: "b2", status: 200 });
  assert.deepEqual([b2.from, b2.to], ["crypto-proxy", "b2"]);
  const mongo = toEdgeEvent({ id: "5", dir: "out", service: "auth-service", target: "mongodb", status: 200 });
  assert.deepEqual([mongo.from, mongo.to], ["auth-service", "mongodb"]);
  assert.equal(toEdgeEvent({ id: "6", dir: "out", service: "x", target: "evil.example", status: 200 }), null);
  assert.equal(toEdgeEvent(null), null);
});

/* ---------------- stats ---------------- */

test("percentile and summarize compute p50/p95/p99, error split and rps", () => {
  const sorted = Array.from({ length: 100 }, (_, i) => i + 1);
  assert.equal(percentile(sorted, 50), 50);
  assert.equal(percentile(sorted, 95), 95);
  assert.equal(percentile(sorted, 99), 99);
  assert.equal(percentile([], 95), 0);
  const now = 100000;
  const events = [
    ...Array.from({ length: 18 }, (_, i) => ({ ts: now - 1000, ms: 10 + i, status: 200, bytes: 100 })),
    { ts: now - 2000, ms: 500, status: 404, bytes: 0 },
    { ts: now - 30000, ms: 900, status: 502, bytes: 0 },
  ];
  const s = summarize(events, { rateWindowMs: 10000, now });
  assert.equal(s.count, 20);
  assert.equal(s.rps, 1.9); // 19 events in the last 10s
  assert.equal(s.err4xx, 1);
  assert.equal(s.err5xx, 1);
  assert.equal(s.errorRate, 10);
  assert.equal(s.serverErrorRate, 5);
  assert.equal(s.p99, 900);
  assert.ok(s.p50 >= 18 && s.p50 <= 20);
  assert.equal(s.bytesPerSec, 180);
});

/* ---------------- hub polling ---------------- */

test("hub pulls every upstream, merges with local events and reports health", async () => {
  const auth = await fakeService("auth-service");
  const caseSvc = await fakeService("case-service");
  const local = createTelemetry({ service: "api-gateway", ...quiet });
  const hub = new TelemetryHub({
    local,
    upstreams: [
      { name: "auth-service", url: auth.url },
      { name: "case-service", url: caseSvc.url },
      { name: "file-service", url: "http://127.0.0.1:1" }, // nothing listens here
    ],
    pollMs: 50,
  });
  const batches = [];
  const unsubscribe = hub.subscribe((b) => batches.push(b));
  try {
    await fetch(`${auth.url}/auth/login`, { method: "POST", headers: { "x-forwarded-by": "legalvault-gateway" } });
    await fetch(`${caseSvc.url}/fail`, { headers: { "x-forwarded-by": "legalvault-gateway" } });
    local.record({ dir: "in", source: "client", target: "api-gateway", method: "POST", route: "/auth/login", status: 200, latencyMs: 9 });
    await wait(250);
    const traffic = batches.flatMap((b) => b.traffic);
    const pairs = traffic.map((e) => `${e.from}->${e.to} ${e.status}`).sort();
    assert.deepEqual(pairs, ["api-gateway->auth-service 200", "api-gateway->case-service 500", "client->api-gateway 200"]);
    const ids = new Set(traffic.map((e) => e.id));
    assert.equal(ids.size, traffic.length, "no duplicates across polls");
    const st = hub.stats();
    assert.equal(st.health["auth-service"].status, "up");
    assert.equal(st.health["file-service"].status, "down");
    assert.equal(st.nodes["case-service"].err5xx, 1);
    assert.equal(st.global.requests, 1);
    assert.equal(st.edges["api-gateway->auth-service"].count, 1);
  } finally {
    unsubscribe();
    auth.server.close();
    caseSvc.server.close();
  }
});

test("hub stops polling when the last dashboard disconnects", async () => {
  let calls = 0;
  const hub = new TelemetryHub({
    upstreams: [{ name: "auth-service", url: "http://x" }],
    pollMs: 30,
    fetchImpl: async () => { calls++; return { ok: true, json: async () => ({ data: { bootId: "b", seq: 0, events: [] } }) }; },
  });
  const off = hub.subscribe(() => {});
  await wait(120);
  off();
  const after = calls;
  assert.ok(after >= 2);
  await wait(120);
  assert.equal(calls, after, "no polling with zero subscribers");
  assert.equal(hub.timer, null);
});

test("hub detects an upstream restart (new bootId) and re-reads from the start", async () => {
  let boot = "boot-1";
  let events = [{ id: "case-service:boot-1:1", seq: 1, dir: "in", source: "client", target: "case-service", status: 200, ts: Date.now() }];
  const seenSince = [];
  const hub = new TelemetryHub({
    upstreams: [{ name: "case-service", url: "http://x" }],
    fetchImpl: async (url) => {
      const since = Number(new URL(url).searchParams.get("since"));
      seenSince.push(since);
      const evs = events.filter((e) => e.seq > since);
      return { ok: true, json: async () => ({ data: { bootId: boot, seq: evs.length ? evs[evs.length - 1].seq : since, events: evs } }) };
    },
  });
  await hub.tick();
  boot = "boot-2";
  events = [{ id: "case-service:boot-2:1", seq: 1, dir: "in", source: "client", target: "case-service", status: 201, ts: Date.now() }];
  await hub.tick();
  assert.deepEqual(seenSince, [0, 1, 0]);
  assert.equal(hub.window.length, 2);
});

test("hub sends TELEMETRY_TOKEN and marks a rejected token as down", async () => {
  const svc = await fakeService("crypto-proxy", { token: "t0k" });
  try {
    const good = new TelemetryHub({ upstreams: [{ name: "crypto-proxy", url: svc.url }], token: "t0k" });
    await good.tick();
    assert.equal(good.stats().health["crypto-proxy"].status, "up");
    const bad = new TelemetryHub({ upstreams: [{ name: "crypto-proxy", url: svc.url }], token: "nope" });
    await bad.tick();
    assert.equal(bad.stats().health["crypto-proxy"].status, "down");
    assert.match(bad.stats().health["crypto-proxy"].error, /token/);
  } finally {
    svc.server.close();
  }
});

test("hub prunes events older than the window", async () => {
  let now = 1_000_000;
  const hub = new TelemetryHub({ upstreams: [], windowMs: 10000, now: () => now });
  hub._ingest([{ id: "a", dir: "in", source: "client", target: "auth-service", status: 200, ts: now }]);
  now += 20000;
  hub._ingest([{ id: "b", dir: "in", source: "client", target: "auth-service", status: 200, ts: now }]);
  const st = hub.stats();
  assert.equal(st.nodes["auth-service"].count, 1);
  assert.equal(hub.seen.has("a"), false);
});

/* ---------------- SSE + stats routes ---------------- */

async function readSse(url, init, { until, timeoutMs = 3000 }) {
  const ctrl = new AbortController();
  const res = await fetch(url, { ...init, signal: ctrl.signal });
  const events = [];
  if (res.status !== 200) return { res, events };
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  const deadline = Date.now() + timeoutMs;
  try {
    while (Date.now() < deadline) {
      const { value, done } = await Promise.race([
        reader.read(),
        wait(deadline - Date.now()).then(() => ({ done: true })),
      ]);
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n\n")) !== -1) {
        const block = buf.slice(0, i);
        buf = buf.slice(i + 2);
        const ev = /^event: (.*)$/m.exec(block);
        const data = /^data: (.*)$/m.exec(block);
        if (ev && data) events.push({ event: ev[1], data: JSON.parse(data[1]) });
      }
      if (until(events)) break;
    }
  } finally {
    ctrl.abort();
  }
  return { res, events };
}

test("SSE stream sends hello, live traffic and stats", async () => {
  const caseSvc = await fakeService("case-service");
  const hub = new TelemetryHub({ upstreams: [{ name: "case-service", url: caseSvc.url }], pollMs: 100 });
  const app = express();
  app.use("/api/v1/telemetry", createTelemetryRouter({ hub, authUrl: "http://unused", requireAuth: false }));
  const gw = await listen(app);
  try {
    setTimeout(() => fetch(`${caseSvc.url}/cases`, { headers: { "x-forwarded-by": "legalvault-gateway" } }), 300);
    const { res, events } = await readSse(`${gw.url}/api/v1/telemetry/stream`, {}, {
      until: (evs) => evs.some((e) => e.event === "traffic") && evs.some((e) => e.event === "stats"),
    });
    assert.equal(res.headers.get("content-type"), "text/event-stream; charset=utf-8");
    assert.equal(events[0].event, "hello");
    assert.ok(events[0].data.nodes.includes("crypto-proxy"));
    const traffic = events.find((e) => e.event === "traffic");
    assert.equal(traffic.data.traffic[0].to, "case-service");
    assert.equal(traffic.data.traffic[0].from, "api-gateway");
    const stats = events.find((e) => e.event === "stats");
    assert.ok(stats.data.nodes["case-service"]);
    await wait(50);
    assert.equal(hub.subscribers, 0, "subscription released when the browser disconnects");
  } finally {
    caseSvc.server.close();
    gw.server.closeAllConnections();
    gw.server.close();
  }
});

test("stream and stats require a logged-in user when requireAuth is on", async () => {
  const authApp = express();
  authApp.get("/auth/me", (req, res) =>
    req.headers.authorization === "Bearer good" ? res.json({ success: true }) : res.status(401).json({ success: false }));
  const auth = await listen(authApp);
  const hub = new TelemetryHub({ upstreams: [] });
  const app = express();
  app.use("/api/v1/telemetry", createTelemetryRouter({ hub, authUrl: auth.url, requireAuth: true }));
  const gw = await listen(app);
  try {
    assert.equal((await fetch(`${gw.url}/api/v1/telemetry/stats`)).status, 401);
    assert.equal((await fetch(`${gw.url}/api/v1/telemetry/stats`, { headers: { authorization: "Bearer bad" } })).status, 401);
    const ok = await fetch(`${gw.url}/api/v1/telemetry/stats`, { headers: { authorization: "Bearer good" } });
    assert.equal(ok.status, 200);
    const body = await ok.json();
    assert.ok(body.data.global);
    const denied = await readSse(`${gw.url}/api/v1/telemetry/stream`, {}, { until: () => true });
    assert.equal(denied.res.status, 401);
    const allowed = await readSse(`${gw.url}/api/v1/telemetry/stream`, { headers: { authorization: "Bearer good" } }, {
      until: (evs) => evs.some((e) => e.event === "hello"),
    });
    assert.equal(allowed.res.status, 200);
  } finally {
    auth.server.close();
    gw.server.closeAllConnections();
    gw.server.close();
  }
});

test("stream refuses connections beyond maxClients and when telemetry is disabled", async () => {
  const hub = new TelemetryHub({ upstreams: [] });
  const app = express();
  app.use("/a", createTelemetryRouter({ hub, authUrl: "", requireAuth: false, maxClients: 1 }));
  app.use("/b", createTelemetryRouter({ hub, authUrl: "", requireAuth: false, enabled: false }));
  const gw = await listen(app);
  const ctrl = new AbortController();
  try {
    const first = await fetch(`${gw.url}/a/stream`, { signal: ctrl.signal });
    assert.equal(first.status, 200);
    const second = await fetch(`${gw.url}/a/stream`);
    assert.equal(second.status, 503);
    assert.equal((await fetch(`${gw.url}/b/stats`)).status, 503);
  } finally {
    ctrl.abort();
    gw.server.closeAllConnections();
    gw.server.close();
  }
});
