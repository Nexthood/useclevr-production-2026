import { spawn } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readdirSync, realpathSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { chatGptTestProcessEnvironment, testDatabases, testDatabaseUrl } from "./chatgpt-test-environment.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const requested = process.argv[2] || "all";
if (!["all", ...Object.keys(testDatabases)].includes(requested) || process.argv.length > 3) {
  throw new Error("Usage: node scripts/analysis/run-chatgpt-tests.mjs [all|oauth|mcp]");
}

// Explicit allowlist: no .env loader, PG* overrides, NODE_OPTIONS, cloud keys or
// inherited DATABASE_URL/DIRECT_URL can reach PostgreSQL or application imports.
const environment = chatGptTestProcessEnvironment();
for (const key of Object.keys(process.env)) {
  if (key.startsWith("PG")) delete process.env[key];
}
const postgresRoots = existsSync("/usr/lib/postgresql")
  ? readdirSync("/usr/lib/postgresql").sort((a, b) => Number(b) - Number(a)).map((version) => `/usr/lib/postgresql/${version}/bin`)
  : [];
const postgresBin = [...postgresRoots, ...environment.PATH.split(path.delimiter)].find((candidate) =>
  ["initdb", "pg_ctl"].every((binary) => existsSync(path.join(candidate, binary))));
if (process.getuid?.() === 0) throw new Error("Run the disposable PostgreSQL tests as an unprivileged user");

const directory = mkdtempSync(path.join(environment.TMPDIR, "useclevr-chatgpt-"));
const data = path.join(directory, "data");
const socket = path.join(directory, "socket");
mkdirSync(socket, { mode: 0o700 });
writeFileSync(path.join(directory, "runner-owned"), "UseClevr disposable ChatGPT tests\n", { mode: 0o600 });
let activeChild;
let started = false;
let interrupted = false;
const containerName = `useclevr-chatgpt-${randomBytes(12).toString("hex")}`;
const dockerArgs = ["--host", "unix:///var/run/docker.sock"];
let containerAttempted = false;

function command(binary, args, env = environment, quiet = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { cwd: root, env, stdio: quiet ? "ignore" : "inherit" });
    activeChild = child;
    const timeout = setTimeout(() => child.kill("SIGTERM"), 120_000);
    child.on("error", (error) => { clearTimeout(timeout); reject(error); });
    child.on("exit", (code, signal) => {
      clearTimeout(timeout);
      activeChild = undefined;
      if (code === 0) resolve();
      else reject(new Error(`${path.basename(binary)} failed (${signal || code})`));
    });
  });
}
const onSignal = () => { interrupted = true; process.exitCode = 1; activeChild?.kill("SIGTERM"); };
process.on("SIGINT", onSignal);
process.on("SIGTERM", onSignal);

try {
  await command(process.execPath, ["--test", "scripts/analysis/test-chatgpt-test-safety.mjs"]);
  if (postgresBin) {
    await command(path.join(postgresBin, "initdb"), ["-D", data, "-U", "useclevr_test", "-A", "trust", "--no-locale", "--encoding=UTF8"], environment, true);
    // No TCP listener; the directory and socket are accessible only to this user.
    await command(path.join(postgresBin, "pg_ctl"), ["-D", data, "-l", path.join(directory, "postgres.log"), "-o", `-F -h '' -k ${socket} -c unix_socket_permissions=0700`, "-w", "start"], environment, true);
  } else {
    // Use only the local daemon and this newly created directory. No published
    // ports, external network, existing volumes or inherited Docker context.
    containerAttempted = true;
    await command("docker", [...dockerArgs, "run", "--detach", "--name", containerName,
      "--network", "none", "--user", `${process.getuid()}:${process.getgid()}`,
      "--mount", `type=bind,src=${directory},dst=/work`,
      "--mount", `type=bind,src=${socket},dst=/var/run/postgresql`,
      "--env", "PGDATA=/work/data", "--env", "POSTGRES_USER=useclevr_test",
      "--env", "POSTGRES_HOST_AUTH_METHOD=trust", "postgres:17-bookworm",
      "postgres", "-h", "", "-k", "/var/run/postgresql", "-c", "unix_socket_permissions=0700"], environment, true);
    try {
      // The image briefly starts a bootstrap server. Wait for PID 1 to exec the
      // final server before opening clients, so its restart cannot race tests.
      await command("docker", [...dockerArgs, "exec", containerName, "sh", "-c",
        'attempt=0; while [ "$attempt" -lt 300 ]; do if [ "$(cat /proc/1/comm)" = postgres ] && pg_isready -q -h /var/run/postgresql -U useclevr_test; then exit 0; fi; attempt=$((attempt + 1)); sleep 0.1; done; exit 1'], environment, true);
    } catch {
      await command("docker", [...dockerArgs, "logs", containerName], environment);
      throw new Error("Disposable PostgreSQL did not become ready");
    }
  }
  started = true;
  // The image initializes its standard socket directory as 2775. Restore the
  // private host directory permission before any application client is started.
  chmodSync(socket, 0o700);
  for (const suite of requested === "all" ? Object.keys(testDatabases) : [requested]) {
    if (interrupted) throw new Error("ChatGPT tests interrupted");
    const admin = new Pool({ host: socket, port: 5432, user: "useclevr_test", database: "postgres", ssl: false });
    try {
      await admin.query(`CREATE DATABASE "${testDatabases[suite]}"`);
    } finally {
      await admin.end();
    }
    console.log(`ChatGPT ${suite}: fresh disposable PostgreSQL database; external credentials excluded.`);
    const url = testDatabaseUrl(directory, suite);
    await command(process.execPath, ["--experimental-test-module-mocks", "--import", "tsx", `scripts/analysis/test-chatgpt-${suite === "oauth" ? "oauth-flow" : "mcp-integration"}.ts`], {
      ...environment,
      NODE_ENV: "test",
      DATABASE_URL: url,
      DIRECT_URL: url,
      NEON_USE_SERVERLESS: "false",
      NEON_USE_WS_POOL: "false",
      AUTH_SECRET: randomBytes(48).toString("base64url"),
      AUTH_TRUST_HOST: "true",
      AUTH_URL: "https://app.useclevr.com",
      NEXTAUTH_URL: "https://app.useclevr.com",
      CHATGPT_TEST_RUN_DIRECTORY: directory,
      CHATGPT_TEST_SUITE: suite,
    });
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "ChatGPT test runner failed");
  process.exitCode = 1;
} finally {
  // Stop even after a partially successful start. Never remove a running cluster.
  if (containerAttempted) {
    try {
      await command("docker", [...dockerArgs, "rm", "--force", containerName], environment, true);
      started = false;
    } catch {
      started = true;
      process.exitCode = 1;
      console.error("Disposable container cleanup failed; retain its temporary directory for inspection.");
    }
  } else if (started || existsSync(path.join(data, "postmaster.pid"))) {
    try {
      await command(path.join(postgresBin, "pg_ctl"), ["-D", data, "-m", "immediate", "-w", "stop"], environment, true);
      started = false;
    } catch {
      started = true;
      process.exitCode = 1;
      console.error("Disposable PostgreSQL shutdown failed; retain the temporary cluster for inspection.");
    }
  }
  if (!started) rmSync(directory, { recursive: true, force: true });
  process.off("SIGINT", onSignal);
  process.off("SIGTERM", onSignal);
}
