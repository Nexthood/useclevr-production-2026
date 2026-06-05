#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { repoRelative, rootDir } from "./lib/app-config.js";

const ignoredDirectories = new Set([
  ".cache",
  ".git",
  ".next",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "tmp",
]);

const ignoredFileNames = new Set(["package-lock.json", "pnpm-lock.yaml"]);

const textExtensions = new Set([
  ".cjs",
  ".css",
  ".csv",
  ".env.example",
  ".html",
  ".js",
  ".json",
  ".jsonc",
  ".md",
  ".mjs",
  ".sql",
  ".svg",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

const credentialAssignment =
  String.raw`(?<![A-Za-z])(?:api[_ -]?key|apikey|token|secret|password|private[_ -]?key)(?![A-Za-z])` +
  String.raw`\s*[:=]\s*["']?(?!<|\$\{|process\.env\b)([A-Za-z0-9_./+=-]{20,})`;

const checks = [
  {
    name: "Google API key",
    pattern: new RegExp("AI" + "za[0-9A-Za-z_-]{20,}", "g"),
  },
  {
    name: "GitHub token",
    pattern: new RegExp("(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]{20,}", "g"),
  },
  {
    name: "Stripe secret key",
    pattern: new RegExp("s" + "k_(?:live|test)_[A-Za-z0-9_]{12,}", "g"),
  },
  {
    name: "Stripe restricted key",
    pattern: new RegExp("r" + "k_(?:live|test)_[A-Za-z0-9_]{12,}", "g"),
  },
  {
    name: "webhook secret",
    pattern: new RegExp("w" + "hsec_[A-Za-z0-9_]{12,}", "g"),
  },
  {
    name: "credential assignment",
    pattern: new RegExp(credentialAssignment, "gi"),
  },
  {
    name: "token-like UUID",
    pattern:
      /\b(?=.*(?:api|key|secret|token|railway))[^\n]*\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
  },
];

function isIgnoredPath(filePath) {
  const relativePath = repoRelative(filePath);
  const segments = relativePath.split("/");
  const fileName = segments.at(-1) || "";

  if (ignoredFileNames.has(fileName)) return true;
  if (fileName.startsWith(".env")) return true;

  return segments.some((segment) => ignoredDirectories.has(segment));
}

function isTextFile(filePath) {
  const fileName = path.basename(filePath);
  if (fileName === "AGENTS.md" || fileName === "CHANGELOG.md" || fileName === "SECURITY.md") {
    return true;
  }
  if (fileName.startsWith(".") && !fileName.endsWith(".md") && !fileName.endsWith(".json")) {
    return false;
  }

  const extension = path.extname(filePath);
  if (textExtensions.has(extension)) return true;

  return [...textExtensions].some((suffix) => fileName.endsWith(suffix));
}

function collectFiles(directory) {
  const files = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (isIgnoredPath(filePath)) continue;

    if (entry.isDirectory()) {
      files.push(...collectFiles(filePath));
      continue;
    }

    if (entry.isFile() && isTextFile(filePath)) {
      files.push(filePath);
    }
  }

  return files;
}

function isAllowedLine(line) {
  return (
    /<[^>\s]+>/.test(line) ||
    /\$\{[^}]+}/.test(line) ||
    /process\.env\./.test(line) ||
    /\.\.\./.test(line)
  );
}

function redact(value) {
  const trimmed = value.trim();
  if (trimmed.length <= 8) return "[redacted]";
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

function scanFile(filePath) {
  const content = readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  const findings = [];

  lines.forEach((line, index) => {
    if (isAllowedLine(line)) return;

    for (const check of checks) {
      check.pattern.lastIndex = 0;
      const matches = line.matchAll(check.pattern);
      for (const match of matches) {
        findings.push({
          filePath,
          line: index + 1,
          name: check.name,
          sample: redact(match[1] || match[0]),
        });
      }
    }
  });

  return findings;
}

const findings = [];

for (const filePath of collectFiles(rootDir)) {
  const stats = statSync(filePath);
  if (stats.size > 1_000_000) continue;
  findings.push(...scanFile(filePath));
}

if (findings.length > 0) {
  console.error("Secret leak check failed. Replace real credentials with placeholders.");
  for (const finding of findings) {
    console.error(
      `- ${repoRelative(finding.filePath)}:${finding.line} ${finding.name} (${finding.sample})`,
    );
  }
  process.exit(1);
}

console.log("Secret leak check passed.");
