import { type NextRequest, NextResponse } from "next/server"

const MCP_SUBDOMAIN_PATTERN = /^mcp(?:-test)?\.useclevr\.com(:?\d+)?$/;
const MCP_TEST_SUBDOMAIN_PATTERN = /^mcp-test\.useclevr\.com(:?\d+)?$/

const apiPrefix = "/api"
const publicApiPrefixes = ["/api/auth"]
const publicApiPaths = [
  "/api/health",
  "/api/debug/resend-status",
  "/api/mcp",
  "/api/payload/mcp",
  "/api/webhooks/stripe",
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
  const pathname = nextUrl.pathname
  const host = request.headers.get("host") || ""
  const isMcpSubdomain = MCP_SUBDOMAIN_PATTERN.test(host)
  const isMcpTestSubdomain = MCP_TEST_SUBDOMAIN_PATTERN.test(host)
  if (isMcpSubdomain && pathname !== "/api/mcp" && pathname !== "/api/payload/mcp") {
    return new NextResponse("Not Found", { status: 404 })
  }

  const isLoggedIn = hasSessionCookie(request)

  // Generate CSP Nonce
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64")
  const styleSources = pathname.startsWith("/admin")
    ? "'self' 'unsafe-inline'"
    : `'self' 'nonce-${nonce}'`
  const cspHeader = `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'unsafe-eval'; style-src ${styleSources}; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https:; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'`.replace(/\s{2,}/g, " ").trim()

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("x-useclevr-pathname", pathname)
  requestHeaders.set("Content-Security-Policy", cspHeader)

  if (isMcpTestSubdomain && (pathname === "/api/mcp" || pathname === "/api/payload/mcp")) {
    requestHeaders.set("x-internal-trusted-proxy", "1")
    const mcpUrl = nextUrl.clone()
    mcpUrl.pathname = "/api/payload/mcp"
    return NextResponse.rewrite(mcpUrl, {
      request: {
        headers: requestHeaders,
      },
    })
  }

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
