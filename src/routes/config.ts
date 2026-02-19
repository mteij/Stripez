import { Hono } from "hono";
import { get, run, nowIso } from "../db";
import { APP_NAME, APP_YEAR, DRINK_REQUIRE_APPROVAL, OPENAI_API_KEY, STRIPEZ_DEFAULT_DURATION_DAYS } from "../config";

const app = new Hono();

app.get("/calendar", async (c) => {
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

app.post("/calendar", async (c) => {
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

app.get("/stripez", async (c) => {
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

app.post("/stripez", async (c) => {
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

app.get("/app", async (c) => {
  return c.json({
    name: APP_NAME,
    year: APP_YEAR,
    hasOracle: Boolean(OPENAI_API_KEY),
    requireApprovalForDrinks: Boolean(DRINK_REQUIRE_APPROVAL),
  });
});

export default app;
