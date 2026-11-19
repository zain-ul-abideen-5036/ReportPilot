import { NextResponse, type NextRequest } from "next/server";
import { USERS } from "@reportpilot/demo";
import { SESSION_COOKIE, cookieOptions, isDemoMode, sessionSecret, signSession } from "@/lib/auth/session";

/**
 * "Open the demo" on the landing page. Signs the visitor in as the sample
 * agency's account manager in one click. Switched off once a database is
 * configured; real deployments use email sign-in links.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.search = "";
  if (!isDemoMode()) {
    url.pathname = "/sign-in";
    return NextResponse.redirect(url);
  }
  const roleParam = req.nextUrl.searchParams.get("as");
  const role = roleParam === "owner" || roleParam === "viewer" ? roleParam : "manager";
  const user = USERS.find((u) => u.role === role)!;
  const token = await signSession({ uid: user.id, org: "org_northfold", role, name: user.name, email: user.email, demo: true }, sessionSecret()!);
  url.pathname = "/dashboard";
  const res = NextResponse.redirect(url);
  res.cookies.set(SESSION_COOKIE, token, cookieOptions);
  return res;
}
