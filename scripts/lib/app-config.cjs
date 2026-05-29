const path = require("node:path");

const rootDir = path.resolve(__dirname, "..", "..");
const docsDir = path.join(rootDir, "docs");
const changelogPath = path.join(rootDir, "CHANGELOG.md");
const packagePath = path.join(rootDir, "package.json");
const licensePath = path.join(rootDir, "LICENSE");
const todoConfigPath = path.join(rootDir, ".TODO", "config.json");
const workflowsDir = path.join(rootDir, ".github", "workflows");
const requiredPackageManager = "pnpm@11.5.0";

function resolveRepoPath(...segments) {
  return path.join(rootDir, ...segments);
}

function repoRelative(filePath) {
  return path.relative(rootDir, filePath).replace(/\\/g, "/");
}

module.exports = {
  changelogPath,
  docsDir,
  licensePath,
  packagePath,
  repoRelative,
  requiredPackageManager,
  resolveRepoPath,
  rootDir,
  todoConfigPath,
  workflowsDir,
};
