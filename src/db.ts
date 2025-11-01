import postgres, { Sql } from "postgres";

const DATABASE_URL = process.env.DATABASE_URL || "postgres://stripez:stripez@localhost:5432/stripez";

export const sql: Sql = postgres(DATABASE_URL, {
  prepare: true,
  max: 10,
});

/**
 * Initialize database schema (idempotent)
 */
export async function migrate() {
  // Ensure extensions where helpful (safe if missing permissions)
  try {
    await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
  } catch (_) {}

  // People (ledger)
  await sql`
    CREATE TABLE IF NOT EXISTS people (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NULL
    )
  `;

  // Stripes (normal and drunk)
  await sql`
    CREATE TABLE IF NOT EXISTS stripes (
      id BIGSERIAL PRIMARY KEY,
      person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      kind TEXT NOT NULL CHECK (kind IN ('normal','drunk'))
    )
  `;

  // Rules
  await sql`
    CREATE TABLE IF NOT EXISTS rules (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      "order" INTEGER NOT NULL,
      tags TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Activity log
  await sql`
    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      actor TEXT NOT NULL,
      details TEXT NOT NULL,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Config key/value (json)
  await sql`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Sessions (Schikko session)
  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      uid TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    )
  `;

  // Throttles (generic sliding window)
  await sql`
    CREATE TABLE IF NOT EXISTS throttles (
      key TEXT PRIMARY KEY,
      attempts TIMESTAMPTZ[] NOT NULL DEFAULT '{}'
    )
  `;
}

/**
 * Helpers
 */
export function randomId(prefix = ""): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
  return prefix ? `${prefix}_${hex}` : hex;
}