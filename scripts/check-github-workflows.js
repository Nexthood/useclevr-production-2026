#!/usr/bin/env node

import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import process from "node:process"
import yaml from "js-yaml"

const root = process.cwd()
const workflowsDir = path.join(root, ".github", "workflows")
const allowedActions = new Map([
  ["actions/checkout", new Set(["v5"])],
  ["actions/setup-node", new Set(["v5"])],
  ["actions/github-script", new Set(["v8"])],
])
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

    if (action === "pnpm/action-setup") {
      errors.push(`${fileName}: do not use ${actionRef}; activate pnpm with Corepack instead`)
      return
    }

    const allowedRefs = allowedActions.get(action)
    if (!allowedRefs) {
      errors.push(`${fileName}: unapproved action ${actionRef}; add it to the workflow allowlist after review`)
      return
    }

    if (!allowedRefs.has(ref)) {
      errors.push(`${fileName}: unapproved ${action} ref ${ref || "(missing)"}; allowed refs: ${[...allowedRefs].join(", ")}`)
    }
  })

  if (source.includes("pnpm install") && !source.includes("corepack prepare pnpm@11.1.2 --activate")) {
    errors.push(`${fileName}: pnpm install requires a preceding Corepack activation step`)
  }
}

if (errors.length > 0) {
  console.error("GitHub workflow health check failed:")
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log("GitHub workflow health check passed.")
