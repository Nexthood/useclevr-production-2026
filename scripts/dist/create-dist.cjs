const fs = require("node:fs")
const path = require("node:path")
const { spawnSync } = require("node:child_process")

const rootDir = process.cwd()
const distDir = path.join(rootDir, "dist")
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
fs.mkdirSync(distDir, { recursive: true })

// Copy Node.js bundle (standalone) directly to dist root
copyDir(standaloneDir, distDir, { excludeRootDirs: ["dist"] })

// Copy Next.js static assets
if (fs.existsSync(nextStaticDir)) {
  copyDir(nextStaticDir, path.join(distDir, ".next", "static"))
}

// Copy database schema and migrations for production CLI tools (drizzle-kit)
if (fs.existsSync(dbSchemaDir)) {
  const destDbDir = path.join(distDir, "src", "lib", "db")
  fs.mkdirSync(destDbDir, { recursive: true })
  fs.cpSync(dbSchemaDir, destDbDir, { recursive: true })
}
fs.cpSync(path.join(rootDir, "drizzle.config.ts"), path.join(distDir, "drizzle.config.ts"))

// Copy assets to dist root
copyDir(srcAssetsDir, path.join(distDir, "assets"))

// Copy public folder if it has files
if (fs.existsSync(publicDir)) {
  const publicItems = fs.readdirSync(publicDir)
  for (const item of publicItems) {
    const src = path.join(publicDir, item)
    if (fs.statSync(src).isFile()) {
      fs.cpSync(src, path.join(distDir, item))
    }
  }
}

// Write main distribution README
fs.writeFileSync(
  path.join(distDir, "README.md"),
  [
    "# UseClevr Production Outputs",
    "",
    "This folder contains the standalone Next.js production bundle and assets for Railway deployment.",
    "- `server.js`: The entry point for the Node.js server.",
    "- `assets/`: App-specific assets.",
    "",
  ].join("\n"),
)

// Write package.json and railway.json to dist root as a convenience for hosts
// configured to deploy the whole dist directory instead of dist/node.
const rootDistPackage = {
  name: "useclever-2026-dist",
  version: require(path.join(rootDir, "package.json")).version,
  private: true,
  type: "commonjs",
  scripts: {
    start: "node server.js",
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
    startCommand: "HOSTNAME=0.0.0.0 PORT=${PORT:-8080} node -r ./scripts/runtime/load-env.cjs server.js",
    preDeployCommand: "npx drizzle-kit push",
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
for (const targetDir of [distDir]) {
  const envFile = path.join(targetDir, ".env")
  if (fs.existsSync(envFile)) {
    fs.rmSync(envFile, { force: true })
  }

  for (const file of fs.readdirSync(targetDir)) {
    if (file.startsWith(".env.")) {
      fs.rmSync(path.join(targetDir, file), { force: true })
    }
  }
}

console.log(`Created distribution in ${distDir}`)
