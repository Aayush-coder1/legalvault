# Keep-Alive / Service Wake-Up - Documentation

How the project keeps its Render free-tier services from sleeping after inactivity, and how a cold chain gets woken up again.

## Background

Render's free tier spins a service down after ~15 minutes without inbound HTTP traffic. A sleeping service takes ~30-60s to boot, so the first real request after idle would just time out. To avoid this, the services "wake each other" over `/readyz`, on a 1-minute cadence, instead of relying on repeated client hits or rapid-fire frontend retries.

## Wake chain

```text
Frontend (browser, warmup.ts)
        |
        | GET /readyz  (on app load, retry every 1 min)
        v
   API Gateway  ---- background keep-alive every 60s ----+
        |                                                 |
        | GET /readyz                                     |
        v                 v                 v             v
     auth-service      case-service       file-service --------> crypto-proxy
   (checks Mongo)    (dials crypto)     (dials crypto)       GET /health, 3s timeout
```

One request into the gateway cascades all the way down to crypto-proxy.

## Roles of each component

| Component | Role in the chain |
| --- | --- |
| `frontend/lib/api/warmup.ts` | Trigger on app load. Probes `GET {gateway}/readyz` and retries until the chain reports `ok: true` (or budget expires). |
| `api-gateway/src/index.js` | Fan-out hub. `/readyz` dials auth/case/file in parallel; also runs a background 60s keep-alive so services wake each other on their own. |
| `auth-service/src/index.js:62` | Serves `/readyz` only (own Mongo check). Calls no one. |
| `case-service/src/index.js:42` | Serves `/readyz` and dials crypto-proxy `/health`. |
| `file-service/src/index.js:42` | Same as case-service. |
| `crypto-proxy/src/index.js:32` | Leaf node. Serves `/readyz`, calls no one. |

## Timings and timeouts

| Path | Timeout | Notes |
| --- | --- | --- |
| Frontend `warmup.ts` attempt | 25s (`ATTEMPT_TIMEOUT_MS`) | Fits one full cold chain boot. |
| Frontend `warmup.ts` retry spacing | 60s (`RETRY_INTERVAL_MS`) | No rapid-fire retries; one hit per minute keeps the chain booting. |
| Frontend `warmup.ts` total budget | 180s (`DEFAULT_BUDGET_MS`) | Login is still attempted after the budget runs out. |
| Gateway `probeUpstream()` | 20s | Slow path kept long on purpose: upstreams may be cold-booting (30-60s). |
| Gateway background keep-alive interval | 60s | Started on boot (`unref()`-ed so shutdown is never blocked); also fires once immediately. |
| case/file -> crypto-proxy `/health` | 3s | Crypto is a fast leaf with no DB, so the timeout is trimmed tight. |

## How a cold start plays out

1. User opens the app; `frontend/components/auth/session.tsx` calls `warmBackend()` on mount and disables the login/register buttons ("Waking up services...").
2. The first `GET {gateway}/readyz` hits the sleeping gateway; every failed attempt keeps the gateway process booting.
3. Once the gateway is up, `/readyz` fans out to auth/case/file; case/file dial crypto-proxy. A waking crypto returns non-ok 503, but the request itself still boots it.
4. Frontend retries once per minute until every leg reports `ok` (up to 3 minutes), then the session refresh proceeds.
5. While the gateway process stays up, its internal 60s keep-alive pings stretch the whole chain indefinitely — no user activity required.

## Limits

- If **no one opens the frontend for ~15 minutes**, the gateway itself goes to sleep, and the interval dies with it; the upstreams then follow. An external 1-minute pinger (e.g. cron-job.org) hitting `GET {gateway}/readyz` would keep the gateway alive forever.
- The 13-minute `POST /auth/refresh` timer in `frontend/components/auth/session.tsx` doubles as idle-keep-alive traffic, but only while a session is open in a visible tab.
