# API Gateway - Documentation

Single entry point for the frontend. Forwards every client request to the right microservice, preserving method, path, query, headers, cookies, and body (JSON + multipart).

```text
Browser / Next.js (:3000)
        |
        | all API traffic -> :4000
        v
   API Gateway (:4000)
     |       |       |
     v       v       v
 :4001     :4002     :4003
  auth      case     file
```

## Routes

| Prefix | Target | Example |
| --- | --- | --- |
| `/auth/*` | `AUTH_URL` (:4001) | `/auth/login` -> `:4001/auth/login` |
| `/cases`, `/cases/*`, `/notes`, `/notes/*` | `CASE_URL` (:4002) | `/cases` -> `:4002/cases` |
| `/files`, `/files/*` | `FILE_URL` (:4003) | `/files/upload` -> `:4003/files/upload` |

Paths are preserved as-is downstream.

## Env

```env
GATEWAY_PORT=4000
AUTH_URL=http://localhost:4001
CASE_URL=http://localhost:4002
FILE_URL=http://localhost:4003
FRONTEND_URL=http://localhost:3000
```

In Docker, `AUTH_URL/CASE_URL/FILE_URL` use service names (`http://auth-service:4001`, ...). See `infrastructure/docker-compose.yml`.

## Notes

- No auth logic here: services verify JWT via JWKS themselves.
- Forwards `Authorization`, cookies (incl. multi `Set-Cookie`), `x-request-id`.
- `GET /health`, `GET /readyz` are gateway-local (readyz lists upstreams).
- 502 `BAD_GATEWAY` = downstream down, 504 `UPSTREAM_TIMEOUT` = downstream too slow (30s).
- Body limit 30MB (covers 25MB file uploads).
- Basic per-IP rate limit (1000 req / 15 min); auth-service enforces its own stricter limit.
