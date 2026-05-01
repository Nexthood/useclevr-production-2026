const fs = require("node:fs")
const path = require("node:path")

const files = [".env", ".env.local"]
const loaded = {}

for (const file of files) {
  const envPath = path.join(process.cwd(), file)
  if (!fs.existsSync(envPath)) continue

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue

    const separator = trimmed.indexOf("=")
    if (separator === -1) continue

    const key = trimmed.slice(0, separator).trim()
    let value = trimmed.slice(separator + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    loaded[key] = value
  }
}

for (const [key, value] of Object.entries(loaded)) {
  if (process.env[key] === undefined) {
    process.env[key] = value
  }
}
