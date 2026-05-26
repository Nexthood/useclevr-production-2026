const fs = require("node:fs");

const { resolveRepoPath } = require("../../lib/app-config.cjs");

const from = resolveRepoPath("dist-root", "server-config", "railway.json");
const checkOnly = process.argv.includes("--check");

if (!fs.existsSync(from)) {
  throw new Error("Missing dist-root/server-config/railway.json");
}

JSON.parse(fs.readFileSync(from, "utf8"));

if (checkOnly) {
  console.log("dist-root/server-config/railway.json is valid");
  process.exit(0);
}

console.log("Railway config stays in dist-root/server-config/railway.json");
