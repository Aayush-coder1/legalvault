/**
 * LegalVault request telemetry — zero dependencies, CommonJS, Node 22.
 *
 * CANONICAL SOURCE. Each service deploys from its own folder on Render
 * (rootDir: services/<name>) and its Dockerfile copies only `src/`, so a
 * shared package outside the service folder would not ship. This file is
 * therefore vendored into every service as `src/telemetry/index.js` by
 * `node scripts/sync-telemetry.js`; a test fails if a copy drifts.
 *
 * What it records (and nothing else):
 *   timestamp, service, direction (in/out), source, target, HTTP method,
 *   SANITIZED route (ids stripped, no query string), status code,
 *   latency ms, self time ms, request/response byte counts.
 * Never recorded: headers, cookies, tokens, bodies, query strings, IPs,
 * user/tenant ids, S3 object keys, Mongo filters.
 *
 * Safety contract: telemetry can never fail or slow a real request.
 *   - every hook is wrapped in try/catch and swallows its own errors
 *   - the middleware always calls next() exactly once
 *   - recording is an O(1) write into a fixed-size ring buffer
 *   - TELEMETRY_ENABLED=false turns everything into a pass-through
 */
const crypto = require("crypto");
const { EventEmitter } = require("events");
const { AsyncLocalStorage } = require("async_hooks");

/** Service names that may appear as a source/target. Anything else -> "client". */
const KNOWN_SERVICES = Object.freeze([
  "api-gateway",
  "auth-service",
  "case-service",
  "file-service",
  "crypto-proxy",
]);
const EXTERNAL_TARGETS = Object.freeze(["mongodb", "b2"]);

/** Paths that are health/keep-alive noise (and the telemetry plumbing itself). */
const DEFAULT_SKIP = [/^\/health\/?$/, /^\/readyz\/?$/, /^\/telemetry(\/|$)/, /^\/api\/v1\/telemetry(\/|$)/];

const SOURCE_HEADER = "x-lv-source";
const TOKEN_HEADER = "x-telemetry-token";
/** Requests carrying this header are telemetry plumbing and never recorded. */
const INTERNAL_HEADER = "x-lv-telemetry";

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const ID_SEGMENT = [
  /^[a-f0-9]{24}$/i, // Mongo ObjectId
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, // UUID
  /^\d+$/, // numeric id
  /^[A-Za-z0-9_-]{20,}$/, // long opaque token / hash / file id
];

/**
 * Turn a raw URL path into a privacy-safe route shape.
 * "/cases/65f0c...a1/notes?x=1" -> "/cases/:id/notes"
 */
function sanitizeRoute(rawPath) {
  try {
    let p = String(rawPath || "/");
    const q = p.indexOf("?");
    if (q !== -1) p = p.slice(0, q);
    const h = p.indexOf("#");
    if (h !== -1) p = p.slice(0, h);
    const parts = p.split("/").map((seg) => {
      if (!seg) return seg;
      let s;
      try { s = decodeURIComponent(seg); } catch { s = seg; }
      if (ID_SEGMENT.some((re) => re.test(s))) return ":id";
      // Anything with characters outside a conservative route alphabet
      // (emails, file names, free text) is not a route word: hide it.
      if (!/^[A-Za-z0-9._-]{1,40}$/.test(s)) return ":param";
      return s;
    });
    const out = parts.join("/") || "/";
    return out.length > 96 ? out.slice(0, 96) : out;
  } catch {
    return "/";
  }
}

function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function nowMs(startNs) {
  return Number(process.hrtime.bigint() - startNs) / 1e6;
}

function safeEqual(a, b) {
  try {
    const ab = Buffer.from(String(a));
    const bb = Buffer.from(String(b));
    if (ab.length !== bb.length) return false;
    return crypto.timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* ring buffer                                                         */
/* ------------------------------------------------------------------ */

/**
 * Fixed-capacity buffer with a monotonically increasing sequence number.
 * Readers ask "everything after seq N"; if N has already been overwritten
 * they get what is left plus a `dropped` count, never an error.
 */
class RingBuffer {
  constructor(capacity) {
    this.capacity = Math.max(10, toInt(capacity) || 2000);
    this.items = new Array(this.capacity);
    this.seq = 0; // seq of the newest item (0 = empty)
  }

  push(item) {
    this.seq += 1;
    item.seq = this.seq;
    this.items[(this.seq - 1) % this.capacity] = item;
    return item;
  }

  /** Items with seq > since, oldest first, at most `limit`. */
  since(since, limit = 1000) {
    const newest = this.seq;
    const oldest = Math.max(1, newest - this.capacity + 1);
    let from = Math.max(toInt(since) + 1, oldest);
    const dropped = Math.max(0, oldest - (toInt(since) + 1));
    const out = [];
    const max = Math.max(1, Math.min(toInt(limit) || 1000, this.capacity));
    for (let s = from; s <= newest && out.length < max; s++) {
      out.push(this.items[(s - 1) % this.capacity]);
    }
    return { events: out, seq: out.length ? out[out.length - 1].seq : Math.max(toInt(since), 0), newest, dropped };
  }

  get size() {
    return Math.min(this.seq, this.capacity);
  }
}

/* ------------------------------------------------------------------ */
/* factory                                                             */
/* ------------------------------------------------------------------ */

/**
 * @param {object} opts
 * @param {string} opts.service        this service's name (one of KNOWN_SERVICES)
 * @param {number} [opts.capacity]     ring buffer size (default 2000)
 * @param {boolean} [opts.enabled]     default: TELEMETRY_ENABLED !== "false"
 * @param {string} [opts.token]        default: TELEMETRY_TOKEN (guards /telemetry/recent)
 * @param {Record<string,string>} [opts.targets] base URL -> service name, for outbound calls
 * @param {RegExp[]} [opts.skip]       paths not to record
 * @param {string[]} [opts.skipMethods] methods not to record (default: OPTIONS, i.e. CORS preflights)
 * @param {(e:Error)=>void} [opts.onError] diagnostics hook (default: rate-limited console.warn)
 */
function createTelemetry(opts = {}) {
  const service = String(opts.service || "unknown");
  const enabled = opts.enabled !== undefined ? !!opts.enabled : process.env.TELEMETRY_ENABLED !== "false";
  const token = opts.token !== undefined ? opts.token : process.env.TELEMETRY_TOKEN || "";
  const skip = Array.isArray(opts.skip) ? opts.skip : DEFAULT_SKIP;
  const skipMethods = new Set((Array.isArray(opts.skipMethods) ? opts.skipMethods : ["OPTIONS"]).map((m) => String(m).toUpperCase()));
  const buffer = new RingBuffer(opts.capacity || Number(process.env.TELEMETRY_BUFFER) || 2000);
  const bootId = crypto.randomBytes(6).toString("hex");
  const emitter = new EventEmitter();
  emitter.setMaxListeners(50);
  const als = new AsyncLocalStorage();
  // request-id -> request context. Fallback for code paths that lose async
  // context (e.g. multer/busboy callbacks): outbound calls that forward
  // x-request-id are still attributed to the right inbound request.
  const byRequestId = new Map();
  let targets = [];
  let lastWarn = 0;
  let errors = 0;

  const onError = typeof opts.onError === "function" ? opts.onError : (e) => {
    const t = Date.now();
    if (t - lastWarn > 60000) {
      lastWarn = t;
      console.warn(`[telemetry:${service}] ignored error: ${e && e.message}`);
    }
  };

  function fail(e) {
    errors += 1;
    try { onError(e); } catch { /* never throw from diagnostics */ }
  }

  function setTargets(map) {
    try {
      targets = Object.entries(map || {})
        .filter(([base, name]) => base && name)
        .map(([base, name]) => {
          const u = new URL(base);
          return { origin: u.origin, name: String(name) };
        });
    } catch (e) {
      fail(e);
    }
  }
  setTargets(opts.targets);

  /** Map an outbound URL to a service name ("crypto-proxy") or null. */
  function resolveTarget(url) {
    try {
      const origin = new URL(String(url)).origin;
      const hit = targets.find((t) => t.origin === origin);
      return hit ? hit.name : null;
    } catch {
      return null;
    }
  }

  function record(ev) {
    if (!enabled) return null;
    try {
      const item = buffer.push({
        id: "",
        ts: ev.ts || Date.now(),
        service,
        dir: ev.dir === "out" ? "out" : "in",
        source: ev.source,
        target: ev.target,
        method: String(ev.method || "GET").toUpperCase().slice(0, 10),
        route: ev.routeRaw !== undefined ? sanitizeRoute(ev.routeRaw) : String(ev.route || "/").slice(0, 96),
        status: toInt(ev.status),
        latencyMs: round1(Math.max(0, Number(ev.latencyMs) || 0)),
        selfMs: ev.selfMs === undefined ? undefined : round1(Math.max(0, Number(ev.selfMs) || 0)),
        reqBytes: toInt(ev.reqBytes),
        resBytes: toInt(ev.resBytes),
        error: ev.error ? String(ev.error).slice(0, 40) : undefined,
      });
      item.id = `${service}:${bootId}:${item.seq}`;
      if (emitter.listenerCount("event")) {
        try { emitter.emit("event", item); } catch (e) { fail(e); }
      }
      return item;
    } catch (e) {
      fail(e);
      return null;
    }
  }

  /** Who called us? Gateway, a sibling service, or the browser. */
  function detectSource(req) {
    try {
      const h = req.headers || {};
      if (h["x-forwarded-by"] === "legalvault-gateway") return "api-gateway";
      const s = String(h[SOURCE_HEADER] || "").toLowerCase();
      if (KNOWN_SERVICES.includes(s) && s !== service) return s;
    } catch { /* fall through */ }
    return "client";
  }

  /* ---------------- inbound: Express middleware ---------------- */

  function middleware() {
    return function requestTracker(req, res, next) {
      if (!enabled) return next();
      let ctx = null;
      try {
        const path = (req.originalUrl || req.url || "/").split("?")[0];
        const skipped =
          skipMethods.has(String(req.method || "").toUpperCase()) ||
          (req.headers && req.headers[INTERNAL_HEADER] === "skip") ||
          skip.some((re) => re.test(path));
        ctx = { skip: skipped, outboundMs: 0 };
        const rid = typeof req.requestId === "string" && req.requestId ? req.requestId : null;
        if (rid) {
          if (byRequestId.size > 10000) byRequestId.clear(); // leak guard
          byRequestId.set(rid, ctx);
          const forget = () => { if (byRequestId.get(rid) === ctx) byRequestId.delete(rid); };
          res.once("finish", forget);
          res.once("close", forget);
        }
        if (!skipped) {
          const start = process.hrtime.bigint();
          const ts = Date.now();
          const source = detectSource(req);
          const reqBytes = toInt(req.headers && req.headers["content-length"]);
          let done = false;
          const finish = (aborted) => {
            if (done) return;
            done = true;
            try {
              const latencyMs = nowMs(start);
              const status = aborted && !res.headersSent ? 499 : res.statusCode;
              record({
                ts,
                dir: "in",
                source,
                target: service,
                method: req.method,
                routeRaw: path,
                status,
                latencyMs,
                selfMs: Math.max(0, latencyMs - ctx.outboundMs),
                reqBytes,
                resBytes: res.getHeader ? res.getHeader("content-length") : 0,
              });
            } catch (e) {
              fail(e);
            }
          };
          res.once("finish", () => finish(false));
          res.once("close", () => finish(!res.writableFinished));
        }
      } catch (e) {
        fail(e);
        ctx = null;
      }
      // next() runs exactly once, inside the context when we have one.
      if (ctx) {
        let called = false;
        try {
          return als.run(ctx, () => {
            called = true;
            return next();
          });
        } catch (e) {
          if (!called) return next();
          throw e; // an error from the app itself, not from telemetry
        }
      }
      return next();
    };
  }

  /* ---------------- outbound: fetch / SDK / driver calls ---------------- */

  function headerValue(headers, name) {
    try {
      if (!headers) return null;
      if (typeof headers.get === "function") return headers.get(name);
      for (const k of Object.keys(headers)) if (k.toLowerCase() === name) return headers[k];
    } catch { /* ignore */ }
    return null;
  }

  /** The inbound request this outbound work belongs to (or undefined). */
  function contextFor(headers) {
    const s = als.getStore();
    if (s) return s;
    const rid = headerValue(headers, "x-request-id");
    return rid ? byRequestId.get(String(rid)) : undefined;
  }

  /** True when an outbound call happens inside a skipped (health) request. */
  function inSkippedContext(ctx) {
    const s = ctx || als.getStore();
    return !!(s && s.skip);
  }

  function addOutbound(ms, ctx) {
    try {
      const s = ctx || als.getStore();
      if (s && !s.skip) s.outboundMs += ms;
    } catch { /* ignore */ }
  }

  /**
   * Record one finished outbound call. `target` is a service name or an
   * external system ("mongodb", "b2").
   */
  function recordOutbound({ target, method, route, routeRaw, status, latencyMs, reqBytes, resBytes, error, ctx }) {
    if (!enabled) return null;
    try {
      if (inSkippedContext(ctx)) return null;
      addOutbound(Number(latencyMs) || 0, ctx);
      return record({ dir: "out", source: service, target, method, route, routeRaw, status, latencyMs, reqBytes, resBytes, error });
    } catch (e) {
      fail(e);
      return null;
    }
  }

  /**
   * Headers to add to a call to a sibling service so it can attribute the
   * request to us. Returns a NEW headers value; never mutates the input.
   */
  function withSourceHeader(headers, url) {
    if (!enabled) return headers;
    try {
      if (!resolveTarget(url)) return headers; // never label calls to third parties
      if (headers && typeof headers.forEach === "function" && typeof headers.set === "function") {
        const copy = new Headers(headers);
        copy.set(SOURCE_HEADER, service);
        return copy;
      }
      return { ...(headers || {}), [SOURCE_HEADER]: service };
    } catch (e) {
      fail(e);
      return headers;
    }
  }

  /**
   * Wrap an async fetch-like function `(url, opts, ...rest) => Response`.
   * Calls to known sibling services are labelled and timed; anything else
   * passes through untouched.
   */
  function wrapFetch(fetchFn) {
    return async function trackedFetch(url, fopts = {}, ...rest) {
      let target = null;
      let start = null;
      let o = fopts;
      let ctx;
      try {
        target = enabled ? resolveTarget(url) : null;
        ctx = target ? contextFor(fopts && fopts.headers) : undefined;
        if (target) {
          o = { ...(fopts || {}), headers: withSourceHeader(fopts && fopts.headers, url) };
          start = process.hrtime.bigint();
        }
      } catch (e) {
        fail(e);
        target = null;
        o = fopts;
      }
      if (!target) return fetchFn(url, fopts, ...rest);
      let routeRaw = "/";
      try { routeRaw = new URL(String(url)).pathname; } catch { /* keep "/" */ }
      try {
        const res = await fetchFn(url, o, ...rest);
        try {
          recordOutbound({
            target,
            method: (o && o.method) || "GET",
            routeRaw,
            status: res && res.status,
            latencyMs: nowMs(start),
            reqBytes: o && o.body ? (o.body.length || o.body.byteLength || 0) : 0,
            resBytes: res && res.headers && res.headers.get ? res.headers.get("content-length") : 0,
            ctx,
          });
        } catch (e) { fail(e); }
        return res;
      } catch (err) {
        try {
          const timeout = err && (err.code === "UPSTREAM_TIMEOUT" || err.name === "TimeoutError" || err.name === "AbortError");
          recordOutbound({
            target,
            method: (o && o.method) || "GET",
            routeRaw,
            status: timeout ? 504 : 0,
            latencyMs: nowMs(start),
            error: timeout ? "timeout" : (err && err.cause && err.cause.code) || "network",
            ctx,
          });
        } catch (e) { fail(e); }
        throw err;
      }
    };
  }

  /**
   * Time any promise-returning operation against an external system
   * (B2 SDK command, etc.). The operation's own result/error is returned
   * unchanged.
   */
  async function trackOperation(meta, op) {
    if (!enabled || inSkippedContext()) return op();
    const start = process.hrtime.bigint();
    try {
      const out = await op();
      try { recordOutbound({ ...meta, status: meta.status || 200, latencyMs: nowMs(start) }); } catch (e) { fail(e); }
      return out;
    } catch (err) {
      try {
        const status = toInt(err && (err.$metadata && err.$metadata.httpStatusCode || err.status)) || 500;
        recordOutbound({ ...meta, status, latencyMs: nowMs(start), error: (err && (err.code || err.name)) || "error" });
      } catch (e) { fail(e); }
      throw err;
    }
  }

  /* ---------------- Mongo (driver command monitoring) ---------------- */

  const MONGO_SKIP = new Set([
    "hello", "ismaster", "ping", "buildinfo", "saslstart", "saslcontinue",
    "endsessions", "getlasterror", "killcursors", "listindexes", "createindexes",
  ]);

  /**
   * Attach to a MongoClient created with `monitorCommands: true`.
   * Only the command name + collection are kept (never filters/documents).
   */
  function attachMongo(client) {
    if (!enabled || !client || typeof client.on !== "function") return false;
    try {
      const pending = new Map();
      const keyOf = (ev) => `${ev.connectionId}:${ev.requestId}`;
      client.on("commandStarted", (ev) => {
        try {
          const name = String(ev.commandName || "").toLowerCase();
          if (MONGO_SKIP.has(name)) return;
          if (inSkippedContext()) return;
          const coll = ev.command && typeof ev.command[ev.commandName] === "string" ? ev.command[ev.commandName] : "";
          pending.set(keyOf(ev), { route: `${ev.commandName}${coll ? " " + sanitizeRoute(coll).replace(/^\//, "") : ""}`, ctx: als.getStore() });
          if (pending.size > 5000) pending.clear(); // leak guard
        } catch (e) { fail(e); }
      });
      const done = (ok) => (ev) => {
        try {
          const p = pending.get(keyOf(ev));
          if (!p) return;
          pending.delete(keyOf(ev));
          const ms = Number(ev.duration) || 0;
          if (p.ctx && !p.ctx.skip) p.ctx.outboundMs += ms;
          record({
            dir: "out",
            source: service,
            target: "mongodb",
            method: "CMD",
            route: p.route.slice(0, 96),
            status: ok ? 200 : 500,
            latencyMs: ms,
            error: ok ? undefined : (ev.failure && (ev.failure.codeName || ev.failure.name)) || "error",
          });
        } catch (e) { fail(e); }
      };
      client.on("commandSucceeded", done(true));
      client.on("commandFailed", done(false));
      return true;
    } catch (e) {
      fail(e);
      return false;
    }
  }

  /* ---------------- AWS SDK v3 (B2) middleware ---------------- */

  /** Add timing middleware to an S3Client. Object keys are never recorded. */
  function attachS3(client, target = "b2") {
    if (!enabled || !client || !client.middlewareStack) return false;
    try {
      client.middlewareStack.add(
        (next, context) => async (args) => {
          if (inSkippedContext()) return next(args);
          const cmd = String((context && context.commandName) || "S3Command").replace(/Command$/, "");
          const method = /^(Put|Upload|Create|Complete)/.test(cmd) ? "PUT" : /^Delete/.test(cmd) ? "DELETE" : /^Head/.test(cmd) ? "HEAD" : "GET";
          const reqBytes = args && args.input ? toInt(args.input.ContentLength) : 0;
          return trackOperation({ target, method, route: cmd, reqBytes }, () => next(args));
        },
        { step: "initialize", name: "legalvaultTelemetry", override: true }
      );
      return true;
    } catch (e) {
      fail(e);
      return false;
    }
  }

  /* ---------------- pull endpoint for the gateway ---------------- */

  /**
   * GET /telemetry/recent?since=<seq>&limit=<n>
   * Guarded by TELEMETRY_TOKEN (x-telemetry-token header) when set.
   */
  function recentHandler() {
    return function telemetryRecent(req, res) {
      try {
        if (token && !safeEqual(req.headers && req.headers[TOKEN_HEADER], token)) {
          return res.status(401).json({ success: false, error: { code: "TELEMETRY_AUTH", message: "Bad telemetry token" } });
        }
        res.setHeader("Cache-Control", "no-store");
        if (!enabled) return res.json({ success: true, data: { service, bootId, enabled: false, seq: 0, newest: 0, dropped: 0, events: [] } });
        const q = req.query || {};
        const out = buffer.since(q.since, q.limit);
        return res.json({ success: true, data: { service, bootId, enabled: true, errors, ...out } });
      } catch (e) {
        fail(e);
        try { return res.status(500).json({ success: false, error: { code: "TELEMETRY_ERROR", message: "Telemetry unavailable" } }); } catch { return undefined; }
      }
    };
  }

  return {
    service,
    bootId,
    enabled,
    buffer,
    emitter,
    als,
    middleware,
    recentHandler,
    record,
    recordOutbound,
    wrapFetch,
    withSourceHeader,
    trackOperation,
    attachMongo,
    attachS3,
    resolveTarget,
    setTargets,
    get errors() { return errors; },
  };
}

module.exports = {
  createTelemetry,
  sanitizeRoute,
  RingBuffer,
  KNOWN_SERVICES,
  EXTERNAL_TARGETS,
  SOURCE_HEADER,
  TOKEN_HEADER,
  INTERNAL_HEADER,
};
