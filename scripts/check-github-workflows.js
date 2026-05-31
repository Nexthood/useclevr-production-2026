#!/usr/bin/env node

import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import process from "node:process"
import yaml from "js-yaml"

import { requiredPackageManager, resolveRepoPath, workflowsDir } from "./lib/app-config.js"

const allowedActions = new Map([
  ["actions/checkout", new Set(["v6"])],
  ["actions/setup-node", new Set(["v6"])],
  ["actions/github-script", new Set(["v9"])],
])

const errors = []
const fixesApplied = []
const isFix = process.argv.includes("--fix")

const PACKAGE_MANAGER = "pnpm@11.5.0"

function walk(value, visitor) {
  if (Array.isArray(value)) {
    value.forEach((item) => walk(item, visitor))
    return
  }
  if (!value || typeof value !== "object") return
  visitor(value)
  Object.values(value).forEach((item) => walk(item, visitor))
}

function hasPackageManager(workflow) {
  let found = false
  walk(workflow, (node) => {
    if (typeof node.uses !== "string") return
    if (node.uses.trim() === "actions/setup-node@v6" && node.with?.["package-manager"]) {
      found = true
    }
  })
  return found
}

function fixWorkflow(source, fileName) {
  let workflow
  try {
    workflow = yaml.load(source)
  } catch {
    errors.push(`${fileName}: cannot auto-fix — invalid YAML`)
    return { fixed: null, modified: false }
  }

  let modified = false

  if (!workflow.jobs) {
    return { fixed: source, modified }
  }

  for (const jobId of Object.keys(workflow.jobs)) {
    const job = workflow.jobs[jobId]
    if (!job?.steps || !Array.isArray(job.steps)) continue

    let setupNodeIdx = -1
    let corepackIdx = -1

    for (let i = 0; i < job.steps.length; i++) {
      const step = job.steps[i]
      if (typeof step.uses === "string" && step.uses.trim() === "actions/setup-node@v6") {
        setupNodeIdx = i
        if (!step.with) {
          step.with = {}
          modified = true
        }
        if (!step.with["package-manager"]) {
          step.with["package-manager"] = PACKAGE_MANAGER
          modified = true
          fixesApplied.push(`${fileName} (job ${jobId}): added package-manager to setup-node`)
        }
      }
      const name = typeof step.name === "string" ? step.name.toLowerCase() : ""
      const run = typeof step.run === "string" ? step.run.toLowerCase() : ""
      if (
        name.includes("corepack") ||
        run.includes("corepack enable") ||
        run.includes("corepack prepare")
      ) {
        corepackIdx = i
      }
    }

    if (setupNodeIdx >= 0 && corepackIdx >= 0 && hasPackageManager(workflow)) {
      job.steps.splice(corepackIdx, 1)
      modified = true
      fixesApplied.push(`${fileName} (job ${jobId}): removed stale Corepack activation step`)
    }
  }

  if (!modified) {
    return { fixed: source, modified: false }
  }

  const dumped = yaml.dump(workflow, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false,
  })

  return { fixed: dumped, modified: true }
}

for (const fileName of readdirSync(workflowsDir).filter((file) => /\.ya?ml$/i.test(file))) {
  const filePath = resolveRepoPath(".github", "workflows", fileName)
  const source = readFileSync(filePath, "utf-8")

  let sourceToCheck = source

  if (isFix) {
    const { fixed, modified } = fixWorkflow(source, fileName)
    if (fixed !== null && modified) {
      writeFileSync(filePath, fixed, "utf-8")
      sourceToCheck = fixed
    }
    if (fixed === null) {
      continue
    }
  }

  let workflow
  try {
    workflow = yaml.load(sourceToCheck)
  } catch (error) {
    errors.push(`${fileName}: invalid YAML (${error.message})`)
    continue
  }

  walk(workflow, (node) => {
    if (typeof node.uses !== "string") return
    const actionRef = node.uses.trim()
    const [action, ref = ""] = actionRef.split("@")

    if (action === "pnpm/action-setup") {
      errors.push(
        `${fileName}: do not use ${actionRef}; activate pnpm with Corepack in a run step or use package-manager on setup-node`,
      )
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
      errors.push(
        `${fileName}: unapproved ${action} ref ${ref || "(missing)"}; allowed refs: ${[...allowedRefs].join(", ")}`,
      )
    }
  })

  const hasPkgMgr = hasPackageManager(workflow)
  if (sourceToCheck.includes("pnpm install") && !hasPkgMgr) {
    if (!sourceToCheck.includes(`corepack prepare ${requiredPackageManager} --activate`)) {
      errors.push(
        `${fileName}: pnpm install found without package-manager on setup-node or Corepack activation`,
      )
    }
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

if (fixesApplied.length > 0) {
  console.log("Self-healing applied:")
  for (const fix of fixesApplied) console.log(`  ✓ ${fix}`)
}

if (errors.length > 0) {
  console.error("GitHub workflow health check failed:")
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

if (errors.length === 0 && fixesApplied.length === 0) {
  console.log("GitHub workflow health check passed.")
}
