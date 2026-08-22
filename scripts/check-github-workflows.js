#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import process from "node:process";
import yaml from "js-yaml";

import { requiredPackageManager, resolveRepoPath, rootDir, workflowsDir } from "./lib/app-config.js";
import {
  deriveWorkflowSnapshot,
  readWorkflowGolden,
  stringifyWorkflowSnapshot,
  workflowGoldenPath,
} from "./lib/workflow-check-names.js";

const allowedActions = new Map([
  ["actions/checkout", new Set(["d23441a48e516b6c34aea4fa41551a30e30af803"])],
  ["actions/setup-node", new Set(["249970729cb0ef3589644e2896645e5dc5ba9c38"])],
  ["actions/github-script", new Set(["3a2844b7e9c422d3c10d287c895573f7108da1b3"])],
  ["./.github/workflows/validate.yml", new Set([""])],
  ["./.github/actions/setup", new Set([""])],
]);

const pinnedActionVersions = new Map([
  ["actions/checkout", "v6"],
  ["actions/setup-node", "v6"],
  ["actions/github-script", "v9"],
]);

const errors = [];
const fixesApplied = [];
const isFix = process.argv.includes("--fix");
const shouldRefreshGolden = process.argv.includes("--refresh-golden");

function walk(value, visitor) {
  if (Array.isArray(value)) {
    value.forEach((item) => walk(item, visitor));
    return;
  }
  if (!value || typeof value !== "object") return;
  visitor(value);
  Object.values(value).forEach((item) => walk(item, visitor));
}

function fixWorkflow(source, fileName) {
  let workflow;
  try {
    workflow = yaml.load(source);
  } catch {
    errors.push(`${fileName}: cannot auto-fix — invalid YAML`);
    return { fixed: null, modified: false };
  }

  let modified = false;

  if (!workflow.jobs) {
    return { fixed: source, modified };
  }

  for (const jobId of Object.keys(workflow.jobs)) {
    const job = workflow.jobs[jobId];
    if (!job?.steps || !Array.isArray(job.steps)) continue;

    for (let i = 0; i < job.steps.length; i++) {
      const step = job.steps[i];
      if (typeof step.uses === "string" && step.uses.trim() === "actions/setup-node@v6") {
        if (step.with) {
          const keysToRemove = ["package-manager", "package-manager-cache"];
          let stepModified = false;
          for (const key of keysToRemove) {
            if (key in step.with) {
              delete step.with[key];
              stepModified = true;
            }
          }
          if (stepModified) {
            modified = true;
            fixesApplied.push(`${fileName} (job ${jobId}): removed extraneous setup-node keys`);
          }
        }
      }
    }
  }

  if (!modified) {
    return { fixed: source, modified: false };
  }

  const dumped = yaml.dump(workflow, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false,
  });

  return { fixed: dumped, modified: true };
}

function collectYamlFiles(directory) {
  if (!existsSync(directory)) return [];

  const entries = readdirSync(directory);
  const files = [];
  for (const entry of entries) {
    const path = `${directory}/${entry}`;
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...collectYamlFiles(path));
    } else if (/\.ya?ml$/i.test(entry)) {
      files.push(path);
    }
  }
  return files;
}

function toDisplayName(path) {
  return path.startsWith(`${rootDir}/`) ? path.slice(rootDir.length + 1) : path;
}

function isExternalAction(action) {
  return !action.startsWith("./") && !action.startsWith("docker://");
}

const workflowSnapshot = deriveWorkflowSnapshot({ readdirSync, readFileSync });
const workflowFiles = readdirSync(workflowsDir)
  .filter((file) => /\.ya?ml$/i.test(file))
  .map((file) => resolveRepoPath(".github", "workflows", file));
const actionFiles = collectYamlFiles(resolveRepoPath(".github", "actions"));

for (const filePath of [...workflowFiles, ...actionFiles]) {
  const fileName = toDisplayName(filePath);
  const source = readFileSync(filePath, "utf-8");
  const isWorkflowFile = filePath.startsWith(`${workflowsDir}/`);

  let sourceToCheck = source;

  if (isFix && isWorkflowFile) {
    const { fixed, modified } = fixWorkflow(source, fileName);
    if (fixed !== null && modified) {
      writeFileSync(filePath, fixed, "utf-8");
      sourceToCheck = fixed;
    }
    if (fixed === null) {
      continue;
    }
  }

  let workflow;
  try {
    workflow = yaml.load(sourceToCheck);
  } catch (error) {
    errors.push(`${fileName}: invalid YAML (${error.message})`);
    continue;
  }

  walk(workflow, (node) => {
    if (typeof node.uses !== "string") return;
    const actionRef = node.uses.trim();
    const [action, ref = ""] = actionRef.split("@");

    if (action === "pnpm/action-setup") {
      errors.push(
        `${fileName}: do not use ${actionRef}; activate pnpm with Corepack in a run step or use package-manager on setup-node`,
      );
      return;
    }

    const allowedRefs = allowedActions.get(action);
    if (!allowedRefs) {
      errors.push(
        `${fileName}: unapproved action ${actionRef}; use approved GitHub-owned actions or add it to the workflow allowlist after review`,
      );
      return;
    }

    if (!allowedRefs.has(ref)) {
      errors.push(
        `${fileName}: unapproved ${action} ref ${ref || "(missing)"}; allowed refs: ${[...allowedRefs].join(", ")}`,
      );
    }

    if (isExternalAction(action) && !/^[0-9a-f]{40}$/i.test(ref)) {
      errors.push(
        `${fileName}: external action ${actionRef} must be pinned to a full 40-character commit SHA`,
      );
    }

    const readableVersion = pinnedActionVersions.get(action);
    if (readableVersion) {
      const expectedComment = `${action}@${ref} # ${readableVersion}`;
      if (!sourceToCheck.includes(expectedComment)) {
        errors.push(
          `${fileName}: pinned ${action} ref must keep the readable ${readableVersion} comment`,
        );
      }
    }
  });

  if (sourceToCheck.includes("pnpm install")) {
    if (!sourceToCheck.includes("pnpm install --frozen-lockfile")) {
      errors.push(
        `${fileName}: pnpm install must use --frozen-lockfile`,
      );
    }

    const hasCorepack = sourceToCheck.includes(
      `corepack prepare ${requiredPackageManager} --activate`,
    );
    if (!hasCorepack) {
      errors.push(
        `${fileName}: pnpm install requires Corepack activation for ${requiredPackageManager}`,
      );
    }
  }

  if (fileName === ".github/workflows/ci.yml") {
    const auditCommand = "pnpm audit --audit-level=moderate";
    if (!sourceToCheck.includes(auditCommand)) {
      errors.push(`${fileName}: CI must run ${auditCommand}`);
    }
    if (/pnpm audit --audit-level=moderate\s*(\|\||&&\s*true|;\s*true)/.test(sourceToCheck)) {
      errors.push(`${fileName}: CI audit failure must not be suppressed`);
    }
  }

  if (workflow.jobs) {
    for (const jobId of Object.keys(workflow.jobs)) {
      if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(jobId) || jobId.length > 100) {
        errors.push(
          `${fileName}: invalid job ID '${jobId}'; must start with letter/underscore and contain only alphanumeric/_/- characters`,
        );
      }
    }
  }
}

if (shouldRefreshGolden) {
  writeFileSync(workflowGoldenPath, stringifyWorkflowSnapshot(workflowSnapshot), "utf-8");
  fixesApplied.push(".github/workflow-job-names.golden.json: refreshed workflow check-run golden file");
} else {
  const workflowGolden = readWorkflowGolden({ readFileSync });
  const expected = stringifyWorkflowSnapshot(workflowGolden);
  const actual = stringifyWorkflowSnapshot(workflowSnapshot);

  if (expected !== actual) {
    errors.push(
      `workflow check-run names drifted from .github/workflow-job-names.golden.json; run 'pnpm lint:workflows:refresh' after reviewing workflow name changes`,
    );
  }
}

if (fixesApplied.length > 0) {
  console.log("Self-healing applied:");
  for (const fix of fixesApplied) console.log(`  ✓ ${fix}`);
}

if (errors.length > 0) {
  console.error("GitHub workflow health check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

if (errors.length === 0 && fixesApplied.length === 0) {
  console.log("GitHub workflow health check passed.");
}
