#!/usr/bin/env node

import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import process from "node:process"
import yaml from "js-yaml"

const root = process.cwd()
const workflowsDir = path.join(root, ".github", "workflows")
const allowedPnpmSetupRefs = new Set(["v6"])
const errors = []

function walk(value, visitor) {
  if (Array.isArray(value)) {
    value.forEach((item) => walk(item, visitor))
    return
  }

  if (!value || typeof value !== "object") return

  visitor(value)
  Object.values(value).forEach((item) => walk(item, visitor))
}

for (const fileName of readdirSync(workflowsDir).filter((file) => /\.ya?ml$/i.test(file))) {
  const filePath = path.join(workflowsDir, fileName)
  const source = readFileSync(filePath, "utf8")
  let workflow

  try {
    workflow = yaml.load(source)
  } catch (error) {
    errors.push(`${fileName}: invalid YAML (${error.message})`)
    continue
  }

  walk(workflow, (node) => {
    if (typeof node.uses !== "string") return

    const actionRef = node.uses.trim()
    const [action, ref = ""] = actionRef.split("@")

    if (action === "pnpm/action-setup" && !allowedPnpmSetupRefs.has(ref)) {
      errors.push(`${fileName}: use pnpm/action-setup@v6, found ${actionRef}`)
    }
  })
}

if (errors.length > 0) {
  console.error("GitHub workflow health check failed:")
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log("GitHub workflow health check passed.")
