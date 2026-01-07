// @ts-nocheck
/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { db, migrate, randomId, all, get, run, nowIso } from "./db";
import crypto from "crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { request as gaxiosRequest } from "gaxios";
import net from "net";
import cron from "node-cron";
import path from "node:path";
import { Index } from "./views/Index";

// ---- ENV ----
const PORT = Number(process.env.PORT || 8080);
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "*")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const SESSION_SECRET =
  process.env.SESSION_SECRET || "dev-session-secret-change-me";
const GEMINI_KEY = process.env.GEMINI_KEY || "";
const ORACLE_MODEL = process.env.ORACLE_MODEL || "gemini-2.5-flash";
const ADMIN_KEY = (process.env.ADMIN_KEY || "").trim();

// Branding
const APP_NAME = process.env.APP_NAME || "Stripez";
const APP_YEAR = Number(process.env.APP_YEAR || new Date().getFullYear());
// Drink request policy (default: require Schikko approval)
const DRINK_REQUIRE_APPROVAL = parseBool(
  process.env.DRINK_REQUIRE_APPROVAL,
  true
);

// Event config and cleanup behavior
const STRIPEZ_DEFAULT_DURATION_DAYS = Math.max(
  1,
  Number(process.env.STRIPEZ_DEFAULT_DURATION_DAYS || 3)
);
const STRIPEZ_UNSET_DELAY_HOURS = Math.max(
  0,
  Number(process.env.STRIPEZ_UNSET_DELAY_HOURS || 6)
);
const STRIPEZ_CLEANUP_ACTION = String(
  process.env.STRIPEZ_CLEANUP_ACTION || "NOTHING"
).toUpperCase();

// ---- APP ----
const app = new Hono();

// CORS
app.use(
  "/api/*",
  cors({
    origin: (origin) =>
      !origin ? "*" : CORS_ORIGINS.includes(origin) ? origin : CORS_ORIGINS[0],
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "DELETE", "PUT", "PATCH", "OPTIONS"],
    credentials: true,
    maxAge: 86400,
  })
);

// Security headers (CSP mirrors firebase.json, minus Firebase APIs)
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://cdn.tailwindcss.com https://www.gstatic.com https://www.googletagmanager.com https://apis.google.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: https:",
  "font-src 'self' https://fonts.gstatic.com data:",
  "connect-src 'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com blob: data:",
  "frame-src 'self' https://apis.google.com https://schikko-rules.firebaseapp.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
].join("; ");

app.use("*", async (c, next) => {
  c.header("Content-Security-Policy", CSP);
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header(
    "Permissions-Policy",
    "accelerometer=(), autoplay=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()"
  );
  c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  await next();
});

// ---- Helpers ----
function getCookie(c: any, name: string): string | undefined {
  const cookie = c.req.header("Cookie") || "";
  const parts = cookie.split(";").map((p) => p.trim());
  for (const part of parts) {
    if (part.startsWith(`${name}=`))
      return decodeURIComponent(part.substring(name.length + 1));
  }
  return undefined;
}

function setCookie(c: any, name: string, value: string, days = 365) {
  const expires = new Date(Date.now() + days * 86400000).toUTCString();
  const secure = c.req.url.startsWith("https:") ? " Secure;" : "";
  c.header(
    "Set-Cookie",
    `${name}=${encodeURIComponent(
      value
    )}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires};${secure}`
  );
}

function jsonDate(d: Date | string | number | null | undefined) {
  if (!d) return null;
  if (typeof d === "string") return d;
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toISOString();
}

function yearKey(y = new Date().getFullYear()) {
  return `schikko_${y}`;
}

function timingSafeEq(aHex: string, bHex: string) {
  const a = Buffer.from(aHex, "hex");
  const b = Buffer.from(bHex, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function timingSafeStrEq(a: string, b: string) {
  const A = Buffer.from(String(a || ""), "utf8");
  const B = Buffer.from(String(b || ""), "utf8");
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

// Env boolean parsing with sane defaults
function parseBool(v: any, def = false) {
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  if (s === "false" || s === "0" || s === "no" || s === "off") return false;
  if (s === "true" || s === "1" || s === "yes" || s === "on") return true;
  return def;
}

function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password: string, salt: string, hash: string) {
  const computed = crypto.scryptSync(password, salt, 64).toString("hex");
  return timingSafeEq(computed, hash);
}

// ---- TOTP helpers (RFC 6238) ----
const B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(bytes: Uint8Array): string {
  let bits = 0,
    value = 0,
    output = "";
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      output += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += B32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(str: string): Uint8Array {
  const clean = String(str || "")
    .toUpperCase()
    .replace(/[^A-Z2-7]/g, "");
  let bits = 0,
    value = 0;
  const out: number[] = [];
  for (let i = 0; i < clean.length; i++) {
    const idx = B32_ALPHABET.indexOf(clean[i]);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Uint8Array.from(out);
}

function hotp(secret: Uint8Array, counter: number, digits = 6): string {
  const buf = Buffer.alloc(8);
  for (let i = 7; i >= 0; i--) {
    buf[i] = counter & 0xff;
    counter = Math.floor(counter / 256);
  }
  const hmac = crypto
    .createHmac("sha1", Buffer.from(secret))
    .update(buf)
    .digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const mod = 10 ** digits;
  return String(code % mod).padStart(digits, "0");
}

function totpVerify(
  secretBase32: string,
  token: string,
  window = 1,
  step = 30,
  digits = 6
): boolean {
  const secret = base32Decode(secretBase32);
  const counter = Math.floor(Date.now() / 1000 / step);
  const norm = String(token || "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(norm)) return false;
  for (let w = -window; w <= window; w++) {
    const otp = hotp(secret, counter + w, digits);
    if (otp === norm) return true;
  }
  return false;
}

function makeOtpAuthUrl(opts: {
  secretBase32: string;
  account: string;
  issuer: string;
}): string {
  const issuer = opts.issuer;
  const account = opts.account;
  const label = `${issuer}:${account}`;
  const params = new URLSearchParams({
    secret: opts.secretBase32,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

async function pushThrottle(
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const cutoff = Date.now() - windowMs;
  let attemptsJson = get<{ attempts: string }>(
    "SELECT attempts FROM throttles WHERE key = ?",
    [key]
  )?.attempts;
  let attempts: string[] = [];
  if (attemptsJson) {
    try {
      attempts = JSON.parse(attemptsJson);
    } catch {
      attempts = [];
    }
  }
  const recent = attempts.filter((iso) => {
    const t = Date.parse(iso);
    return !Number.isNaN(t) && t > cutoff;
  });
  if (recent.length >= limit) return false;
  recent.push(nowIso());
  run(
    `INSERT INTO throttles (key, attempts) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET attempts=excluded.attempts`,
    [key, JSON.stringify(recent)]
  );
  return true;
}

// ---- Mail (Resend) ----

// ---- Auth: Anonymous UID ----
app.post("/api/auth/anon", async (c) => {
  let uid = getCookie(c, "uid");
  if (!uid) {
    uid = randomId("u");
    setCookie(c, "uid", uid);
  }
  return c.json({ uid });
});

// ---- Schikko: Status / Info ----
app.get("/api/schikko/status", async (c) => {
  const y = APP_YEAR;
  const key = yearKey(y);
  const row =
    get<{ data: string }>("SELECT data FROM config WHERE key = ?", [key]) ||
    null;
  let exists = !!row;
  let verified = false;
  if (row) {
    try {
      const data = JSON.parse(row.data || "{}");
      verified = !!data.verified;
    } catch {}
  }
  return c.json({ isSet: verified, pending: exists && !verified });
});

app.get("/api/schikko/info", async (c) => {
  const y = new Date().getFullYear();
  const key = yearKey(y);
  const row =
    get<{ data: string }>("SELECT data FROM config WHERE key = ?", [key]) ||
    null;
  if (!row) return c.json({ name: null, expires: null });
  let data: any = {};
  try {
    data = JSON.parse(row.data || "{}");
  } catch {}

  // Calculate strict expiry: defaults to End of Year, but uses Stripez event+delay if configured
  let expiry = new Date(y, 11, 31, 23, 59, 59); // Default: Dec 31st 23:59:59

  // Check if Stripez event is configured
  const stripeConfRow =
    get<{ data: string }>("SELECT data FROM config WHERE key='stripez'") ||
    null;
  if (stripeConfRow) {
    try {
      const sData = JSON.parse(stripeConfRow.data || "{}");
      if (sData.date) {
        const startISO = new Date(String(sData.date));
        if (!Number.isNaN(startISO.getTime())) {
          // Replicate logic from cron: local midnight start + duration + delay
          const startLocal = new Date(
            startISO.getFullYear(),
            startISO.getMonth(),
            startISO.getDate()
          );
          const durDays = Math.max(
            1,
            Number(sData.durationDays || STRIPEZ_DEFAULT_DURATION_DAYS)
          );
          const endLocal = new Date(
            startLocal.getTime() + durDays * 24 * 60 * 60 * 1000
          );
          // Deadline includes the unset delay
          const deadline = new Date(
            endLocal.getTime() + STRIPEZ_UNSET_DELAY_HOURS * 60 * 60 * 1000
          );
          
          // If the event deadline is valid (and possibly earlier than year end), use it.
          // Note: Logic allows it to be next year if the event is late in the year, 
          // but usually we want the earliest "unset" trigger. 
          // However, the cron job for Jan 1st is separate. 
          // Let's assume the event-based expiry is the interesting one for the user.
          expiry = deadline;
        }
      }
    } catch {}
  }

  const verified = !!data.verified;
  const name = verified
    ? [data.firstName, data.lastName].filter(Boolean).join(" ").trim() || null
    : null;
  return c.json({ name, expires: verified ? expiry.toISOString() : null });
});

// ---- Schikko: Set & Login ----
app.post("/api/schikko/set", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const firstName = String(body.firstName || "").trim();
  const lastName = String(body.lastName || "").trim();

  if (!firstName || !lastName)
    return c.json({ error: "invalid-argument" }, 400);

  const y = APP_YEAR;
  const key = yearKey(y);
  const exists = !!get("SELECT 1 FROM config WHERE key = ?", [key]);
  if (exists)
    return c.json(
      {
        error: "already-exists",
        message: `A Schikko is already set for ${y}.`,
      },
      409
    );

  // Generate a new TOTP secret (not persisted yet — requires immediate verification)
  const rawSecret = crypto.randomBytes(20); // 160-bit
  const secretBase32 = base32Encode(rawSecret);
  const issuer = `${APP_NAME} ${y}`;
  const account =
    [firstName, lastName].filter(Boolean).join(" ").trim() || "Schikko";
  const otpauthUrl = makeOtpAuthUrl({ secretBase32, account, issuer });

  // Return the OTP setup details; client must confirm with a valid 2FA code to finalize
  return c.json({
    success: true,
    otp: { secret: secretBase32, otpauthUrl },
    needsConfirmation: true,
  });
});

app.post("/api/schikko/confirm", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const firstName = String(body.firstName || "").trim();
  const lastName = String(body.lastName || "").trim();
  const secretBase32 = String(body.secret || "").trim();
  const code = String(body.code || "").trim();

  if (!firstName || !lastName || !secretBase32 || !code) {
    return c.json({ error: "invalid-argument" }, 400);
  }

  const y = APP_YEAR;
  const key = yearKey(y);
  const exists = !!get("SELECT 1 FROM config WHERE key = ?", [key]);
  if (exists)
    return c.json(
      {
        error: "already-exists",
        message: `A Schikko is already set for ${y}.`,
      },
      409
    );

  // Verify the provided TOTP code against the provided secret
  const ok = totpVerify(secretBase32, code, 1, 30, 6);
  if (!ok) return c.json({ success: false, error: "invalid-2fa" }, 401);

  try {
    run(`INSERT INTO config (key, data, updated_at) VALUES (?, ?, ?)`, [
      key,
      JSON.stringify({
        firstName,
        lastName,
        totpSecret: secretBase32,
        verified: true,
      }),
      nowIso(),
    ]);
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: "internal" }, 500);
  }
});

app.post("/api/schikko/login", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const providedRaw = body?.code;
  const provided = typeof providedRaw === "string" ? providedRaw.trim() : "";
  if (!provided) return c.json({ error: "invalid-argument" }, 400);

  // Throttle global login attempts
  const allowed = await pushThrottle("login_throttle", 20, 10 * 60 * 1000);
  if (!allowed) return c.json({ error: "resource-exhausted" }, 429);

  const uid = getCookie(c, "uid");
  if (!uid) return c.json({ error: "unauthenticated" }, 401);

  const y = APP_YEAR;
  const key = yearKey(y);
  const row =
    get<{ data: string }>("SELECT data FROM config WHERE key = ?", [key]) ||
    null;
  // Allow break-glass ADMIN_KEY login even if no Schikko is set
  if (!row) {
    if (ADMIN_KEY && timingSafeStrEq(provided, ADMIN_KEY)) {
      const sessionId = randomId("s");
      const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
      run(
        `INSERT INTO sessions (id, uid, created_at, expires_at) VALUES (?, ?, ?, ?)`,
        [sessionId, uid, nowIso(), expiresAt.toISOString()]
      );
      return c.json({ success: true, sessionId, expiresAtMs: +expiresAt });
    }
    return c.json(
      { error: "not-found", message: `No Schikko set for ${y}.` },
      404
    );
  }

  let data: any = {};
  try {
    data = JSON.parse(row.data || "{}");
  } catch {}

  let ok = false;
  let usedTotp = false;

  // Break-glass admin key (ENV) — bypasses TOTP when present (does NOT mark verified)
  if (!ok && ADMIN_KEY && timingSafeStrEq(provided, ADMIN_KEY)) {
    ok = true;
  }

  if (!ok && typeof data.totpSecret === "string" && data.totpSecret) {
    const passed = totpVerify(data.totpSecret, provided, 1, 30, 6);
    if (passed) {
      ok = true;
      usedTotp = true;
    }
  } else if (data.passwordHash && data.passwordSalt) {
    // Backward compatibility: accept legacy password logins if TOTP not yet configured
    ok = verifyPassword(provided, data.passwordSalt, data.passwordHash);
  } else if (typeof data.password === "string") {
    // Legacy plaintext fallback + migrate to hash
    ok = data.password === provided;
    if (ok) {
      const { salt, hash } = hashPassword(provided);
      run(`UPDATE config SET data = ?, updated_at = ? WHERE key = ?`, [
        JSON.stringify({
          ...data,
          passwordHash: hash,
          passwordSalt: salt,
          password: undefined,
        }),
        nowIso(),
        key,
      ]);
    }
  }

  if (!ok) return c.json({ success: false });

  // On first successful TOTP login, mark Schikko as verified
  if (usedTotp && !data.verified) {
    try {
      run(`UPDATE config SET data = ?, updated_at = ? WHERE key = ?`, [
        JSON.stringify({ ...data, verified: true }),
        nowIso(),
        key,
      ]);
    } catch {}
  }

  const sessionId = randomId("s");
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
  run(
    `INSERT INTO sessions (id, uid, created_at, expires_at) VALUES (?, ?, ?, ?)`,
    [sessionId, uid, nowIso(), expiresAt.toISOString()]
  );
  return c.json({ success: true, sessionId, expiresAtMs: +expiresAt });
});

// ---- Config (calendar/stripez) ----
app.get("/api/config/calendar", async (c) => {
  const row =
    get<{ data: string }>("SELECT data FROM config WHERE key='calendar'") ||
    null;
  if (!row) return c.json({ url: null });
  try {
    const data = JSON.parse(row.data || "{}");
    return c.json({ url: data.url || null });
  } catch {
    return c.json({ url: null });
  }
});

app.post("/api/config/calendar", async (c) => {
  const { url } = await c.req.json();
  if (!url || typeof url !== "string")
    return c.json({ error: "invalid-argument" }, 400);
  run(
    `INSERT INTO config (key, data, updated_at)
     VALUES ('calendar', ?, ?)
     ON CONFLICT(key) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at`,
    [JSON.stringify({ url }), nowIso()]
  );
  return c.json({ ok: true });
});

app.get("/api/config/stripez", async (c) => {
  const row =
    get<{ data: string }>("SELECT data FROM config WHERE key='stripez'") ||
    null;
  if (!row)
    return c.json({ date: null, durationDays: STRIPEZ_DEFAULT_DURATION_DAYS });
  try {
    const data = JSON.parse(row.data || "{}");
    const durationDays = Math.max(
      1,
      Number(data.durationDays || STRIPEZ_DEFAULT_DURATION_DAYS)
    );
    return c.json({ date: data.date || null, durationDays });
  } catch {
    return c.json({ date: null, durationDays: STRIPEZ_DEFAULT_DURATION_DAYS });
  }
});

app.post("/api/config/stripez", async (c) => {
  const { dateString, durationDays } = await c.req.json();
  const d = new Date(String(dateString || ""));
  if (Number.isNaN(d.getTime()))
    return c.json({ error: "invalid-argument" }, 400);
  const dur = Math.max(
    1,
    Number(durationDays || STRIPEZ_DEFAULT_DURATION_DAYS)
  );
  run(
    `INSERT INTO config (key, data, updated_at)
     VALUES ('stripez', ?, ?)
     ON CONFLICT(key) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at`,
    [JSON.stringify({ date: d.toISOString(), durationDays: dur }), nowIso()]
  );
  return c.json({ ok: true });
});

// ---- App config (branding + oracle availability) ----
app.get("/api/config/app", async (c) => {
  return c.json({
    name: APP_NAME,
    year: APP_YEAR,
    hasOracle: Boolean(GEMINI_KEY),
    requireApprovalForDrinks: Boolean(DRINK_REQUIRE_APPROVAL),
  });
});

// ---- Data: Punishments / Rules / Activity (reads) ----
app.get("/api/punishments", async (c) => {
  const people = all<{ id: string; name: string; role: string | null }>(
    `SELECT id, name, role FROM people ORDER BY LOWER(name) ASC`
  );
  const stripes = all<{
    person_id: string;
    ts: string;
    kind: "normal" | "drunk";
  }>(`SELECT person_id, ts, kind FROM stripes`);

  const byId: Record<string, any> = {};
  for (const p of people) {
    byId[p.id] = {
      id: p.id,
      name: p.name,
      role: p.role ?? undefined,
      stripes: [] as string[],
      drunkStripes: [] as string[],
    };
  }
  for (const s of stripes) {
    const rec = byId[s.person_id];
    if (!rec) continue;
    if (s.kind === "normal") rec.stripes.push(jsonDate(s.ts));
    else rec.drunkStripes.push(jsonDate(s.ts));
  }

  const list = Object.values(byId);
  for (const p of list) {
    p.stripes = p.stripes.sort();
    p.drunkStripes = p.drunkStripes.sort();
  }
  return c.json(list);
});

app.get("/api/rules", async (c) => {
  const rows = all<{
    id: string;
    text: string;
    order: number;
    tags: string;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, text, "order", tags, created_at, updated_at FROM rules ORDER BY "order" ASC`
  );
  return c.json(
    rows.map((r) => ({
      id: r.id,
      text: r.text,
      order: r.order,
      tags: (() => {
        try {
          return JSON.parse(r.tags || "[]");
        } catch {
          return [];
        }
      })(),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }))
  );
});

app.get("/api/activity", async (c) => {
  const sinceDays = Number(
    new URL(c.req.url).searchParams.get("sinceDays") || 30
  );
  const cutoff = new Date();
  cutoff.setDate(
    cutoff.getDate() - (Number.isFinite(sinceDays) ? sinceDays : 30)
  );
  const rows = all<{
    id: string;
    action: string;
    actor: string;
    details: string;
    timestamp: string;
  }>(
    `SELECT id, action, actor, details, timestamp
     FROM activity_log
     WHERE timestamp >= ?
     ORDER BY timestamp DESC`,
    [cutoff.toISOString()]
  );
  return c.json(rows);
});

// ---- Calendar Proxy (with SSRF hardening) ----
function isPrivateOrDisallowedHost(hostname: string): boolean {
  const lower = String(hostname || "").toLowerCase();
  if (lower === "localhost" || lower === "127.0.0.1" || lower === "::1")
    return true;
  if (lower.endsWith(".internal") || lower === "metadata.google.internal")
    return true;

  const ipv4Private =
    /^(10\.([0-9]{1,3}\.){2}[0-9]{1,3})$/.test(lower) ||
    /^(192\.168\.[0-9]{1,3}\.[0-9]{1,3})$/.test(lower) ||
    /^(172\.(1[6-9]|2[0-9]|3[0-1])\.[0-9]{1,3}\.[0-9]{1,3})$/.test(lower) ||
    /^(169\.254\.[0-9]{1,3}\.[0-9]{1,3})$/.test(lower);

  const ipv6Private = lower.startsWith("fd") || lower.startsWith("fe80");

  const ipVersion = net.isIP(lower);
  if (ipVersion === 4 && ipv4Private) return true;
  if (ipVersion === 6 && (ipv6Private || lower === "::1")) return true;
  if (ipVersion === 4 || ipVersion === 6) return true;
  return false;
}

app.post("/api/calendar/proxy", async (c) => {
  const method = c.req.method;
  if (method === "PURGE") return c.text("Method Not Allowed", 405);
  if (method !== "POST") return c.text("Method Not Allowed", 405);

  const body = await c.req.json().catch(() => ({}));
  const url = body?.url as string | undefined;
  if (!url || typeof url !== "string")
    return c.json(
      { error: { status: "INVALID_ARGUMENT", message: "Missing 'url'." } },
      400
    );

  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return c.json(
      { error: { status: "INVALID_ARGUMENT", message: "Invalid URL." } },
      400
    );
  }
  if (!["http:", "https:"].includes(u.protocol)) {
    return c.json(
      {
        error: {
          status: "INVALID_ARGUMENT",
          message: "Only http(s) URLs are allowed.",
        },
      },
      400
    );
  }
  if (isPrivateOrDisallowedHost(u.hostname)) {
    return c.json(
      {
        error: {
          status: "INVALID_ARGUMENT",
          message: "Target host is not allowed.",
        },
      },
      400
    );
  }

  try {
    const resp = await gaxiosRequest<string>({
      url: u.toString(),
      method: "GET",
      timeout: 8000,
      headers: {
        Accept: "text/calendar, text/plain;q=0.9, */*;q=0.1",
        "User-Agent": "stripez-ical-proxy/1.0",
      },
      maxContentLength: 1000000,
    });
    const ct = String(
      resp.headers?.["content-type"] || resp.headers?.["Content-Type"] || ""
    ).toLowerCase();
    if (
      ct &&
      !(
        ct.startsWith("text/calendar") ||
        ct.startsWith("text/plain") ||
        ct.startsWith("text/")
      )
    ) {
      return c.json(
        {
          error: {
            status: "INVALID_ARGUMENT",
            message: "Unsupported content type from target host.",
          },
        },
        400
      );
    }
    return c.json({ icalData: resp.data });
  } catch (e) {
    return c.json(
      {
        error: {
          status: "INTERNAL",
          message: "Could not fetch calendar data.",
        },
      },
      500
    );
  }
});

// ---- Oracle (Gemini) ----
app.post("/api/oracle/judgement", async (c) => {
  const { promptText, rules, ledgerNames } = await c.req.json();
  if (!GEMINI_KEY) return c.json({ error: "GEMINI_KEY not configured" }, 500);
  if (!promptText) return c.json({ error: "invalid-argument" }, 400);

  const sanitizedPrompt = String(promptText).replace(/`/g, "'");

  const genAI = new GoogleGenerativeAI(GEMINI_KEY);
  let modelName = ORACLE_MODEL || "gemini-2.5-flash";
  let model = genAI.getGenerativeModel({ model: modelName });

  const rulesText = (Array.isArray(rules) ? rules : [])
    .map((rule: any, i: number) => `${i + 1}. ${rule.text}`)
    .join("\n");

  const fullPrompt = `You are an ancient, wise, and slightly dramatic Oracle for a game called "Schikko Rules". Your task is to pass judgement on a transgression described by a user. You must determine the broken rules and their individual penalties. You will output your judgement as a JSON string, wrapped in a markdown code block (e.g., \`\`\`json { ... } \`\`\`). Do NOT output anything else outside the code block.

The JSON must have the following structure:
{
  "person": "string",
  "penalties": [
    {"type": "stripes", "amount": number},
    {"type": "dice", "value": number}
  ],
  "rulesBroken": [number, ...],
  "innocent": boolean
}

IMPORTANT:
- The "penalties" array must contain an object for each individual penalty. Do NOT sum them.
- If multiple dice rolls are required, create a separate "dice" penalty object for each roll. For example, a penalty to roll a d20 and two d6s would result in: "penalties": [{"type": "dice", "value": 20}, {"type": "dice", "value": 6}, {"type": "dice", "value": 6}].
- If no rules are broken, set "innocent" to true and the "penalties" array can be empty.

Here are the official "Schikko's Decrees":
---
${rulesText}
---
A user has described the following transgression:
---
"${sanitizedPrompt}"
---`;

  let result: any;
  try {
    console.log(`[Oracle] Attempting to use model: ${modelName}`);
    result = await model.generateContent(fullPrompt);
    console.log(`[Oracle] Success with model: ${modelName}`);
  } catch (primaryError: any) {
    console.error(
      `[Oracle] Error with model ${modelName}:`,
      primaryError.message
    );
    if (modelName !== "gemini-1.5-flash-latest") {
      console.log(`[Oracle] Falling back to gemini-1.5-flash-latest`);
      modelName = "gemini-1.5-flash-latest";
      model = genAI.getGenerativeModel({ model: modelName });
      result = await model.generateContent(fullPrompt);
    } else {
      throw primaryError;
    }
  }

  const judgementText = String(result.response.text()).trim();
  let parsed: any;
  try {
    const fenced =
      judgementText.match(/```json[\s\S]*?```/i) ||
      judgementText.match(/```[\s\S]*?```/);
    const jsonString = fenced
      ? fenced[0]
          .replace(/```json/i, "")
          .replace(/```/g, "")
          .trim()
      : judgementText;
    parsed = JSON.parse(jsonString);
  } catch (e) {
    return c.json(
      {
        error: {
          status: "INVALID_ARGUMENT",
          message: "Oracle returned non-JSON judgement",
          judgement: judgementText,
        },
      },
      400
    );
  }

  // Levenshtein/light name snap
  function lev(a: string, b: string) {
    const m = Array.from({ length: b.length + 1 }, (_, i) => [i]);
    for (let j = 0; j <= a.length; j++) m[0][j] = j;
    for (let i = 1; i <= b.length; i++)
      for (let j = 1; j <= a.length; j++)
        m[i][j] =
          b.charAt(i - 1) === a.charAt(j - 1)
            ? m[i - 1][j - 1]
            : Math.min(m[i - 1][j - 1] + 1, m[i][j - 1] + 1, m[i - 1][j] + 1);
    return m[b.length][a.length];
  }
  if (
    Array.isArray(ledgerNames) &&
    parsed.person &&
    String(parsed.person).toLowerCase() !== "someone"
  ) {
    let closest = parsed.person;
    let min = -1;
    for (const name of ledgerNames) {
      const d = lev(
        String(parsed.person).toLowerCase(),
        String(name).toLowerCase()
      );
      if (min === -1 || d < min) {
        min = d;
        closest = name;
      }
    }
    if (min >= 0 && min < 3) parsed.person = closest;
  }

  return c.json({ judgement: parsed });
});

// ---- Schikko Mutations (Authorization via session) ----
async function requireValidSession(c: any, sessionId: string) {
  const uid = getCookie(c, "uid");
  if (!uid) return { ok: false, code: 401, error: "unauthenticated" };
  const row = get<{ id: string; uid: string; expires_at: string }>(
    "SELECT id, uid, expires_at FROM sessions WHERE id = ?",
    [sessionId]
  );
  if (
    !row ||
    row.uid !== uid ||
    new Date(row.expires_at).getTime() <= Date.now()
  )
    return { ok: false, code: 403, error: "permission-denied" };
  return { ok: true };
}

app.post("/api/schikko/action", async (c) => {
  const body = await c.req.json();
  const { action, sessionId, ...data } = body || {};
  if (typeof action !== "string" || !action)
    return c.json({ error: "invalid-argument" }, 400);

  const session = await requireValidSession(c, String(sessionId || ""));
  if (!session.ok) return c.json({ error: session.error }, session.code);

  // Rate limit per-uid
  const uid = getCookie(c, "uid")!;
  const allowed = await pushThrottle(
    `schikko_action_throttle_${uid}`,
    60,
    60 * 1000
  );
  if (!allowed) return c.json({ error: "resource-exhausted" }, 429);

  try {
    switch (action) {
      // Ledger
      case "addPerson": {
        const name = String(data.name || "").trim();
        if (!name) return c.json({ error: "invalid-argument" }, 400);
        const id = randomId("p");
        run(`INSERT INTO people (id, name) VALUES (?, ?)`, [id, name]);
        return c.json({ ok: true, id });
      }
      case "addStripe": {
        const docId = String(data.docId || "");
        const count = Math.max(1, Number(data.count || 1));
        if (!docId) return c.json({ error: "invalid-argument" }, 400);
        for (let i = 0; i < count; i++) {
          const ts = new Date(Date.now() + i).toISOString();
          run(
            `INSERT INTO stripes (person_id, ts, kind) VALUES (?, ?, 'normal')`,
            [docId, ts]
          );
        }
        return c.json({ ok: true });
      }
      case "addDrunkStripe": {
        const docId = String(data.docId || "");
        const count = Math.max(1, Number(data.count || 1));
        if (!docId) return c.json({ error: "invalid-argument" }, 400);
        for (let i = 0; i < count; i++) {
          const ts = new Date(Date.now() + i).toISOString();
          run(
            `INSERT INTO stripes (person_id, ts, kind) VALUES (?, ?, 'drunk')`,
            [docId, ts]
          );
        }
        return c.json({ ok: true });
      }
      case "removeLastStripe": {
        const docId = String(data.docId || "");
        if (!docId) return c.json({ error: "invalid-argument" }, 400);
        const last = get<{ id: number; ts: string }>(
          `SELECT id, ts FROM stripes WHERE person_id = ? AND kind = 'normal' ORDER BY ts DESC LIMIT 1`,
          [docId]
        );
        if (last?.id) run(`DELETE FROM stripes WHERE id = ?`, [last.id]);

        // Ensure drunk <= normal
        const n =
          get<{ c: number }>(
            `SELECT COUNT(*) as c FROM stripes WHERE person_id = ? AND kind = 'normal'`,
            [docId]
          )?.c || 0;
        const d =
          get<{ c: number }>(
            `SELECT COUNT(*) as c FROM stripes WHERE person_id = ? AND kind = 'drunk'`,
            [docId]
          )?.c || 0;
        if (d > n) {
          const toRemove = d - n;
          const rows = all<{ id: number }>(
            `SELECT id FROM stripes WHERE person_id = ? AND kind = 'drunk' ORDER BY ts DESC LIMIT ?`,
            [docId, toRemove]
          );
          if (rows.length) {
            const qs = rows.map(() => "?").join(", ");
            run(
              `DELETE FROM stripes WHERE id IN (${qs})`,
              rows.map((r) => r.id)
            );
          }
        }
        return c.json({ ok: true });
      }
      case "renamePerson": {
        const docId = String(data.docId || "");
        const newName = String(data.newName || "").trim();
        if (!docId || !newName)
          return c.json({ error: "invalid-argument" }, 400);
        run(`UPDATE people SET name = ? WHERE id = ?`, [newName, docId]);
        return c.json({ ok: true });
      }
      case "deletePerson": {
        const docId = String(data.docId || "");
        if (!docId) return c.json({ error: "invalid-argument" }, 400);
        run(`DELETE FROM people WHERE id = ?`, [docId]);
        return c.json({ ok: true });
      }
      case "setPersonRole": {
        const docId = String(data.docId || "");
        const role =
          typeof data.role === "string" ? String(data.role || "").trim() : "";
        const allowedRoles = ["Schikko", APP_NAME, "Board", "Activist"];
        let value: string | null = null;
        if (role) {
          const match = allowedRoles.find(
            (r) => r.toLowerCase() === role.toLowerCase()
          );
          if (!match)
            return c.json(
              { error: "invalid-argument", message: "Invalid role" },
              400
            );
          value = match;
        }
        run(`UPDATE people SET role = ? WHERE id = ?`, [value, docId]);
        return c.json({ ok: true });
      }

      // Rules
      case "addRule": {
        const text = String(data.text || "").trim();
        const order = Number(data.order);
        if (!text || !Number.isFinite(order))
          return c.json({ error: "invalid-argument" }, 400);
        const id = randomId("r");
        const ts = nowIso();
        run(
          `INSERT INTO rules (id, text, "order", tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
          [id, text, order, JSON.stringify([]), ts, ts]
        );
        return c.json({ ok: true, id });
      }
      case "deleteRule": {
        const docId = String(data.docId || "");
        if (!docId) return c.json({ error: "invalid-argument" }, 400);
        run(`DELETE FROM rules WHERE id = ?`, [docId]);
        return c.json({ ok: true });
      }
      case "updateRuleOrder": {
        const r1 = data.rule1;
        const r2 = data.rule2;
        if (!r1?.id || !r2?.id)
          return c.json({ error: "invalid-argument" }, 400);
        run(`UPDATE rules SET "order" = ?, updated_at = ? WHERE id = ?`, [
          r2.order,
          nowIso(),
          r1.id,
        ]);
        run(`UPDATE rules SET "order" = ?, updated_at = ? WHERE id = ?`, [
          r1.order,
          nowIso(),
          r2.id,
        ]);
        return c.json({ ok: true });
      }
      case "updateRule": {
        const docId = String(data.docId || "");
        const text = String(data.text || "");
        const tags = Array.isArray(data.tags)
          ? data.tags.map((t: any) => String(t))
          : [];
        if (!docId) return c.json({ error: "invalid-argument" }, 400);
        run(
          `UPDATE rules SET text = ?, tags = ?, updated_at = ? WHERE id = ?`,
          [text, JSON.stringify(tags), nowIso(), docId]
        );
        return c.json({ ok: true });
      }

      // Bulk update rules (replaces all)
      case "bulkUpdateRules": {
        const rulesText = String(data.rulesText || "");
        
        // Parse the text into lines
        const lines = rulesText
          .split(/\r?\n/)
          .map(l => l.trim())
          .filter(Boolean);

        // Transactional replacement
        const now = nowIso();
        
        try {
            // Using a transaction would be ideal but for this simple setup we'll just run commands sequentially
            // and hope for the best. SQLite in WAL mode is pretty robust.
            
            // 1. Delete all existing rules
            run(`DELETE FROM rules`);
            
            // 2. Insert new rules
            let order = 0;
            const newIds: string[] = [];
            
            for (const line of lines) {
                order++;
                const id = randomId("r");
                
                // Extract tags (format: #tag1 #tag2 at the end or anywhere really, but let's grab all hashtags)
                const tagRegex = /#(\w+)/g;
                const matches = [...line.matchAll(tagRegex)];
                const tags = matches.map(m => m[1]);
                
                // Remove tags from text for cleaner display, or keep them? 
                // Plan said: "parser that looks for tags ... so they can be preserved/added"
                // Let's strip them from the stored text so they don't show up twice in UI if the UI displays tags separately.
                const cleanText = line.replace(tagRegex, '').trim(); 
                
                // If the line was ONLY tags, skip it or treat as empty rule? 
                // If cleanText is empty, use the original line (maybe they just want a rule named "#YOLO")
                const finalText = cleanText || line;

                run(
                  `INSERT INTO rules (id, text, "order", tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
                  [id, finalText, order, JSON.stringify(tags), now, now]
                );
                newIds.push(id);
            }
            
            // 3. Log the action
            const uid = getCookie(c, "uid") || "unknown";
             run(
                `INSERT INTO activity_log (id, action, actor, details, timestamp) VALUES (?, ?, ?, ?, ?)`,
                [randomId("log"), "BULK_UPDATE_RULES", "Schikko", `Updated decrees (set ${lines.length} rules).`, now]
              );
            
            return c.json({ ok: true, count: lines.length });
            
        } catch(e) {
             console.error("Bulk update failed:", e);
             return c.json({ error: "internal", message: "Failed to update rules." }, 500);
        }
      }

      // Drunk stripes
      case "removeLastDrunkStripe": {
        const docId = String(data.docId || "");
        if (!docId) return c.json({ error: "invalid-argument" }, 400);
        const last = get<{ id: number; ts: string }>(
          `SELECT id, ts FROM stripes WHERE person_id = ? AND kind = 'drunk' ORDER BY ts DESC LIMIT 1`,
          [docId]
        );
        if (last?.id) run(`DELETE FROM stripes WHERE id = ?`, [last.id]);
        return c.json({ ok: true });
      }

      // Config
      case "saveCalendarUrl": {
        const url = String(data.url || "");
        if (!url) return c.json({ error: "invalid-argument" }, 400);
        run(
          `INSERT INTO config (key, data, updated_at)
           VALUES ('calendar', ?, ?)
           ON CONFLICT(key) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at`,
          [JSON.stringify({ url }), nowIso()]
        );
        return c.json({ ok: true });
      }
      case "saveStripezDate": {
        const dateString = String(data.dateString || "");
        const durationDays = Math.max(
          1,
          Number(data.durationDays || STRIPEZ_DEFAULT_DURATION_DAYS)
        );
        const d = new Date(dateString);
        if (Number.isNaN(d.getTime()))
          return c.json({ error: "invalid-argument" }, 400);
        run(
          `INSERT INTO config (key, data, updated_at)
           VALUES ('stripez', ?, ?)
           ON CONFLICT(key) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at`,
          [JSON.stringify({ date: d.toISOString(), durationDays }), nowIso()]
        );
        return c.json({ ok: true });
      }

      // Activity log deletion
      case "deleteLog": {
        const ids = Array.isArray(data.docIds) ? data.docIds : [data.docIds];
        const safeIds = ids.filter((s: any) => typeof s === "string" && s);
        if (safeIds.length) {
          const qs = safeIds.map(() => "?").join(", ");
          run(`DELETE FROM activity_log WHERE id IN (${qs})`, safeIds);
        }
        return c.json({ ok: true });
      }

      // Drink requests admin (Schikko only)
      case "listDrinkRequests": {
        const rows = all<{
          id: string;
          person_id: string;
          amount: number;
          status: string;
          requested_by: string;
          created_at: string;
          person_name: string;
        }>(`
          SELECT dr.id, dr.person_id, dr.amount, dr.status, dr.requested_by, dr.created_at, p.name AS person_name
          FROM drink_requests dr
          JOIN people p ON p.id = dr.person_id
          WHERE dr.status = 'pending'
          ORDER BY dr.created_at ASC
        `);
        return c.json({ ok: true, requests: rows });
      }
      case "approveDrinkRequest": {
        const reqId = String(data.requestId || "").trim();
        if (!reqId) return c.json({ error: "invalid-argument" }, 400);

        const req = get<{
          id: string;
          person_id: string;
          amount: number;
          status: string;
        }>(
          `SELECT id, person_id, amount, status FROM drink_requests WHERE id = ?`,
          [reqId]
        );
        if (!req) return c.json({ error: "not-found" }, 404);
        if (req.status !== "pending")
          return c.json(
            {
              error: "failed-precondition",
              message: "Request is not pending.",
            },
            409
          );

        const n =
          get<{ c: number }>(
            `SELECT COUNT(*) as c FROM stripes WHERE person_id = ? AND kind = 'normal'`,
            [req.person_id]
          )?.c || 0;
        const d =
          get<{ c: number }>(
            `SELECT COUNT(*) as c FROM stripes WHERE person_id = ? AND kind = 'drunk'`,
            [req.person_id]
          )?.c || 0;
        const available = Math.max(0, n - d);
        const desired = Math.max(1, Number(req.amount || 0));
        const toApply = Math.min(available, desired);

        for (let i = 0; i < toApply; i++) {
          const ts = new Date(Date.now() + i).toISOString();
          run(
            `INSERT INTO stripes (person_id, ts, kind) VALUES (?, ?, 'drunk')`,
            [req.person_id, ts]
          );
        }
        const uid = getCookie(c, "uid") || "unknown";
        run(
          `UPDATE drink_requests
             SET status = 'approved',
                 processed_at = ?,
                 processed_by = ?,
                 applied = ?
           WHERE id = ?`,
          [nowIso(), uid, toApply > 0 ? 1 : 0, reqId]
        );
        return c.json({ ok: true, applied: toApply });
      }
      case "rejectDrinkRequest": {
        const reqId = String(data.requestId || "").trim();
        if (!reqId) return c.json({ error: "invalid-argument" }, 400);
        const exists = get<{ id: string; status: string }>(
          `SELECT id, status FROM drink_requests WHERE id = ?`,
          [reqId]
        );
        if (!exists) return c.json({ error: "not-found" }, 404);
        if (exists.status !== "pending")
          return c.json(
            {
              error: "failed-precondition",
              message: "Request is not pending.",
            },
            409
          );
        const uid = getCookie(c, "uid") || "unknown";
        run(
          `UPDATE drink_requests
             SET status = 'rejected',
                 processed_at = ?,
                 processed_by = ?,
                 applied = 0
           WHERE id = ?`,
          [nowIso(), uid, reqId]
        );
        return c.json({ ok: true });
      }

      default:
        return c.json(
          { error: "invalid-argument", message: `Unknown action: ${action}` },
          400
        );
    }
  } catch (e) {
    return c.json({ error: "internal" }, 500);
  }
});

// ---- Activity logging endpoint (client writes logs directly) ----
app.post("/api/activity", async (c) => {
  const { action, actor, details } = await c.req.json();
  if (!action || !actor || !details)
    return c.json({ error: "invalid-argument" }, 400);
  const id = randomId("log");
  run(
    `INSERT INTO activity_log (id, action, actor, details, timestamp) VALUES (?, ?, ?, ?, ?)`,
    [id, String(action), String(actor), String(details), nowIso()]
  );
  return c.json({ ok: true, id });
});

// ---- Drink Requests (guest creates requests; Schikko approves/rejects) ----
app.post("/api/drink/request", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const personId = String(body.personId || "").trim();
  const amountRaw = Number(body.amount || 0);
  const amount = Math.max(1, Number.isFinite(amountRaw) ? amountRaw : 0);

  const uid = getCookie(c, "uid");
  if (!uid) return c.json({ error: "unauthenticated" }, 401);
  if (!personId || amount <= 0)
    return c.json({ error: "invalid-argument" }, 400);

  // Person must exist
  const exists = !!get("SELECT 1 FROM people WHERE id = ?", [personId]);
  if (!exists) return c.json({ error: "not-found" }, 404);

  // Throttle per uid
  const allowed = await pushThrottle(
    `drink_request_${uid}`,
    20,
    10 * 60 * 1000
  );
  if (!allowed) return c.json({ error: "resource-exhausted" }, 429);

  const id = randomId("req");
  const autoApprove = !DRINK_REQUIRE_APPROVAL; // If approval not required, auto-approve
  const status = autoApprove ? "approved" : "pending";
  const applied = autoApprove ? amount : 0;

  run(
    `INSERT INTO drink_requests (id, person_id, amount, status, requested_by, created_at, applied)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, personId, amount, status, uid, nowIso(), applied]
  );

  if (autoApprove) {
    for (let i = 0; i < amount; i++) {
        const ts = new Date(Date.now() + i).toISOString();
        run(
          `INSERT INTO stripes (person_id, ts, kind) VALUES (?, ?, 'drunk')`,
          [personId, ts]
        );
    }
  }

  return c.json({ ok: true, id, status, applied });
});

// ---- Static assets ----
const PUBLIC_DIR = path.join(import.meta.dir, "..", "public");
app.get("/favicon.ico", (c) => c.redirect("/assets/favicon.png", 302));
// Ensure correct MIME type for Service Worker (Bun runtime)
app.get("/sw.js", async (c) => {
  const file = Bun.file(path.join(PUBLIC_DIR, "sw.js"));
  return new Response(file, {
    headers: { "Content-Type": "application/javascript; charset=utf-8" },
  });
});
app.get("/manifest.json", async (c) => {
  const name = `${APP_NAME}${APP_YEAR ? " " + APP_YEAR : ""}`;
  const manifest = {
    name,
    short_name: APP_NAME,
    start_url: "/index.html",
    display: "standalone",
    background_color: "#fdf8e9",
    theme_color: "#8c6b52",
    description: "The official ledger for the Rules of Schikko.",
    icons: [
      { src: "/assets/icon-192.png", type: "image/png", sizes: "192x192" },
      { src: "/assets/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    screenshots: [
      {
        src: "/assets/screenshot-desktop.png",
        sizes: "1280x720",
        type: "image/png",
        form_factor: "wide",
        label: "The Ledger of Punishments on Desktop",
      },
      {
        src: "/assets/screenshot-mobile.png",
        sizes: "540x720",
        type: "image/png",
        form_factor: "narrow",
        label: "The Ledger of Punishments on Mobile",
      },
    ],
  };
  return c.json(manifest);
});
// Force correct MIME type for CSS to satisfy X-Content-Type-Options: nosniff
app.get("/style.css", async (c) => {
  const file = Bun.file(path.join(PUBLIC_DIR, "style.css"));
  return new Response(file, {
    headers: { "Content-Type": "text/css; charset=utf-8" },
  });
});
app.get("/assets/*", serveStatic({ root: PUBLIC_DIR }));
app.get("/js/*", serveStatic({ root: PUBLIC_DIR }));
app.get("/randomizer/*", serveStatic({ root: PUBLIC_DIR }));
app.get("/", (c) => c.html(<Index title={APP_NAME} />));

// Fallback SPA route: serve index.html for any non-API path,
// but return 404 for unknown asset-like URLs to avoid MIME-type confusion.
app.notFound((c) => {
  const p = c.req.path;
  if (p.startsWith("/api/")) return c.json({ error: "not-found" }, 404);
  // If the path looks like a file (has an extension) and wasn't matched above, 404 it.
  if (/\.[a-zA-Z0-9]+$/.test(p)) {
    return c.text("Not Found", 404);
  }
  return c.html(<Index title={APP_NAME} />);
  });

// ---- Cron Jobs ----
// Annual Schikko reset: 0 0 1 1 * (Jan 1st 00:00)
cron.schedule(
  "0 0 1 1 *",
  async () => {
    const previousYear = new Date().getFullYear() - 1;
    const key = yearKey(previousYear);
    run(`DELETE FROM config WHERE key = ?`, [key]);
  },
  { timezone: "Europe/Amsterdam" }
);

// Daily activity log cleanup (older than 30 days)
cron.schedule(
  "0 0 * * *",
  async () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    run(`DELETE FROM activity_log WHERE timestamp < ?`, [cutoff.toISOString()]);
  },
  { timezone: "Europe/Amsterdam" }
);

// Auto-unset Schikko after Stripez event ends (+ delay), with optional cleanup
cron.schedule(
  "*/10 * * * *",
  async () => {
    try {
      const confRow =
        get<{ data: string }>("SELECT data FROM config WHERE key='stripez'") ||
        null;
      if (!confRow) return;
      let conf: any = {};
      try {
        conf = JSON.parse(confRow.data || "{}");
      } catch {}
      const dateIso = conf.date;
      if (!dateIso) return;
      const startISO = new Date(String(dateIso));
      if (Number.isNaN(startISO.getTime())) return;
      // Local midnight start
      const startLocal = new Date(
        startISO.getFullYear(),
        startISO.getMonth(),
        startISO.getDate()
      );
      const durDays = Math.max(
        1,
        Number(conf.durationDays || STRIPEZ_DEFAULT_DURATION_DAYS)
      );
      const endLocal = new Date(
        startLocal.getTime() + durDays * 24 * 60 * 60 * 1000
      );
      const deadline = new Date(
        endLocal.getTime() + STRIPEZ_UNSET_DELAY_HOURS * 60 * 60 * 1000
      );
      if (Date.now() < +deadline) return;

      const currentKey = yearKey(new Date().getFullYear());
      const schikkoExists = !!get("SELECT 1 FROM config WHERE key = ?", [
        currentKey,
      ]);
      if (!schikkoExists) return; // already unset or not set at all

      // Unset Schikko for the year
      run(`DELETE FROM config WHERE key = ?`, [currentKey]);

      switch (STRIPEZ_CLEANUP_ACTION) {
        case "NUKE":
          run(`DELETE FROM people`);
          run(`DELETE FROM stripes`);
          run(`DELETE FROM rules`);
          run(`DELETE FROM activity_log`);
          break;
        case "KEEP_DECREES":
          run(`DELETE FROM people`);
          run(`DELETE FROM stripes`);
          break;
        case "KEEP_LEDGER":
          run(`DELETE FROM rules`);
          break;
        case "REMOVE_STRIPES_ONLY":
          run(`DELETE FROM stripes`);
          break;
        case "NOTHING":
        default:
          // do nothing
          break;
      }
      console.log(
        "[Stripez] Auto-unset Schikko and applied cleanup:",
        STRIPEZ_CLEANUP_ACTION
      );
    } catch (e) {
      console.error("[Stripez] Auto-unset job failed:", e);
    }
  },
  { timezone: "Europe/Amsterdam" }
);

// ---- Bootstrap & Serve ----
migrate();

Bun.serve({
  port: PORT,
  fetch: app.fetch,
});

console.log(`[Stripez] Listening on http://localhost:${PORT}`);
