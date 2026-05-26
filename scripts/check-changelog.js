#!/usr/bin/env node
import { readFileSync } from "node:fs"

import { changelogPath } from "./lib/app-config.js"

const lines = readFileSync(changelogPath, "utf8").split("\n")
const nowPattern = /^\s*-\s*now\b/i
const retrospectiveStartPattern =
  /^\s*-\s*(added|aligned|cleaned|disabled|fixed|hardened|migrated|optimized|replaced|restructured|updated|verified)\b/i
const passivePatterns = [
  /\bkept\b/i,
  /\bpreserved\b/i,
  /\bretained\b/i,
  /\bunchanged\b/i,
  /\bcontinued tracking\b/i,
  /\bremains\b/i,
  /\bstill\b/i,
]
let failed = false

const unreleasedStart = lines.findIndex((line) => line.startsWith("## [Unreleased]"))
const unreleasedEnd = lines.findIndex((line, index) => index > unreleasedStart && /^##\s+/.test(line))
const scanStart = unreleasedStart === -1 ? 0 : unreleasedStart + 1
const scanEnd = unreleasedEnd === -1 ? lines.length : unreleasedEnd

for (let index = scanStart; index < scanEnd; index += 1) {
  const line = lines[index]
  if (!line.trim().startsWith("-")) continue

  if (nowPattern.test(line)) {
    console.error(`CHANGELOG.md:${index + 1}: avoid entries starting with "now": ${line.trim()}`)
    failed = true
  }

  if (retrospectiveStartPattern.test(line)) {
    console.error(
      `CHANGELOG.md:${index + 1}: use present-action wording instead of retrospective phrasing: ${line.trim()}`,
    )
    failed = true
  }

  for (const pattern of passivePatterns) {
    if (pattern.test(line)) {
      console.error(`CHANGELOG.md:${index + 1}: avoid passive or retention wording: ${line.trim()}`)
      failed = true
    }
  }
}

if (failed) {
  console.error("\nChangelog entries must describe active changes.")
  process.exit(1)
}

console.log("Changelog wording is valid.")
