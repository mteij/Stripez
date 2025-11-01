# Stripez

<div align="center">
  <img src="public/assets/icon-512.png" alt="Stripez Icon" width="192" height="192" />

  <strong>Bun.js API + static web app, powered by Hono and SQLite</strong>

  <a href="https://bun.sh"><img src="https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white" alt="Bun"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://hono.dev/"><img src="https://img.shields.io/badge/Hono-FF6A00?style=for-the-badge&logo=hono&logoColor=white" alt="Hono"></a>
  <a href="https://www.sqlite.org/"><img src="https://img.shields.io/badge/SQLite-07405E?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite"></a>
  <a href="https://www.docker.com/"><img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker"></a>

  <a href="https://github.com/MichielEijpe/schikko-rules/issues"><strong>Report Issues</strong></a>
</div>

<details>
<summary><font size="+3"><b>Disclaimer: Built with AI</b></font></summary>

This project was built with help from AI tooling and is still evolving. Use at your own risk and review the code and configuration before deploying to production.
</details>

## About

Stripez is a minimal Bun.js backend with a static frontend. It uses Hono for routing and SQLite for storage, and ships with Docker Compose for easy deployment.

## Features

- Hono-based API with sensible security headers
- SQLite with WAL mode and auto migrations on boot
- Static frontend with PWA assets (manifest + service worker)
- Dockerized with persistent data volume

## Quick start

<details>
<summary>Docker Compose (recommended)</summary>

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
</details>

<details>
<summary>Local development (Bun)</summary>

```bash
bun install
bun run src/server.ts
```

Server reads env from shell; default DB at ./data/stripez.sqlite.
</details>

## Configuration

Minimal env to consider (see [.env.example](.env.example)):

- PORT (default 8080)
- SESSION_SECRET (required)
- CORS_ORIGINS (CSV)
- GEMINI_KEY (optional)
- ORACLE_MODEL (default gemini-2.5-flash)
- DB_FILE (default ./data/stripez.sqlite)
- RESEND_API_KEY and MAIL_FROM (for email)

## Project files

- API server: [src/server.ts](src/server.ts)
- DB helpers and migrations: [src/db.ts](src/db.ts)
- Frontend: [public/index.html](public/index.html), [public/js/api.js](public/js/api.js), [public/js/main.js](public/js/main.js)
- Docker: [Dockerfile](Dockerfile), [docker-compose.yml](docker-compose.yml)