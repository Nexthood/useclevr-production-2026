import { auth } from "@/lib/auth/auth";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

type AuthenticatedRequest = NextRequest & { auth?: unknown };

export default auth((request: AuthenticatedRequest) => {
  const isLoggedIn = !!request.auth;
  const pathname = request.nextUrl.pathname;

  // Define route types
  const isOnApp = pathname.startsWith("/app");
  const isOnLogin = pathname === "/login";
  const isOnSignup = pathname === "/signup";
  const isOnAuthApi = pathname.startsWith("/api/auth");
  const isOnApi = pathname.startsWith("/api");
  const isOnStatic =
    pathname.startsWith("/_next") || pathname.startsWith("/static") || pathname.includes(".");

  // Skip proxy for static files and non-auth API routes.
  if (isOnStatic || (isOnApi && !isOnAuthApi)) {
    return NextResponse.next();
  }

  // Protected route: redirect to login if not authenticated
  if (isOnApp && !isLoggedIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Auth pages: redirect to app if already authenticated
  if ((isOnLogin || isOnSignup) && isLoggedIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // All other requests (including root /) - allow through without modification
  return NextResponse.next();
});

export const config = {
  matcher: ["/app/:path*", "/login", "/signup"],
};
