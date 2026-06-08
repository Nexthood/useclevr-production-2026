#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

const requiredPaths = [
  "CHANGELOG.md",
  "project-logs/interactive-log.md",
  "project-logs/activity-log.md",
  "project-prompts/README.md",
  "docs/AI-interaction/interaction-status.md",
];

const retiredPaths = [
  "docs/AI-interaction/prompt-library",
  "docs/AI-interaction/learning-traces/consolidated-interactions-log.md",
];

const missing = requiredPaths.filter((path) => !existsSync(path));
const retired = retiredPaths.filter((path) => existsSync(path));

if (missing.length > 0 || retired.length > 0) {
  if (missing.length > 0) {
    console.error(`Project record check failed. Missing: ${missing.join(", ")}`);
  }
  if (retired.length > 0) {
    console.error(`Project record check failed. Retired paths still exist: ${retired.join(", ")}`);
  }
  process.exit(1);
}

let stagedFiles = [];
try {
  stagedFiles = execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR"], {
    encoding: "utf8",
  })
    .split(/\r?\n/)
    .filter(Boolean);
} catch {
  console.error("Project record check failed. Unable to inspect staged files.");
  process.exit(1);
}

if (stagedFiles.length > 0) {
  const requiredStagedFiles = [
    "CHANGELOG.md",
    "project-logs/interactive-log.md",
    "project-logs/activity-log.md",
    "docs/AI-interaction/interaction-status.md",
  ];
  const staged = new Set(stagedFiles);
  const unstagedRecords = requiredStagedFiles.filter((path) => !staged.has(path));

  if (unstagedRecords.length > 0) {
    console.error("Pre-commit project record checklist failed.");
    console.error(`Stage updated records: ${unstagedRecords.join(", ")}`);
    process.exit(1);
  }
}

console.log("Project record checklist passed.");
