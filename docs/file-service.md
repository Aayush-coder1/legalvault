# File Service - Documentation

The `file-service` handles files linked to cases: PDF, images, videos, etc.

Simple rule:

- `file-service` = "I handle files."
- `crypto-proxy` = "I protect files and manage their encryption keys."
- `S3` = "I store the encrypted files."

It does NOT do encryption or key management. That belongs to `crypto-proxy`.

Same idea for cases:

- `case-service` = "I handle case data."
- `crypto-proxy` = "I protect case data."
- `MongoDB` = "I store the encrypted case data."

## 1. How It Works

```text
Next.js
   |
   | Upload PDF / Image / Video
   v
file-service
   |
   |-- Check login (JWT)
   |-- Check tenant and case access
   |-- Check file is valid
   |
   v
crypto-proxy
   |
   |-- Pick tenant key
   |-- Lock file
   |
   v
S3 (stores locked file only)
```

Steps in simple words:

1. Lawyer picks a file on the website.
2. Frontend sends `POST /files/upload` with JWT.
3. File-service checks JWT, tenant, and case.
4. File-service checks file type and size.
5. File-service sends file to crypto-proxy.
6. Crypto-proxy locks the file with the right tenant key.
7. Locked file is saved in S3. Original open file is never saved in S3.

Download is reverse: S3 -> crypto-proxy unlocks -> file-service returns file.

## 2. Folder Structure

```text
file-service/
|
├── src/
|   |
|   ├── controllers/
|   │   └── file.controller.ts
|   |
|   ├── routes/
|   │   └── file.routes.ts
|   |
|   ├── services/
|   │   └── file.service.ts
|   |
|   ├── storage/
|   │   └── s3/
|   │       └── s3.client.ts
|   |
|   ├── middleware/
|   │   └── auth.middleware.ts
|   |
|   └── config/
|       └── aws.config.ts
|
├── package.json
└── Dockerfile
```

What each folder does:

- `controllers/file.controller.ts` - takes upload / download requests.
- `routes/file.routes.ts` - URLs like `/files/upload`, `/files/:fileId`.
- `services/file.service.ts` - rules: who can upload, file checks, link file to case.
- `storage/s3/s3.client.ts` - talks to S3, but only with locked files.
- `middleware/auth.middleware.ts` - checks JWT and tenant.
- `config/aws.config.ts` - bucket name, region, S3 settings from env.

## 3. Example

Lawyer uploads for one case:

```text
case-123/
    ├── contract.pdf
    ├── evidence.jpg
    └── recording.mp4
```

Frontend sends:

```text
POST /files/upload
```

Then inside backend:

```text
file-service
     |
     |-- JWT check
     |-- Tenant check
     |-- Case check (does this case belong to this tenant?)
     |-- File check (type, size)
     |
     v
crypto-proxy
     |
     |-- Get tenant key
     |-- Lock file
     |
     v
S3
```

S3 stores the locked file, not the open file.

## 4. How Files Are Stored in S3

Use tenant and case in the path:

```text
S3 Bucket
|
├── tenant-001/
│   ├── case-101/
│   │   ├── file-abc
│   │   └── file-def
│   └── case-102/
│
└── tenant-002/
    └── case-201/
```

Rules:

- Always start path with `tenantId`.
- Then `caseId`, then `fileId`.
- Never mix tenants in one folder.
- File name in S3 should be fileId, not real user file name. Keep real name in MongoDB metadata if needed.

Example key:

```text
tenant-001/case-101/file-abc
```

## 5. Safety Checks for Every Request

For upload, download, delete:

1. Verify JWT with public key from auth-service JWKS.
2. Check `exp`, `iss`, `aud`, `alg = RS256`.
3. Get `tenantId` from JWT.
4. Check case belongs to that tenant (ask case-service or check DB).
5. Validate file:
   - Allowed types: pdf, jpg, png, mp4, etc.
   - Max size limit.
   - No empty file.
   - Scan file name for bad paths.
6. Send tenant-scoped request to crypto-proxy.
7. Return error if tenant or case does not match.

## 6. What Belongs Here

Yes, put in `file-service`:

- File upload and download APIs.
- File validation (type, size).
- Link file to `caseId` + `tenantId`.
- S3 client for storing locked files.
- File delete and list by case.

No, do NOT put here:

- Login / signup -> `auth-service`
- Case notes logic -> `case-service`
- Encryption and keys -> `crypto-proxy`
- Direct use of tenant keys -> `crypto-proxy`

## 7. Build Checklist

1. Make upload API `POST /files/upload` with JWT check.
2. Add file validation and S3 path rule `tenant/case/file`.
3. Connect to crypto-proxy for lock / unlock.
4. Add download and delete APIs.
5. Test: tenant A cannot download tenant B file, expired JWT is rejected, bad file type is rejected.
