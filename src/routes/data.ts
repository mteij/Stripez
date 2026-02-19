import { Hono } from "hono";
import { all, get, randomId, run, nowIso } from "../db";
import { jsonDate, getCookie } from "../utils/helpers";
import { pushThrottle } from "../utils/throttle";
import { DRINK_REQUIRE_APPROVAL } from "../config";

const app = new Hono();

app.get("/punishments", async (c) => {
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

export default app;
