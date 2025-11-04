// src/db.ts
// Bun SQLite database setup and helpers

/* @ts-nocheck */
import { Database } from "bun:sqlite";
import { mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

// Determine DB path (persisted inside ./data)
// Resolve default path relative to repo root (one dir above src)
const DEFAULT_DB = join(import.meta.dir, "..", "data", "stripez.sqlite");
const DB_FILE = (process.env.DB_FILE && process.env.DB_FILE.trim())
 ? process.env.DB_FILE
 : DEFAULT_DB;

// Ensure data directory exists
const dataDir = dirname(DB_FILE);
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

export const db = new Database(DB_FILE, { create: true });
export const DB_PATH = DB_FILE;
// Helpful for troubleshooting which DB file is actually used (local vs Docker)
try { console.log(`[DB] Using file: ${DB_FILE}`); } catch (_) {}

// Pragmas for reliability
db.exec(`
  PRAGMA journal_mode = wal;
  PRAGMA synchronous = normal;
  PRAGMA foreign_keys = ON;
`);

// Helpers
export function all<T = any>(sql: string, params: any[] = []): T[] {
  const stmt = db.prepare(sql);
  return stmt.all(...params) as T[];
}

export function get<T = any>(sql: string, params: any[] = []): T | undefined {
  const stmt = db.prepare(sql);
  return stmt.get(...params) as T | undefined;
}

export function run(sql: string, params: any[] = []): void {
  const stmt = db.prepare(sql);
  stmt.run(...params);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function randomId(prefix = ""): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return prefix ? `${prefix}_${hex}` : hex;
}

// Initialize database schema (idempotent)
export function migrate() {
  // people
  db.exec(`
    CREATE TABLE IF NOT EXISTS people (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT
    );
  `);

  // stripes (ts stored as ISO TEXT)
  db.exec(`
    CREATE TABLE IF NOT EXISTS stripes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id TEXT NOT NULL,
      ts TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('normal','drunk')),
      FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_stripes_person ON stripes(person_id);
    CREATE INDEX IF NOT EXISTS idx_stripes_ts ON stripes(ts);
  `);

  // rules (tags stored as JSON TEXT, created_at/updated_at ISO TEXT)
  db.exec(`
    CREATE TABLE IF NOT EXISTS rules (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      "order" INTEGER NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_rules_order ON rules("order");
  `);

  // activity_log (timestamp ISO TEXT)
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      actor TEXT NOT NULL,
      details TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_activity_ts ON activity_log(timestamp);
  `);

  // config (data JSON TEXT, updated_at ISO TEXT)
  db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // sessions (created_at/expires_at ISO TEXT)
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      uid TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
  `);

  // throttles (attempts stored as JSON array TEXT)
  db.exec(`
    CREATE TABLE IF NOT EXISTS throttles (
      key TEXT PRIMARY KEY,
      attempts TEXT NOT NULL DEFAULT '[]'
    );
  `);

  // drink_requests (guest requests to record consumed draughts; timestamps ISO TEXT)
  db.exec(`
    CREATE TABLE IF NOT EXISTS drink_requests (
      id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL,
      amount INTEGER NOT NULL CHECK (amount > 0),
      status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected')),
      requested_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      processed_at TEXT,
      processed_by TEXT,
      applied INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_drink_requests_status_created ON drink_requests(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_drink_requests_person ON drink_requests(person_id);
  `);
}