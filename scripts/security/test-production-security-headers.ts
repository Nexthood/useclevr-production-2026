import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import {
  applyRuntimeSecurityHeaders,
  buildContentSecurityPolicy,
  getNextConfigSecurityHeaders,
} from "../../src/lib/security/http-headers.mjs"

const repoRoot = resolve(import.meta.dirname, "../..")

function readProjectFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8")
}

function assertIncludes(source: string, expected: string, message: string) {
  assert.ok(source.includes(expected), message)
}

function assertNotIncludes(source: string, forbidden: string, message: string) {
  assert.equal(source.includes(forbidden), false, message)
}

function getNextHeader(name: string) {
  return getNextConfigSecurityHeaders().find((header) => header.key === name)?.value || ""
}

function main() {
  assert.equal(getNextHeader("X-Content-Type-Options"), "nosniff", "Next config applies nosniff")
  assert.equal(getNextHeader("Referrer-Policy"), "strict-origin-when-cross-origin", "Next config applies strict referrer policy")
  assert.equal(getNextHeader("X-Frame-Options"), "DENY", "Next config denies framing")

  const permissionsPolicy = getNextHeader("Permissions-Policy")
  for (const directive of ["camera=()", "microphone=()", "geolocation=()", "payment=()", "usb=()"]) {
    assertIncludes(permissionsPolicy, directive, `Permissions-Policy disables ${directive}`)
  }

  const productionHeaders = new Headers()
  applyRuntimeSecurityHeaders(productionHeaders, {
    csp: buildContentSecurityPolicy({ nonce: "testnonce", pathname: "/app/dashboard", isProduction: true }),
    isProduction: true,
    isHttps: true,
  })
  assert.equal(
    productionHeaders.get("Strict-Transport-Security"),
    "max-age=31536000; includeSubDomains",
    "production HTTPS responses include HSTS without preload",
  )

  const localHeaders = new Headers()
  applyRuntimeSecurityHeaders(localHeaders, {
    csp: buildContentSecurityPolicy({ nonce: "testnonce", pathname: "/app/dashboard", isProduction: false }),
    isProduction: false,
    isHttps: true,
  })
  assert.equal(localHeaders.has("Strict-Transport-Security"), false, "local responses do not include HSTS")

  const productionHttpHeaders = new Headers()
  applyRuntimeSecurityHeaders(productionHttpHeaders, {
    isProduction: true,
    isHttps: false,
  })
  assert.equal(productionHttpHeaders.has("Strict-Transport-Security"), false, "non-HTTPS responses do not include HSTS")

  const csp = productionHeaders.get("Content-Security-Policy") || ""
  for (const directive of [
    "default-src 'self'",
    "script-src 'self' 'nonce-testnonce'",
    "style-src 'self' 'nonce-testnonce' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self' https://checkout.stripe.com https://connect.squareup.com https://connect.squareupsandbox.com",
    "worker-src 'self' blob:",
  ]) {
    assertIncludes(csp, directive, `CSP includes ${directive}`)
  }
  assertNotIncludes(csp, "default-src *", "CSP does not allow every default origin")
  assertNotIncludes(csp, "connect-src 'self' https:", "production CSP does not allow every HTTPS connection")
  assertNotIncludes(csp, "'unsafe-eval'", "production CSP does not allow eval")

  const devCsp = buildContentSecurityPolicy({ nonce: "testnonce", pathname: "/app/dashboard", isProduction: false })
  assertIncludes(devCsp, "http://localhost:*", "development CSP allows local helper HTTP calls")
  assertIncludes(devCsp, "ws://localhost:*", "development CSP allows local helper websocket calls")
  assertIncludes(devCsp, "'unsafe-eval'", "development CSP keeps Next dev compatibility")

  const adminCsp = buildContentSecurityPolicy({ nonce: "testnonce", pathname: "/admin", isProduction: true })
  assertIncludes(adminCsp, "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", "Payload admin keeps inline style compatibility")

  const nextConfig = readProjectFile("next.config.mjs")
  const proxy = readProjectFile("src/proxy.ts")
  assertIncludes(nextConfig, "getNextConfigSecurityHeaders()", "Next config uses the central security header helper")
  assertIncludes(proxy, "buildContentSecurityPolicy", "proxy uses the central CSP helper")
  assertIncludes(proxy, "applyRuntimeSecurityHeaders", "proxy applies runtime security headers")
  assertNotIncludes(nextConfig, "Access-Control-Allow-Origin", "Next config does not introduce global CORS")
  assertNotIncludes(proxy, 'Access-Control-Allow-Origin", "*"', "proxy does not introduce wildcard CORS")
  assertNotIncludes(proxy, "Access-Control-Allow-Origin', '*'", "proxy does not introduce wildcard CORS")

  const publicAiRoute = readProjectFile("src/app/api/public/ai/route.ts")
  assertIncludes(publicAiRoute, "process.env.NODE_ENV !== 'production'", "Public AI API remains production-disabled")
  assertIncludes(publicAiRoute, "NextResponse.json({ error: 'Not found' }, { status: 404 })", "Public AI API keeps generic production 404")
}

main()
