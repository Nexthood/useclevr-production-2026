const { readFileSync } = require("node:fs");
const { execFileSync } = require("node:child_process");

const { packagePath } = require("../lib/app-config.cjs");

const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
const version = pkg.version;
const tag = `v${version}`;

if (!version) {
  console.error("package.json is missing a version.");
  process.exit(1);
}

try {
  execFileSync("git", ["rev-parse", "--verify", tag], { stdio: "ignore" });
  console.error(`Tag ${tag} already exists.`);
  process.exit(1);
} catch {
  // Missing tag is expected.
}

execFileSync("git", ["tag", "-a", tag, "-m", tag], { stdio: "inherit" });
console.log(`Created ${tag}.`);
