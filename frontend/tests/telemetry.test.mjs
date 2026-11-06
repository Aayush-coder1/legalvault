// Unit tests for the live topology's pure modules.
// Run: npm test   (Node >= 22.18 strips TypeScript types natively)
import test from "node:test";
import assert from "node:assert/strict";
import { createSseParser } from "../lib/telemetry/sse.ts";
import { buildCalibratedBreakscaleUrl, decodeD2, encodeD2, BREAKSCALE_ORIGIN } from "../lib/telemetry/breakscale.ts";
import { NODES, BASE_EDGES, edgeGeometry, bezierPoint, NODE_W, NODE_H, CANVAS_W, CANVAS_H } from "../lib/telemetry/topology.ts";

/* ---------------- SSE parser ---------------- */

test("SSE parser handles events split across arbitrary chunks", () => {
  const got = [];
  const p = createSseParser((m) => got.push(m));
  const stream = 'retry: 3000\n\nevent: hello\ndata: {"a":1}\n\n: ping 123\n\nevent: traffic\ndata: {"traffic":[1,2]}\n\n';
  for (let i = 0; i < stream.length; i += 3) p.push(stream.slice(i, i + 3));
  assert.deepEqual(got.map((m) => m.event), ["hello", "traffic"]);
  assert.deepEqual(JSON.parse(got[1].data), { traffic: [1, 2] });
});

test("SSE parser supports CRLF, multi-line data, default event name and end() flush", () => {
  const got = [];
  const p = createSseParser((m) => got.push(m));
  p.push("data: line1\r\ndata: line2\r\n\r\nevent: stats\ndata:{}");
  p.end();
  assert.equal(got[0].event, "message");
  assert.equal(got[0].data, "line1\nline2");
  assert.equal(got[1].event, "stats");
  assert.equal(got[1].data, "{}");
});

/* ---------------- BreakScale link ---------------- */

const node = (o = {}) => ({ count: 0, rps: 0, p50: 0, p95: 0, p99: 0, meanMs: 0, selfP50: null, err4xx: 0, err5xx: 0, errorRate: 0, serverErrorRate: 0, bytesPerSec: 0, totalBytes: 0, inFlight: 0, ...o });

function sampleStats() {
  return {
    serverNow: 0, windowMs: 60000, rateWindowMs: 10000,
    global: { rps: 4, p50: 50, p95: 300, p99: 600, errorRate: 2, err4xx: 1, err5xx: 1, requests: 100, internalRps: 12 },
    crypto: { rps: 3, p95: 120, inFlight: 0.3, bytesPerSec: 2048, errorRate: 0, b2Rps: 1, mongoRps: 2 },
    nodes: {
      client: node({ count: 100, rps: 4 }),
      "api-gateway": node({ count: 100, rps: 4, p50: 60, selfP50: 1.4 }),
      "auth-service": node({ count: 20, rps: 1, p50: 90, selfP50: 70 }),
      "case-service": node({ count: 50, rps: 2, p50: 80, selfP50: 12 }),
      "file-service": node({ count: 30, rps: 1, p50: 400, selfP50: 35, serverErrorRate: 10 }),
      "crypto-proxy": node({ count: 80, rps: 3, p50: 60, selfP50: 8 }),
      mongodb: node({ count: 90, rps: 3, p50: 9 }),
      b2: node({ count: 30, rps: 1, p50: 180 }),
    },
    edges: {
      "api-gateway->auth-service": { rps: 1, count: 20, p95: 0, errorRate: 0 },
      "api-gateway->case-service": { rps: 2, count: 50, p95: 0, errorRate: 0 },
      "api-gateway->file-service": { rps: 1, count: 30, p95: 0, errorRate: 0 },
    },
    health: {}, totals: { events: 0, since: 0 },
  };
}

// The same structural gate BreakScale applies to every link (src/clipboard.ts isTopology).
const BS_KINDS = new Set(["client", "lb", "service", "cache", "db", "queue", "worker", "replica", "shard", "cdn", "objectstore", "apigateway"]);
function looksLikeBreakscaleTopology(t) {
  const ids = new Set();
  for (const n of t.nodes) {
    if (typeof n.id !== "string" || !n.id || ids.has(n.id)) return false;
    if (typeof n.label !== "string" || !BS_KINDS.has(n.kind)) return false;
    if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) return false;
    if (typeof n.config !== "object" || !n.config) return false;
    for (const v of Object.values(n.config)) if (!Number.isFinite(v)) return false;
    ids.add(n.id);
  }
  for (const e of t.edges) {
    if (typeof e.id !== "string" || !ids.has(e.from) || !ids.has(e.to) || !Number.isFinite(e.weight)) return false;
  }
  return true;
}

test("encodeD2/decodeD2 round-trip with the RAW flag and a URL-safe alphabet", () => {
  const topo = { nodes: [{ id: "a", kind: "client", label: "Ünïcode ✓", x: 1, y: 2, config: { rps: 5 } }], edges: [] };
  const frag = encodeD2(topo);
  assert.match(frag, /^d2\.[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodeD2(frag), topo);
});

test("calibrated link carries live numbers into the BreakScale design", () => {
  const { url, calibration, liveSamples } = buildCalibratedBreakscaleUrl(sampleStats(), { multiplier: 10, now: new Date("2026-11-07T00:00:00Z") });
  assert.ok(url.startsWith(`${BREAKSCALE_ORIGIN}#d2.`));
  const t = decodeD2(url.split("#")[1]);
  assert.ok(looksLikeBreakscaleTopology(t), "passes BreakScale's structural validation");
  const byId = Object.fromEntries(t.nodes.map((n) => [n.id, n]));
  assert.equal(byId.client.config.rps, 40, "4 req/s x 10");
  assert.equal(byId.client.config.timeoutMs, 35000);
  assert.equal(byId.gateway.kind, "lb");
  assert.equal(byId.gateway.config.serviceMs, 1.4);
  assert.equal(byId.auth.config.serviceMs, 70, "self time, not end-to-end latency");
  assert.equal(byId.file.config.errorRate, 0.1);
  assert.equal(byId.mongo.config.serviceMs, 9);
  assert.equal(byId.b2.config.serviceMs, 180);
  const w = Object.fromEntries(t.edges.filter((e) => e.from === "gateway").map((e) => [e.to, e.weight]));
  assert.deepEqual(w, { auth: 20, case: 50, file: 30 });
  assert.equal(t.edges.length, 9);
  assert.equal(t.annotations[0].kind, "note");
  assert.ok(calibration.some((c) => c.source === "live"));
  assert.equal(liveSamples, 500);
  assert.ok(url.length < 8000, `link length ${url.length}`);
});

test("without live data the link still opens, using defaults", () => {
  const { url, calibration } = buildCalibratedBreakscaleUrl(null);
  const t = decodeD2(url.split("#")[1]);
  assert.ok(looksLikeBreakscaleTopology(t));
  assert.ok(calibration.every((c) => c.source === "default"));
  assert.ok(t.edges.every((e) => e.weight === 1));
});

/* ---------------- topology geometry ---------------- */

test("every node fits on the canvas and every edge endpoint touches its nodes", () => {
  for (const n of NODES) {
    assert.ok(n.x >= 0 && n.y >= 0 && n.x + NODE_W <= CANVAS_W && n.y + NODE_H <= CANVAS_H, n.id);
  }
  for (const [a, b] of BASE_EDGES) {
    const g = edgeGeometry(a, b);
    const s = bezierPoint(g, 0);
    const e = bezierPoint(g, 1);
    assert.deepEqual(s, g.p0);
    assert.deepEqual(e, g.p3);
    assert.ok(g.d.startsWith("M "));
  }
});
