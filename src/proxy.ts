import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Fast, optimistic redirect for signed-out visitors (a real 307 before anything renders).
 * It only checks that a session cookie EXISTS. It does not prove the session is valid:
 * the real checks run on the server in src/server/auth/session.ts for every page and action.
 */
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  const login = new URL("/login", request.url);
  login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/admin/:path*", "/portal/:path*", "/security/:path*", "/no-access"],
};