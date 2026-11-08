import { execFileSync, spawn } from "node:child_process";
import { Pool } from "pg";
import { randomBytes } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  statfsSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

// An isolated source copy prevents Next from loading repository .env files.
// This script accepts no external database or provider configuration.
const retry = process.argv[2] === "--retry-regression";
const regression = process.argv[2] === "--regression" || retry;
if (process.argv.length !== (retry ? 4 : regression ? 3 : 2))
  throw new Error("Safe build accepts --regression or --retry-regression <snapshot>");
const root = fileURLToPath(new URL("../../", import.meta.url));
// Prefer disk-backed snapshots. A constrained checkout can use the writable system
// temporary directory without deleting existing artifacts or sharing dependency files.
const space = statfsSync(root);
const buildDirectory =
  space.bavail * space.bsize >= 4 * 1024 ** 3 ? path.join(root, "build") : os.tmpdir();
mkdirSync(buildDirectory, { recursive: true });
const destination = retry
  ? path.resolve(process.argv[3])
  : mkdtempSync(path.join(buildDirectory, "partner-validation-"));
if (
  retry &&
  (!path.basename(destination).startsWith("partner-validation-") ||
    !existsSync(path.join(destination, "safe-build-manifest.json")))
)
  throw new Error("Retry requires a runner-owned snapshot");
const previousResults = retry
  ? JSON.parse(readFileSync(path.join(destination, "regression-results.json"), "utf8"))
  : null;
const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { cwd: root, encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean);
const exampleFiles = new Set([".env.railway.example", ".env.local.example"]);
const directories = new Set([
  "src",
  "scripts",
  "public",
  "data-config",
  "dist-root",
  ".github",
  "docs",
  ".TODO",
  "project-prompts",
  "project-logs",
  "test-fixtures",
]);
for (const file of files) {
  if (retry && !file.startsWith("test-fixtures/") && !exampleFiles.has(file)) continue;
  const parts = file.split("/");
  if (
    parts.some(
      (p) =>
        (p.startsWith(".env") && !exampleFiles.has(p)) ||
        ["node_modules", "dist", ".next", ".git", ".railway"].includes(p),
    )
  )
    continue;
  if (parts.length > 1 && !directories.has(parts[0])) continue;
  if (
    (/\.(csv|log|pem|key)$/i.test(file) &&
      !(
        (file.startsWith("test-fixtures/") ||
          (file.startsWith("scripts/") && file.includes("/fixtures/"))) &&
        file.endsWith(".csv")
      )) ||
    ["pnpm-lock.yaml", "package-lock.json"].includes(file)
  )
    continue;
  if (!existsSync(path.join(root, file))) continue;
  mkdirSync(path.dirname(path.join(destination, file)), { recursive: true });
  copyFileSync(path.join(root, file), path.join(destination, file));
}
// Keep dependency realpaths inside the snapshot so standalone tracing and
// packaging cannot resolve back into the shared workspace dependency tree.
if (!retry)
  execFileSync(
    "cp",
    [
      "-a",
      "--reflink=auto",
      path.join(root, "node_modules"),
      path.join(destination, "node_modules"),
    ],
    { stdio: "inherit" },
  );
const environment = {
  PATH: process.env.PATH || "/usr/bin:/bin",
  HOME: os.homedir(),
  TMPDIR: destination,
  LANG: "C.UTF-8",
  CI: "true",
  NEXT_TELEMETRY_DISABLED: "1",
  DATABASE_URL: "postgresql://local_build@127.0.0.1:1/local_build",
  DIRECT_URL: "postgresql://local_build@127.0.0.1:1/local_build",
  AUTH_SECRET: randomBytes(48).toString("base64url"),
  PAYLOAD_SECRET: randomBytes(48).toString("base64url"),
  AUTH_URL: "http://localhost:3000",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  AUTH_TRUST_HOST: "true",
  PARTNER_PROGRAM_ENABLED: "false",
  NODE_OPTIONS: "--max-old-space-size=4096",
};
if (!retry)
  writeFileSync(
    path.join(destination, "safe-build-manifest.json"),
    JSON.stringify(
      {
        source: root,
        destination,
        environmentKeys: Object.keys(environment),
        database: "unreachable loopback port 1",
        partnerProgram: "disabled",
      },
      null,
      2,
    ),
  );
console.log(`Safe source snapshot: ${destination}`);
console.log(
  "Build uses synthetic authentication, unreachable loopback databases, and no inherited provider credentials.",
);
async function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: destination, env: environment, stdio: "inherit" });
    child.on("error", (error) => {
      console.error(error.message);
      resolve(1);
    });
    child.on("exit", (code, signal) => {
      if (signal) console.error(`Isolated command terminated by ${signal}`);
      resolve(code === 0 && !signal ? 0 : code || 1);
    });
  });
}
let regressionFailures = [];
if (regression) {
  // A dedicated new database on the fixed disposable fixture supports regression
  // suites that need public-schema foreign keys. No caller can supply a target.
  delete environment.AUTH_URL;
  delete environment.NEXT_PUBLIC_APP_URL;
  const fixture = "postgresql://postgres@127.0.0.1:55438/partner_tests";
  const dbName = `partner_regression_${randomBytes(8).toString("hex")}`;
  const pool = new Pool({ connectionString: fixture });
  await pool.query(`CREATE DATABASE "${dbName}"`);
  await pool.end();
  const regressionUrl = `postgresql://postgres@127.0.0.1:55438/${dbName}`;
  environment.DATABASE_URL = regressionUrl;
  environment.DIRECT_URL = regressionUrl;
  environment.NEON_USE_SERVERLESS = "false";
  environment.NEON_USE_WS_POOL = "false";
  const manifest = JSON.parse(
    await (
      await import("node:fs/promises")
    ).readFile(path.join(destination, "package.json"), "utf8"),
  );
  // Execute every declared suite sequentially, retaining every failure. Provider
  // credentials and repository .env files never enter the snapshot or child env.
  const commands = retry
    ? previousResults.failures.map((script) => `pnpm ${script}`)
    : manifest.scripts["test:all"].split(" && ");
  for (const command of commands) {
    if (!/^pnpm test:[a-z0-9-]+$/.test(command))
      throw new Error("Review regression command format");
    const script = command.slice(5);
    console.log(`Isolated regression: ${script}`);
    if ((await run("pnpm", ["--config.verify-deps-before-run=false", script])) !== 0)
      regressionFailures.push(script);
  }
  console.log(`Regression failures: ${JSON.stringify(regressionFailures)}`);
  writeFileSync(
    path.join(destination, "regression-results.json"),
    JSON.stringify(
      {
        totalSuites: manifest.scripts["test:all"].split(" && ").length,
        initialFailures:
          previousResults?.initialFailures || previousResults?.failures || regressionFailures,
        failures: regressionFailures,
      },
      null,
      2,
    ),
  );
}
if (retry) process.exit(regressionFailures.length ? 1 : 0);
// Compilation must never connect even to the regression fixture.
environment.AUTH_URL = "http://localhost:3000";
environment.NEXT_PUBLIC_APP_URL = environment.AUTH_URL;
environment.DATABASE_URL = "postgresql://local_build@127.0.0.1:1/local_build";
environment.DIRECT_URL = environment.DATABASE_URL;
const buildCode = await run("pnpm", ["--config.verify-deps-before-run=false", "build"]);
const packagingCode =
  buildCode === 0 ? await run(process.execPath, ["scripts/package-dist/create-dist.cjs"]) : 1;
process.exitCode = buildCode || packagingCode || (regressionFailures.length ? 1 : 0);
