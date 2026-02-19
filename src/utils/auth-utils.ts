import crypto from "crypto";
import { timingSafeEq } from "./helpers";

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

export function verifyPassword(password: string, salt: string, hash: string) {
  const computed = crypto.scryptSync(password, salt, 64).toString("hex");
  return timingSafeEq(computed, hash);
}

// ---- TOTP helpers (RFC 6238) ----
const B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0,
    value = 0,
    output = "";
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      output += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += B32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function base32Decode(str: string): Uint8Array {
  const clean = String(str || "")
    .toUpperCase()
    .replace(/[^A-Z2-7]/g, "");
  let bits = 0,
    value = 0;
  const out: number[] = [];
  for (let i = 0; i < clean.length; i++) {
    const idx = B32_ALPHABET.indexOf(clean[i]);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Uint8Array.from(out);
}

export function hotp(secret: Uint8Array, counter: number, digits = 6): string {
  const buf = Buffer.alloc(8);
  for (let i = 7; i >= 0; i--) {
    buf[i] = counter & 0xff;
    counter = Math.floor(counter / 256);
  }
  const hmac = crypto
    .createHmac("sha1", Buffer.from(secret))
    .update(buf)
    .digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const mod = 10 ** digits;
  return String(code % mod).padStart(digits, "0");
}

export function totpVerify(
  secretBase32: string,
  token: string,
  window = 1,
  step = 30,
  digits = 6
): boolean {
  const secret = base32Decode(secretBase32);
  const counter = Math.floor(Date.now() / 1000 / step);
  const norm = String(token || "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(norm)) return false;
  for (let w = -window; w <= window; w++) {
    const otp = hotp(secret, counter + w, digits);
    if (otp === norm) return true;
  }
  return false;
}

export function makeOtpAuthUrl(opts: {
  secretBase32: string;
  account: string;
  issuer: string;
}): string {
  const issuer = opts.issuer;
  const account = opts.account;
  const label = `${issuer}:${account}`;
  const params = new URLSearchParams({
    secret: opts.secretBase32,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}
