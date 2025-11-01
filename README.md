# Stripez

Bun.js API + static web app using SQLite, containerized with Docker Compose. Original Firebase project preserved in ./OLD.

- API server: [src/server.ts](src/server.ts)
- DB helpers and migrations: [src/db.ts](src/db.ts)
- Static frontend: [public/index.html](public/index.html), [public/js/api.js](public/js/api.js), [public/js/main.js](public/js/main.js)
- Docker: [Dockerfile](Dockerfile), [docker-compose.yml](docker-compose.yml)

---

## Quick start (Docker Compose)

1) Copy env
```bash
cp .env.example .env
```

2) Build and run
```bash
docker compose up -d --build
```

App: http://localhost:8080

Data persists in ./data (mapped to /app/data). Override DB path with DB_FILE.

---

## Local development (Bun)

```bash
bun install
bun run src/server.ts
```

Server reads env from shell; default DB at ./data/stripez.sqlite.

---

## Environment

- PORT: listen port (default 8080)
- SESSION_SECRET: cookie signing secret
- CORS_ORIGINS: comma-separated allowed origins
- GEMINI_KEY: Google Generative AI API key
- ORACLE_MODEL: model name (default gemini-2.5-flash)
- DB_FILE: SQLite database file path (default ./data/stripez.sqlite)

See [.env.example](.env.example).

---

## API

- POST /api/auth/anon
- GET /api/schikko/status
- GET /api/schikko/info
- POST /api/schikko/set { email }
- POST /api/schikko/login { password }
- GET /api/punishments
- GET /api/rules
- GET /api/activity?sinceDays=30
- POST /api/schikko/action { action, sessionId, ... }
- GET/POST /api/config/{calendar|nicat}
- POST /api/oracle/judgement
- POST /api/activity
- POST /api/calendar/proxy

---

## Notes

- Security headers and CORS configured in server.
- SQLite WAL mode enabled. Migrations run on boot.
- Service worker and manifest intact: [public/sw.js](public/sw.js), [public/manifest.json](public/manifest.json).