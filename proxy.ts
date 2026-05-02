import { auth } from "@/lib/auth"
import { NextResponse, type NextRequest } from "next/server"

export default auth((request) => {
  const isLoggedIn = !!request.auth
  const pathname = request.nextUrl.pathname
  
  // Define route types
  const isOnApp = pathname.startsWith("/app")
  const isOnLogin = pathname === "/login"
  const isOnSignup = pathname === "/signup"
  const isOnApi = pathname.startsWith("/api")
  const isOnStatic = pathname.startsWith("/_next") || 
                      pathname.startsWith("/static") ||
                      pathname.includes(".")

  // Skip proxy for static files and most API routes
  if (isOnStatic || (isOnApi && pathname !== "/api/auth")) {
    return NextResponse.next()
  }

  // Protected route: redirect to login if not authenticated
  if (isOnApp && !isLoggedIn) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.search = ""
    return NextResponse.redirect(url)
  }

  // Auth pages: redirect to app if already authenticated
  if ((isOnLogin || isOnSignup) && isLoggedIn) {
    const url = request.nextUrl.clone()
    url.pathname = "/app"
    url.search = ""
    return NextResponse.redirect(url)
  }

  // All other requests (including root /) - allow through without modification
  return NextResponse.next()
})

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
