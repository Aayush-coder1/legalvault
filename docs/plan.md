# LegalVault - Project Plan

LegalVault is a safe place for lawyers to store cases, notes, and files.
It has a website, small backend services, and strong encryption.

## Folder Structure

```text
legalvault/
│
├── frontend/              # Website made with Next.js
│   ├── app/
│   │   ├── login/
│   │   ├── signup/
│   │   ├── dashboard/
│   │   ├── cases/
│   │   └── ...
│   ├── components/
│   ├── lib/
│   ├── public/
│   ├── package.json
│   ├── next.config.ts
│   ├── tsconfig.json
│   └── ...
│
├── services/
│   ├── auth-service/      # Login and signup
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   ├── models/
│   │   │   ├── middleware/
│   │   │   └── config/
│   │   ├── package.json
│   │   └── Dockerfile
│   │
│   ├── case-service/      # Lawyers, cases, notes
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   ├── models/
│   │   │   ├── middleware/
│   │   │   └── config/
│   │   ├── package.json
│   │   └── Dockerfile
│   │
│   ├── file-service/      # PDF, images, videos
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   ├── storage/
│   │   │   │   └── s3/
│   │   │   ├── middleware/
│   │   │   └── config/
│   │   ├── package.json
│   │   └── Dockerfile
│   │
│   └── crypto-proxy/      # Main security part
│       ├── src/
│       │   ├── key-management/
│       │   │   ├── key-manager.ts
│       │   │   ├── tenant-keys.ts
│       │   │   ├── key-rotation.ts
│       │   │   └── key-versioning.ts
│       │   ├── encryption/
│       │   │   ├── encrypt.ts
│       │   │   ├── decrypt.ts
│       │   │   └── envelope-encryption.ts
│       │   ├── mongodb/
│       │   │   └── mongodb-proxy.ts
│       │   ├── s3/
│       │   │   └── s3-proxy.ts
│       │   ├── tenants/
│       │   │   └── tenant-manager.ts
│       │   ├── middleware/
│       │   │   └── authentication.ts
│       │   └── config/
│       ├── package.json
│       └── Dockerfile
│
├── packages/
│   └── shared/            # Common code for all services
│       ├── types/
│       ├── constants/
│       └── utils/
│
├── infrastructure/
│   └── docker-compose.yml # Runs all services together
│
├── docs/
│   └── architecture/
│
├── .env.example
├── .gitignore
├── README.md
└── package.json
```

## What Each Part Does

| Part | Work |
| --- | --- |
| `frontend` | Website. Login, signup, dashboard, cases pages. |
| `auth-service` | Checks who the user is. Handles signup and login. |
| `case-service` | Saves lawyers, cases, and notes. |
| `file-service` | Uploads and downloads files like PDF and images. |
| `crypto-proxy` | Locks and unlocks data. Keeps keys safe. |
| `packages/shared` | Common types and helper functions. |
| `infrastructure` | Starts everything with Docker. |

## How Data Moves

```text
              Next.js website
                    |
      -------------------------------
      |              |              |
 Auth Service  Case Service   File Service
      |              |              |
      |              |              |
    Users       Crypto Proxy  Crypto Proxy
                     |              |
                   MongoDB          S3
```

Steps in simple words:

1. User opens the website.
2. Website talks to 3 services: auth, case, file.
3. Auth service checks login and finds the user.
4. Case and file services do not save open data.
5. They send data to crypto-proxy first.
6. Crypto-proxy locks the data, then saves it to MongoDB or S3.

## Crypto-Proxy in Simple Words

Crypto-proxy protects two things:

```text
        crypto-proxy
             |
     -----------------
     |               |
   MongoDB           S3
 locked text    locked files
```

- MongoDB stores locked case data.
- S3 stores locked files.
- No one can read data without the right key.

Inside crypto-proxy:

- `key-management/` makes keys, changes them, and keeps old versions.
- `encryption/` locks and unlocks data.
- `mongodb/` protects database data.
- `s3/` protects files.
- `tenants/` keeps each customer separate.
- `middleware/` checks login before allowing access.

## Tenant Keys

Each customer has their own key:

```text
Customer A -> Key A
Customer B -> Key B
Customer C -> Key C
```

This means Customer A cannot open Customer B's files.

## What To Build First

Do not make all folders and files at once.

Start simple:

1. Make the 4 service folders first.
2. Add inner folders only when you start that service.
3. Get one flow working: login -> make a case -> save a file -> read it back.

This keeps the project clean and easy to understand.
