# Case Service - Documentation

The `case-service` is the business-logic service for everything related to a lawyer's legal cases.

Simple rule:

- `auth-service` answers: "Who is this user?"
- `case-service` answers: "What cases and notes does this lawyer have?"

It does not handle login, files, or encryption keys. It only handles cases and notes.

## 1. Folder Structure

```text
case-service/
│
├── controllers/       # Handles HTTP requests
├── routes/            # Defines API endpoints
├── services/          # Case business logic
├── models/            # MongoDB data models
├── middleware/        # JWT verification, tenant checks
└── config/            # Database / configuration
```

What each folder does:

- `controllers/` - takes request, calls service, sends answer.
- `routes/` - URLs for cases and notes.
- `services/` - rules like who can create, update, delete a case.
- `models/` - shape of case and note saved in MongoDB.
- `middleware/` - checks JWT, checks tenant, blocks bad requests.
- `config/` - DB address, crypto-proxy address, env settings.

## 2. APIs

Cases:

```text
POST   /cases
GET    /cases
GET    /cases/:caseId
PUT    /cases/:caseId
DELETE /cases/:caseId
```

Notes inside a case:

```text
POST   /cases/:caseId/notes
GET    /cases/:caseId/notes
PUT    /cases/:caseId/notes/:noteId
DELETE /cases/:caseId/notes/:noteId
```

Simple meaning:

- `POST /cases` - make a new case.
- `GET /cases` - list my cases.
- `GET /cases/:caseId` - open one case.
- `PUT /cases/:caseId` - change case details or status.
- `DELETE /cases/:caseId` - remove a case.
- Notes APIs do the same, but for text notes inside a case.

## 3. Example Flow - Lawyer Creates a Case

```text
Next.js
   |
   | POST /cases + JWT
   v
case-service
   |
   |-- Verify JWT
   |-- Get user / tenant from JWT
   |-- Check case data is valid
   |
   v
crypto-proxy
   |
   |-- Find tenant from JWT
   |-- Lock case data with tenant key
   |
   v
MongoDB
```

Steps in simple words:

1. Lawyer fills case form on website.
2. Frontend sends `POST /cases` with JWT.
3. Case-service checks JWT signature, expiry, issuer, audience.
4. Case-service reads `userId` and `tenantId` from JWT, not from body.
5. Case-service checks case title, client name, status are valid.
6. Case-service sends data to crypto-proxy.
7. Crypto-proxy picks the right tenant key and locks the data.
8. Locked data is saved in MongoDB.

Reading is reverse: MongoDB -> crypto-proxy unlocks -> case-service returns open data to frontend.

## 4. How Data Looks in MongoDB

Concept example:

```json
{
  "tenantId": "tenant123",
  "caseId": "case456",
  "encryptedData": "..."
}
```

Rules:

- Always save `tenantId` with every case and note.
- Never save open client secrets without going through crypto-proxy.
- Case-service does not store encryption keys.

## 5. Important: No Encryption Logic Here

Case-service must NOT do encryption itself.

It asks crypto-proxy to handle protected database work.

```text
Wrong: case-service -> encrypts -> MongoDB
Right: case-service -> crypto-proxy -> encrypts -> MongoDB
```

This keeps crypto-proxy as the one central security layer.

## 6. What Belongs Here

Yes, put in `case-service`:

- Lawyer's cases
- Case create, update, delete
- Case metadata like title, client, court, date
- Text notes
- Case status: open, pending, closed
- Client info linked to a case
- Business rules: who can see or edit which case

No, do NOT put here:

- Login / signup -> `auth-service`
- PDF, image, video upload -> `file-service`
- Encryption and key management -> `crypto-proxy`
- Direct use of encryption keys -> `crypto-proxy`

## 7. How Services Are Divided

```text
Auth Service
    |
    "Who are you?"

Case Service
    |
    "What cases do you have?"

File Service
    |
    "What files are linked to those cases?"

Crypto Proxy
    |
    "How do we safely store all that data?"
```

This division makes microservices useful. Otherwise we just have 4 folders around one big backend.

## 8. Safety Checks for Every Request

For every case / note API:

1. Verify JWT with public key from auth-service JWKS.
2. Check `exp`, `iss`, `aud`, `alg = RS256`.
3. Get `tenantId` from JWT.
4. Check that `caseId` belongs to that `tenantId`.
5. Validate input: title not empty, status is allowed, note not too big.
6. Send tenant-scoped request to crypto-proxy.
7. Return error if tenant does not match. Never return other tenant's data.

## 9. Build Checklist

1. Make case model with `tenantId`, `caseId`, metadata.
2. Make note model linked to `caseId` + `tenantId`.
3. Add JWT verify middleware using JWKS.
4. Add tenant check middleware.
5. Build `POST /cases` and `GET /cases` first with crypto-proxy.
6. Add update, delete, then notes APIs.
7. Test: user A cannot see user B cases, expired JWT is rejected.
