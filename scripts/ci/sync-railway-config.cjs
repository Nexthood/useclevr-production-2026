const fs = require("node:fs")
const path = require("node:path")

const root = process.cwd()
const from = path.join(root, "ci-settings", "railway.dist.json")
const toDir = path.join(root, "dist")
const to = path.join(toDir, "railway.json")

if (!fs.existsSync(from)) {
  throw new Error("Missing ci-settings/railway.dist.json")
}

fs.mkdirSync(toDir, { recursive: true })
fs.copyFileSync(from, to)

console.log("Synced dist/railway.json")
