import { get, run, nowIso } from "../db";

export async function pushThrottle(
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
