const path = require("node:path");
const { spawnSync } = require("node:child_process");

const target = process.env.USECLEVR_SERVER_TARGET || process.env.SERVER_TARGET || "local";
const port = process.env.PORT || "8080";

process.env.NEXT_TELEMETRY_DISABLED ||= "1";
process.env.AUTH_SECRET ||= process.env.NEXTAUTH_SECRET || "";
process.env.AUTH_TRUST_HOST ||= "true";
process.env.PORT = port;

if (target === "railway") {
  process.env.AUTH_URL ||= process.env.NEXTAUTH_URL || "";
  process.env.HOSTNAME = "0.0.0.0";
} else if (target === "vercel") {
  if (!process.env.AUTH_URL && !process.env.NEXTAUTH_URL && process.env.VERCEL_URL) {
    process.env.AUTH_URL = `https://${process.env.VERCEL_URL}`;
  } else {
    process.env.AUTH_URL ||= process.env.NEXTAUTH_URL || "";
  }
  process.env.HOSTNAME = "0.0.0.0";
} else {
  process.env.AUTH_URL ||= process.env.NEXTAUTH_URL || `http://localhost:${port}`;
  process.env.HOSTNAME ||= "127.0.0.1";
}

const fs = require("node:fs");

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
  console.error("Could not find a generated Next standalone server. Run the production build first.");
  process.exit(1);
}

const result = spawnSync(process.execPath, [serverPath], {
  env: process.env,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
