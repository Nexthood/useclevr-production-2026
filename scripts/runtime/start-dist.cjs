const path = require("node:path");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");

const port = process.env.PORT || "8080";
const serverTarget = process.env.USECLEVR_SERVER_TARGET || process.env.SERVER_TARGET || "";

process.env.NEXT_TELEMETRY_DISABLED ||= "1";
process.env.AUTH_SECRET ||= process.env.NEXTAUTH_SECRET || "";
process.env.AUTH_TRUST_HOST ||= "true";
process.env.PORT = port;

if (process.env.RAILWAY_ENVIRONMENT_ID || serverTarget === "railway") {
  if (process.env.USECLEVR_AUTH_URL_STRICT !== "true") {
    delete process.env.AUTH_URL;
    delete process.env.NEXTAUTH_URL;
  } else {
    process.env.AUTH_URL ||= process.env.NEXTAUTH_URL || "";
  }
  process.env.HOSTNAME = "0.0.0.0";
} else if (process.env.VERCEL || serverTarget === "vercel") {
  if (!process.env.AUTH_URL && !process.env.NEXTAUTH_URL && process.env.VERCEL_URL) {
    process.env.AUTH_URL = `https://${process.env.VERCEL_URL}`;
  } else {
    process.env.AUTH_URL ||= process.env.NEXTAUTH_URL || "";
  }
  process.env.HOSTNAME = "0.0.0.0";
} else {
  const localAuthUrl = `http://localhost:${port}`;
  if (!isLocalHttpUrl(process.env.AUTH_URL) && !isLocalHttpUrl(process.env.NEXTAUTH_URL)) {
    process.env.AUTH_URL = localAuthUrl;
    process.env.NEXTAUTH_URL = localAuthUrl;
  } else {
    process.env.AUTH_URL ||= process.env.NEXTAUTH_URL || localAuthUrl;
    process.env.NEXTAUTH_URL ||= process.env.AUTH_URL;
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
