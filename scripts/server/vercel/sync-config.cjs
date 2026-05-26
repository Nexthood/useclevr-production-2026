const fs = require("node:fs");

const { resolveRepoPath } = require("../../lib/app-config.cjs");

const from = resolveRepoPath("dist-root", "server-config", "vercel.json");
const to = resolveRepoPath("vercel.json");
const checkOnly = process.argv.includes("--check");

if (!fs.existsSync(from)) {
  throw new Error("Missing dist-root/server-config/vercel.json");
}

if (checkOnly) {
  JSON.parse(fs.readFileSync(from, "utf8"));

  if (!fs.existsSync(to)) {
    throw new Error("vercel.json is missing. Run pnpm deploy:vercel:sync.");
  }

  if (fs.readFileSync(from, "utf8") !== fs.readFileSync(to, "utf8")) {
    throw new Error("vercel.json is out of sync with dist-root/server-config/vercel.json");
  }

  console.log("vercel.json is in sync");
  process.exit(0);
}

fs.copyFileSync(from, to);

console.log("Synced vercel.json");
