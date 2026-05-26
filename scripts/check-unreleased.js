#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs"

import { changelogPath } from "./lib/app-config.js"

if (!existsSync(changelogPath)) {
  console.error("CHANGELOG.md not found.")
  process.exit(1)
}

const lines = readFileSync(changelogPath, "utf8").split("\n")
const startIndex = lines.findIndex((line) => /^##\s+\[Unreleased\]/i.test(line))

if (startIndex === -1) {
  console.error('CHANGELOG.md must include "## [Unreleased]".')
  process.exit(1)
}

const body = []
for (let index = startIndex + 1; index < lines.length; index += 1) {
  if (/^##\s/.test(lines[index])) break
  body.push(lines[index])
}

const hasEntry = body.some((line) => line.trim().startsWith("- "))

if (!hasEntry) {
  console.error('CHANGELOG.md "## [Unreleased]" must include at least one bullet.')
  process.exit(1)
}

console.log("CHANGELOG.md has unreleased entries.")
