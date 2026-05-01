const fs = require("node:fs")
const path = require("node:path")

const rootPackage = require("../../package.json")

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
    buildCommand: "echo \"Using prebuilt Next.js standalone bundle\"",
  },
  deploy: {
    startCommand: "node server.js",
    healthcheckPath: "/",
    healthcheckTimeout: 100,
  },
}

fs.writeFileSync(
  path.join(process.cwd(), "dist", "package.json"),
  `${JSON.stringify(distPackage, null, 2)}\n`,
)

fs.writeFileSync(
  path.join(process.cwd(), "dist", "railway.json"),
  `${JSON.stringify(distRailwayConfig, null, 2)}\n`,
)
