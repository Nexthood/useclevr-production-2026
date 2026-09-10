import assert from "node:assert/strict"

import { NextRequest } from "next/server"

import { normalizePublicAuthBaseUrl, resolveAuthRedirect } from "../../src/lib/auth/redirect-origin"
import proxy from "../../src/proxy"

assert.equal(
  resolveAuthRedirect("https://app.useclevr.com/app", "https://app.useclevr.com"),
  "https://app.useclevr.com/app",
)
assert.equal(
  resolveAuthRedirect("https://test.useclevr.com/app", "https://app.useclevr.com"),
  "https://app.useclevr.com/login",
)
assert.equal(
  resolveAuthRedirect("https://attacker.example/app", "https://app.useclevr.com"),
  "https://app.useclevr.com/login",
)
assert.equal(
  resolveAuthRedirect("/login", "http://0.0.0.0:8080"),
  "http://localhost:8080/login",
)
assert.equal(
  resolveAuthRedirect("http://0.0.0.0:8080/login", "http://0.0.0.0:8080"),
  "http://localhost:8080/login",
)
assert.equal(
  new URL("/api/auth/callback/google", normalizePublicAuthBaseUrl("http://0.0.0.0:8080")).toString(),
  "http://localhost:8080/api/auth/callback/google",
)
process.env.AUTH_URL = "https://test.useclevr.com"
process.env.NEXTAUTH_URL = "https://test.useclevr.com"
assert.equal(
  new URL("/api/auth/callback/google", normalizePublicAuthBaseUrl("https://0.0.0.0:8080")).toString(),
  "https://test.useclevr.com/api/auth/callback/google",
)
assert.equal(
  new URL("/api/auth/callback/linkedin", normalizePublicAuthBaseUrl("https://0.0.0.0:8080")).toString(),
  "https://test.useclevr.com/api/auth/callback/linkedin",
)
assert.equal(
  resolveAuthRedirect("/app/dashboard", "https://test.useclevr.com"),
  "https://test.useclevr.com/app/dashboard",
)
assert.equal(
  resolveAuthRedirect("https://app.useclevr.com/app/dashboard", "https://test.useclevr.com"),
  "https://test.useclevr.com/login",
)
assert.equal(
  resolveAuthRedirect("/app", "http://localhost:3100"),
  "http://localhost:3100/app",
)

const anonymousAppRootResponse = proxy(
  new NextRequest("https://app.useclevr.com/", {
    method: "GET",
    headers: { host: "app.useclevr.com" },
  }),
)
assert.equal(anonymousAppRootResponse.status, 307)
assert.equal(anonymousAppRootResponse.headers.get("location"), "https://app.useclevr.com/login")

const signedInAppRootResponse = proxy(
  new NextRequest("https://app.useclevr.com/", {
    method: "GET",
    headers: {
      cookie: "authjs.session-token=test-session",
      host: "app.useclevr.com",
    },
  }),
)
assert.equal(signedInAppRootResponse.status, 307)
assert.equal(signedInAppRootResponse.headers.get("location"), "https://app.useclevr.com/app")

const marketingRootResponse = proxy(
  new NextRequest("https://www.useclevr.com/", {
    method: "GET",
    headers: { host: "www.useclevr.com" },
  }),
)
assert.equal(marketingRootResponse.status, 200)
assert.equal(marketingRootResponse.headers.get("location"), null)

console.log("Auth redirect origin checks passed.")
