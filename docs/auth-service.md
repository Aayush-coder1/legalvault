# Auth Service - Documentation

The auth-service handles signup, login, and who the user is.
Only this service can create login tokens. Other services only check them.

We use RS256 (RSA + SHA-256) for JWT signing. This is good for microservices.

## 1. How It Works

```text
Next.js Frontend
      |
      | sends login email + password
      v
Auth Service (has private key)
      |
      | checks user, signs JWT
      v
Frontend gets JWT
      |
      | sends JWT with every request
      v
-------------------------------
| Case Service  -> checks with public key
| File Service  -> checks with public key
| Crypto Proxy  -> checks with public key
```

Each service checks the JWT by itself. It does not call auth-service every time.

Steps in simple words:

1. User enters email and password on website.
2. Frontend sends them to auth-service.
3. Auth-service checks the user in the database.
4. If correct, auth-service makes a JWT and signs it with the private key.
5. Frontend saves the JWT and sends it with next requests.
6. Case-service, file-service, and crypto-proxy check the JWT signature with the public key.
7. If the signature is valid, they allow the request.

## 2. Why RS256

- Auth-service keeps the private key secret. It signs tokens.
- All other services get the public key. They only verify tokens.
- If the private key leaks, we can change keys without changing all services at once.
- Public key can be shared safely. Private key cannot.

## 3. Four Important Rules

### 3.1 Check Full JWT, Not Only Signature

When a service gets a JWT, it must check:

- `signature` - is it signed by auth-service?
- `exp` - is it expired?
- `iss` - issuer. Is it from our auth-service?
- `aud` - audience. Is it made for our app?
- `alg` - allow only `RS256`. Reject `none` and other methods.

Bad token = reject request.

### 3.2 Tenant Isolation

JWT must contain:

- `userId`
- `tenantId` (customer / law firm id)

Rules:

- Do not trust `tenantId` sent in URL or body alone.
- Crypto-proxy must read `tenantId` from the verified JWT.
- Crypto-proxy uses that `tenantId` to pick the right encryption key.
- User A with `tenantId: A` can never open data of `tenantId: B`.

Example:

```text
JWT has tenantId = A -> crypto-proxy uses Key A
JWT has tenantId = B -> crypto-proxy uses Key B
```

### 3.3 Key Management With JWKS

- Only auth-service has the private signing key.
- Other services get the public key from a JWKS endpoint.

Example endpoint:

```text
GET /auth/jwks.json
```

This returns public keys in JWKS format.

Benefits:

- Key rotation is easy. Add new key, keep old key for some time, then remove old key.
- Services fetch new public key automatically.
- Private key stays outside source code and git. Use env variables or secret manager.

Do:

- Store private key in `.env` or secret manager, never in `src/`.
- Add `keys/` to `.gitignore` if keys are files.

Do not:

- Copy private key to case-service, file-service, or frontend.

### 3.4 Token Security

- Access token: short life. Example: 15 minutes.
- Refresh token: longer life. Example: 7 days. Used only to get a new access token.
- For browser login, store tokens in secure, HttpOnly cookies, not in localStorage.
- Use `Secure`, `SameSite=strict/lax`, and CSRF protection.
- Logout must clear cookies and block the refresh token.

Why:

- Short access token limits damage if stolen.
- HttpOnly cookie cannot be read by JavaScript, so XSS theft is harder.
- CSRF protection stops other sites from using your login.

## 4. Auth-Service Folder Structure

```text
auth-service/
├── src/
│   ├── controllers/       # Takes login/signup requests
│   ├── routes/            # URLs like /login, /signup, /refresh, /jwks.json
│   ├── services/
│   │   ├── auth.service.ts   # Checks password, finds user
│   │   └── token.service.ts  # Makes and refreshes JWT
│   ├── models/            # User model
│   ├── middleware/        # Checks input, limits login tries
│   ├── keys/
│   │   └── jwks.ts        # Serves public keys
│   └── config/            # Env, DB address, key settings
├── package.json
└── Dockerfile
```

What each folder does:

- `controllers/` - receives request, sends answer.
- `routes/` - defines paths.
- `services/auth.service.ts` - signup, login logic.
- `services/token.service.ts` - sign access token, verify refresh token.
- `models/` - user table shape.
- `middleware/` - validation and safety checks.
- `keys/jwks.ts` - public key endpoint for other services.
- `config/` - loads env variables.

## 5. Important: Two Different Keys

Do not mix these keys:

1. JWT signing keys - only prove who logged in. Managed by auth-service.
2. Crypto-proxy encryption keys - lock MongoDB and S3 data per tenant. Managed by crypto-proxy.

They need separate storage and separate rotation.

```text
JWT private key -> proves login, lives in auth-service
Tenant Key A/B/C -> locks data, lives in crypto-proxy
```

## 6. What Other Services Must Do

For case-service, file-service, crypto-proxy:

1. Get public key from `GET /auth/jwks.json`.
2. Cache it, refresh sometimes.
3. For each request:
   - Check signature with public key.
   - Check `exp`, `iss`, `aud`, `alg`.
   - Read `userId` and `tenantId` from token, not from request body.
   - Allow or reject.

## 7. Build Checklist

1. Make signup and login API.
2. Add RS256 signing with private key from env.
3. Add `/jwks.json` public key endpoint.
4. Add refresh token API.
5. Add HttpOnly cookie + CSRF.
6. Test expired token, wrong issuer, wrong algorithm are rejected.
7. Connect case-service to verify JWT before building full features.
