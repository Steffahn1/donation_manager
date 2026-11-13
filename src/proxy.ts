import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-cookie";

/**
 * Optimistic check only: if there is no session cookie at all, send the visitor
 * to /login with a proper 307 before any rendering happens. The real
 * authorisation (valid session + correct role) is enforced on the server by
 * requireRole() in every protected page, Server Action and Route Handler.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
