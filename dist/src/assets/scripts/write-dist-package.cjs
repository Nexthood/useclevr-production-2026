const fs = require("node:fs")
const path = require("node:path")

const rootPackage = require("../../../package.json")

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

fs.writeFileSync(
  path.join(process.cwd(), "dist", "package.json"),
  `${JSON.stringify(distPackage, null, 2)}\n`,
)
