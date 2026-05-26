#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs"

import { licensePath, packagePath } from "./lib/app-config.js"

const packageJson = JSON.parse(readFileSync(packagePath, "utf8"))

if (packageJson.private && !packageJson.license) {
  console.log("License metadata is valid for a private package.")
  process.exit(0)
}

if (!packageJson.license) {
  console.error("package.json must declare a license for public packages.")
  process.exit(1)
}

if (!existsSync(licensePath)) {
  console.error("package.json declares a license, but LICENSE is missing.")
  process.exit(1)
}

const licenseText = readFileSync(licensePath, "utf8").trim()
if (!licenseText) {
  console.error("LICENSE must not be empty.")
  process.exit(1)
}

console.log("License metadata is valid.")
