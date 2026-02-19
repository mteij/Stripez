// @ts-nocheck
/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { migrate } from "./db";
import path from "node:path";
import { Index } from "./views/Index";
import pkg from "../package.json";
import { PORT, CORS_ORIGINS, APP_NAME, APP_YEAR } from "./config";
import { setupCronJobs } from "./cron";

// Route modules
import authRoutes from "./routes/auth";
import schikkoRoutes from "./routes/schikko";
import configRoutes from "./routes/config";
import dataRoutes from "./routes/data";
import calendarRoutes from "./routes/calendar";
import oracleRoutes from "./routes/oracle";

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
  "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://cdn.tailwindcss.com https://www.gstatic.com https://www.googletagmanager.com https://apis.google.com https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: https:",
  "font-src 'self' https://fonts.gstatic.com data:",
  "connect-src 'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com blob: data: https://cloudflareinsights.com",
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

// ---- Mount Routes ----
app.route("/api/auth", authRoutes);
app.route("/api/schikko", schikkoRoutes);
app.route("/api/config", configRoutes);
app.route("/api", dataRoutes);
app.route("/api/calendar", calendarRoutes);
app.route("/api/oracle", oracleRoutes);

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

app.get("/", (c) => {
  c.header("Cache-Control", "no-cache, no-store, must-revalidate");
  return c.html(<Index title={APP_NAME} version={pkg.version} />);
});

// Fallback SPA route: serve index.html for any non-API path,
// but return 404 for unknown asset-like URLs to avoid MIME-type confusion.
app.notFound((c) => {
  const p = c.req.path;
  if (p.startsWith("/api/")) return c.json({ error: "not-found" }, 404);
  // If the path looks like a file (has an extension) and wasn't matched above, 404 it.
  if (/\.[a-zA-Z0-9]+$/.test(p)) {
    return c.text("Not Found", 404);
  }
  c.header("Cache-Control", "no-cache, no-store, must-revalidate");
  return c.html(<Index title={APP_NAME} version={pkg.version} />);
});

// ---- Bootstrap & Serve ----
migrate();
setupCronJobs();

Bun.serve({
  port: PORT,
  fetch: app.fetch,
});

console.log(`[Stripez] Listening on http://localhost:${PORT}`);
