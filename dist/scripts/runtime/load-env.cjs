const fs = require("node:fs");
const path = require("node:path");

const cwd = process.cwd();
const candidateDirs = [];

function findGitRoot(startDir) {
  let dir = startDir;

  while (true) {
    if (fs.existsSync(path.join(dir, ".git"))) {
      return dir;
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      return null;
    }

    dir = parent;
  }
}

function addCandidate(dir) {
  if (!dir || candidateDirs.includes(dir)) return;
  candidateDirs.push(dir);
}

const gitRoot = findGitRoot(cwd);

if (gitRoot) {
  addCandidate(path.dirname(gitRoot));
}

addCandidate(cwd);

if (path.basename(cwd) === "dist") {
  addCandidate(path.dirname(cwd));
}

const files = [".env", ".env.local", ".env.mock"];
const loaded = {};

for (const dir of candidateDirs) {
  for (const file of files) {
    const envPath = path.join(dir, file);
    if (!fs.existsSync(envPath)) continue;

    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const separator = trimmed.indexOf("=");
      if (separator === -1) continue;

      const key = trimmed.slice(0, separator).trim();
      let value = trimmed.slice(separator + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      loaded[key] = value;
    }
  }
}

for (const [key, value] of Object.entries(loaded)) {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
}
