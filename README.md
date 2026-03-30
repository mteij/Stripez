# Stripez

Stripez is a small Bun + Hono + SQLite app for running a stripes ledger.

It keeps track of people, decrees, drink requests, event timing, and Schikko administration in a single server-rendered app.

## Features

- Ledger management for people, stripes, and fulfilled stripes
- Decree management with ordering, tags, search, and bulk editing
- Event countdown, live state, and Schikko-controlled rescheduling
- Drink requests with optional approval flow
- Schikko claim/login flow with optional Google/Firebase support
- Oracle judgements powered by OpenAI
- Logbook, stats, and randomizers

## Stack

- Bun
- Hono
- SQLite
- Server-rendered frontend with static assets from `public/`

## Run locally

1. Copy `.env.example` to `.env`
2. Set at least `SESSION_SECRET`
3. Install dependencies with `bun install`
4. Start the app with `bun run dev`

The app runs on `http://localhost:8080` by default.

## Run with Docker

```bash
docker compose up -d --build
```

The SQLite database is stored in `./data` by default.

## Important config

See `.env.example` for the full list. The main settings are:

- `SESSION_SECRET`
- `APP_NAME`
- `APP_YEAR`
- `PORT`
- `CORS_ORIGINS`
- `DB_FILE`
- `ADMIN_KEY`
- `DRINK_REQUIRE_APPROVAL`
- `STRIPEZ_DEFAULT_DURATION_DAYS`
- `STRIPEZ_UNSET_DELAY_HOURS`
- `STRIPEZ_CLEANUP_ACTION`
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `ORACLE_MODEL`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_API_KEY`
- `ALLOWED_GOOGLE_EMAILS`

## API

- `POST /api/auth/anon`
- `GET /api/punishments`
- `GET /api/rules`
- `GET /api/activity?sinceDays=30`
- `POST /api/activity`
- `POST /api/drink/request`
- `GET /api/drink/mine`
- `GET /api/config/app`
- `GET /api/config/stripez`
- `POST /api/config/stripez`
- `GET /api/schikko/status`
- `GET /api/schikko/info`
- `POST /api/schikko/set`
- `POST /api/schikko/login`
- `POST /api/schikko/action`
- `POST /api/oracle/judgement`

## Notes

- There is no separate frontend build step.
- Static files are served directly by the Bun server.
- `bun run check` is currently a placeholder script.
