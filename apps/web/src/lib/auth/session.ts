/**
 * Sessions are a signed cookie: base64url(JSON payload) + "." + HMAC-SHA256.
 * Web Crypto only, so the same code verifies sessions in the edge
 * middleware and in server components. No session table to keep tidy;
 * a session ends when the cookie expires (14 days) or the user signs out.
 */

export type Role = "owner" | "manager" | "viewer";

export interface Session {
  uid: string;
  org: string;
  role: Role;
  name: string;
  email: string;
  /** True for the public demo, where the data is the bundled sample agency. */
  demo: boolean;
  /** Expiry, seconds since the epoch. */
  exp: number;
}

export const SESSION_COOKIE = "rp_session";
export const SESSION_DAYS = 14;

/**
 * Demo sessions only ever unlock the bundled sample data, so a fixed
 * secret is acceptable there. With a database configured, AUTH_SECRET is
 * required and the demo shortcut is switched off.
 */
const DEMO_SECRET = "reportpilot-demo-sessions-unlock-sample-data-only";

export function isDemoMode(): boolean {
  return !process.env.DATABASE_URL;
}

export function sessionSecret(): string | null {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 32) return s;
  return isDemoMode() ? DEMO_SECRET : null;
}

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

function equal(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

export async function signSession(payload: Omit<Session, "exp">, secret: string, now = Date.now()): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify({ ...payload, exp: Math.floor(now / 1000) + SESSION_DAYS * 86_400 })));
  return `${body}.${b64url(await hmac(secret, body))}`;
}

export async function verifySession(cookie: string | undefined, secret: string | null, now = Date.now()): Promise<Session | null> {
  if (!cookie || !secret) return null;
  const [body, sig] = cookie.split(".");
  if (!body || !sig) return null;
  try {
    if (!equal(fromB64url(sig), await hmac(secret, body))) return null;
    const s = JSON.parse(new TextDecoder().decode(fromB64url(body))) as Session;
    if (typeof s.exp !== "number" || s.exp * 1000 < now) return null;
    if (!["owner", "manager", "viewer"].includes(s.role)) return null;
    // A demo cookie must not open a real database, and vice versa.
    if (s.demo !== isDemoMode()) return null;
    return s;
  } catch {
    return null;
  }
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_DAYS * 86_400,
};
