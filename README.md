# Stripez

A Bun.js API + static web app that replaces Firebase (Hosting, Functions, Auth) with a self‑hosted stack (PostgreSQL + Docker). The UI and behavior remain equivalent.

- Backend: Bun + Hono, PostgreSQL, cron jobs
- Frontend: existing static files in ./public (PWA unchanged)
- Image: ghcr.io/<owner>/stripez:latest (see CI)

---

## Quick start (Docker Compose)

- Copy env template, adjust values:
```bash
# bash
cp .env.example .env
```

- Build and run:
```bash
# bash
docker compose up -d --build
```

- App: http://localhost:8080

Services
- stripez-app: Bun server serving API + static files
- postgres: PostgreSQL with volume pgdata

---

## Development (local Bun)

Prereqs: Bun >= 1.1, Docker (for DB) or local Postgres.

- Start DB:
```bash
# bash
docker compose up -d postgres
```

- Install deps and run:
```bash
# bash
bun install
bun run src/server.ts
```

Server runs migrations on boot.

---

## Environment

See [.env.example](.env.example)

- PORT: default 8080
- SESSION_SECRET: cookie signing secret
- CORS_ORIGINS: comma-separated allowed origins (keep current domains + http://localhost:8080)
- GEMINI_KEY: Google Generative AI key
- ORACLE_MODEL: gemini-2.5-flash (fallback to gemini-1.5-flash-latest)
- DATABASE_URL: e.g. postgres://stripez:stripez@postgres:5432/stripez

---

## API

Anonymous identity
- POST /api/auth/anon → sets uid cookie

Schikko
- GET /api/schikko/status
- GET /api/schikko/info
- POST /api/schikko/set { email }
- POST /api/schikko/login { password } → { success, sessionId }

Config
- GET /api/config/calendar
- POST /api/config/calendar { url }
- GET /api/config/nicat
- POST /api/config/nicat { dateString }

Reads
- GET /api/punishments → [{ id, name, role, stripes[], drunkStripes[] }]
- GET /api/rules → [{ id, text, order, tags[], createdAt, updatedAt }]
- GET /api/activity?sinceDays=30

Mutations (require sessionId)
- POST /api/schikko/action { action, sessionId, ... }
  - addPerson { name }
  - addStripe { docId, count? }
  - addDrunkStripe { docId, count? }
  - removeLastStripe { docId }
  - removeLastDrunkStripe { docId }
  - renamePerson { docId, newName }
  - deletePerson { docId }
  - setPersonRole { docId, role }
  - addRule { text, order }
  - deleteRule { docId }
  - updateRuleOrder { rule1, rule2 }
  - updateRule { docId, text, tags }
  - saveCalendarUrl { url }
  - saveNicatDate { dateString }
  - deleteLog { docIds }

Oracle + iCal
- POST /api/oracle/judgement { promptText, rules[], ledgerNames[] }
- POST /api/calendar/proxy { url } (SSRF hardened)

Activity log (client writes)
- POST /api/activity { action, actor, details }

---

## Frontend

- Static served from ./public
- Client uses REST module:
  - API module: [public/js/api.js](public/js/api.js)
  - Main uses REST API: [public/js/main.js](public/js/main.js:4)

Realtime
- Emulated via polling in client. Timestamps expose toDate()/toMillis().

PWA
- Service worker and manifest unchanged: [public/sw.js](public/sw.js), [public/manifest.json](public/manifest.json)

---

## Security

- CORS limited by CORS_ORIGINS
- Security headers (CSP, HSTS, XFO, XCTO, Referrer-Policy, Permissions-Policy) applied in server: [hono middleware](src/server.ts:51)
- SSRF safeguards in iCal proxy: [isPrivateOrDisallowedHost](src/server.ts:316)

---

## Database

Migrations run on boot: [migrate()](src/db.ts:12)

Schema (idempotent):
- people(id, name, role)
- stripes(id, person_id, ts, kind normal|drunk)
- rules(id, text, order, tags[], created_at, updated_at)
- activity_log(id, action, actor, details, timestamp)
- config(key, data jsonb, updated_at)
- sessions(id, uid, created_at, expires_at)
- throttles(key, attempts timestamptz[])

---

## Scheduling

- Annual reset Jan 1st: [cron.schedule](src/server.ts:672)
- Daily log cleanup: [cron.schedule](src/server.ts:680)
Timezone: Europe/Amsterdam

---

## CI (Docker image)

GitHub Actions builds/pushes multi-arch to GHCR:
- Workflow: [.github/workflows/docker.yml](.github/workflows/docker.yml)
- Tags: ghcr.io/<owner>/stripez:latest and :<sha>

---

## Notes

- Original Firebase project copied to ./OLD
- Project name: Stripez
