#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const configPath = path.join(".TODO", "config.json");

function fail(message) {
  console.error(`TODO management check failed: ${message}`);
  process.exitCode = 1;
}

function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(`cannot parse ${filePath}: ${error.message}`);
    return null;
  }
}

function readText(filePath) {
  try {
    return readFileSync(filePath, "utf8");
  } catch (error) {
    fail(`cannot read ${filePath}: ${error.message}`);
    return "";
  }
}

const config = readJson(configPath);
if (!config) {
  process.exit(1);
}

const requiredFields = ["currentTaskPrefix", "nextTaskNumber", "todoFiles", "linksHeader"];
for (const field of requiredFields) {
  if (!(field in config)) {
    fail(`${configPath} is missing "${field}".`);
  }
}

const todoFiles = config.todoFiles || {};
for (const [name, filePath] of Object.entries(todoFiles)) {
  if (typeof filePath !== "string") {
    fail(`todoFiles.${name} must be a string path.`);
    continue;
  }
  if (!existsSync(filePath)) {
    fail(`${filePath} listed in todoFiles.${name} does not exist.`);
  }
}

const taskPattern = new RegExp(config.taskIdPattern || `^${config.currentTaskPrefix}\\d{2,}$`);
const ids = new Map();
let maxTaskNumber = 0;

for (const filePath of Object.values(todoFiles)) {
  if (typeof filePath !== "string" || !existsSync(filePath)) continue;
  const text = readText(filePath);
  const matches = text.matchAll(new RegExp(`\\b(${config.currentTaskPrefix}\\d{2,})\\b`, "g"));
  for (const match of matches) {
    const id = match[1];
    if (!taskPattern.test(id)) {
      fail(`${filePath} contains invalid task id "${id}".`);
    }
    if (ids.has(id)) {
      fail(`${id} appears in both ${ids.get(id)} and ${filePath}.`);
    }
    ids.set(id, filePath);
    maxTaskNumber = Math.max(maxTaskNumber, Number(id.slice(config.currentTaskPrefix.length)));
  }
}

if (!Number.isInteger(config.nextTaskNumber) || config.nextTaskNumber <= maxTaskNumber) {
  fail(`nextTaskNumber must be greater than ${config.currentTaskPrefix}${maxTaskNumber}.`);
}

process.exit(process.exitCode || 0);
