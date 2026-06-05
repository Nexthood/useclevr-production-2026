#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";

import { changelogPath, packagePath } from "./lib/app-config.js";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const bumpArg = args.find((arg) => ["patch", "minor", "major"].includes(arg));

const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
const changelog = readFileSync(changelogPath, "utf8");
const lines = changelog.split("\n");
const unreleasedIndex = lines.findIndex((line) => /^##\s+\[Unreleased\]/i.test(line));

if (unreleasedIndex === -1) {
  console.error('CHANGELOG.md must include "## [Unreleased]".');
  process.exit(1);
}

let nextHeadingIndex = lines.length;
for (let index = unreleasedIndex + 1; index < lines.length; index += 1) {
  if (/^##\s/.test(lines[index])) {
    nextHeadingIndex = index;
    break;
  }
}

const unreleasedBody = lines.slice(unreleasedIndex + 1, nextHeadingIndex);
if (!unreleasedBody.some((line) => line.trim().startsWith("- "))) {
  console.error('CHANGELOG.md "## [Unreleased]" has no release entries.');
  process.exit(1);
}

const bump =
  bumpArg || (/^###\s+(Added|Changed)\b/im.test(unreleasedBody.join("\n")) ? "minor" : "patch");
const [major, minor, patch] = packageJson.version.split(".").map(Number);
const nextVersion =
  bump === "major"
    ? `${major + 1}.0.0`
    : bump === "minor"
      ? `${major}.${minor + 1}.0`
      : `${major}.${minor}.${patch + 1}`;

const date = new Date().toISOString().slice(0, 10);
const releasedHeading = `## [${nextVersion}] - ${date}`;
const nextLines = [
  ...lines.slice(0, unreleasedIndex),
  "## [Unreleased]",
  "",
  releasedHeading,
  ...unreleasedBody,
  ...lines.slice(nextHeadingIndex),
];

if (dryRun) {
  console.log(`Next version: ${nextVersion}`);
  process.exit(0);
}

packageJson.version = nextVersion;
writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
writeFileSync(changelogPath, nextLines.join("\n"));
console.log(`Released ${nextVersion}.`);
