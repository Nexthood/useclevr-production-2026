const fs = require("node:fs")
const path = require("node:path")

const rootPackage = require("../../package.json")
const outputDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(process.cwd(), "dist", "node")

const distPackage = {
  name: rootPackage.name,
  version: rootPackage.version,
  private: true,
  type: "commonjs",
  scripts: {
    start: "HOSTNAME=0.0.0.0 PORT=${PORT:-8080} node server.js",
    prod: "pnpm start",
    "prod:start": "pnpm start",
  },
  engines: rootPackage.engines,
  packageManager: rootPackage.packageManager,
}

const distRailwayConfig = {
  $schema: "https://railway.com/railway.schema.json",
  build: {
    builder: "RAILPACK",
    buildCommand: "echo 'Using pre-built artifacts from dist/node/'",
  },
  deploy: {
    startCommand: "node server.js",
    healthcheckPath: "/api/health",
    healthcheckTimeout: 300,
    restartPolicyType: "ON_FAILURE",
    restartPolicyMaxRetries: 10,
  },
}

fs.writeFileSync(
  path.join(outputDir, "package.json"),
  `${JSON.stringify(distPackage, null, 2)}\n`,
)

fs.writeFileSync(
  path.join(outputDir, "railway.json"),
  `${JSON.stringify(distRailwayConfig, null, 2)}\n`,
)
