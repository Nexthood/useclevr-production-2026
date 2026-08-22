import { type NextRequest, NextResponse } from "next/server"

import { SQUARE_CALLBACK_PATH } from "@/integrations/retail/providers/square/square-oauth"
import {
  applyRuntimeSecurityHeaders,
  buildContentSecurityPolicy,
  isHttpsRequest,
} from "@/lib/security/http-headers.mjs"

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
  SQUARE_CALLBACK_PATH,
]

function hasSessionCookie(request: NextRequest) {
  return request.cookies.has("authjs.session-token") ||
    request.cookies.has("__Secure-authjs.session-token") ||
    request.cookies.has("next-auth.session-token") ||
    request.cookies.has("__Secure-next-auth.session-token") ||
    request.cookies.has("payload-token")
}

function isDemoRoute(pathname: string) {
  return pathname === "/demo" || pathname.startsWith("/demo/")
}

function applyResponseSecurityHeaders(request: NextRequest, response: NextResponse, cspHeader: string) {
  applyRuntimeSecurityHeaders(response.headers, {
    csp: cspHeader,
    isHttps: isHttpsRequest(request),
  })
  return response
}

function redirectWithCsp(request: NextRequest, url: URL, cspHeader: string) {
  const response = NextResponse.redirect(url)
  return applyResponseSecurityHeaders(request, response, cspHeader)
}

export default function proxy(request: NextRequest) {
  const { nextUrl } = request
  const pathname = nextUrl.pathname
  const host = request.headers.get("host") || ""
  const isMcpSubdomain = MCP_SUBDOMAIN_PATTERN.test(host)
  const isMcpTestSubdomain = MCP_TEST_SUBDOMAIN_PATTERN.test(host)
  // Generate CSP Nonce
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64")
  const cspHeader = buildContentSecurityPolicy({ nonce, pathname })

  if (isMcpSubdomain && pathname !== "/api/mcp" && pathname !== "/api/payload/mcp") {
    const response = new NextResponse("Not Found", { status: 404 })
    applyRuntimeSecurityHeaders(response.headers, {
      csp: cspHeader,
      isHttps: isHttpsRequest(request),
    })
    return response
  }

  const isLoggedIn = hasSessionCookie(request)

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("x-useclevr-pathname", pathname)
  requestHeaders.set("Content-Security-Policy", cspHeader)

  if (isMcpTestSubdomain && (pathname === "/api/mcp" || pathname === "/api/payload/mcp")) {
    requestHeaders.set("x-internal-trusted-proxy", "1")
    const mcpUrl = nextUrl.clone()
    mcpUrl.pathname = "/api/payload/mcp"
    const response = NextResponse.rewrite(mcpUrl, {
      request: {
        headers: requestHeaders,
      },
    })
    return applyResponseSecurityHeaders(request, response, cspHeader)
  }

  const isPublicApiPrefix = publicApiPrefixes.some((prefix) => pathname.startsWith(prefix))
  const isPublicApiPath = publicApiPaths.includes(pathname)

  if (isDemoRoute(pathname)) {
    if (!isLoggedIn) {
      const registerUrl = nextUrl.clone()
      registerUrl.pathname = "/register"
      registerUrl.search = ""
      return redirectWithCsp(request, registerUrl, cspHeader)
    }

    const demoWorkspaceUrl = nextUrl.clone()
    demoWorkspaceUrl.pathname = "/app/dashboard"
    demoWorkspaceUrl.search = ""
    return redirectWithCsp(request, demoWorkspaceUrl, cspHeader)
  }

  if (!isLoggedIn && pathname.startsWith(apiPrefix) && !isPublicApiPrefix && !isPublicApiPath) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    return applyResponseSecurityHeaders(request, response, cspHeader)
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
  return applyResponseSecurityHeaders(request, response, cspHeader)
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
