# LegalVault

Safe place for lawyers to store cases, notes, and files.
Next.js frontend + 3 Express services + crypto-proxy (AES-256-GCM) + MongoDB + real AWS S3.

## Structure (per docs/plan.md)

```
legalvault/
├── frontend/              # Next.js (real API client, no mock)
├── services/
│   ├── auth-service/      # signup/login, RS256 JWT, JWKS (4001)
│   ├── case-service/      # cases + notes, forwards to crypto-proxy (4002)
│   ├── file-service/      # upload/download, forwards to crypto-proxy (4003)
│   └── crypto-proxy/      # tenant keys, encrypt/decrypt, MongoDB + S3 (4004)
├── packages/shared/       # response + constants
├── infrastructure/docker-compose.yml
├── scripts/generate-jwt-keys.js
└── .env.example
```

Flow: `Next.js → auth/case/file → crypto-proxy → MongoDB / S3` (locked data only in storage).

## Setup (you fill blanks)

1. Copy env:
   ```bash
   cp .env.example .env
   cp frontend/.env.example frontend/.env.local
   ```
2. Generate JWT RS256 keys:
   ```bash
   npm run gen:keys
   ```
   Paste output into `.env` as `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY`.
3. Generate master key (32 bytes base64):
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
   Paste into `.env` as `CRYPTO_MASTER_KEY`.
4. Fill in `.env`:
   ```
   MONGO_URI=...
   AWS_REGION=...
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   S3_BUCKET=...
   ```
5. Install + run (each terminal):
   ```bash
   npm --prefix services/auth-service install
   npm --prefix services/crypto-proxy install
   npm --prefix services/case-service install
   npm --prefix services/file-service install
   npm --prefix frontend install
   ```
   Then start services (needs `.env` filled):
   ```bash
   npm --prefix services/auth-service run dev
   npm --prefix services/crypto-proxy run dev
   npm --prefix services/case-service run dev
   npm --prefix services/file-service run dev
   npm --prefix frontend run dev
   ```
   Or Docker: `docker compose -f infrastructure/docker-compose.yml up --build` (needs `.env`).

## One flow to test

signup → login (cookie) → POST /cases → POST /files/upload → GET back.
Tenant A can never read Tenant B (tenantId comes from verified JWT).
Expired / wrong-issuer / wrong-alg JWTs are rejected everywhere.
