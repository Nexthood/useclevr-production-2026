import { type NextRequest, NextResponse } from "next/server"

const apiPrefix = "/api"

function hasSessionCookie(request: NextRequest) {
  return request.cookies.has("authjs.session-token") ||
    request.cookies.has("__Secure-authjs.session-token") ||
    request.cookies.has("next-auth.session-token") ||
    request.cookies.has("__Secure-next-auth.session-token")
}

export default function middleware(request: NextRequest) {
  const { nextUrl } = request
  const isLoggedIn = hasSessionCookie(request)
  const pathname = nextUrl.pathname

  // Generate CSP Nonce
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64")
  const cspHeader = `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'unsafe-eval'; style-src 'self' 'nonce-${nonce}'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https:; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'`.replace(/\s{2,}/g, " ").trim()

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("Content-Security-Policy", cspHeader)

  if (!isLoggedIn && pathname.startsWith(apiPrefix)) {
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
