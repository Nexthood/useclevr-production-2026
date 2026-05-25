#!/usr/bin/env node
import { readFileSync } from "node:fs";

const lines = readFileSync("CHANGELOG.md", "utf8").split("\n");
const startIndex = lines.findIndex((line) => /^##\s+\[Unreleased\]/i.test(line));

if (startIndex === -1) {
  console.error('CHANGELOG.md must include "## [Unreleased]".');
  process.exit(1);
}

const body = [];
for (let index = startIndex + 1; index < lines.length; index += 1) {
  if (/^##\s/.test(lines[index])) break;
  body.push(lines[index]);
}

const hasEntry = body.some((line) => {
  const trimmed = line.trim();
  return trimmed.startsWith("- ");
});

if (!hasEntry) {
  console.error('CHANGELOG.md "## [Unreleased]" must include at least one bullet.');
  process.exit(1);
}

console.log("CHANGELOG.md has unreleased entries.");
