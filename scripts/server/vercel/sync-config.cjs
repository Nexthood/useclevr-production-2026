const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const from = path.join(root, "dist-root", "server-settings", "vercel", "vercel.source.json");
const to = path.join(root, "vercel.json");
const checkOnly = process.argv.includes("--check");

if (!fs.existsSync(from)) {
  throw new Error("Missing dist-root/server-settings/vercel/vercel.source.json");
}

if (checkOnly) {
  JSON.parse(fs.readFileSync(from, "utf8"));

  if (!fs.existsSync(to)) {
    throw new Error("vercel.json is missing. Run pnpm deploy:vercel:sync.");
  }

  if (fs.readFileSync(from, "utf8") !== fs.readFileSync(to, "utf8")) {
    throw new Error("vercel.json is out of sync with dist-root/server-settings/vercel/vercel.source.json");
  }

  console.log("vercel.json is in sync");
  process.exit(0);
}

fs.copyFileSync(from, to);

console.log("Synced vercel.json");
