# Live request tracker & system topology

Real-time view of every HTTP request moving through LegalVault, drawn on the
same topology as our BreakScale design (`docs/breakscale-simulation.png`).

```
browser ──► api-gateway ──► auth / case / file ──► crypto-proxy ──► MongoDB / B2
   ▲            │  every service records its own requests in a ring buffer
   │            │  (src/telemetry, zero dependencies, never blocks a request)
   │            ▼
   │   gateway TelemetryHub pulls GET <service>/telemetry/recent every 1s
   │   (only while a dashboard is open) and merges everything into edge events
   │            │
   └── SSE ◄────┘  GET /api/v1/telemetry/stream  →  /dashboard/system-topology
```

## What is recorded (and what is not)

Per request hop: timestamp, source → target, HTTP method, **sanitised** route
(`/cases/65f0…/notes?x=1` → `/cases/:id/notes`), status code, latency ms,
self time ms (latency minus time spent waiting on downstream calls),
request/response byte counts.

**Never recorded:** headers, cookies, tokens, bodies, query strings, IPs,
user/tenant ids, S3 object keys, Mongo filters or documents. Mongo is recorded
as command + collection only (`find users`), B2 as the command name
(`PutObject`) + byte count.

Not recorded at all: `/health`, `/readyz`, `/telemetry/*`, CORS preflights
(`OPTIONS`), and requests marked `x-lv-telemetry: skip` (telemetry plumbing).

## Safety guarantees

- The middleware calls `next()` exactly once, wraps every hook in
  `try/catch`, and writes into a fixed-size in-memory ring buffer (O(1)).
  If telemetry throws, the request continues untouched (unit-tested by
  sabotaging the buffer).
- Outbound wrappers (`fetchWithTimeout`, S3 middleware) return the original
  response / rethrow the original error. Timeouts still surface as
  `UPSTREAM_TIMEOUT` (504), exactly as before.
- The gateway polls upstreams **only while a dashboard is connected**, with
  short timeouts and no overlapping polls. An unreachable service is shown as
  `UNREACHABLE` on the topology, nothing else is affected.
- `TELEMETRY_ENABLED=false` turns everything into a pass-through.

## Endpoints

| Where | Endpoint | Purpose |
|---|---|---|
| every service | `GET /telemetry/recent?since=<seq>` | recent events after a cursor (guarded by `TELEMETRY_TOKEN` when set) |
| gateway | `GET /api/v1/telemetry/stream` | Server-Sent Events: `hello`, `traffic` (≈1 s batches), `stats` (every 2 s) |
| gateway | `GET /api/v1/telemetry/stats` | one JSON snapshot (same shape as the `stats` event + last 50 events) |

Stream and stats require a logged-in user: the gateway checks the caller's own
Bearer token / cookies against auth-service `GET /auth/me` (cached 60 s).
The browser reads SSE with `fetch()` (not `EventSource`) so it can send the
Bearer fallback the rest of the app already uses.

## Environment variables

| Variable | Service | Default | Meaning |
|---|---|---|---|
| `TELEMETRY_ENABLED` | all | `true` | `false` = pass-through, no recording |
| `TELEMETRY_TOKEN` | all | empty | optional shared secret; when set on a service, the gateway must send the same value. **Set the same value on all five or on none.** |
| `TELEMETRY_BUFFER` | all | `2000` | events kept per service |
| `CRYPTO_URL` | gateway | `CRYPTO_PROXY_URL` or `http://localhost:4004` | where the gateway reads crypto-proxy telemetry |
| `TELEMETRY_REQUIRE_AUTH` | gateway | `true` | `false` opens the stream without login (local demos only) |
| `TELEMETRY_POLL_MS` | gateway | `1000` | upstream poll interval while a dashboard is open |
| `TELEMETRY_WINDOW_MS` | gateway | `60000` | sliding window for p50/p95/p99 and error rates |
| `TELEMETRY_MAX_CLIENTS` | gateway | `25` | max concurrent dashboards |
| `NEXT_PUBLIC_GATEWAY_URL` | frontend | `http://localhost:4000` | where the dashboard opens the stream |

## The dashboard (`/dashboard/system-topology`)

- **Metric cards:** entry requests/sec, P95 latency (+p50/p99), error rate
  split into 4xx/5xx, crypto-proxy (AES-256-GCM) load: req/s, throughput,
  in-flight estimate (Little's law), B2 and Mongo ops/s.
- **Topology:** one animated dot per real request hop (teal 2xx/3xx, amber
  4xx, red 5xx/unreachable), per-edge req/s, per-node req/s, P99, error %,
  sparkline and health. Dotted violet edges are real hops that are not in the
  original design (JWKS key fetches, or the browser calling services
  directly in local dev).
- **Recent requests:** the last 60 hops.

## BreakScale integration

BreakScale (`github.com/xevrion/breakscale`) is a client-side simulator: a
design lives entirely in the URL and there is no API to stream live traffic
into it. So **Open live-calibrated design** builds a BreakScale link of our
topology where every parameter comes from live telemetry:

| BreakScale parameter | Taken from |
|---|---|
| client `rps` | measured entry req/s × load multiplier (1×–500×) |
| gateway routing weights | measured share of traffic to auth / case / file |
| service `serviceMs` | measured median **self** time per service |
| service `errorRate` | measured 5xx rate per service |
| MongoDB / B2 `serviceMs` | measured median command / object latency |

Format: `https://breakscale.tech/#d2.<base64url(0x00 + JSON)>` (BreakScale's
own legacy JSON link format, validated by its `isTopology()` on open).
Raise the multiplier to see where LegalVault would break. The original hand-made design is
still linked for comparison.

## Code map

```
packages/telemetry/index.js          canonical module (+ tests)
scripts/sync-telemetry.js            copies it to services/*/src/telemetry/index.js
services/*/src/telemetry/setup.js    per-service instance + sibling URL map
services/api-gateway/src/telemetry/  hub.js (merge + stats), routes.js (SSE / stats)
frontend/lib/telemetry/              SSE parser, stream hook, topology layout, BreakScale link
frontend/components/topology/        dashboard UI
```

Why copies instead of one shared package: each Render service builds from its
own folder (`rootDir: services/<name>`) and the Dockerfiles copy only `src/`,
so a `require()` outside the service folder would crash in production. Edit
`packages/telemetry/index.js`, then run `node scripts/sync-telemetry.js`;
a test fails if any copy drifts.

## Tests

```bash
npm run test:telemetry      # core + all five services + frontend (node:test, no extra deps)
```
