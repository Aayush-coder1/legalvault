# Crypto Proxy - Documentation

This is the core service of LegalVault. It is a multi-tenant encryption and key-management proxy.

It sits between app services and storage:

```text
case-service ------|
                  |
file-service ------|
                  v
            crypto-proxy
             |        |
             v        v
          MongoDB     S3
```

Job in simple words: services do NOT touch encryption keys. Only crypto-proxy touches keys.

- `case-service` sends open case data, crypto-proxy locks it, MongoDB stores locked data.
- `file-service` sends open files, crypto-proxy locks them, S3 stores locked files.

## 1. Key Management

This is the most important part.

```text
key-management/
├── key-manager.ts
├── tenant-keys.ts
├── key-rotation.ts
└── key-versioning.ts
```

### key-manager.ts

Central manager for keys.

Example work:

```text
getKey(tenantId)
createKey(tenantId)
revokeKey(tenantId)
```

It controls the other key files. All key requests go through here.

### tenant-keys.ts

Keeps a separate key for each tenant (customer / law firm).

```text
Tenant A -> Key A
Tenant B -> Key B
Tenant C -> Key C
```

Rules:

- Tenant A must never use Tenant B key.
- Every encrypt / decrypt must first pick key by `tenantId` from verified JWT.
- Never accept `tenantId` from body alone.

### key-rotation.ts

Changes old keys to new keys safely.

Example:

```text
Before:
Tenant A -> Key v1

Rotation:
Tenant A -> Key v2
```

Rules:

- New data uses `v2`.
- Old data locked with `v1` must still open until re-locked.
- Keep old key readable for some time, then remove it.
- Rotation should not stop the app.

### key-versioning.ts

Remembers which key version locked each item.

Example:

```text
Case 101
  locked with:
  tenant-A-key-v3
```

Later:

```text
New key: tenant-A-key-v4
Old data still needs v3 to open
```

Rules:

- Save `keyVersion` with every record and file metadata.
- On read, load the same version to unlock.
- On write, use latest version.

## 2. Encryption

Real lock / unlock work lives here.

```text
encryption/
├── encrypt.ts
├── decrypt.ts
└── envelope-encryption.ts
```

### encrypt.ts

Takes open text and makes locked text.

```text
"Confidential legal information"
   |
   | encrypt()
   v
locked text
```

### decrypt.ts

Reverse:

```text
locked text
   |
   | decrypt()
   v
"Confidential legal information"
```

### envelope-encryption.ts

Use this when data grows. Do not lock everything directly with one big master key.

Idea:

```text
        Master Key
            |
            v
        Data Key
            |
    -----------------
    |               |
Encrypt case   Encrypt file
    |               |
    v               v
  MongoDB            S3
```

Steps in simple words:

1. Make a small data key for one case or file.
2. Lock the case / file with that data key.
3. Lock the data key with the master / tenant key.
4. Save locked data + locked data key together.

Benefits:

- Master key is used less, so safer.
- Each file can have its own data key.
- Changing master key does not need re-locking all files at once.

## 3. MongoDB Proxy

```text
mongodb/
└── mongodb-proxy.ts
```

Handles talk to MongoDB.

Flow:

```text
case-service
     |
     v
crypto-proxy
     |
     |-- find tenant from JWT
     |-- get right key + version
     |-- lock / unlock
     |
     v
MongoDB
```

Rules:

- `case-service` never talks to MongoDB directly for protected data.
- It calls crypto-proxy with `tenantId`, `caseId`, and data.
- Crypto-proxy does lock / unlock and then reads / writes MongoDB.
- MongoDB only sees locked data plus `tenantId`, `caseId`, `keyVersion`.

## 4. S3 Proxy

```text
s3/
└── s3-proxy.ts
```

Same idea, but for files.

```text
file-service
     |
     v
crypto-proxy
     |
     |-- find tenant from JWT
     |-- get key
     |-- lock file
     |
     v
S3
```

Rules:

- `file-service` never uploads open files to S3.
- S3 bucket has only locked files.
- S3 path must be `tenantId/caseId/fileId`.
- Crypto-proxy checks tenant before lock / unlock.

## 5. Tenants

```text
tenants/
└── tenant-manager.ts
```

Keeps tenant context correct.

Flow:

```text
JWT
 |
 v
tenantId = tenant-123
 |
 v
crypto-proxy
 |
 v
Tenant 123 key
```

Must block:

```text
Tenant A
   X
   |
   v
Tenant B locked data / key
```

Rules:

- Read `tenantId` only from verified JWT.
- Pass `tenantId` with every key request, encrypt, decrypt, MongoDB, and S3 call.
- If tenant does not match record tenant, reject.

## 6. Middleware

```text
middleware/
└── authentication.ts
```

Crypto-proxy must check login itself.

```text
Auth Service
     |
     | signs JWT with PRIVATE KEY
     v
    JWT
     |
     v
Crypto Proxy
     |
     | checks with PUBLIC KEY
     v
Allow request
```

Rules:

- Crypto-proxy does NOT have auth private key.
- It gets public key from `GET /auth/jwks.json`.
- Check signature, `exp`, `iss`, `aud`, `alg = RS256`.
- Reject expired or wrong-issuer tokens.
- No JWT = no key, no decrypt, no storage access.

## 7. Config

Settings like:

```text
MongoDB address
S3 bucket, region
JWT public key / JWKS URL
Encryption settings
Env variables
```

Rules:

- Keep secrets in env or secret manager, not in `src/`.
- Never commit private keys, master keys, or AWS secrets to git.
- Use different keys for dev and production.
- JWT signing keys and tenant data keys are separate. Do not mix them.

## 8. Complete Picture

```text
                  Next.js
                     |
       -------------------------------
       |              |              |
     Auth           Case           File
    Service        Service        Service
                      |              |
                      |              |
                      v              v
                -----------------------
                |    Crypto Proxy     |
                |                     |
                |  Tenant Check       |
                |        |            |
                |  Key Management     |
                |        |            |
                |  Lock / Unlock      |
                -----------------------
                          |
              -----------------------
              |                     |
              v                     v
           MongoDB                  S3
        locked case data       locked files
```

## 9. One Important Design Rule

Only crypto-proxy owns encryption keys.

```text
Auth Service    X no encryption keys
Case Service    X no encryption keys
File Service    X no encryption keys
MongoDB         X no encryption keys
S3              X no encryption keys

Crypto Proxy    YES key management
                YES lock / unlock
                YES tenant separation
```

This is what makes crypto-proxy real security, not just another service with a big name.

## 10. Build Checklist

1. Make tenant-manager + JWT check first.
2. Make key-manager with `getKey`, `createKey`, `revokeKey`.
3. Add tenant-keys storage per tenant.
4. Add encrypt / decrypt, then envelope encryption.
5. Add key rotation + versioning.
6. Add mongodb-proxy for case data.
7. Add s3-proxy for files.
8. Test: Tenant A cannot open Tenant B data, old version still opens after rotation, no JWT means no access.
