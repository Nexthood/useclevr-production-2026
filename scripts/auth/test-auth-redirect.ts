import assert from "node:assert/strict"

import { resolveAuthRedirect } from "../../src/lib/auth/redirect-origin"

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
  resolveAuthRedirect("/app", "http://localhost:3100"),
  "http://localhost:3100/app",
)

console.log("Auth redirect origin checks passed.")
