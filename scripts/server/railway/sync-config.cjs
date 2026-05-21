const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const from = path.join(root, "dist-root", "server-settings", "railway", "railway.dist.json");
const toDir = path.join(root, "dist");
const to = path.join(toDir, "railway.json");
const checkOnly = process.argv.includes("--check");

if (!fs.existsSync(from)) {
  throw new Error("Missing dist-root/server-settings/railway/railway.dist.json");
}

if (checkOnly) {
  if (!fs.existsSync(to)) {
    JSON.parse(fs.readFileSync(from, "utf8"));
    console.log("dist-root/server-settings/railway/railway.dist.json is valid; dist/railway.json is generated");
    process.exit(0);
  }

  if (fs.readFileSync(from, "utf8") !== fs.readFileSync(to, "utf8")) {
    throw new Error("dist/railway.json is out of sync with dist-root/server-settings/railway/railway.dist.json");
  }

  console.log("dist/railway.json is in sync");
  process.exit(0);
}

fs.mkdirSync(toDir, { recursive: true });
fs.copyFileSync(from, to);

console.log("Synced dist/railway.json");
