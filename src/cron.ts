import cron from "node-cron";
import { get, run } from "./db";
import { yearKey } from "./utils/helpers";
import { STRIPEZ_DEFAULT_DURATION_DAYS, STRIPEZ_UNSET_DELAY_HOURS, STRIPEZ_CLEANUP_ACTION } from "./config";

export function setupCronJobs() {
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
}
