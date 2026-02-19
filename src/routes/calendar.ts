import { Hono } from "hono";
import { request as gaxiosRequest } from "gaxios";
import net from "net";

const app = new Hono();

function isPrivateOrDisallowedHost(hostname: string): boolean {
  const lower = String(hostname || "").toLowerCase();
  if (lower === "localhost" || lower === "127.0.0.1" || lower === "::1")
    return true;
  if (lower.endsWith(".internal") || lower === "metadata.google.internal")
    return true;

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

app.post("/proxy", async (c) => {
  const method = c.req.method;
  if (method === "PURGE") return c.text("Method Not Allowed", 405);
  if (method !== "POST") return c.text("Method Not Allowed", 405);

  const body = await c.req.json().catch(() => ({}));
  const url = body?.url as string | undefined;
  if (!url || typeof url !== "string")
    return c.json(
      { error: { status: "INVALID_ARGUMENT", message: "Missing 'url'." } },
      400
    );

  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return c.json(
      { error: { status: "INVALID_ARGUMENT", message: "Invalid URL." } },
      400
    );
  }
  if (!["http:", "https:"].includes(u.protocol)) {
    return c.json(
      {
        error: {
          status: "INVALID_ARGUMENT",
          message: "Only http(s) URLs are allowed.",
        },
      },
      400
    );
  }
  if (isPrivateOrDisallowedHost(u.hostname)) {
    return c.json(
      {
        error: {
          status: "INVALID_ARGUMENT",
          message: "Target host is not allowed.",
        },
      },
      400
    );
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
    const ct = String(
      resp.headers?.["content-type"] || resp.headers?.["Content-Type"] || ""
    ).toLowerCase();
    if (
      ct &&
      !(
        ct.startsWith("text/calendar") ||
        ct.startsWith("text/plain") ||
        ct.startsWith("text/")
      )
    ) {
      return c.json(
        {
          error: {
            status: "INVALID_ARGUMENT",
            message: "Unsupported content type from target host.",
          },
        },
        400
      );
    }
    return c.json({ icalData: resp.data });
  } catch (e) {
    return c.json(
      {
        error: {
          status: "INTERNAL",
          message: "Could not fetch calendar data.",
        },
      },
      500
    );
  }
});

export default app;
