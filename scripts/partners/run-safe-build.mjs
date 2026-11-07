import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

// An isolated source copy prevents Next from loading repository .env files.
// This script accepts no external database or provider configuration.
if (process.argv.length > 2) throw new Error("Safe build accepts no arguments");
const root = fileURLToPath(new URL("../../", import.meta.url));
// Use the ignored build directory rather than a memory-backed system /tmp.
const buildDirectory = path.join(root, "build");
mkdirSync(buildDirectory, { recursive: true });
const destination = mkdtempSync(path.join(buildDirectory, "partner-validation-"));
const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { cwd: root, encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean);
const directories = new Set(["src", "scripts", "public", "data-config", "dist-root"]);
for (const file of files) {
  const parts = file.split("/");
  if (
    parts.some(
      (p) =>
        p.startsWith(".env") || ["node_modules", "dist", ".next", ".git", ".railway"].includes(p),
    )
  )
    continue;
  if (parts.length > 1 && !directories.has(parts[0])) continue;
  if (/\.(csv|log|pem|key)$/i.test(file) || ["pnpm-lock.yaml", "package-lock.json"].includes(file))
    continue;
  if (!existsSync(path.join(root, file))) continue;
  mkdirSync(path.dirname(path.join(destination, file)), { recursive: true });
  copyFileSync(path.join(root, file), path.join(destination, file));
}
// Keep dependency realpaths inside the snapshot so standalone tracing and
// packaging cannot resolve back into the shared workspace dependency tree.
execFileSync(
  "cp",
  ["-a", "--reflink=auto", path.join(root, "node_modules"), path.join(destination, "node_modules")],
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
};
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
const child = spawn("pnpm", ["--config.verify-deps-before-run=false", "build"], {
  cwd: destination,
  env: environment,
  stdio: "inherit",
});
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  if (code !== 0 || signal) {
    if (signal) console.error(`Isolated build terminated by ${signal}`);
    process.exitCode = code || 1;
    return;
  }
  const packaging = spawn(process.execPath, ["scripts/package-dist/create-dist.cjs"], {
    cwd: destination,
    env: environment,
    stdio: "inherit",
  });
  packaging.on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  packaging.on("exit", (packagingCode, packagingSignal) => {
    if (packagingSignal) console.error(`Isolated packaging terminated by ${packagingSignal}`);
    process.exitCode = packagingCode === 0 && !packagingSignal ? 0 : packagingCode || 1;
  });
});
