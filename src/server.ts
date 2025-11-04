// @ts-nocheck
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
import { Resend } from "resend";

// ---- ENV ----
const PORT = Number(process.env.PORT || 8080);
const CORS_ORIGINS = (process.env.CORS_ORIGINS ||
  "*")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-session-secret-change-me";
const GEMINI_KEY = process.env.GEMINI_KEY || "";
const ORACLE_MODEL = process.env.ORACLE_MODEL || "gemini-2.5-flash";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const MAIL_FROM = process.env.MAIL_FROM || "";

// Branding
const APP_NAME = process.env.APP_NAME || "Stripez";
const APP_YEAR = Number(process.env.APP_YEAR || new Date().getFullYear());

// ---- APP ----
const app = new Hono();

// CORS
app.use(
  "/api/*",
  cors({
    origin: (origin) => (!origin ? "*" : CORS_ORIGINS.includes(origin) ? origin : CORS_ORIGINS[0]),
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
    if (part.startsWith(`${name}=`)) return decodeURIComponent(part.substring(name.length + 1));
  }
  return undefined;
}

function setCookie(c: any, name: string, value: string, days = 365) {
  const expires = new Date(Date.now() + days * 86400000).toUTCString();
  const secure = c.req.url.startsWith("https:") ? " Secure;" : "";
  c.header("Set-Cookie", `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires};${secure}`);
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

function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password: string, salt: string, hash: string) {
  const computed = crypto.scryptSync(password, salt, 64).toString("hex");
  return timingSafeEq(computed, hash);
}

async function pushThrottle(key: string, limit: number, windowMs: number): Promise<boolean> {
  const cutoff = Date.now() - windowMs;
  let attemptsJson = get<{ attempts: string }>("SELECT attempts FROM throttles WHERE key = ?", [key])?.attempts;
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
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

async function sendPasswordEmail(to: string, firstName: string, password: string) {
  if (!resend) throw new Error("email-not-configured");
  const subject = `${APP_NAME}${APP_YEAR ? " " + APP_YEAR : ""}: Your Schikko password`;
  const displayName = firstName ? `${firstName}` : "Schikko";
  const text = `Hail ${displayName},

Your Schikko password is: ${password}

Keep it safe. This password grants access to administrative actions.

— ${APP_NAME}${APP_YEAR ? " " + APP_YEAR : ""}`;
  await resend.emails.send({
    from: MAIL_FROM || "no-reply@example.com",
    to: [to],
    subject,
    text,
  });
}

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
  const y = new Date().getFullYear();
  const key = yearKey(y);
  const row = get<{ data: string }>("SELECT data FROM config WHERE key = ?", [key]) || null;
  return c.json({ isSet: !!row });
});

app.get("/api/schikko/info", async (c) => {
  const y = new Date().getFullYear();
  const key = yearKey(y);
  const row = get<{ data: string }>("SELECT data FROM config WHERE key = ?", [key]) || null;
  if (!row) return c.json({ email: null, expires: null });
  let data: any = {};
  try {
    data = JSON.parse(row.data || "{}");
  } catch {}
  const expiry = new Date(y, 11, 31, 23, 59, 59);
  return c.json({ email: data.email || null, expires: expiry.toISOString() });
});

// ---- Schikko: Set & Login ----
app.post("/api/schikko/set", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const firstName = String(body.firstName || "").trim();
  const lastName = String(body.lastName || "").trim();
  const email = String(body.email || "").trim().toLowerCase();

  if (!firstName || !lastName || !email) return c.json({ error: "invalid-argument" }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ error: "invalid-argument" }, 400);

  if (!RESEND_API_KEY || !MAIL_FROM) return c.json({ error: "email-not-configured" }, 500);

  const y = new Date().getFullYear();
  const key = yearKey(y);
  const exists = !!get("SELECT 1 FROM config WHERE key = ?", [key]);
  if (exists) return c.json({ error: "already-exists", message: `A Schikko is already set for ${y}.` }, 409);

  const password = crypto.randomBytes(12).toString("hex");
  const { salt, hash } = hashPassword(password);

  try {
    run(
      `INSERT INTO config (key, data, updated_at) VALUES (?, ?, ?)`,
      [key, JSON.stringify({ firstName, lastName, email, passwordHash: hash, passwordSalt: salt }), nowIso()]
    );

    await sendPasswordEmail(email, firstName, password);

    return c.json({ success: true });
  } catch (e) {
    // rollback on failure to send
    try { run(`DELETE FROM config WHERE key = ?`, [key]); } catch (_) {}
    return c.json({ error: "internal" }, 500);
  }
});

app.post("/api/schikko/login", async (c) => {
  const { password } = await c.req.json();
  if (!password || typeof password !== "string") return c.json({ error: "invalid-argument" }, 400);

  // Throttle global login attempts
  const allowed = await pushThrottle("login_throttle", 20, 10 * 60 * 1000);
  if (!allowed) return c.json({ error: "resource-exhausted" }, 429);

  const uid = getCookie(c, "uid");
  if (!uid) return c.json({ error: "unauthenticated" }, 401);

  const y = new Date().getFullYear();
  const key = yearKey(y);
  const row = get<{ data: string }>("SELECT data FROM config WHERE key = ?", [key]) || null;
  if (!row) return c.json({ error: "not-found", message: `No Schikko set for ${y}.` }, 404);

  let data: any = {};
  try {
    data = JSON.parse(row.data || "{}");
  } catch {}

  let ok = false;
  if (data.passwordHash && data.passwordSalt) {
    ok = verifyPassword(password, data.passwordSalt, data.passwordHash);
  } else if (typeof data.password === "string") {
    ok = data.password === password;
    if (ok) {
      const { salt, hash } = hashPassword(password);
      run(`UPDATE config SET data = ?, updated_at = ? WHERE key = ?`, [
        JSON.stringify({ ...data, passwordHash: hash, passwordSalt: salt, password: undefined }),
        nowIso(),
        key,
      ]);
    }
  }

  if (!ok) return c.json({ success: false });

  const sessionId = randomId("s");
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
  run(`INSERT INTO sessions (id, uid, created_at, expires_at) VALUES (?, ?, ?, ?)`, [
    sessionId,
    uid,
    nowIso(),
    expiresAt.toISOString(),
  ]);
  return c.json({ success: true, sessionId, expiresAtMs: +expiresAt });
});

 // ---- Config (calendar/stripez) ----
app.get("/api/config/calendar", async (c) => {
  const row = get<{ data: string }>("SELECT data FROM config WHERE key='calendar'") || null;
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
  if (!url || typeof url !== "string") return c.json({ error: "invalid-argument" }, 400);
  run(
    `INSERT INTO config (key, data, updated_at)
     VALUES ('calendar', ?, ?)
     ON CONFLICT(key) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at`,
    [JSON.stringify({ url }), nowIso()]
  );
  return c.json({ ok: true });
});

app.get("/api/config/stripez", async (c) => {
  const row = get<{ data: string }>("SELECT data FROM config WHERE key='stripez'") || null;
  if (!row) return c.json({ date: null });
  try {
    const data = JSON.parse(row.data || "{}");
    return c.json({ date: data.date || null });
  } catch {
    return c.json({ date: null });
  }
});

app.post("/api/config/stripez", async (c) => {
  const { dateString } = await c.req.json();
  const d = new Date(String(dateString || ""));
  if (Number.isNaN(d.getTime())) return c.json({ error: "invalid-argument" }, 400);
  run(
    `INSERT INTO config (key, data, updated_at)
     VALUES ('stripez', ?, ?)
     ON CONFLICT(key) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at`,
    [JSON.stringify({ date: d.toISOString() }), nowIso()]
  );
  return c.json({ ok: true });
});

// ---- App config (branding + oracle availability) ----
app.get("/api/config/app", async (c) => {
  return c.json({
    name: APP_NAME,
    year: APP_YEAR,
    hasOracle: Boolean(GEMINI_KEY),
  });
});

// ---- Data: Punishments / Rules / Activity (reads) ----
app.get("/api/punishments", async (c) => {
  const people = all<{ id: string; name: string; role: string | null }>(
    `SELECT id, name, role FROM people ORDER BY LOWER(name) ASC`
  );
  const stripes = all<{ person_id: string; ts: string; kind: "normal" | "drunk" }>(
    `SELECT person_id, ts, kind FROM stripes`
  );

  const byId: Record<string, any> = {};
  for (const p of people) {
    byId[p.id] = { id: p.id, name: p.name, role: p.role ?? undefined, stripes: [] as string[], drunkStripes: [] as string[] };
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
  const rows = all<{ id: string; text: string; order: number; tags: string; created_at: string; updated_at: string }>(
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
  const sinceDays = Number(new URL(c.req.url).searchParams.get("sinceDays") || 30);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (Number.isFinite(sinceDays) ? sinceDays : 30));
  const rows = all<{ id: string; action: string; actor: string; details: string; timestamp: string }>(
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
  if (lower === "localhost" || lower === "127.0.0.1" || lower === "::1") return true;
  if (lower.endsWith(".internal") || lower === "metadata.google.internal") return true;

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
  if (!url || typeof url !== "string") return c.json({ error: { status: "INVALID_ARGUMENT", message: "Missing 'url'." } }, 400);

  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return c.json({ error: { status: "INVALID_ARGUMENT", message: "Invalid URL." } }, 400);
  }
  if (!["http:", "https:"].includes(u.protocol)) {
    return c.json({ error: { status: "INVALID_ARGUMENT", message: "Only http(s) URLs are allowed." } }, 400);
  }
  if (isPrivateOrDisallowedHost(u.hostname)) {
    return c.json({ error: { status: "INVALID_ARGUMENT", message: "Target host is not allowed." } }, 400);
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
    const ct = String(resp.headers?.["content-type"] || resp.headers?.["Content-Type"] || "").toLowerCase();
    if (ct && !(ct.startsWith("text/calendar") || ct.startsWith("text/plain") || ct.startsWith("text/"))) {
      return c.json({ error: { status: "INVALID_ARGUMENT", message: "Unsupported content type from target host." } }, 400);
    }
    return c.json({ icalData: resp.data });
  } catch (e) {
    return c.json({ error: { status: "INTERNAL", message: "Could not fetch calendar data." } }, 500);
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
    result = await model.generateContent(fullPrompt);
  } catch (primaryError: any) {
    if (modelName !== "gemini-1.5-flash-latest") {
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
    const fenced = judgementText.match(/```json[\s\S]*?```/i) || judgementText.match(/```[\s\S]*?```/);
    const jsonString = (fenced ? fenced[0].replace(/```json/i, '').replace(/```/g, '').trim() : judgementText);
    parsed = JSON.parse(jsonString);
  } catch (e) {
    return c.json({ error: { status: "INVALID_ARGUMENT", message: "Oracle returned non-JSON judgement", judgement: judgementText } }, 400);
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
  if (Array.isArray(ledgerNames) && parsed.person && String(parsed.person).toLowerCase() !== "someone") {
    let closest = parsed.person;
    let min = -1;
    for (const name of ledgerNames) {
      const d = lev(String(parsed.person).toLowerCase(), String(name).toLowerCase());
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
  const row = get<{ id: string; uid: string; expires_at: string }>("SELECT id, uid, expires_at FROM sessions WHERE id = ?", [
    sessionId,
  ]);
  if (!row || row.uid !== uid || new Date(row.expires_at).getTime() <= Date.now())
    return { ok: false, code: 403, error: "permission-denied" };
  return { ok: true };
}

app.post("/api/schikko/action", async (c) => {
  const body = await c.req.json();
  const { action, sessionId, ...data } = body || {};
  if (typeof action !== "string" || !action) return c.json({ error: "invalid-argument" }, 400);

  const session = await requireValidSession(c, String(sessionId || ""));
  if (!session.ok) return c.json({ error: session.error }, session.code);

  // Rate limit per-uid
  const uid = getCookie(c, "uid")!;
  const allowed = await pushThrottle(`schikko_action_throttle_${uid}`, 60, 60 * 1000);
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
          run(`INSERT INTO stripes (person_id, ts, kind) VALUES (?, ?, 'normal')`, [docId, ts]);
        }
        return c.json({ ok: true });
      }
      case "addDrunkStripe": {
        const docId = String(data.docId || "");
        const count = Math.max(1, Number(data.count || 1));
        if (!docId) return c.json({ error: "invalid-argument" }, 400);
        for (let i = 0; i < count; i++) {
          const ts = new Date(Date.now() + i).toISOString();
          run(`INSERT INTO stripes (person_id, ts, kind) VALUES (?, ?, 'drunk')`, [docId, ts]);
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
        const n = get<{ c: number }>(`SELECT COUNT(*) as c FROM stripes WHERE person_id = ? AND kind = 'normal'`, [docId])?.c || 0;
        const d = get<{ c: number }>(`SELECT COUNT(*) as c FROM stripes WHERE person_id = ? AND kind = 'drunk'`, [docId])?.c || 0;
        if (d > n) {
          const toRemove = d - n;
          const rows = all<{ id: number }>(
            `SELECT id FROM stripes WHERE person_id = ? AND kind = 'drunk' ORDER BY ts DESC LIMIT ?`,
            [docId, toRemove]
          );
          if (rows.length) {
            const qs = rows.map(() => "?").join(", ");
            run(`DELETE FROM stripes WHERE id IN (${qs})`, rows.map((r) => r.id));
          }
        }
        return c.json({ ok: true });
      }
      case "renamePerson": {
        const docId = String(data.docId || "");
        const newName = String(data.newName || "").trim();
        if (!docId || !newName) return c.json({ error: "invalid-argument" }, 400);
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
        const role = typeof data.role === "string" ? String(data.role || "").trim() : "";
        const allowedRoles = ["Schikko", APP_NAME, "Board", "Activist"];
        let value: string | null = null;
        if (role) {
          const match = allowedRoles.find((r) => r.toLowerCase() === role.toLowerCase());
          if (!match) return c.json({ error: "invalid-argument", message: "Invalid role" }, 400);
          value = match;
        }
        run(`UPDATE people SET role = ? WHERE id = ?`, [value, docId]);
        return c.json({ ok: true });
      }

      // Rules
      case "addRule": {
        const text = String(data.text || "").trim();
        const order = Number(data.order);
        if (!text || !Number.isFinite(order)) return c.json({ error: "invalid-argument" }, 400);
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
        if (!r1?.id || !r2?.id) return c.json({ error: "invalid-argument" }, 400);
        run(`UPDATE rules SET "order" = ?, updated_at = ? WHERE id = ?`, [r2.order, nowIso(), r1.id]);
        run(`UPDATE rules SET "order" = ?, updated_at = ? WHERE id = ?`, [r1.order, nowIso(), r2.id]);
        return c.json({ ok: true });
      }
      case "updateRule": {
        const docId = String(data.docId || "");
        const text = String(data.text || "");
        const tags = Array.isArray(data.tags) ? data.tags.map((t: any) => String(t)) : [];
        if (!docId) return c.json({ error: "invalid-argument" }, 400);
        run(`UPDATE rules SET text = ?, tags = ?, updated_at = ? WHERE id = ?`, [text, JSON.stringify(tags), nowIso(), docId]);
        return c.json({ ok: true });
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
        const d = new Date(dateString);
        if (Number.isNaN(d.getTime())) return c.json({ error: "invalid-argument" }, 400);
        run(
          `INSERT INTO config (key, data, updated_at)
           VALUES ('stripez', ?, ?)
           ON CONFLICT(key) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at`,
          [JSON.stringify({ date: d.toISOString() }), nowIso()]
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

      default:
        return c.json({ error: "invalid-argument", message: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    return c.json({ error: "internal" }, 500);
  }
});

// ---- Activity logging endpoint (client writes logs directly) ----
app.post("/api/activity", async (c) => {
  const { action, actor, details } = await c.req.json();
  if (!action || !actor || !details) return c.json({ error: "invalid-argument" }, 400);
  const id = randomId("log");
  run(
    `INSERT INTO activity_log (id, action, actor, details, timestamp) VALUES (?, ?, ?, ?, ?)`,
    [id, String(action), String(actor), String(details), nowIso()]
  );
  return c.json({ ok: true, id });
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
      { src: "/assets/icon-512.png", type: "image/png", sizes: "512x512" }
    ],
    screenshots: [
      {
        src: "/assets/screenshot-desktop.png",
        sizes: "1280x720",
        type: "image/png",
        form_factor: "wide",
        label: "The Ledger of Punishments on Desktop"
      },
      {
        src: "/assets/screenshot-mobile.png",
        sizes: "540x720",
        type: "image/png",
        form_factor: "narrow",
        label: "The Ledger of Punishments on Mobile"
      }
    ]
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
app.get("/", serveStatic({ path: path.join(PUBLIC_DIR, "index.html") }));

// Fallback SPA route: serve index.html for any non-API path,
// but return 404 for unknown asset-like URLs to avoid MIME-type confusion.
app.notFound((c) => {
  const p = c.req.path;
  if (p.startsWith("/api/")) return c.json({ error: "not-found" }, 404);
  // If the path looks like a file (has an extension) and wasn't matched above, 404 it.
  if (/\.[a-zA-Z0-9]+$/.test(p)) {
    return c.text("Not Found", 404);
  }
  const file = Bun.file(path.join(PUBLIC_DIR, "index.html"));
  return new Response(file, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
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

// ---- Bootstrap & Serve ----
migrate();

Bun.serve({
  port: PORT,
  fetch: app.fetch,
});

console.log(`[Stripez] Listening on http://localhost:${PORT}`);