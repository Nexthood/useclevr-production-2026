const path = require("node:path");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");

function assertNextDistBuild(nextDir) {
  const requiredFiles = [
    path.join(nextDir, "dist", "build", "output", "log.js"),
    path.join(nextDir, "dist", "build", "next-config-ts", "transpile-config.js"),
  ];
  const missingFiles = requiredFiles.filter((requiredFile) => !fs.existsSync(requiredFile));
  if (missingFiles.length > 0) {
    console.error(
      `Packaged Next.js runtime is incomplete: ${missingFiles
        .map((missingFile) => path.relative(process.cwd(), missingFile))
        .join(", ")}`,
    );
    process.exit(1);
  }
}

function validateNextBuildRuntime() {
  const cwd = process.cwd();
  const nmDir = path.join(cwd, "node_modules");
  if (!fs.existsSync(nmDir)) return;
  // pnpm: check .pnpm/next@*/node_modules/next/
  const pnpmDir = path.join(nmDir, ".pnpm");
  if (fs.existsSync(pnpmDir)) {
    for (const entry of fs.readdirSync(pnpmDir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.startsWith("next@")) {
        assertNextDistBuild(path.join(pnpmDir, entry.name, "node_modules", "next"));
      }
    }
  }
  // flat: check next/ directly
  const flatNext = path.join(nmDir, "next");
  if (fs.existsSync(path.join(flatNext, "package.json"))) {
    assertNextDistBuild(flatNext);
  }
}

validateNextBuildRuntime();

const port = process.env.PORT || "8080";
const serverTarget = process.env.USECLEVR_SERVER_TARGET || process.env.SERVER_TARGET || "";

process.env.NEXT_TELEMETRY_DISABLED ||= "1";
process.env.AUTH_TRUST_HOST ||= "true";
process.env.PORT = port;

if (process.env.RAILWAY_ENVIRONMENT_ID || serverTarget === "railway") {
  if (process.env.USECLEVR_AUTH_URL_STRICT !== "true") {
    delete process.env.AUTH_URL;
  }
  process.env.HOSTNAME = "0.0.0.0";
} else if (process.env.VERCEL || serverTarget === "vercel") {
  if (!process.env.AUTH_URL && process.env.VERCEL_URL) {
    process.env.AUTH_URL = `https://${process.env.VERCEL_URL}`;
  }
  process.env.HOSTNAME = "0.0.0.0";
} else {
  const localAuthUrl = `http://localhost:${port}`;
  if (!isLocalHttpUrl(process.env.AUTH_URL)) {
    process.env.AUTH_URL = localAuthUrl;
  } else {
    process.env.AUTH_URL ||= localAuthUrl;
  }
  process.env.HOSTNAME ||= "127.0.0.1";
}

function isLocalHttpUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "http:" && ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

const nextBuildDir = path.join(process.cwd(), ".next");
const nextBuildRestoreDir = path.join(process.cwd(), "next-build");
if (!fs.existsSync(nextBuildDir) && fs.existsSync(nextBuildRestoreDir)) {
  fs.cpSync(nextBuildRestoreDir, nextBuildDir, { recursive: true });
}

const serverCandidates = [
  path.join(process.cwd(), "server.js"),
  path.join(process.cwd(), "dist", "server.js"),
  path.join(process.cwd(), ".next", "standalone", "server.js"),
];
const serverPath = serverCandidates.find((candidate) => fs.existsSync(candidate));

if (!serverPath) {
  console.error(
    "Could not find a generated Next standalone server. Run the production build first.",
  );
  process.exit(1);
}

const result = spawnSync(process.execPath, [serverPath], {
  env: process.env,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
