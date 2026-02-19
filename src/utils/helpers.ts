import crypto from "crypto";

export function getCookie(c: any, name: string): string | undefined {
  const cookie = c.req.header("Cookie") || "";
  const parts = cookie.split(";").map((p: string) => p.trim());
  for (const part of parts) {
    if (part.startsWith(`${name}=`))
      return decodeURIComponent(part.substring(name.length + 1));
  }
  return undefined;
}

export function setCookie(c: any, name: string, value: string, days = 365) {
  const expires = new Date(Date.now() + days * 86400000).toUTCString();
  const secure = c.req.url.startsWith("https:") ? " Secure;" : "";
  c.header(
    "Set-Cookie",
    `${name}=${encodeURIComponent(
      value
    )}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires};${secure}`
  );
}

export function jsonDate(d: Date | string | number | null | undefined) {
  if (!d) return null;
  if (typeof d === "string") return d;
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toISOString();
}

export function yearKey(y = new Date().getFullYear()) {
  return `schikko_${y}`;
}

export function timingSafeEq(aHex: string, bHex: string) {
  const a = Buffer.from(aHex, "hex");
  const b = Buffer.from(bHex, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function timingSafeStrEq(a: string, b: string) {
  const A = Buffer.from(String(a || ""), "utf8");
  const B = Buffer.from(String(b || ""), "utf8");
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}
