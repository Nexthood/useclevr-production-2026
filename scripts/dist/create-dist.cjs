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
const dbSchemaDir = path.join(rootDir, "src", "lib", "db")

function assertExists(target, label) {
  if (!fs.existsSync(target)) {
    throw new Error(
      `${label} not found at ${path.relative(rootDir, target)}. Run pnpm build first.`,
    )
  }
}

function copyDir(from, to, options = {}) {
  assertExists(from, "Source directory")
  fs.mkdirSync(to, { recursive: true })
  fs.cpSync(from, to, {
    recursive: true,
    filter: (src) => {
      const relativePath = path.relative(from, src)
      if (!relativePath) return true

      const firstSegment = relativePath.split(path.sep)[0]
      return !(options.excludeRootDirs || []).includes(firstSegment)
    },
  })
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

// Copy Node.js bundle (standalone). Keep node_modules, but prevent stale dist
// output from being traced back into the new bundle.
copyDir(standaloneDir, nodeDistDir, { excludeRootDirs: ["dist"] })

// Copy Next.js static assets to node bundle
if (fs.existsSync(nextStaticDir)) {
  copyDir(nextStaticDir, path.join(nodeDistDir, ".next", "static"))
}

// Copy database schema and migrations for production CLI tools (drizzle-kit)
if (fs.existsSync(dbSchemaDir)) {
  const destDbDir = path.join(nodeDistDir, "src", "lib", "db")
  fs.mkdirSync(destDbDir, { recursive: true })
  fs.cpSync(dbSchemaDir, destDbDir, { recursive: true })
}
fs.cpSync(path.join(rootDir, "drizzle.config.ts"), path.join(nodeDistDir, "drizzle.config.ts"))

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
    "- `node/`: Next.js standalone Node server bundle. This is the cleanest Railway/Docker/VPS deploy root.",
    "- `package.json` and `railway.json`: allow `dist/` itself to be used as a Railway deploy root; it starts `node/server.js`.",
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

// Write package.json and railway.json to dist root as a convenience for hosts
// configured to deploy the whole dist directory instead of dist/node.
const rootDistPackage = {
  name: "useclever-2026-dist",
  version: require(path.join(rootDir, "package.json")).version,
  private: true,
  type: "commonjs",
  scripts: {
    start: "HOSTNAME=0.0.0.0 PORT=${PORT:-8080} node node/server.js",
    prod: "pnpm start",
    "prod:start": "pnpm start",
  },
  engines: require(path.join(rootDir, "package.json")).engines,
  packageManager: require(path.join(rootDir, "package.json")).packageManager,
}

const rootDistRailwayConfig = {
  $schema: "https://railway.com/railway.schema.json",
  build: {
    builder: "RAILPACK",
    buildCommand: "echo 'Using pre-built artifacts from dist/'",
  },
  deploy: {
    startCommand: "node node/server.js",
    preDeployCommand: "cd node && npx drizzle-kit push",
    healthcheckPath: "/api/health",
    healthcheckTimeout: 300,
    restartPolicyType: "ON_FAILURE",
    restartPolicyMaxRetries: 10,
  },
}

fs.writeFileSync(
  path.join(distDir, "package.json"),
  `${JSON.stringify(rootDistPackage, null, 2)}\n`,
)

fs.writeFileSync(
  path.join(distDir, "railway.json"),
  `${JSON.stringify(rootDistRailwayConfig, null, 2)}\n`,
)

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

  // Do NOT remove 'src' if you need the DB schema for migrations/push
  for (const folder of ["dist"]) {
    const generatedDir = path.join(targetDir, folder)
    if (fs.existsSync(generatedDir)) {
      fs.rmSync(generatedDir, { recursive: true, force: true })
    }
  }
}

console.log(`Created distribution in ${distDir}`)
