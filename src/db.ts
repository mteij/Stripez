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
      role TEXT,
      consecutive_breaks INTEGER NOT NULL DEFAULT 0,
      last_rule_broken TEXT
    );
  `);
  
  // Add columns to existing database if they don't exist (SQLite workaround)
  // Check if the column exists by querying PRAGMA
  const tableInfo = db.prepare("PRAGMA table_info(people)").all();
  const columns = tableInfo.map((col: any) => col.name);
  
  if (!columns.includes('consecutive_breaks')) {
    db.exec(`ALTER TABLE people ADD COLUMN consecutive_breaks INTEGER DEFAULT 0`);
    // Update existing rows to have 0
    db.exec(`UPDATE people SET consecutive_breaks = 0 WHERE consecutive_breaks IS NULL`);
  }
  
  if (!columns.includes('last_rule_broken')) {
    db.exec(`ALTER TABLE people ADD COLUMN last_rule_broken TEXT`);
  }

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

// Seed default rules if the rules table is empty
export function seedDefaultRules() {
  const existingRules = all<{ id: string }>('SELECT id FROM rules LIMIT 1');
  if (existingRules.length > 0) return; // Already seeded

  const now = nowIso();
  const defaultRules = [
    { id: randomId('rule'), text: '5 minutes late to a meeting: 1 stripe', order: 1 },
    { id: randomId('rule'), text: 'Not finishing an AP: 1 stripe', order: 2 },
    { id: randomId('rule'), text: 'Missing a meeting without notice: dice 3', order: 3 },
    { id: randomId('rule'), text: 'On phone doing unrelated stuff: 1 stripe (2 stripes if it is a Supercell game)', order: 4 },
    { id: randomId('rule'), text: 'Do 6-7 meme (or laugh about it): dice 3', order: 5 },
    { id: randomId('rule'), text: 'Not speaking English during meeting: 1 stripe', order: 6 },
    { id: randomId('rule'), text: 'Rules can be changed or added by Schikko; they go into effect next meeting.', order: 7 },
  ];

  for (const rule of defaultRules) {
    run(
      `INSERT INTO rules (id, text, "order", tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [rule.id, rule.text, rule.order, '[]', now, now]
    );
  }
  console.log('[DB] Seeded default rules');
}
