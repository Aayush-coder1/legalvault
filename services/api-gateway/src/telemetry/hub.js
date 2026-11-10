/**
 * Telemetry hub (gateway only).
 *
 * Merges the gateway's own request events with every upstream service's
 * ring buffer (pulled from GET <service>/telemetry/recent), turns them into
 * edge events ("client -> api-gateway", "case-service -> crypto-proxy",
 * "crypto-proxy -> b2"...) and keeps a sliding window for live stats.
 *
 * Polling runs ONLY while at least one subscriber (dashboard) is connected,
 * so an idle system pays nothing. Every network call has a short timeout
 * and failures only mark that service "down" in the health map.
 */
const { EventEmitter } = require("events");
const telemetryStore = require("./store");

const NODE_IDS = Object.freeze([
  "client",
  "api-gateway",
  "auth-service",
  "case-service",
  "file-service",
  "crypto-proxy",
  "mongodb",
  "b2",
]);
const EXTERNAL = new Set(["mongodb", "b2"]);
const KNOWN = new Set(NODE_IDS);

/**
 * Convert one raw service event into an edge event, or null when the hop
 * is already represented by the receiver's own inbound event (so nothing is
 * counted twice).
 */
function toEdgeEvent(e) {
  if (!e || typeof e !== "object") return null;
  let from;
  let to;
  if (e.dir === "in") {
    from = KNOWN.has(e.source) ? e.source : "client";
    to = e.target;
  } else {
    from = e.service;
    to = e.target;
    const internalFailure = !EXTERNAL.has(to) && (e.status === 0 || (e.error && e.status >= 500));
    // A successful call to a sibling shows up as that sibling's inbound event.
    if (!EXTERNAL.has(to) && !internalFailure) return null;
  }
  if (!KNOWN.has(from) || !KNOWN.has(to) || from === to) return null;
  return {
    id: e.id,
    ts: e.ts,
    from,
    to,
    method: e.method,
    route: e.route,
    status: e.status,
    ms: e.latencyMs,
    self: e.selfMs,
    bytes: (e.reqBytes || 0) + (e.resBytes || 0),
    err: e.error,
  };
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function r1(n) {
  return Math.round(n * 10) / 10;
}

function isError(status) {
  return status === 0 || status >= 400;
}

/** Aggregate a list of edge events into the numbers one node/edge shows. */
function summarize(events, { rateWindowMs, now }) {
  const lat = [];
  const self = [];
  let c4 = 0;
  let c5 = 0;
  let bytes = 0;
  let recent = 0;
  let recentBytes = 0;
  for (const e of events) {
    lat.push(e.ms || 0);
    if (e.self !== undefined) self.push(e.self);
    if (e.status >= 400 && e.status < 500) c4++;
    else if (e.status >= 500 || e.status === 0) c5++;
    bytes += e.bytes || 0;
    if (now - e.ts <= rateWindowMs) {
      recent++;
      recentBytes += e.bytes || 0;
    }
  }
  lat.sort((a, b) => a - b);
  self.sort((a, b) => a - b);
  const count = events.length;
  const mean = count ? lat.reduce((a, b) => a + b, 0) / count : 0;
  const rps = recent / (rateWindowMs / 1000);
  return {
    count,
    rps: r1(rps),
    p50: r1(percentile(lat, 50)),
    p95: r1(percentile(lat, 95)),
    p99: r1(percentile(lat, 99)),
    meanMs: r1(mean),
    selfP50: self.length ? r1(percentile(self, 50)) : null,
    err4xx: c4,
    err5xx: c5,
    errorRate: count ? r1(((c4 + c5) / count) * 100) : 0,
    serverErrorRate: count ? r1((c5 / count) * 100) : 0,
    bytesPerSec: Math.round(recentBytes / (rateWindowMs / 1000)),
    totalBytes: bytes,
    // Little's law: average requests in flight = arrival rate x time in system.
    inFlight: r1(rps * (mean / 1000)),
  };
}

class TelemetryHub extends EventEmitter {
  /**
   * @param {object} o
   * @param {object} o.local        the gateway's own telemetry instance
   * @param {{name:string,url:string}[]} o.upstreams
   * @param {number} [o.pollMs]
   * @param {number} [o.windowMs]
   * @param {number} [o.rateWindowMs] window for "requests per second" (default 10s)
   * @param {string} [o.token]      TELEMETRY_TOKEN sent to upstreams
   * @param {Function} [o.fetchImpl]
   * @param {Function} [o.now]
   */
  constructor(o) {
    super();
    this.setMaxListeners(100);
    this.local = o.local;
    this.upstreams = (o.upstreams || []).filter((u) => u && u.url);
    this.pollMs = o.pollMs || 1000;
    this.windowMs = o.windowMs || 60000;
    this.rateWindowMs = o.rateWindowMs || 10000;
    this.token = o.token || "";
    this.fetchImpl = o.fetchImpl || ((...a) => fetch(...a));
    this.now = o.now || Date.now;
    this.maxWindowEvents = o.maxWindowEvents || 50000;

    this.window = []; // edge events, oldest first
    this.pending = []; // edge events not yet broadcast
    this.seen = new Set(); // ids in window (dedupe across restarts/cursor resets)
    this.cursors = new Map(); // name -> { bootId, seq }
    this.health = new Map(); // name -> { status, checkedAt, lastOkAt, error, pollMs, dropped }
    this.inflight = new Set();
    this.subscribers = 0;
    this.timer = null;
    this.totals = { events: 0, since: this.now() };

    for (const u of this.upstreams) this.health.set(u.name, { status: "unknown" });
    this.health.set(this.local ? this.local.service : "api-gateway", { status: "up", lastOkAt: this.now() });

    this.localSeq = 0;
  }

  /** Start/stop polling with the number of connected dashboards. */
  subscribe(listener) {
    this.on("batch", listener);
    this.subscribers++;
    if (this.subscribers === 1) this._start();
    let done = false;
    return () => {
      if (done) return;
      done = true;
      this.off("batch", listener);
      this.subscribers = Math.max(0, this.subscribers - 1);
      if (this.subscribers === 0) this._stop();
    };
  }

  _start() {
    this.tick().catch(() => {});
    this.timer = setInterval(() => this.tick().catch(() => {}), this.pollMs);
    if (this.timer.unref) this.timer.unref();
  }

  _stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  _ingest(rawEvents) {
    for (const raw of rawEvents) {
      const ev = toEdgeEvent(raw);
      if (!ev || !ev.id || this.seen.has(ev.id)) continue;
      this.seen.add(ev.id);
      this.window.push(ev);
      this.pending.push(ev);
      this.totals.events++;
    }
    if (this.window.length > this.maxWindowEvents) {
      const drop = this.window.splice(0, this.window.length - this.maxWindowEvents);
      for (const e of drop) this.seen.delete(e.id);
    }
  }

  _prune() {
    const cutoff = this.now() - this.windowMs;
    let i = 0;
    while (i < this.window.length && this.window[i].ts < cutoff) {
      this.seen.delete(this.window[i].id);
      i++;
    }
    if (i) this.window.splice(0, i);
  }

  async pollOne(u) {
    if (this.inflight.has(u.name)) return; // previous poll still running: skip, never pile up
    this.inflight.add(u.name);
    const cur = this.cursors.get(u.name) || { bootId: null, seq: 0 };
    const started = this.now();
    const prev = this.health.get(u.name) || {};
    try {
      const headers = { accept: "application/json" };
      if (this.token) headers["x-telemetry-token"] = this.token;
      const res = await this.fetchImpl(`${u.url}/telemetry/recent?since=${cur.seq}&limit=1000`, {
        headers,
        signal: AbortSignal.timeout(Math.min(4000, Math.max(1500, this.pollMs * 2.5))),
      });
      if (!res.ok) throw new Error(res.status === 401 ? "telemetry token rejected" : `HTTP ${res.status}`);
      const body = await res.json();
      const d = body && body.data;
      if (!d || !Array.isArray(d.events)) throw new Error("bad telemetry payload");
      if (d.enabled === false) {
        this.health.set(u.name, { status: "disabled", checkedAt: this.now(), lastOkAt: this.now(), pollMs: this.now() - started });
        return;
      }
      const events = d.events;
      if (cur.bootId && d.bootId !== cur.bootId && cur.seq > 0) {
        // Service restarted: its sequence numbers start again from 1.
        // Re-read from the beginning of the new process.
        this.cursors.set(u.name, { bootId: d.bootId, seq: 0 });
        this.inflight.delete(u.name);
        return await this.pollOne(u);
      }
      this._ingest(events);
      this.cursors.set(u.name, { bootId: d.bootId, seq: d.seq });
      this.health.set(u.name, {
        status: "up",
        checkedAt: this.now(),
        lastOkAt: this.now(),
        pollMs: this.now() - started,
        dropped: d.dropped || 0,
      });
    } catch (e) {
      const timeout = e && (e.name === "TimeoutError" || e.name === "AbortError");
      const cause = e && e.cause ? e.cause.code || e.cause.message : null;
      this.health.set(u.name, {
        status: "down",
        checkedAt: this.now(),
        lastOkAt: prev.lastOkAt,
        error: timeout ? "timeout" : cause || (e && e.message) || "unreachable",
      });
    } finally {
      this.inflight.delete(u.name);
    }
  }

  /** Read the gateway's own buffer (same cursor model as upstreams). */
  pullLocal() {
    if (!this.local || !this.local.buffer) return;
    try {
      for (let i = 0; i < 20; i++) {
        const out = this.local.buffer.since(this.localSeq, 1000);
        this._ingest(out.events);
        this.localSeq = out.seq;
        if (out.seq >= out.newest) break;
      }
    } catch { /* local telemetry is best-effort */ }
  }

  /** One polling round: pull every upstream, then broadcast what is new. */
  async tick() {
    this.pullLocal();
    await Promise.all(this.upstreams.map((u) => this.pollOne(u)));
    this.pullLocal();
    this._prune();
    // Persist newly ingested events to MongoDB (best-effort, never blocks).
    const toPersist = this.pending.slice(0);
    if (toPersist.length) {
      telemetryStore.insertMany(toPersist).catch(() => {});
    }
    this.flush();
  }

  flush() {
    const traffic = this.pending.splice(0, this.pending.length);
    try {
      this.emit("batch", { traffic, serverNow: this.now() });
    } catch { /* a broken subscriber is removed by its own close handler */ }
  }

  healthSnapshot() {
    const out = {};
    for (const [name, h] of this.health) out[name] = { ...h };
    return out;
  }

  /** Everything the dashboard's metric cards and node cards need. */
  stats() {
    this._prune();
    const now = this.now();
    const opts = { rateWindowMs: this.rateWindowMs, now };
    const byNode = new Map();
    const byEdge = new Map();
    for (const e of this.window) {
      if (!byNode.has(e.to)) byNode.set(e.to, []);
      byNode.get(e.to).push(e);
      const k = `${e.from}->${e.to}`;
      if (!byEdge.has(k)) byEdge.set(k, []);
      byEdge.get(k).push(e);
    }
    const nodes = {};
    for (const id of NODE_IDS) {
      if (id === "client") continue;
      nodes[id] = summarize(byNode.get(id) || [], opts);
    }
    // The client node "receives" nothing; show what it sends instead.
    const clientOut = this.window.filter((e) => e.from === "client");
    nodes.client = summarize(clientOut, opts);

    const edges = {};
    for (const [k, list] of byEdge) {
      const s = summarize(list, opts);
      edges[k] = { rps: s.rps, count: s.count, p95: s.p95, errorRate: s.errorRate, serverErrorRate: s.serverErrorRate };
    }

    const entry = summarize(clientOut, opts);
    const crypto = nodes["crypto-proxy"];
    return {
      serverNow: now,
      windowMs: this.windowMs,
      rateWindowMs: this.rateWindowMs,
      global: {
        rps: entry.rps,
        p50: entry.p50,
        p95: entry.p95,
        p99: entry.p99,
        errorRate: entry.errorRate,
        serverErrorRate: entry.serverErrorRate,
        err4xx: entry.err4xx,
        err5xx: entry.err5xx,
        requests: entry.count,
        internalRps: r1(this.window.filter((e) => now - e.ts <= this.rateWindowMs).length / (this.rateWindowMs / 1000)),
      },
      crypto: {
        rps: crypto.rps,
        p95: crypto.p95,
        inFlight: crypto.inFlight,
        bytesPerSec: crypto.bytesPerSec,
        errorRate: crypto.errorRate,
        b2Rps: nodes.b2.rps,
        mongoRps: nodes.mongodb.rps,
      },
      nodes,
      edges,
      health: this.healthSnapshot(),
      totals: { ...this.totals },
    };
  }

  /** Recent edge events (newest last), for the request log on first paint. */
  recent(limit = 50) {
    return this.window.slice(-limit);
  }
}

module.exports = { TelemetryHub, toEdgeEvent, summarize, percentile, NODE_IDS };
