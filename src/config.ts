// Env boolean parsing with sane defaults
export function parseBool(v: any, def = false) {
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  if (s === "false" || s === "0" || s === "no" || s === "off") return false;
  if (s === "true" || s === "1" || s === "yes" || s === "on") return true;
  return def;
}

export const PORT = Number(process.env.PORT || 8080);
export const CORS_ORIGINS = (process.env.CORS_ORIGINS || "*")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
export const SESSION_SECRET =
  process.env.SESSION_SECRET || "dev-session-secret-change-me";
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
export const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
export const ORACLE_MODEL = process.env.ORACLE_MODEL || "gpt-4o-mini";
export const ADMIN_KEY = (process.env.ADMIN_KEY || "").trim();

// Branding
export const APP_NAME = process.env.APP_NAME || "Stripez";
export const APP_YEAR = Number(process.env.APP_YEAR || new Date().getFullYear());
// Drink request policy (default: require Schikko approval)
export const DRINK_REQUIRE_APPROVAL = parseBool(
  process.env.DRINK_REQUIRE_APPROVAL,
  true
);

// Event config and cleanup behavior
export const STRIPEZ_DEFAULT_DURATION_DAYS = Math.max(
  1,
  Number(process.env.STRIPEZ_DEFAULT_DURATION_DAYS || 3)
);
export const STRIPEZ_UNSET_DELAY_HOURS = Math.max(
  0,
  Number(process.env.STRIPEZ_UNSET_DELAY_HOURS || 6)
);
export const STRIPEZ_CLEANUP_ACTION = String(
  process.env.STRIPEZ_CLEANUP_ACTION || "NOTHING"
).toUpperCase();
