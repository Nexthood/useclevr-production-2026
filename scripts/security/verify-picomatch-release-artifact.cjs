#!/usr/bin/env node
// Verifies every picomatch copy inside the packaged dist/ release artifact
// contains the CVE-2026-112366 extglob ReDoS patch. Run after `pnpm prod:build`.
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");
const distDir = path.join(repoRoot, "dist");
const patchMarker = "isSelfRepeatingStarBranch";

if (!fs.existsSync(distDir)) {
  console.error("No dist/ found. Run `pnpm prod:build` before the artifact patch check.");
  process.exit(1);
}

const found = [];

function search(dir, depth) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true, encoding: "utf8" });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "picomatch") {
        const parseJs = path.join(full, "lib", "parse.js");
        if (fs.existsSync(parseJs)) {
          let real = full;
          try {
            real = fs.realpathSync(full);
          } catch {}
          found.push({ full, real, parseJs });
        }
      } else {
        search(full, depth + 1);
      }
    }
  }
}

search(distDir, 0);

if (found.length === 0) {
  console.log("No picomatch package is bundled in dist/. The artifact cannot carry the vulnerable copy.");
  process.exit(0);
}

const unpatched = [];
for (const item of found) {
  const source = fs.readFileSync(fs.realpathSync(item.parseJs), "utf8");
  const patched = source.includes(patchMarker);
  if (!patched) unpatched.push(item.real);
  console.log(
    `${patched ? "PATCHED" : "UNPATCHED"} ${item.real}`.concat(
      item.real !== item.full ? ` (via ${item.full})` : "",
    ),
  );
}

if (unpatched.length > 0) {
  console.error("\nArtifact check FAILED: unpatched picomatch copies in the release artifact.");
  process.exit(1);
}
console.log(`\nArtifact check PASSED: ${found.length} picomatch copy(ies) in dist/ carry the extglob ReDoS patch.`);
