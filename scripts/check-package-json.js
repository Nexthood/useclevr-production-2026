#!/usr/bin/env node
import { readFileSync } from "node:fs";

import { packagePath, requiredPackageManager } from "./lib/app-config.js";

const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));

function fail(message) {
  console.error(`package.json lint failed: ${message}`);
  process.exit(1);
}

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be an object.`);
  }
}

function assertSortedKeys(object, label) {
  const keys = Object.keys(object);
  const sorted = [...keys].sort((a, b) => a.localeCompare(b));
  const firstMismatch = keys.find((key, index) => key !== sorted[index]);
  if (firstMismatch) {
    fail(`${label} keys must be alphabetically sorted; first mismatch is "${firstMismatch}".`);
  }
}

function assertScripts(requiredScripts) {
  assertObject(packageJson.scripts, "scripts");
  for (const script of requiredScripts) {
    if (!packageJson.scripts[script]) {
      fail(`missing required script "${script}".`);
    }
  }
}

assertObject(packageJson.scripts, "scripts");
assertObject(packageJson.dependencies, "dependencies");
assertObject(packageJson.devDependencies, "devDependencies");

if (packageJson.packageManager !== requiredPackageManager) {
  fail(`packageManager must be "${requiredPackageManager}".`);
}

assertScripts([
  "format",
  "format:check",
  "lint",
  "lint:changelog",
  "lint:commits",
  "lint:deps",
  "lint:docs",
  "lint:package",
  "lint:secrets",
  "lint:todos",
  "link:docs",
  "validate:precommit",
]);

assertSortedKeys(packageJson.dependencies, "dependencies");
assertSortedKeys(packageJson.devDependencies, "devDependencies");

if (packageJson.scripts["validate:precommit"].includes("lint:deps")) {
  fail(
    "validate:precommit must not include lint:deps because dependency freshness checks are external.",
  );
}

console.log("package.json is valid.");
