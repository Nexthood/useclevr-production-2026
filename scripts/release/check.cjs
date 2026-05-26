const { existsSync, readFileSync } = require("node:fs");
const { execSync } = require("node:child_process");

const { changelogPath, packagePath } = require("../lib/app-config.cjs");

const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
const version = pkg.version;

if (!version) {
  console.error("package.json is missing a version.");
  process.exit(1);
}

if (!existsSync(changelogPath)) {
  console.error("CHANGELOG.md is missing.");
  process.exit(1);
}

const changelog = readFileSync(changelogPath, "utf8");
if (!changelog.includes("## [Unreleased]")) {
  console.error("CHANGELOG.md is missing an Unreleased section.");
  process.exit(1);
}

try {
  execSync("git rev-parse --is-inside-work-tree", { stdio: "ignore" });
} catch {
  console.error("Release checks must run inside a git repository.");
  process.exit(1);
}

console.log(`Release checks passed for v${version}.`);
