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
  assert.equal(application.status, 200);
  assert.ok((await application.text()).includes("No customer account is required to apply."));
  const onboarding = await fetch(origin + "/partners/onboard?token=" + "a".repeat(43));
  assert.equal(onboarding.status, 200);
  const onboardingHtml = await onboarding.text();
  assert.ok(onboardingHtml.includes("Send verification code"));
  assert.ok(onboardingHtml.includes('name="referrer" content="no-referrer"'));
  const portal = await fetch(origin + "/partner", { redirect: "manual" });
  assert.equal(portal.status, 307);
  assert.equal(new URL(portal.headers.get("location"), origin).pathname, "/partner/login");
  const partnerLogin = await fetch(origin + "/partner/login", { redirect: "manual" });
  assert.equal(partnerLogin.status, 307);
  const loginLocation = new URL(partnerLogin.headers.get("location"), origin);
  assert.equal(loginLocation.pathname, "/login");
  assert.equal(loginLocation.searchParams.get("callbackUrl"), "/partner");
  for (const route of ["/api/partners", "/api/partners/profile", "/api/admin/partners"]) {
    const response = await fetch(origin + route);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, "Unauthorized");
  }
  const agreements = await fetch(origin + "/api/partners/contracts");
  assert.equal(agreements.status, 401);
  assert.equal((await agreements.json()).error, "Verify your invitation or sign in.");
  const login = await fetch(origin + "/login?callbackUrl=%2Fpartner");
  assert.equal(login.status, 200);
  assert.ok((await login.text()).includes("Sign"));
  const native = await fetch(origin + "/partners/sign");
  assert.equal(native.status, 200);
  const nativeHtml = await native.text();
  assert.ok(nativeHtml.includes("Sign your partner agreement"));
  assert.ok(nativeHtml.includes('name="referrer" content="no-referrer"'));
  const nativeApi = await fetch(origin + "/api/partners/contracts/native");
  assert.equal(nativeApi.status, 404);
  assert.equal((await nativeApi.json()).code, "contract_management_disabled");
  console.log(
    "PASS packaged runtime serves account-free applications and invitation verification, protects partner login returns, and rejects anonymous private API access",
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
