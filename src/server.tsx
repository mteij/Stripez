// @ts-nocheck
/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { migrate, seedDefaultRules } from "./db";
import path from "node:path";
import { Index } from "./views/Index";
import pkg from "../package.json";
import { PORT, CORS_ORIGINS, APP_NAME, APP_YEAR, FIREBASE_AUTH_DOMAIN } from "./config";
import { setupCronJobs } from "./cron";
import { getAppDisplayName, renderAppIconPng, renderAppIconSvg } from "./icon";

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

const frameSrc = ["'self'", "https://apis.google.com"];
if (FIREBASE_AUTH_DOMAIN) {
  frameSrc.push(`https://${FIREBASE_AUTH_DOMAIN}`);
}

// Security headers (CSP mirrors firebase.json, minus Firebase APIs)
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://cdn.tailwindcss.com https://www.gstatic.com https://www.googletagmanager.com https://apis.google.com https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: https:",
  "font-src 'self' https://fonts.gstatic.com data:",
  "connect-src 'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com blob: data: https://cloudflareinsights.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com",
  `frame-src ${frameSrc.join(" ")}`,
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
const ASSET_VERSION = encodeURIComponent(pkg.version || "0.0.0");

function withNoStore(headers: HeadersInit = {}) {
  return {
    "Cache-Control": "no-cache, no-store, must-revalidate",
    ...headers,
  };
}

app.get("/favicon.ico", (c) => c.redirect("/favicon.svg", 302));
app.get("/favicon.svg", (c) => {
  const svg = renderAppIconSvg(APP_NAME, APP_YEAR, 64);
  return c.body(svg, 200, {
    "Content-Type": "image/svg+xml; charset=utf-8",
    "Cache-Control": "no-cache, no-store, must-revalidate",
  });
});
app.get("/icon-192.svg", (c) => {
  const svg = renderAppIconSvg(APP_NAME, APP_YEAR, 192);
  return c.body(svg, 200, {
    "Content-Type": "image/svg+xml; charset=utf-8",
    "Cache-Control": "no-cache, no-store, must-revalidate",
  });
});
app.get("/icon-192.png", (c) => {
  const png = renderAppIconPng(APP_NAME, APP_YEAR, 192);
  return c.body(png, 200, {
    "Content-Type": "image/png",
    "Cache-Control": "no-cache, no-store, must-revalidate",
  });
});
app.get("/icon-512.svg", (c) => {
  const svg = renderAppIconSvg(APP_NAME, APP_YEAR, 512);
  return c.body(svg, 200, {
    "Content-Type": "image/svg+xml; charset=utf-8",
    "Cache-Control": "no-cache, no-store, must-revalidate",
  });
});
app.get("/icon-512.png", (c) => {
  const png = renderAppIconPng(APP_NAME, APP_YEAR, 512);
  return c.body(png, 200, {
    "Content-Type": "image/png",
    "Cache-Control": "no-cache, no-store, must-revalidate",
  });
});
app.get("/apple-touch-icon.png", (c) => {
  const png = renderAppIconPng(APP_NAME, APP_YEAR, 180);
  return c.body(png, 200, {
    "Content-Type": "image/png",
    "Cache-Control": "no-cache, no-store, must-revalidate",
  });
});
// Ensure correct MIME type for Service Worker (Bun runtime)
app.get("/sw.js", async (c) => {
  const swScript = `
const CACHE_NAME = 'schikko-rules-cache-${ASSET_VERSION}';
const APP_SHELL = [
  '/',
  '/style.css?v=${ASSET_VERSION}',
  '/js/main.js?v=${ASSET_VERSION}',
  '/manifest.json?v=${ASSET_VERSION}',
  '/randomizer/randomizer.css?v=${ASSET_VERSION}',
  '/randomizer/randomizer.js?v=${ASSET_VERSION}',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-192.svg',
  '/icon-512.png',
  '/icon-512.svg',
  '/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(APP_SHELL.map(async (url) => {
      try {
        await cache.add(url);
      } catch (err) {
        console.warn('SW: skip caching', url, err && (err.message || err));
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map((cacheName) => cacheName === CACHE_NAME ? null : caches.delete(cacheName))
    );
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach((client) => client.postMessage({ type: 'reload' }));
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin || req.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return;

  const isNavigation = req.mode === 'navigate';
  const isAppShellAsset =
    url.pathname.startsWith('/js/') ||
    url.pathname.startsWith('/randomizer/') ||
    url.pathname === '/style.css' ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/sw.js';

  if (isNavigation || isAppShellAsset) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const networkResponse = await fetch(req, { cache: 'no-store' });
        if (networkResponse && networkResponse.ok) {
          cache.put(req, networkResponse.clone());
        }
        return networkResponse;
      } catch (err) {
        const cachedResponse = await cache.match(req);
        if (cachedResponse) return cachedResponse;
        console.warn('SW: network fetch failed', req.url, err && (err.message || err));
        return Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cachedResponse = await caches.match(req);
    if (cachedResponse) return cachedResponse;
    return fetch(req);
  })());
});
`;
  return c.body(swScript, 200, withNoStore({
    "Content-Type": "application/javascript; charset=utf-8",
  }));
});
app.get("/manifest.json", async (c) => {
  const name = getAppDisplayName(APP_NAME, APP_YEAR);
  const manifest = {
    name,
    short_name: APP_NAME,
    start_url: "/index.html",
    display: "standalone",
    background_color: "#fdf8e9",
    theme_color: "#8c6b52",
    description: `The official ledger for ${name}.`,
    icons: [
      {
        src: "/icon-192.png",
        type: "image/png",
        sizes: "192x192",
        purpose: "any maskable",
      },
      {
        src: "/icon-512.png",
        type: "image/png",
        sizes: "512x512",
        purpose: "any maskable",
      },
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
  return c.json(manifest, 200, withNoStore());
});
// Force correct MIME type for CSS to satisfy X-Content-Type-Options: nosniff
app.get("/style.css", async (c) => {
  const file = Bun.file(path.join(PUBLIC_DIR, "style.css"));
  return new Response(file, {
    headers: withNoStore({ "Content-Type": "text/css; charset=utf-8" }),
  });
});

app.use("/js/*", async (c, next) => {
  await next();
  c.header("Cache-Control", "no-cache, no-store, must-revalidate");
});

app.use("/randomizer/*", async (c, next) => {
  await next();
  c.header("Cache-Control", "no-cache, no-store, must-revalidate");
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
seedDefaultRules();
setupCronJobs();

Bun.serve({
  port: PORT,
  fetch: app.fetch,
});

console.log(`[Stripez] Listening on http://localhost:${PORT}`);
