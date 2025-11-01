# Stripez

<div align="center">
  <img src="public/assets/icon-512.png" alt="Stripez Icon" width="192" height="192" />

  <strong>The Stripe System — stripes, decrees, and the Schikko.</strong>

  <a href="https://bun.sh"><img src="https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white" alt="Bun"></a>
  <a href="https://hono.dev/"><img src="https://img.shields.io/badge/Hono-FF6A00?style=for-the-badge&logo=hono&logoColor=white" alt="Hono"></a>
  <a href="https://www.sqlite.org/"><img src="https://img.shields.io/badge/SQLite-07405E?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite"></a>
  <a href="https://www.docker.com/"><img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker"></a>

  <a href="https://github.com/mteij/stripez/issues"><strong>Report issues</strong></a>
</div>

## What is Stripez?

Stripez is a lightweight system to run the Schikko Rules. Keep a shared ledger of people, assign stripes for transgressions, fulfill them, and maintain an evolving scroll of decrees.

## Core features

- Ledger and stripes
  - Add stripes, revert last, and record drunk stripes to fulfill penalties
  - Roles per person (Schikko, Board, Activist), per-person stats and history
- Decrees (rules)
  - Ordered, taggable, searchable list; inline edit, reorder, and delete (Schikko only)
- Oracle judgements (optional)
  - Ask the Oracle to judge a transgression; it returns stripes and dice rolls; apply with one click
- Calendar
  - Set a public iCal URL; see the next activity and a full agenda (via a hardened proxy)
- Logbook
  - Every action is logged; smart grouping; 30‑day activity chart; Schikko can delete entries

<div align="center">
  <img src="public/assets/screenshot-desktop.png" alt="Ledger screenshot" width="800" />
</div>

## Quick start

1) Copy env

```bash
cp .env.example .env
```

2) Run with Docker Compose

```bash
docker compose up -d --build
```

App: http://localhost:8080

## Configure the experience

Minimal env (see .env.example):

- SESSION_SECRET — required
- RESEND_API_KEY and MAIL_FROM — required for Schikko password email
- GEMINI_KEY — enables the Oracle (optional); ORACLE_MODEL defaults to gemini-2.5-flash
- CORS_ORIGINS — CSV of allowed origins
- PORT and DB_FILE — optional overrides

Set the Calendar URL from within the app UI (Schikko only).

<details>
<summary>API overview</summary>

- POST /api/auth/anon
- GET /api/punishments
- GET /api/rules
- GET /api/activity?sinceDays=30
- POST /api/schikko/set, /api/schikko/login, /api/schikko/action
- GET /api/config/calendar, GET /api/config/app
- POST /api/oracle/judgement, POST /api/calendar/proxy

</details>

<details>
<summary>Small print</summary>

Built with assistance from AI. Use at your own risk.

</details>