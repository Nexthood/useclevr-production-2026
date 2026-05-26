#!/usr/bin/env node

import { readdirSync, readFileSync } from "node:fs"
import process from "node:process"
import yaml from "js-yaml"

import { requiredPackageManager, resolveRepoPath, workflowsDir } from "./lib/app-config.js"

const allowedActions = new Map([
  ["actions/checkout", new Set(["v6"])],
  ["actions/setup-node", new Set(["v6"])],
  ["actions/github-script", new Set(["v9"])],
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
  const filePath = resolveRepoPath(".github", "workflows", fileName)
  const source = readFileSync(filePath, "utf-8")
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
      errors.push(`${fileName}: do not use ${actionRef}; activate pnpm with Corepack in a run step`)
      return
    }

    const allowedRefs = allowedActions.get(action)
    if (!allowedRefs) {
      errors.push(
        `${fileName}: unapproved action ${actionRef}; use approved GitHub-owned actions or add it to the workflow allowlist after review`,
      )
      return
    }

    if (!allowedRefs.has(ref)) {
      errors.push(`${fileName}: unapproved ${action} ref ${ref || "(missing)"}; allowed refs: ${[...allowedRefs].join(", ")}`)
    }
  })

  if (
    source.includes("pnpm install") &&
    !source.includes(`corepack prepare ${requiredPackageManager} --activate`)
  ) {
    errors.push(`${fileName}: pnpm install requires Corepack activation for ${requiredPackageManager}`)
  }

  if (workflow.jobs) {
    for (const jobId of Object.keys(workflow.jobs)) {
      if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(jobId) || jobId.length > 100) {
        errors.push(
          `${fileName}: invalid job ID '${jobId}'; must start with letter/underscore and contain only alphanumeric/_/- characters`,
        )
      }
    }
  }
}

if (errors.length > 0) {
  console.error("GitHub workflow health check failed:")
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log("GitHub workflow health check passed.")
