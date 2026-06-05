import { type NextRequest, NextResponse } from "next/server"

const apiPrefix = "/api"
const publicApiPrefixes = ["/api/auth"]
const publicApiPaths = [
  "/api/health",
  "/api/payload/cms-users/login",
  "/api/payload/cms-users/refresh-token",
  "/api/payload/cms-users/forgot-password",
  "/api/payload/cms-users/reset-password",
  "/api/payload/cms-users/unlock",
]

function hasSessionCookie(request: NextRequest) {
  return request.cookies.has("authjs.session-token") ||
    request.cookies.has("__Secure-authjs.session-token") ||
    request.cookies.has("next-auth.session-token") ||
    request.cookies.has("__Secure-next-auth.session-token") ||
    request.cookies.has("payload-token")
}

export default function proxy(request: NextRequest) {
  const { nextUrl } = request
  const isLoggedIn = hasSessionCookie(request)
  const pathname = nextUrl.pathname

  // Generate CSP Nonce
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64")
  const cspHeader = `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'unsafe-eval'; style-src 'self' 'nonce-${nonce}'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https:; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'`.replace(/\s{2,}/g, " ").trim()

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("Content-Security-Policy", cspHeader)

  const isPublicApiPrefix = publicApiPrefixes.some((prefix) => pathname.startsWith(prefix))
  const isPublicApiPath = publicApiPaths.includes(pathname)

  if (!isLoggedIn && pathname.startsWith(apiPrefix) && !isPublicApiPrefix && !isPublicApiPath) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    response.headers.set("Content-Security-Policy", cspHeader)
    return response
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
  response.headers.set("Content-Security-Policy", cspHeader)
  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
