import path from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
const docsDir = path.join(rootDir, "docs")
const changelogPath = path.join(rootDir, "CHANGELOG.md")
const packagePath = path.join(rootDir, "package.json")
const licensePath = path.join(rootDir, "LICENSE")
const todoConfigPath = path.join(rootDir, ".TODO", "config.json")
const workflowsDir = path.join(rootDir, ".github", "workflows")
const requiredPackageManager = "pnpm@11.5.0+sha512.dbfcc4f81cf48597afd4bc391ffdf12c11f1a9fb83a395bfa6b0a2d9cc2fd8ffebafdb1ccbd529632153f793904c2615b7f09fe1a345473fd1c35845172a8eb1"

function resolveRepoPath(...segments) {
  return path.join(rootDir, ...segments)
}

function repoRelative(filePath) {
  return path.relative(rootDir, filePath).replace(/\\/g, "/")
}

export {
    changelogPath,
    docsDir,
    licensePath,
    packagePath,
    repoRelative,
    requiredPackageManager,
    resolveRepoPath,
    rootDir,
    todoConfigPath,
    workflowsDir
}
