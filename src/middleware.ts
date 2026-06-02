import { type NextRequest, NextResponse } from "next/server";

// Temporary: keep middleware packaging path because proxy convention currently breaks production dist build. Revisit after Railway deploy is stable.
const publicRoutes = [
  "/",
  "/login",
  "/signup",
  "/pricing",
  "/faq",
  "/contact",
  "/privacy",
  "/terms",
  "/security",
  "/affiliate",
];

const publicPrefixes = [
  "/_next",
  "/api/auth",
  "/api/health",
  "/api/public",
  "/api/webhooks",
  "/demo",
  "/report",
];

const apiPrefix = "/api";

function hasSessionCookie(request: NextRequest) {
  return (
    request.cookies.has("authjs.session-token") ||
    request.cookies.has("__Secure-authjs.session-token") ||
    request.cookies.has("next-auth.session-token") ||
    request.cookies.has("__Secure-next-auth.session-token")
  );
}

export default function middleware(request: NextRequest) {
  const { nextUrl } = request;
  const isLoggedIn = hasSessionCookie(request);
  const pathname = nextUrl.pathname;

  if (publicRoutes.includes(pathname)) {
    return NextResponse.next();
  }

  if (publicPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  if (!isLoggedIn && pathname.startsWith(apiPrefix)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname + nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
