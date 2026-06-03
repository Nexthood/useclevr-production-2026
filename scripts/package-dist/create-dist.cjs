const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const { packagePath, repoRelative, resolveRepoPath, rootDir } = require("../lib/app-config.cjs");

const distDir = resolveRepoPath("dist");
const standaloneDir = resolveRepoPath(".next", "standalone");
const nextStaticDir = resolveRepoPath(".next", "static");
const srcAssetsDir = resolveRepoPath("src", "assets");
const publicDir = resolveRepoPath("public");
const dbSchemaDir = resolveRepoPath("src", "lib", "db");
const runtimeScriptsDir = resolveRepoPath("scripts", "runtime");

function assertExists(target, label) {
  if (!fs.existsSync(target)) {
    throw new Error(
      `${label} not found at ${repoRelative(target)}. Run pnpm build first.`,
    );
  }
}

function copyDir(from, to, options = {}) {
  assertExists(from, "Source directory");
  fs.mkdirSync(to, { recursive: true });
  fs.cpSync(from, to, {
    recursive: true,
    filter: (src) => {
      const relativePath = path.relative(from, src);
      if (!relativePath) return true;

      const firstSegment = relativePath.split(path.sep)[0];
      if ((options.excludeRootDirs || []).includes(firstSegment)) {
        return false;
      }

      // Exclude .next/cache/webpack which contains large pack files
      if (relativePath.includes(".next" + path.sep + "cache" + path.sep + "webpack")) {
        return false;
      }

      return true;
    },
  });
}

function normalizeMiddlewareManifest(nextDir) {
  const manifestPath = path.join(nextDir, "server", "middleware-manifest.json");
  if (!fs.existsSync(manifestPath)) return;

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  let modified = false;

  for (const entry of Object.values(manifest.middleware || {})) {
    if (!entry || typeof entry !== "object") continue;
    if (typeof entry.entrypoint !== "string") continue;

    const normalizedName = entry.entrypoint
      .replace(/^server\//, "")
      .replace(/\.js$/, "");

    if (entry.name !== normalizedName) {
      entry.name = normalizedName;
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
}

// Verify build exists
assertExists(standaloneDir, "Next standalone build");
assertExists(path.join(standaloneDir, "server.js"), "Standalone server");
assertExists(path.join(standaloneDir, ".next", "BUILD_ID"), "Standalone .next build");

// Clean and create output directories
fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

// Copy Node.js bundle (standalone) directly to dist root
// Use shell cp -a to preserve relative symlinks (fs.cpSync resolves them to absolute paths)
execSync(`cp -a "${standaloneDir}/." "${distDir}/"`, { stdio: "inherit" });
// Remove standalone's own dist/ directory if it was copied (excludeRootDirs equivalent)
const standaloneDistInDist = path.join(distDir, "dist");
if (fs.existsSync(standaloneDistInDist)) {
  fs.rmSync(standaloneDistInDist, { recursive: true, force: true });
}

// Copy Next.js static assets
if (fs.existsSync(nextStaticDir)) {
  copyDir(nextStaticDir, path.join(distDir, ".next", "static"));
}

// Railway's source snapshot can omit dot-directories from the service root. Keep a non-dot copy and
// restore it inside the image before runtime starts.
copyDir(path.join(distDir, ".next"), path.join(distDir, "next-build"));
normalizeMiddlewareManifest(path.join(distDir, ".next"));
normalizeMiddlewareManifest(path.join(distDir, "next-build"));

// Copy database schema and migrations for production CLI tools (drizzle-kit)
if (fs.existsSync(dbSchemaDir)) {
  const destDbDir = path.join(distDir, "src", "lib", "db");
  fs.mkdirSync(destDbDir, { recursive: true });
  fs.cpSync(dbSchemaDir, destDbDir, { recursive: true });
}
fs.cpSync(resolveRepoPath("drizzle.config.ts"), path.join(distDir, "drizzle.config.ts"));

// Copy runtime start helpers used by local, Railway, and future server targets.
copyDir(runtimeScriptsDir, path.join(distDir, "scripts", "runtime"));

// Copy assets to dist root
copyDir(srcAssetsDir, path.join(distDir, "assets"));

// Copy public folder if it has files
if (fs.existsSync(publicDir)) {
  const publicItems = fs.readdirSync(publicDir);
  for (const item of publicItems) {
    const src = path.join(publicDir, item);
    if (fs.statSync(src).isFile()) {
      fs.cpSync(src, path.join(distDir, item));
    }
  }
}

// Load root package.json for syncing
const rootPkg = JSON.parse(fs.readFileSync(packagePath, "utf-8"));

// Write main distribution README
fs.writeFileSync(
  path.join(distDir, "README.md"),
  [
    "# UseClevr",
    "",
    "This folder contains the standalone Next.js production bundle and assets for Railway deployment.",
    "- `server.js`: The entry point for the Node.js server.",
    "- `assets/`: App-specific assets.",
    "",
  ].join("\n"),
);

fs.writeFileSync(
  path.join(distDir, "deployment-manifest.json"),
  `${JSON.stringify(
    {
      sourceCommit: process.env.GITHUB_SHA || process.env.SOURCE_COMMIT || "local",
      sourceBranch: process.env.GITHUB_REF_NAME || process.env.SOURCE_BRANCH || "local",
      buildTimestamp: new Date().toISOString(),
      nodeVersion: process.version,
      healthcheckPath: "/api/health",
      railwayRoot: "/dist",
      vercelSourceBranch: "main",
    },
    null,
    2,
  )}\n`,
);

// Include production dependencies so Railway Dockerfile installs them.
// Dev dependencies omitted — not needed at runtime.
const rootDistPackage = {
  name: "useclevr-2026-dist",
  version: rootPkg.version,
  private: true,
  type: "module",
  scripts: {
    start: "node -r ./scripts/runtime/load-env.cjs ./scripts/runtime/start-dist.cjs",
    "start:local":
      "USECLEVR_SERVER_TARGET=local node -r ./scripts/runtime/load-env.cjs ./scripts/runtime/start-dist.cjs",
    "start:railway":
      "USECLEVR_SERVER_TARGET=railway node -r ./scripts/runtime/load-env.cjs ./scripts/runtime/start-dist.cjs",
    "start:vercel":
      "USECLEVR_SERVER_TARGET=vercel node -r ./scripts/runtime/load-env.cjs ./scripts/runtime/start-dist.cjs",
    "railway:predeploy": "node ./scripts/runtime/railway-predeploy.cjs",
  },
  dependencies: rootPkg.dependencies || {},
};

// Remove packageManager so npm doesn't detect pnpm
delete rootDistPackage.packageManager;

fs.writeFileSync(
  path.join(distDir, "package.json"),
  `${JSON.stringify(rootDistPackage, null, 2)}\n`,
);

// Clean up sensitive files from output
for (const targetDir of [distDir]) {
  const envFile = path.join(targetDir, ".env");
  if (fs.existsSync(envFile)) {
    fs.rmSync(envFile, { force: true });
  }

  for (const file of fs.readdirSync(targetDir)) {
    if (file.startsWith(".env.")) {
      fs.rmSync(path.join(targetDir, file), { force: true });
    }
    if (file === ".npmrc") {
      fs.rmSync(path.join(targetDir, file), { force: true });
    }
  }
}

// Remove package-manager indicators so Railpack uses the prebuilt standalone bundle without
// trying to install dependencies in the generated deployment folder.
const packageManagerFiles = [
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "package-lock.json",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
  ".npmrc",
  ".yarnrc.yml",
  ".yarnrc.yaml",
];
for (const f of packageManagerFiles) {
  const fp = path.join(distDir, f);
  if (fs.existsSync(fp)) fs.rmSync(fp, { force: true });
}

// Railway uses DOCKERFILE builder (not Railpack). The Dockerfile runs npm install, and
// .dockerignore excludes node_modules from the Docker build context. Therefore the dist
// branch does not need node_modules committed. The workflow removes it before git commit.

// Write Dockerfile for Railway Docker builder.
// Installs production dependencies from npm, then copies the
// standalone app files (server.js, assets, scripts, etc.).
// node_modules excluded via .dockerignore so the standalone
// pnpm structure doesn't overwrite npm-installed dependencies.
const dockerfile = `FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --production --omit=optional 2>&1
COPY . .
EXPOSE 8080
CMD ["node", "-r", "./scripts/runtime/load-env.cjs", "./scripts/runtime/start-dist.cjs"]
`;
fs.writeFileSync(path.join(distDir, "Dockerfile"), dockerfile);

// Exclude node_modules from Docker context so npm install result is used.
fs.writeFileSync(path.join(distDir, ".dockerignore"), "node_modules\n.next\n.git\n");

// Create start.sh for Railway deploy
const startSh = `#!/bin/sh
set -e
exec node -r ./scripts/runtime/load-env.cjs ./scripts/runtime/start-dist.cjs "$@"
`;
fs.writeFileSync(path.join(distDir, "start.sh"), startSh, { mode: 0o755 });

console.log(`Created distribution in ${distDir}`);
