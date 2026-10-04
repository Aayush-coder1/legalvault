# LegalVault

Safe place for lawyers to store cases, notes, and files.
Next.js frontend + 3 Express services + crypto-proxy (AES-256-GCM) + local MongoDB (Compass) + Backblaze B2.

```
legalvault/
├── frontend/              # Next.js website (port 3000)
├── services/
│   ├── auth-service/      # signup/login, RS256 JWT, JWKS (port 4001)
│   ├── case-service/      # cases + notes, forwards to crypto-proxy (port 4002)
│   ├── file-service/      # upload/download, forwards to crypto-proxy (port 4003)
│   └── crypto-proxy/      # tenant keys, encrypt/decrypt, MongoDB + B2 (port 4004)
├── packages/shared/       # shared response + constants
├── scripts/generate-jwt-keys.js
├── docs/                  # per-service design docs + plan.md
├── .env                   # your secrets (gitignored, never commit)
└── .env.example           # template
```

Flow: `Next.js → auth/case/file → crypto-proxy → MongoDB / B2` (only locked data touches storage).

## Needs (no Docker)

- Node.js 22
- MongoDB running locally (Compass connected to `mongodb://localhost:27017`)
- A Backblaze B2 bucket (private) + application key limited to that bucket

## Setup (one time)

```bash
cd legalvault

# 1. env files
cp .env.example .env
cp frontend/.env.example frontend/.env.local

# 2. install everything
npm --prefix services/auth-service install
npm --prefix services/crypto-proxy install
npm --prefix services/case-service install
npm --prefix services/file-service install
npm --prefix frontend install
```

Fill in root `.env`:

```env
MONGO_URI=mongodb://localhost:27017/legalvault
JWKS_URL=http://localhost:4001/auth/jwks.json
CRYPTO_PROXY_URL=http://localhost:4004

JWT_PRIVATE_KEY="..."   # from: npm run gen:keys
JWT_PUBLIC_KEY="..."    # from: npm run gen:keys

CRYPTO_MASTER_KEY=...   # from: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

B2_ENDPOINT=https://s3.us-east-005.backblazeb2.com   # your bucket's "S3 Endpoint" (with https://)
B2_REGION=us-east-005
B2_KEY_ID=...           # B2 application key ID (full value, e.g. 005xxx...0001)
B2_APP_KEY=...          # B2 application key secret (shown once at creation)
B2_BUCKET=legalvault
```

`frontend/.env.local` stays as-is:

```env
NEXT_PUBLIC_AUTH_URL=http://localhost:4001
NEXT_PUBLIC_CASE_URL=http://localhost:4002
NEXT_PUBLIC_FILE_URL=http://localhost:4003
```

## Start (5 terminals, in this order)

```bash
# terminal 1
npm --prefix services/auth-service run dev
# terminal 2
npm --prefix services/crypto-proxy run dev
# terminal 3
npm --prefix services/case-service run dev
# terminal 4
npm --prefix services/file-service run dev
# terminal 5
npm --prefix frontend run dev
```

Open `http://localhost:3000` → sign up → dashboard. Auth first because the other
services verify tokens against its `GET /auth/jwks.json`.

## Check it works

```bash
curl http://localhost:4001/health
curl http://localhost:4002/health
curl http://localhost:4003/health
curl http://localhost:4004/health
```

Then in the browser: create a case → upload a file → download it back.
Deleting a case also deletes its notes, its file metadata, and its objects in B2.

## Rules that bite

- `.env` loads at boot: after editing it, restart that service (Ctrl+C, run again).
  Code changes hot-reload by themselves (`node --watch` / Turbopack).
- Local terminals need `localhost` URLs (`JWKS_URL`, `CRYPTO_PROXY_URL`, `MONGO_URI`).
  Service names (`auth-service`, `host.docker.internal`) only work inside Docker —
  mixing them gives `Invalid or expired token` on every case/file request.
- Access tokens live 15 minutes and the frontend has no silent refresh:
  if calls start failing after idle time, log out and back in.
- Never commit `.env` or `*.pem`. Keys in `.env.example` are dev-only examples.
- B2 bucket lifecycle `Keep all versions` hides deleted files but retains versions;
  switch the bucket to `Keep only last version` if deletes should free space.
