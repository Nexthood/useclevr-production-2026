import { auth } from "@/lib/auth"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Middleware for Next.js 14 App Router with NextAuth v5 (Auth.js)
 * 
 * CRITICAL: This middleware must return exactly ONE response per request.
 * Calling redirect() or next() multiple times causes "Cannot append headers after they are sent to the client" errors.
 * 
 * The auth() function from NextAuth v5 returns a middleware wrapper that:
 * 1. Checks authentication status
 * 2. Passes the request to the callback function
 * 3. Expects a single response (either NextResponse.next() or NextResponse.redirect())
 * 
 * Pattern:
 * - Use request.nextUrl.clone() to create mutable URL copies
 * - Return redirect() or next() immediately - no further code after
 * - Never call redirect() after already returning a response
 */
export default auth((request) => {
  // CRITICAL: Get auth status ONCE at the start
  const isLoggedIn = !!request.auth
  const pathname = request.nextUrl.pathname
  
  // Define protected and public routes
  const isOnApp = pathname.startsWith("/app")
  const isOnLogin = pathname === "/login"
  const isOnSignup = pathname === "/signup"
  const isOnApi = pathname.startsWith("/api")
  const isOnStatic = pathname.startsWith("/_next") || 
                      pathname.startsWith("/static") ||
                      pathname.includes(".") // Files with extensions

  // Skip middleware for static files and API health checks
  // This prevents unnecessary auth checks and potential header conflicts
  if (isOnStatic || (isOnApi && pathname !== "/api/auth")) {
    return NextResponse.next()
  }

  // CASE 1: Protected route (/app/*) - redirect to login if not authenticated
  // IMPORTANT: Return immediately - no code after this
  if (isOnApp && !isLoggedIn) {
    console.log('[MIDDLEWARE] Not authenticated, redirecting to /login')
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  // CASE 2: Login/Signup pages - redirect to app if already authenticated
  // IMPORTANT: Return immediately - no code after this
  if ((isOnLogin || isOnSignup) && isLoggedIn) {
    const url = request.nextUrl.clone()
    url.pathname = "/app"
    return NextResponse.redirect(url)
  }

  // CASE 3: All other requests - allow through
  // IMPORTANT: This is the ONLY exit point for authenticated users on non-protected routes
  return NextResponse.next()
})

// Configure which routes the middleware runs on
// Exclude static assets to avoid unnecessary processing
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (browser icon)
     * - public folder files
     * - api routes that don't need auth (optional)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
