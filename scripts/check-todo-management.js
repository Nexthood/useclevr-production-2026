#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";

import { repoRelative, resolveRepoPath, todoConfigPath } from "./lib/app-config.js";

const queueStates = {
  next: "active",
  done: "retired",
  future: "retired",
  ignore: "retired",
};

function fail(message) {
  console.error(`TODO management check failed: ${message}`);
  process.exitCode = 1;
}

function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(`cannot parse ${repoRelative(filePath)}: ${error.message}`);
    return null;
  }
}

function readText(filePath) {
  try {
    return readFileSync(filePath, "utf8");
  } catch (error) {
    fail(`cannot read ${repoRelative(filePath)}: ${error.message}`);
    return "";
  }
}

function hasLinksSection(text, linksHeader) {
  const escapedHeader = linksHeader.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^##\\s+${escapedHeader}\\s*$`, "m").test(text);
}

function taskLinePattern(queueName, config) {
  if (queueName === "future" || queueName === "ignore") {
    return /^[-*]\s+(?!T-\d+\.)(.+)$/i;
  }

  return new RegExp(`^[-*]\\s+(${config.currentTaskPrefix}\\d{2,})\\.\\s*(.+)$`, "i");
}

function taskIdFromLine(line, queueName, config) {
  const match = line.trim().match(taskLinePattern(queueName, config));
  if (!match) return null;
  if (queueName === "future" || queueName === "ignore") return null;
  return match[1];
}

function descriptionFromLine(line, queueName, config) {
  const match = line.trim().match(taskLinePattern(queueName, config));
  if (!match) return "";
  if (queueName === "future" || queueName === "ignore") return match[1];
  return match[2];
}

function validateTaskLanguage(filePath, text, queueName, config) {
  const invalidLines = [];
  const lines = text.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    const description = descriptionFromLine(line, queueName, config);
    if (!description) continue;

    if (/^now\b/i.test(description.trim())) {
      invalidLines.push(index + 1);
    }
  }

  if (invalidLines.length > 0) {
    fail(
      `${repoRelative(filePath)} task descriptions should not start with "now"; lines: ${invalidLines.join(", ")}`,
    );
  }
}

function parseLabels(labelText) {
  return labelText.split(",").map((label) => label.trim()).filter(Boolean);
}

function validateTaskLabels(filePath, text, queueName, config) {
  const invalidLines = [];
  const missingLines = [];
  const unknownLabels = [];
  const duplicateLabels = [];
  const lines = text.split(/\r?\n/);
  const allowedLabels = new Set(config.labels || []);
  const labelPattern = new RegExp(config.labelPattern || "^[a-z][a-z0-9-]{1,31}$");
  const suffixPattern = new RegExp(
    queueName === "done" ? config.doneSuffixPattern : config.labelSuffixPattern,
  );

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    const description = descriptionFromLine(line, queueName, config);
    if (!description) continue;

    const suffixMatch = description.match(suffixPattern);
    if (!suffixMatch) {
      missingLines.push(index + 1);
      continue;
    }

    const labels = parseLabels(suffixMatch[1]);
    const seen = new Set();
    for (const label of labels) {
      if (!labelPattern.test(label)) {
        invalidLines.push(`${index + 1}:${label}`);
      }
      if (seen.has(label)) {
        duplicateLabels.push(`${index + 1}:${label}`);
      }
      seen.add(label);
      if (allowedLabels.size > 0 && !allowedLabels.has(label)) {
        unknownLabels.push(`${index + 1}:${label}`);
      }
    }
  }

  if (missingLines.length > 0) {
    fail(`${repoRelative(filePath)} tasks must include ${queueName === "done" ? "done label/commit" : "label"} suffixes; lines: ${missingLines.join(", ")}`);
  }
  if (invalidLines.length > 0) {
    fail(`${repoRelative(filePath)} contains invalid labels: ${invalidLines.join(", ")}`);
  }
  if (duplicateLabels.length > 0) {
    fail(`${repoRelative(filePath)} contains duplicate labels: ${duplicateLabels.join(", ")}`);
  }
  if (unknownLabels.length > 0) {
    fail(`${repoRelative(filePath)} contains labels missing from config.json: ${unknownLabels.join(", ")}`);
  }
}

const config = readJson(todoConfigPath);
if (!config) {
  process.exit(1);
}

for (const field of ["currentTaskPrefix", "nextTaskNumber", "todoFiles", "linksHeader"]) {
  if (!(field in config)) {
    fail(`${repoRelative(todoConfigPath)} is missing "${field}".`);
  }
}

if (!Array.isArray(config.labels) || config.labels.length === 0) {
  fail(`${repoRelative(todoConfigPath)} must define at least one generic todo label.`);
}

const todoFiles = config.todoFiles || {};
const requiredQueues = Object.keys(queueStates);

for (const queueName of requiredQueues) {
  if (typeof todoFiles[queueName] !== "string") {
    fail(`todoFiles.${queueName} must be a string path.`);
  }
}

const taskPattern = new RegExp(config.taskIdPattern || `^${config.currentTaskPrefix}\\d{2,}$`);
const ids = new Map();
const idsByQueue = new Map();
let maxTaskNumber = 0;
const stateCounts = { active: 0, retired: 0 };

for (const queueName of requiredQueues) {
  const filePath = resolveRepoPath(todoFiles[queueName]);
  const state = queueStates[queueName];

  if (!existsSync(filePath)) {
    fail(`${repoRelative(filePath)} listed in todoFiles.${queueName} does not exist.`);
    continue;
  }

  const text = readText(filePath);
  validateTaskLanguage(filePath, text, queueName, config);
  validateTaskLabels(filePath, text, queueName, config);

  if (!hasLinksSection(text, config.linksHeader)) {
    fail(`${repoRelative(filePath)} must include a "## ${config.linksHeader}" section.`);
  }

  const queueIds = [];
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const id = taskIdFromLine(lines[index], queueName, config);
    if (!id) continue;
    if (!taskPattern.test(id)) {
      fail(`${repoRelative(filePath)} contains invalid task id "${id}".`);
    }
    if (ids.has(id)) {
      fail(`${id} appears in both ${ids.get(id)} and ${repoRelative(filePath)}.`);
    }
    ids.set(id, repoRelative(filePath));
    queueIds.push(Number(id.slice(config.currentTaskPrefix.length)));
    stateCounts[state] += 1;
    maxTaskNumber = Math.max(maxTaskNumber, Number(id.slice(config.currentTaskPrefix.length)));
  }
  idsByQueue.set(queueName, queueIds);
}

const nextIds = idsByQueue.get("next") || [];
const doneIds = idsByQueue.get("done") || [];
const doneIdSet = new Set(doneIds);
for (const nextId of nextIds) {
  if (!doneIdSet.has(nextId) && !ids.has(`${config.currentTaskPrefix}${nextId}`)) {
    // Active IDs are allowed to have historical gaps. The lint reports them only when strict gap checks are enabled.
  }
}

const sortedNext = [...nextIds].sort((a, b) => a - b);
const missingNumbers = [];
for (let index = 0; index < sortedNext.length; index += 1) {
  const expected = sortedNext[0] + index;
  if (sortedNext[index] !== expected) {
    for (let number = expected; number < sortedNext[index]; number += 1) {
      missingNumbers.push(number);
    }
  }
}
if (missingNumbers.length > 0 && process.env.TODO_STRICT_GAPS === "1") {
  fail(`todo-next.md has missing task numbers: ${missingNumbers.map((number) => `${config.currentTaskPrefix}${number}`).join(", ")}`);
}

if (!Number.isInteger(config.nextTaskNumber) || config.nextTaskNumber <= maxTaskNumber) {
  fail(`nextTaskNumber must be greater than ${config.currentTaskPrefix}${maxTaskNumber}.`);
}

if (!process.exitCode) {
  console.log(
    `TODO management is valid. Active state: ${stateCounts.active} queued task(s). Retired states: ${stateCounts.retired} completed, future, or ignored task(s).`,
  );
}

process.exit(process.exitCode || 0);
