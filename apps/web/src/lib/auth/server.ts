import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, sessionSecret, verifySession, type Session } from "./session";

/** The signed-in user, or null. Reads the cookie the middleware already checked. */
export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value, sessionSecret());
}

/** For pages and actions that must have a user. Pages behind the middleware never hit the redirect. */
export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/sign-in");
  return s;
}

const enc = new TextEncoder();

/**
 * The PDF route prints /print/[siteId] with a headless browser that has
 * no session of its own. It passes a short-lived signature instead, so
 * the print page is never readable by someone guessing a site id.
 */
export async function printSignature(siteId: string, exp: number): Promise<string> {
  const secret = sessionSecret();
  if (!secret) throw new Error("AUTH_SECRET is not set");
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`print:${siteId}:${exp}`)));
  return Buffer.from(sig).toString("base64url");
}

export async function verifyPrintSignature(siteId: string, exp: string | undefined, sig: string | undefined): Promise<boolean> {
  if (!exp || !sig || Number(exp) * 1000 < Date.now()) return false;
  const expected = await printSignature(siteId, Number(exp));
  return expected.length === sig.length && Buffer.from(expected).equals(Buffer.from(sig));
}
