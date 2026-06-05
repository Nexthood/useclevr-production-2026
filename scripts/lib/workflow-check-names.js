import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import yaml from "js-yaml";

import { resolveRepoPath, workflowsDir } from "./app-config.js";

const workflowGoldenPath = resolveRepoPath(".github", "workflow-job-names.golden.json");

function listWorkflowFiles(fsModule) {
  return fsModule
    .readdirSync(workflowsDir)
    .filter((file) => /\.ya?ml$/i.test(file))
    .sort();
}

function loadYamlFile(fsModule, filePath) {
  return yaml.load(fsModule.readFileSync(filePath, "utf-8"));
}

function getDisplayName(job, fallback) {
  return typeof job?.name === "string" && job.name.trim().length > 0 ? job.name.trim() : fallback;
}

function getLocalReusableWorkflowPath(usesValue) {
  if (typeof usesValue !== "string" || !usesValue.startsWith("./.github/workflows/")) return null;
  return resolveRepoPath(usesValue.replace(/^\.\//, ""));
}

function deriveJobCheckRuns(fsModule, filePath, workflow, seen = new Set()) {
  const cacheKey = path.relative(resolveRepoPath(), filePath);
  if (seen.has(cacheKey)) {
    throw new Error(`Recursive reusable workflow reference detected for ${cacheKey}`);
  }

  seen.add(cacheKey);

  const checkRuns = [];

  for (const [jobId, job] of Object.entries(workflow.jobs || {})) {
    const parentDisplay = getDisplayName(job, jobId);
    const reusablePath = getLocalReusableWorkflowPath(job?.uses);

    if (reusablePath && existsSync(reusablePath)) {
      const childWorkflow = loadYamlFile(fsModule, reusablePath);
      const childCheckRuns = deriveJobCheckRuns(fsModule, reusablePath, childWorkflow, new Set(seen));
      for (const childRun of childCheckRuns) {
        checkRuns.push(`${parentDisplay} / ${childRun}`);
      }
      continue;
    }

    checkRuns.push(parentDisplay);
  }

  return checkRuns;
}

function deriveWorkflowSnapshot(fsModule) {
  const workflows = {};

  for (const fileName of listWorkflowFiles(fsModule)) {
    const filePath = resolveRepoPath(".github", "workflows", fileName);
    const workflow = loadYamlFile(fsModule, filePath);
    const workflowName =
      typeof workflow?.name === "string" && workflow.name.trim().length > 0 ? workflow.name.trim() : fileName;
    const checkRuns = deriveJobCheckRuns(fsModule, filePath, workflow);

    workflows[fileName] = {
      workflowName,
      checkRuns,
    };
  }

  const validateSourceWorkflow = workflows["ci.yml"];
  const requiredMainChecks = validateSourceWorkflow
    ? validateSourceWorkflow.checkRuns.filter((name) => name.startsWith("Validate source and production build"))
    : [];

  return {
    version: 1,
    requiredMainChecks,
    workflows,
  };
}

function readWorkflowGolden(fsModule) {
  return JSON.parse(fsModule.readFileSync(workflowGoldenPath, "utf-8"));
}

function stringifyWorkflowSnapshot(snapshot) {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

export {
  deriveWorkflowSnapshot,
  readWorkflowGolden,
  stringifyWorkflowSnapshot,
  workflowGoldenPath,
};
