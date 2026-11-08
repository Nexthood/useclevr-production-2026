import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import path from "node:path";

// Only a packaged local snapshot is accepted; no inherited provider credentials.
const directory = path.resolve(process.argv[2] || "");
if (
  process.argv.length !== 3 ||
  !path.basename(directory).startsWith("partner-validation-") ||
  !existsSync(path.join(directory, "safe-build-manifest.json"))
)
  throw new Error("Supply the isolated partner-validation snapshot directory");
const dist = path.join(directory, "dist");
assert.ok(existsSync(path.join(dist, "scripts/runtime/start-dist.cjs")));
const probe = createServer();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const child = spawn(
  process.execPath,
  ["-r", "./scripts/runtime/load-env.cjs", "./scripts/runtime/start-dist.cjs"],
  {
    cwd: dist,
    detached: true,
    env: {
      PATH: process.env.PATH,
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
      AUTH_SECRET: randomBytes(48).toString("base64url"),
      PAYLOAD_SECRET: randomBytes(48).toString("base64url"),
      AUTH_URL: origin,
      NEXT_PUBLIC_APP_URL: origin,
      AUTH_TRUST_HOST: "true",
      DATABASE_URL: "postgresql://local_build@127.0.0.1:1/local_build",
      DIRECT_URL: "postgresql://local_build@127.0.0.1:1/local_build",
      PARTNER_PROGRAM_ENABLED: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let diagnostics = "";
for (const output of [child.stdout, child.stderr])
  output.on("data", (chunk) => {
    diagnostics = (diagnostics + chunk).slice(-8000);
  });
try {
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (child.exitCode !== null) throw new Error("Packaged runtime exited before startup");
    try {
      await fetch(origin + "/api/partners", { signal: AbortSignal.timeout(1000) });
      ready = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  assert.ok(ready, "Packaged runtime must start within 30 seconds");
  const application = await fetch(origin + "/partners/apply", { redirect: "manual" });
  assert.equal(application.status, 307);
  const location = new URL(application.headers.get("location"), origin);
  assert.equal(location.pathname, "/login");
  assert.equal(location.searchParams.get("callbackUrl"), "/partners/apply");
  for (const route of ["/api/partners", "/api/admin/partners"]) {
    const response = await fetch(origin + route);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, "Unauthorized");
  }
  const login = await fetch(origin + "/login?callbackUrl=%2Fpartners%2Fapply");
  assert.equal(login.status, 200);
  assert.ok((await login.text()).includes("Sign"));
  console.log(
    "PASS packaged production runtime starts, application redirects through login with return URL, login renders, and both partner APIs reject anonymous access",
  );
  console.log(
    "Scope: synthetic authentication secrets and deliberately unreachable database; hosted login, health and payment acceptance require authorized deployment.",
  );
} catch (error) {
  console.error(diagnostics);
  throw error;
} finally {
  // The runtime wrapper starts a server child; stop only this owned process group.
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    /* Already exited. */
  }
}
