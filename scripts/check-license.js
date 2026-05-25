#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const licensePath = path.join(root, "LICENSE");

if (!packageJson.private && !packageJson.license) {
  console.error("package.json must declare a license for public packages.");
  process.exit(1);
}

if (packageJson.license && !existsSync(licensePath)) {
  console.error("package.json declares a license, but LICENSE is missing.");
  process.exit(1);
}

console.log("License metadata is valid.");
