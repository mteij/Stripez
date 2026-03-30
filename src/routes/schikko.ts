import { Hono } from "hono";
import { all, get, randomId, run, nowIso } from "../db";
import { getCookie, yearKey, timingSafeStrEq } from "../utils/helpers";
import { pushThrottle } from "../utils/throttle";
import { APP_NAME, APP_YEAR, ADMIN_KEY, FIREBASE_PROJECT_ID, ALLOWED_GOOGLE_EMAILS, STRIPEZ_DEFAULT_DURATION_DAYS, STRIPEZ_UNSET_DELAY_HOURS } from "../config";
import { verifyFirebaseToken } from "../utils/firebase-verify";

const app = new Hono();

function readSchikkoData(key: string) {
  const row = get<{ data: string }>("SELECT data FROM config WHERE key = ?", [key]);
  if (!row) return null;
  try {
    return JSON.parse(row.data || "{}");
  } catch {
    return null;
  }
}

function createSchikkoSession(uid: string) {
  const sessionId = randomId("s");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  run(
    `INSERT INTO sessions (id, uid, created_at, expires_at) VALUES (?, ?, ?, ?)`,
    [sessionId, uid, nowIso(), expiresAt.toISOString()]
  );
  return { sessionId, expiresAtMs: +expiresAt };
}

type SessionCheckResult =
  | { ok: true }
  | { ok: false; code: 401 | 403; error: "unauthenticated" | "permission-denied" };

app.get("/status", async (c) => {
  const key = yearKey(APP_YEAR);
  const row = get<{ data: string }>("SELECT data FROM config WHERE key = ?", [key]);
  if (!row) return c.json({ isSet: false });
  try {
    const data = JSON.parse(row.data || "{}");
    return c.json({ isSet: Boolean(data.verified) });
  } catch {
    return c.json({ isSet: false });
  }
});

app.get("/info", async (c) => {
  const y = APP_YEAR;
  const key = yearKey(y);
  const row =
    get<{ data: string }>("SELECT data FROM config WHERE key = ?", [key]) ||
    null;
  if (!row) return c.json({ name: null, expires: null });
  let data: any = {};
  try {
    data = JSON.parse(row.data || "{}");
  } catch {}

  let expiry = new Date(y, 11, 31, 23, 59, 59); // Default: Dec 31st 23:59:59

  const stripeConfRow =
    get<{ data: string }>("SELECT data FROM config WHERE key='stripez'") ||
    null;
  if (stripeConfRow) {
    try {
      const sData = JSON.parse(stripeConfRow.data || "{}");
      if (sData.date) {
        const startISO = new Date(String(sData.date));
        if (!Number.isNaN(startISO.getTime())) {
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
          const deadline = new Date(
            endLocal.getTime() + STRIPEZ_UNSET_DELAY_HOURS * 60 * 60 * 1000
          );
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

app.post("/set", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const firstName = String(body.firstName || "").trim();
  const lastName = String(body.lastName || "").trim();
  const idToken = typeof body.idToken === "string" ? String(body.idToken) : "";

  if (!firstName || !lastName)
    return c.json({ error: "invalid-argument" }, 400);

  const uid = getCookie(c, "uid");
  if (!uid) return c.json({ error: "unauthenticated" }, 401);

  const y = APP_YEAR;
  const key = yearKey(y);
  const existingDataRaw = readSchikkoData(key);
  const existingData = existingDataRaw || {};
  const alreadySet = Boolean(existingDataRaw?.verified);

  const claims =
    idToken && FIREBASE_PROJECT_ID ? await verifyFirebaseToken(idToken) : null;
  const googleIdentity =
    claims && claims.emailVerified
      ? { email: claims.email, uid: claims.uid }
      : null;

  // If a Schikko is already set this year, require an active session to override
  if (alreadySet) {
    const session = await requireValidSession(c, String(body.sessionId || ""));
    if (!session.ok) return c.json({ error: session.error }, session.code);
  } else if (!googleIdentity) {
    return c.json(
      {
        error: "google-auth-required",
        message:
          "Claiming Schikko requires signing in with the Google account of the person taking the role.",
      },
      400
    );
  }

  const googleEmail = (
    googleIdentity?.email ||
    String(existingData.googleEmail || "")
  )
    .trim()
    .toLowerCase();
  const googleUid = String(googleIdentity?.uid || existingData.googleUid || "").trim();
  const updatedAt = nowIso();
  const payload = {
    firstName,
    lastName,
    googleEmail,
    googleUid,
    verified: true,
    claimedAt: updatedAt,
  };

  if (!alreadySet) {
    run(
      `INSERT OR IGNORE INTO config (key, data, updated_at)
       VALUES (?, ?, ?)`,
      [key, JSON.stringify(payload), updatedAt]
    );

    const saved = readSchikkoData(key);
    if (!saved) return c.json({ error: "internal" }, 500);
    if (saved.googleUid !== googleUid) {
      return c.json(
        {
          error: "already-claimed",
          message:
            "Someone else claimed Schikko first. Refresh to see the current Schikko.",
        },
        409
      );
    }
  } else {
    run(
      `INSERT INTO config (key, data, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at`,
      [key, JSON.stringify(payload), updatedAt]
    );
  }

  const session = createSchikkoSession(uid);
  return c.json({
    success: true,
    claimedBy: googleEmail || null,
    ...session,
  });
});

app.post("/login", async (c) => {
  const body = await c.req.json().catch(() => ({}));

  const allowed = await pushThrottle("login_throttle", 20, 10 * 60 * 1000);
  if (!allowed) return c.json({ error: "resource-exhausted" }, 429);

  const uid = getCookie(c, "uid");
  if (!uid) return c.json({ error: "unauthenticated" }, 401);

  let ok = false;
  let error = "invalid-credentials";
  let message: string | undefined;

  // Option 1: admin key
  if (!ok && body.code) {
    const code = String(body.code).trim();
    if (ADMIN_KEY && timingSafeStrEq(code, ADMIN_KEY)) ok = true;
  }

  // Option 2: Firebase Google idToken
  if (!ok && body.idToken) {
    if (!FIREBASE_PROJECT_ID) {
      error = "google-auth-not-configured";
      message = "Google login is not configured on the server.";
    } else {
      const claims = await verifyFirebaseToken(String(body.idToken));
      if (!claims) {
        error = "google-token-invalid";
        message = "Google sign-in could not be verified.";
      } else if (!claims.emailVerified) {
        error = "google-email-not-verified";
        message = "The selected Google account does not have a verified email address.";
      } else {
        // Check env-level allowlist first
        if (
          ALLOWED_GOOGLE_EMAILS.length > 0 &&
          ALLOWED_GOOGLE_EMAILS.includes(claims.email)
        ) {
          ok = true;
        }
        // Then check the currently stored Schikko identity
        if (!ok) {
          const key = yearKey(APP_YEAR);
          const data = readSchikkoData(key);
          if (data?.verified) {
            const savedUid = String(data.googleUid || "").trim();
            const savedEmail = String(data.googleEmail || "")
              .trim()
              .toLowerCase();
            if (savedUid && savedUid === claims.uid) ok = true;
            if (!ok && savedEmail && savedEmail === claims.email) ok = true;

            if (!ok && (savedUid || savedEmail)) {
              error = "google-account-mismatch";
              message =
                "This Google account does not match the account currently linked to Schikko.";
            } else if (!ok) {
              error = "google-account-not-linked";
              message =
                "The current Schikko does not have a linked Google account yet.";
            }
          }
        }
      }
    }
  }

  if (!ok) return c.json({ success: false, error, message }, 401);

  return c.json({ success: true, ...createSchikkoSession(uid) });
});

async function requireValidSession(c: any, sessionId: string): Promise<SessionCheckResult> {
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

app.post("/action", async (c) => {
  const body = await c.req.json();
  const { action, sessionId, ...data } = body || {};
  if (typeof action !== "string" || !action)
    return c.json({ error: "invalid-argument" }, 400);

  const session = await requireValidSession(c, String(sessionId || ""));
  if (!session.ok) return c.json({ error: session.error }, session.code);

  const uid = getCookie(c, "uid")!;
  const allowed = await pushThrottle(
    `schikko_action_throttle_${uid}`,
    60,
    60 * 1000
  );
  if (!allowed) return c.json({ error: "resource-exhausted" }, 429);

  try {
    switch (action) {
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

      case "bulkUpdateRules": {
        const rulesText = String(data.rulesText || "");
        const lines = rulesText
          .split(/\r?\n/)
          .map(l => l.trim())
          .filter(Boolean);

        const now = nowIso();
        
        try {
            run(`DELETE FROM rules`);
            
            let order = 0;
            const newIds: string[] = [];
            
            for (const line of lines) {
                order++;
                const id = randomId("r");
                
                const tagRegex = /#(\w+)/g;
                const matches = [...line.matchAll(tagRegex)];
                const tags = matches.map(m => m[1]);
                
                const cleanText = line.replace(tagRegex, '').trim(); 
                const finalText = cleanText || line;

                run(
                  `INSERT INTO rules (id, text, "order", tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
                  [id, finalText, order, JSON.stringify(tags), now, now]
                );
                newIds.push(id);
            }
            
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

      case "removeLastDrunkStripe": {
        const docId = String(data.docId || "");
        const count = Math.max(1, Number(data.count || 1));
        if (!docId) return c.json({ error: "invalid-argument" }, 400);
        const rows = all<{ id: number }>(
          `SELECT id
             FROM stripes
            WHERE person_id = ? AND kind = 'drunk'
            ORDER BY ts DESC
            LIMIT ?`,
          [docId, count]
        );
        if (rows.length) {
          const qs = rows.map(() => "?").join(", ");
          run(
            `DELETE FROM stripes WHERE id IN (${qs})`,
            rows.map((row) => row.id)
          );
        }
        return c.json({ ok: true, removed: rows.length });
      }

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

      case "unsetSchikko": {
        const key = yearKey(APP_YEAR);
        const existing = readSchikkoData(key);
        if (!existing) return c.json({ ok: true, alreadyUnset: true });

        run(
          `INSERT INTO activity_log (id, action, actor, details, timestamp) VALUES (?, ?, ?, ?, ?)`,
          [
            randomId("log"),
            "UNSET_SCHIKKO",
            "Schikko",
            "Unset the current Schikko and ended all Schikko sessions.",
            nowIso(),
          ]
        );

        run(`DELETE FROM config WHERE key = ?`, [key]);
        run(`DELETE FROM sessions`);
        return c.json({ ok: true });
      }

      case "deleteLog": {
        const ids = Array.isArray(data.docIds) ? data.docIds : [data.docIds];
        const safeIds = ids.filter((s: any) => typeof s === "string" && s);
        if (safeIds.length) {
          const qs = safeIds.map(() => "?").join(", ");
          run(`DELETE FROM activity_log WHERE id IN (${qs})`, safeIds);
        }
        return c.json({ ok: true });
      }

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
          [nowIso(), uid, toApply, reqId]
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

      case "updateConsecutiveBreaks": {
        const docId = String(data.docId || "");
        const count = Math.max(0, Number(data.count || 0));
        const ruleText = typeof data.ruleText === "string" ? String(data.ruleText || "").trim() : "";
        if (!docId) return c.json({ error: "invalid-argument" }, 400);
        
        const ts = nowIso();
        run(
          `UPDATE people SET consecutive_breaks = ?, last_rule_broken = ? WHERE id = ?`,
          [count, ruleText, docId]
        );
        return c.json({ ok: true });
      }

      case "resetConsecutiveBreaks": {
        const docId = String(data.docId || "");
        if (!docId) return c.json({ error: "invalid-argument" }, 400);
        
        run(
          `UPDATE people SET consecutive_breaks = 0, last_rule_broken = NULL WHERE id = ?`,
          [docId]
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

export default app;
