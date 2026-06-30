import assert from "node:assert/strict"

import { normalizePublicAuthBaseUrl, resolveAuthRedirect } from "../../src/lib/auth/redirect-origin"

assert.equal(
  resolveAuthRedirect("https://app.useclevr.com/app", "https://0.0.0.0:8080"),
  "https://app.useclevr.com/app",
)
assert.equal(
  resolveAuthRedirect("https://test.useclevr.com/app", "https://0.0.0.0:8080"),
  "https://test.useclevr.com/app",
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
  resolveAuthRedirect("/app", "http://localhost:3100"),
  "http://localhost:3100/app",
)

console.log("Auth redirect origin checks passed.")
