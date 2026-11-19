import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, cookieOptions, sessionSecret, signSession } from "@/lib/auth/session";
import { database } from "@/lib/data";

/** The link from the sign-in email. One use, fifteen minutes; then a 14-day session cookie. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const nextParam = req.nextUrl.searchParams.get("next") ?? "/dashboard";
  const next = /^\/(?!\/)/.test(nextParam) ? nextParam : "/dashboard";
  const fail = (error: string) => NextResponse.redirect(new URL(`/sign-in?error=${error}`, req.url));
  const secret = sessionSecret();
  if (!process.env.DATABASE_URL || !secret || !token) return fail("link");
  const { db, repo } = await database();
  const result = await repo.consumeLoginToken(db, token);
  if (!result) return fail("expired");
  const cookie = await signSession({ uid: result.user.id, org: result.orgId, role: result.role, name: result.user.name, email: result.user.email, demo: false }, secret);
  const res = NextResponse.redirect(new URL(next, req.url));
  res.cookies.set(SESSION_COOKIE, cookie, cookieOptions);
  return res;
}
