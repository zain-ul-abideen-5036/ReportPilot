import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sessionSecret, verifySession } from "@/lib/auth/session";

/**
 * Every dashboard route needs a signed-in member of an agency. Client
 * report links (/r/…), the landing page, sign-in, webhooks and the print
 * page (protected by its own signed URL) stay public.
 */
export async function middleware(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value, sessionSecret());
  if (session) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/sign-in";
  url.search = "";
  const next = req.nextUrl.pathname + req.nextUrl.search;
  if (next !== "/") url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/dashboard/:path*", "/reports/:path*", "/clients/:path*", "/alerts/:path*", "/pipeline/:path*", "/settings/:path*", "/outbox/:path*"],
};
