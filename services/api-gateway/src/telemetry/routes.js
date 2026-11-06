/**
 * Gateway telemetry API — mounted at /api/v1/telemetry.
 *
 *   GET /api/v1/telemetry/stream  Server-Sent Events: hello, traffic, stats, health
 *   GET /api/v1/telemetry/stats   one JSON snapshot (same shape as the "stats" event)
 *
 * Access: by default only a logged-in LegalVault user may read it. The
 * caller's own Authorization header / cookies are checked against
 * auth-service GET /auth/me (cached 60s). TELEMETRY_REQUIRE_AUTH=false
 * opens it (local demos only).
 *
 * The browser reads the stream with fetch() (not EventSource) so it can
 * send the Bearer token the rest of the app already uses.
 */
const crypto = require("crypto");
const express = require("express");

const HEARTBEAT_MS = 15000;
const STATS_EVERY_MS = 2000;
const MAX_BUFFERED_BYTES = 1024 * 1024; // drop a dashboard that stops reading

function createTelemetryRouter({ hub, authUrl, requireAuth = true, maxClients = 25, fetchImpl, enabled = true }) {
  const router = express.Router();
  const doFetch = fetchImpl || ((...a) => fetch(...a));
  const authCache = new Map(); // sha256(credentials) -> expiresAt
  let clients = 0;

  async function isAuthorized(req) {
    if (!requireAuth) return true;
    const authz = req.headers.authorization || "";
    const cookie = req.headers.cookie || "";
    if (!authz && !cookie) return false;
    const key = crypto.createHash("sha256").update(`${authz}\n${cookie}`).digest("hex");
    const hit = authCache.get(key);
    if (hit && hit > Date.now()) return true;
    try {
      const headers = { "x-lv-telemetry": "skip" }; // plumbing: not recorded as traffic
      if (authz) headers.authorization = authz;
      if (cookie) headers.cookie = cookie;
      const r = await doFetch(`${authUrl}/auth/me`, { headers, signal: AbortSignal.timeout(10000) });
      if (!r.ok) return false;
      if (authCache.size > 1000) authCache.clear();
      authCache.set(key, Date.now() + 60000);
      return true;
    } catch {
      return false;
    }
  }

  function deny(res, status, code, message) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(status).json({ success: false, error: { code, message } });
  }

  router.use((req, res, next) => {
    if (!enabled) return deny(res, 503, "TELEMETRY_DISABLED", "Telemetry is disabled (TELEMETRY_ENABLED=false)");
    next();
  });

  router.get("/stats", async (req, res) => {
    if (!(await isAuthorized(req))) return deny(res, 401, "UNAUTHORIZED", "Log in to view live telemetry");
    try {
      // No dashboard connected = no background polling, so refresh on demand.
      if (hub.subscribers === 0) await hub.tick();
      res.setHeader("Cache-Control", "no-store");
      res.json({ success: true, data: { ...hub.stats(), recent: hub.recent(50) } });
    } catch {
      deny(res, 500, "TELEMETRY_ERROR", "Telemetry unavailable");
    }
  });

  router.get("/stream", async (req, res) => {
    if (clients >= maxClients) return deny(res, 503, "TOO_MANY_STREAMS", "Too many live dashboards open");
    if (!(await isAuthorized(req))) return deny(res, 401, "UNAUTHORIZED", "Log in to view live telemetry");
    if (req.socket.destroyed) return undefined;

    clients++;
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-store, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // disable proxy buffering (nginx / Render)
    res.flushHeaders();
    if (req.socket.setNoDelay) req.socket.setNoDelay(true);

    let closed = false;
    let unsubscribe = () => {};
    const timers = [];

    const cleanup = () => {
      if (closed) return;
      closed = true;
      clients = Math.max(0, clients - 1);
      for (const t of timers) clearInterval(t);
      unsubscribe();
    };

    const send = (event, data) => {
      if (closed || res.writableEnded || res.destroyed) return;
      try {
        if (res.writableLength > MAX_BUFFERED_BYTES) {
          cleanup();
          res.end();
          return;
        }
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      } catch {
        cleanup();
      }
    };

    req.on("close", cleanup);
    res.on("close", cleanup);
    res.on("error", cleanup);

    res.write("retry: 3000\n\n");
    send("hello", {
      nodes: ["client", "api-gateway", "auth-service", "case-service", "file-service", "crypto-proxy", "mongodb", "b2"],
      windowMs: hub.windowMs,
      rateWindowMs: hub.rateWindowMs,
      pollMs: hub.pollMs,
      serverNow: Date.now(),
      recent: hub.recent(50),
    });

    unsubscribe = hub.subscribe((batch) => {
      if (batch.traffic.length) send("traffic", batch);
    });

    const pushStats = () => {
      try {
        send("stats", hub.stats());
      } catch { /* stats are best-effort */ }
    };
    // First stats after the first poll round has had a moment to land.
    setTimeout(pushStats, Math.min(1200, hub.pollMs + 200)).unref?.();
    timers.push(setInterval(pushStats, STATS_EVERY_MS));
    timers.push(setInterval(() => {
      if (!closed && !res.writableEnded) {
        try { res.write(`: ping ${Date.now()}\n\n`); } catch { cleanup(); }
      }
    }, HEARTBEAT_MS));
    for (const t of timers) t.unref?.();
    return undefined;
  });

  return router;
}

module.exports = { createTelemetryRouter };
