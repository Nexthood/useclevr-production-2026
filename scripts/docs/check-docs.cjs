const { existsSync, readFileSync } = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const files = execFileSync("git", ["ls-files", "*.md"], { encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

let failed = false;
const localLinkPattern = /\[[^\]]+\]\((?!https?:|mailto:|#)([^)]+)\)/g;

for (const file of files) {
  const text = readFileSync(file, "utf8");
  let match;

  while ((match = localLinkPattern.exec(text))) {
    const target = match[1].split("#")[0];
    if (!target) continue;

    const resolved = path.resolve(
      path.dirname(file),
      decodeURIComponent(target),
    );
    if (!existsSync(resolved)) {
      console.error(`${file}: broken local link -> ${match[1]}`);
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log(`Checked ${files.length} markdown files.`);
