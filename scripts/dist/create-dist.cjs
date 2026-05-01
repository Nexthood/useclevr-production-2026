const fs = require("node:fs")
const path = require("node:path")
const { spawnSync } = require("node:child_process")

const rootDir = process.cwd()
const distDir = path.join(rootDir, "dist")
const standaloneDir = path.join(rootDir, ".next", "standalone")
const nextStaticDir = path.join(rootDir, ".next", "static")
const distNextStaticDir = path.join(distDir, ".next", "static")
const srcAssetsDir = path.join(rootDir, "src", "assets")
const distAssetsDir = path.join(distDir, "assets")
const writeDistPackageScript = path.join(
  rootDir,
  "scripts",
  "dist",
  "write-dist-package.cjs",
)

function assertExists(target, label) {
  if (!fs.existsSync(target)) {
    throw new Error(
      `${label} not found at ${path.relative(rootDir, target)}. Run pnpm build first.`,
    )
  }
}

function copyDir(from, to) {
  assertExists(from, "Source directory")
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.cpSync(from, to, { recursive: true })
}

assertExists(standaloneDir, "Next standalone build")
assertExists(path.join(standaloneDir, "server.js"), "Standalone server")
assertExists(path.join(standaloneDir, ".next", "BUILD_ID"), "Standalone .next build")

fs.rmSync(distDir, { recursive: true, force: true })
fs.mkdirSync(distDir, { recursive: true })

copyDir(standaloneDir, distDir)
copyDir(nextStaticDir, distNextStaticDir)
copyDir(srcAssetsDir, distAssetsDir)

const result = spawnSync(process.execPath, [writeDistPackageScript], {
  cwd: rootDir,
  stdio: "inherit",
})

if (result.status !== 0) {
  throw new Error("Failed to write dist package metadata")
}

fs.rmSync(path.join(distDir, ".env"), { force: true })

for (const file of fs.readdirSync(distDir)) {
  if (file.startsWith(".env.")) {
    fs.rmSync(path.join(distDir, file), { force: true })
  }
}
