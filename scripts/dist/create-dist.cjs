const fs = require("node:fs")
const path = require("node:path")
const { spawnSync } = require("node:child_process")

const rootDir = process.cwd()
const distDir = path.join(rootDir, "dist")
const nodeDistDir = path.join(distDir, "node")
const staticDistDir = path.join(distDir, "static")
const sharedDistDir = path.join(distDir, "shared")
const standaloneDir = path.join(rootDir, ".next", "standalone")
const nextStaticDir = path.join(rootDir, ".next", "static")
const srcAssetsDir = path.join(rootDir, "src", "assets")
const publicDir = path.join(rootDir, "public")

function assertExists(target, label) {
  if (!fs.existsSync(target)) {
    throw new Error(
      `${label} not found at ${path.relative(rootDir, target)}. Run pnpm build first.`,
    )
  }
}

function copyDir(from, to) {
  assertExists(from, "Source directory")
  fs.mkdirSync(to, { recursive: true })
  fs.cpSync(from, to, { recursive: true, filter: (src) => !src.includes("node_modules") })
}

function copyDirIfExists(from, to) {
  if (!fs.existsSync(from)) return
  fs.mkdirSync(to, { recursive: true })
  fs.cpSync(from, to, { recursive: true })
}

function copyFileIfExists(from, to) {
  if (!fs.existsSync(from)) return
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.cpSync(from, to)
}

// Verify build exists
assertExists(standaloneDir, "Next standalone build")
assertExists(path.join(standaloneDir, "server.js"), "Standalone server")
assertExists(path.join(standaloneDir, ".next", "BUILD_ID"), "Standalone .next build")

// Clean and create output directories
fs.rmSync(distDir, { recursive: true, force: true })
fs.mkdirSync(nodeDistDir, { recursive: true })
fs.mkdirSync(staticDistDir, { recursive: true })
fs.mkdirSync(sharedDistDir, { recursive: true })

// Copy Node.js bundle (standalone)
copyDir(standaloneDir, nodeDistDir)

// Copy Next.js static assets to node bundle
if (fs.existsSync(nextStaticDir)) {
  copyDir(nextStaticDir, path.join(nodeDistDir, ".next", "static"))
}

// Copy assets to both node bundle and shared (for common use)
copyDir(srcAssetsDir, path.join(nodeDistDir, "assets"))
copyDir(srcAssetsDir, path.join(sharedDistDir, "assets"))

// Copy public folder if it has files
if (fs.existsSync(publicDir)) {
  const publicItems = fs.readdirSync(publicDir)
  for (const item of publicItems) {
    const src = path.join(publicDir, item)
    if (fs.statSync(src).isFile()) {
      fs.cpSync(src, path.join(nodeDistDir, item))
      fs.cpSync(src, path.join(sharedDistDir, item))
    }
  }
}

// Write static distribution README
fs.writeFileSync(
  path.join(staticDistDir, "README.md"),
  [
    "# Static Distribution",
    "",
    "This app currently depends on Next.js server routes and cannot be exported as a plain static site.",
    "Use `dist/node` for Node-compatible hosting.",
    "Common static inputs copied during production builds are in `dist/shared`.",
    "",
  ].join("\n"),
)

// Write main distribution README
fs.writeFileSync(
  path.join(distDir, "README.md"),
  [
    "# UseClevr Production Outputs",
    "",
    "- `node/`: Next.js standalone Node server bundle. Deploy this to Railway, Docker, VPS, or any Node host.",
    "- `static/`: reserved for a host-anywhere static export. This project is not fully static-exportable yet because it uses server routes and auth.",
    "- `shared/`: common copied assets/public files used by production outputs.",
    "",
  ].join("\n"),
)

// Write package.json to node bundle
const writeDistPackageScript = path.join(rootDir, "scripts", "dist", "write-dist-package.cjs")
const result = spawnSync(process.execPath, [writeDistPackageScript, nodeDistDir], {
  cwd: rootDir,
  stdio: "inherit",
})

if (result.status !== 0) {
  throw new Error("Failed to write dist package metadata")
}

// Clean up sensitive files from output
for (const targetDir of [nodeDistDir]) {
  const envFile = path.join(targetDir, ".env")
  if (fs.existsSync(envFile)) {
    fs.rmSync(envFile, { force: true })
  }

  for (const file of fs.readdirSync(targetDir)) {
    if (file.startsWith(".env.")) {
      fs.rmSync(path.join(targetDir, file), { force: true })
    }
  }

  // Remove src folder from node bundle - not needed in production
  const srcDir = path.join(targetDir, "src")
  if (fs.existsSync(srcDir)) {
    fs.rmSync(srcDir, { recursive: true, force: true })
  }
}

console.log(`Created distribution in ${distDir}`)