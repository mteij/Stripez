import { Hono } from "hono";
import { all, get, randomId, run, nowIso } from "../db";
import { jsonDate, getCookie } from "../utils/helpers";
import { pushThrottle } from "../utils/throttle";
import { DRINK_REQUIRE_APPROVAL, STRIPEZ_DEFAULT_DURATION_DAYS } from "../config";

const app = new Hono();

function getStripezEventWindow() {
  const row =
    get<{ data: string }>("SELECT data FROM config WHERE key = 'stripez'") ||
    null;
  if (!row) return { ok: false as const, reason: "not-scheduled" as const };

  try {
    const data = JSON.parse(row.data || "{}");
    const startISO = new Date(String(data.date || ""));
    if (Number.isNaN(startISO.getTime())) {
      return { ok: false as const, reason: "not-scheduled" as const };
    }

    const start = new Date(
      startISO.getFullYear(),
      startISO.getMonth(),
      startISO.getDate()
    );
    const durationDays = Math.max(
      1,
      Number(data.durationDays || STRIPEZ_DEFAULT_DURATION_DAYS)
    );
    const end = new Date(start.getTime() + durationDays * 24 * 60 * 60 * 1000);

    return { ok: true as const, start, end };
  } catch {
    return { ok: false as const, reason: "not-scheduled" as const };
  }
}

app.get("/punishments", async (c) => {
  const people = all<{ id: string; name: string; role: string | null; consecutive_breaks: number; last_rule_broken: string | null }>(
    `SELECT id, name, role, consecutive_breaks, last_rule_broken FROM people ORDER BY LOWER(name) ASC`
  );
  const stripes = all<{
    person_id: string;
    ts: string;
    kind: "normal" | "drunk";
  }>(`SELECT person_id, ts, kind FROM stripes`);
  const pending = all<{
    person_id: string;
    amount: number;
  }>(
    `SELECT person_id, COALESCE(SUM(amount), 0) as amount
     FROM drink_requests
     WHERE status = 'pending'
     GROUP BY person_id`
  );

  const byId: Record<string, any> = {};
  for (const p of people) {
    byId[p.id] = {
      id: p.id,
      name: p.name,
      role: p.role ?? undefined,
      stripes: [] as string[],
      drunkStripes: [] as string[],
      pendingDrinks: 0,
      consecutiveBreaks: p.consecutive_breaks || 0,
      lastRuleBroken: p.last_rule_broken || null,
    };
  }
  for (const s of stripes) {
    const rec = byId[s.person_id];
    if (!rec) continue;
    if (s.kind === "normal") rec.stripes.push(jsonDate(s.ts));
    else rec.drunkStripes.push(jsonDate(s.ts));
  }
  for (const row of pending) {
    const rec = byId[row.person_id];
    if (!rec) continue;
    rec.pendingDrinks = Math.max(0, Number(row.amount || 0));
  }

  const list = Object.values(byId);
  for (const p of list) {
    p.stripes = p.stripes.sort();
    p.drunkStripes = p.drunkStripes.sort();
  }
  return c.json(list);
});

app.get("/drink/mine", async (c) => {
  const uid = getCookie(c, "uid");
  if (!uid) return c.json({ error: "unauthenticated" }, 401);

  const rows = all<{
    id: string;
    person_id: string;
    amount: number;
    status: string;
    applied: number;
    created_at: string;
    processed_at: string | null;
    person_name: string;
  }>(
    `SELECT dr.id, dr.person_id, dr.amount, dr.status, dr.applied, dr.created_at, dr.processed_at, p.name AS person_name
     FROM drink_requests dr
     JOIN people p ON p.id = dr.person_id
     WHERE dr.requested_by = ?
     ORDER BY dr.created_at DESC
     LIMIT 12`,
    [uid]
  );

  return c.json({ ok: true, requests: rows });
});

app.get("/rules", async (c) => {
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

app.get("/activity", async (c) => {
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

app.post("/activity", async (c) => {
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

app.post("/drink/request", async (c) => {
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

  const eventWindow = getStripezEventWindow();
  if (!eventWindow.ok) {
    return c.json(
      {
        error: "failed-precondition",
        message:
          "The date for the next event has not been decreed. Drinks cannot be recorded yet.",
      },
      409
    );
  }

  const nowMs = Date.now();
  if (nowMs < eventWindow.start.getTime()) {
    return c.json(
      {
        error: "failed-precondition",
        message: "Drinks can only be recorded once the event has begun.",
      },
      409
    );
  }
  if (nowMs >= eventWindow.end.getTime()) {
    return c.json(
      {
        error: "failed-precondition",
        message: "This event has already ended. Drinks can no longer be recorded.",
      },
      409
    );
  }

  // Throttle per uid
  const allowed = await pushThrottle(
    `drink_request_${uid}`,
    20,
    10 * 60 * 1000
  );
  if (!allowed) return c.json({ error: "resource-exhausted" }, 429);

  const normalCount =
    get<{ c: number }>(
      `SELECT COUNT(*) as c FROM stripes WHERE person_id = ? AND kind = 'normal'`,
      [personId]
    )?.c || 0;
  const drunkCount =
    get<{ c: number }>(
      `SELECT COUNT(*) as c FROM stripes WHERE person_id = ? AND kind = 'drunk'`,
      [personId]
    )?.c || 0;
  const pendingCount =
    get<{ c: number }>(
      `SELECT COALESCE(SUM(amount), 0) as c
       FROM drink_requests
       WHERE person_id = ? AND status = 'pending'`,
      [personId]
    )?.c || 0;

  const availableToRequest = Math.max(0, normalCount - drunkCount - pendingCount);
  const autoApprove = !DRINK_REQUIRE_APPROVAL; // If approval not required, auto-approve
  const id = randomId("req");
  let status = autoApprove ? "approved" : "pending";
  let applied = 0;

  if (autoApprove) {
    applied = Math.min(amount, availableToRequest);
  } else if (amount > availableToRequest) {
    return c.json(
      {
        error: "failed-precondition",
        message:
          availableToRequest > 0
            ? `Only ${availableToRequest} stripe(s) are currently available to request.`
            : "No stripes are currently available to request.",
      },
      409
    );
  }

  run(
    `INSERT INTO drink_requests (id, person_id, amount, status, requested_by, created_at, applied)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, personId, amount, status, uid, nowIso(), applied]
  );

  if (autoApprove) {
    for (let i = 0; i < applied; i++) {
        const ts = new Date(Date.now() + i).toISOString();
        run(
          `INSERT INTO stripes (person_id, ts, kind) VALUES (?, ?, 'drunk')`,
          [personId, ts]
        );
    }
  }

  return c.json({ ok: true, id, status, applied });
});

export default app;
