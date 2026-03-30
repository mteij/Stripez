import crypto from "crypto";
import { FIREBASE_PROJECT_ID } from "../config";

const CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

interface CertCache {
  certs: Record<string, string>;
  expiresAt: number;
}

let certCache: CertCache | null = null;

async function getSigningCerts(): Promise<Record<string, string>> {
  if (certCache && Date.now() < certCache.expiresAt) return certCache.certs;
  const res = await fetch(CERTS_URL);
  if (!res.ok) throw new Error("Failed to fetch Firebase signing certs");
  const cacheControl = res.headers.get("cache-control") || "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1]) : 3600;
  const certs: Record<string, string> = await res.json();
  certCache = { certs, expiresAt: Date.now() + maxAge * 1000 };
  return certs;
}

function b64urlDecode(str: string): Buffer {
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export interface FirebaseTokenClaims {
  uid: string;
  email: string;
  emailVerified: boolean;
}

export async function verifyFirebaseToken(
  idToken: string
): Promise<FirebaseTokenClaims | null> {
  if (!FIREBASE_PROJECT_ID) return null;
  try {
    const parts = idToken.split(".");
    if (parts.length !== 3) return null;

    const header = JSON.parse(b64urlDecode(parts[0]).toString("utf8"));
    const payload = JSON.parse(b64urlDecode(parts[1]).toString("utf8"));

    if (header.alg !== "RS256") return null;
    if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) return null;
    if (payload.aud !== FIREBASE_PROJECT_ID) return null;
    if (payload.exp * 1000 < Date.now()) return null;
    if (!payload.sub) return null;

    const certs = await getSigningCerts();
    const certPem = certs[header.kid];
    if (!certPem) return null;

    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(`${parts[0]}.${parts[1]}`);
    const valid = verifier.verify(certPem, b64urlDecode(parts[2]));
    if (!valid) return null;

    return {
      uid: payload.sub,
      email: String(payload.email || "").toLowerCase(),
      emailVerified: Boolean(payload.email_verified),
    };
  } catch {
    return null;
  }
}
