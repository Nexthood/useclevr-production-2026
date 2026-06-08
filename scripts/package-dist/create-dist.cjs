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
    throw new Error(`${label} not found at ${repoRelative(target)}. Run pnpm build first.`);
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

    const normalizedName = entry.entrypoint.replace(/^server\//, "").replace(/\.js$/, "");

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

// Save next/dist/build/ from root node_modules before we clean dist
saveNextBuildDir();

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
// restore it inside the image before runtime starts. Copy directly from standalone build to avoid static duplication.
copyDir(path.join(standaloneDir, ".next"), path.join(distDir, "next-build"));
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
  for (const file of fs.readdirSync(targetDir)) {
    if (file.startsWith(".env")) {
      fs.rmSync(path.join(targetDir, file), { force: true });
    }
    if (file === ".npmrc") {
      fs.rmSync(path.join(targetDir, file), { force: true });
    }
  }
}

// Keep pnpm-lock.yaml for deterministic installs in the Dockerfile (pnpm install --prod).
// Remove other package-manager lockfiles and configs that are not needed.
const packageManagerFiles = [
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

// Strip host-config files that Next.js tracing may have pulled in from the project root
for (const f of ["vercel.json", "railway.json"]) {
  const fp = path.join(distDir, f);
  if (fs.existsSync(fp)) fs.rmSync(fp, { force: true });
}

// --- Next.js build directory restore ---
// next/dist/server/next.js needs ../build/output/log at runtime but standalone tracing prunes it.
// Save source from root node_modules BEFORE cleaning dist, restore AFTER standalone copy.
var _nextSourceBuildDir;
function saveNextBuildDir() {
  const nm = path.join(rootDir, "node_modules");
  // Try flat next/ first
  const flat = path.join(nm, "next");
  const flatBuild = path.join(flat, "dist", "build");
  if (fs.existsSync(flatBuild)) {
    _nextSourceBuildDir = flatBuild;
    return;
  }
  // Try pnpm store
  const pnpmDir = path.join(nm, ".pnpm");
  if (fs.existsSync(pnpmDir)) {
    for (const entry of fs.readdirSync(pnpmDir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.startsWith("next@")) {
        const pnpmBuild = path.join(pnpmDir, entry.name, "node_modules", "next", "dist", "build");
        if (fs.existsSync(pnpmBuild)) {
          _nextSourceBuildDir = pnpmBuild;
          return;
        }
      }
    }
  }
  throw new Error("next/dist/build/ not found in root node_modules — run next build first");
}

function restoreNextBuildDir() {
  if (!_nextSourceBuildDir) {
    throw new Error("saveNextBuildDir() must be called before restoreNextBuildDir()");
  }

  // Find all next package directories in the dist node_modules
  const distNm = path.join(distDir, "node_modules");
  var found = 0;
  // 1. pnpm store entries
  const pnpmDir = path.join(distNm, ".pnpm");
  if (fs.existsSync(pnpmDir)) {
    for (const entry of fs.readdirSync(pnpmDir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.startsWith("next@")) {
        const nextDir = path.join(pnpmDir, entry.name, "node_modules", "next");
        const buildDir = path.join(nextDir, "dist", "build");
        copyBuildDir(_nextSourceBuildDir, buildDir);
        found++;
      }
    }
  }
  // 2. Flat next/ (might be symlink to pnpm store, skip if we already restored it)
  const flat = path.join(distNm, "next");
  if (fs.existsSync(path.join(flat, "package.json"))) {
    // Resolve through possible symlink to check if we already handled it
    const realNext = fs.realpathSync(flat);
    const alreadyDone = found > 0 && fs.realpathSync(path.join(distNm, ".pnpm")).startsWith(path.dirname(path.dirname(path.dirname(path.dirname(path.dirname(realNext))))));
    // Simplified: check if flat resolves to a pnpm entry we already processed
    const isPnpmEntry = realNext.includes(path.sep + ".pnpm" + path.sep + "next@");
    if (!isPnpmEntry || found === 0) {
      const buildDir = path.join(flat, "dist", "build");
      copyBuildDir(_nextSourceBuildDir, buildDir);
      found++;
    }
  }

  if (found === 0) {
    throw new Error("No next package found in dist node_modules to restore build dir");
  }
  console.log("Restored next/dist/build/ into " + found + " next package(s)");
}

function copyBuildDir(sourceBuild, buildDir) {
  fs.rmSync(buildDir, { recursive: true, force: true });
  fs.mkdirSync(buildDir, { recursive: true });
  execSync(`cp -a "${sourceBuild}/." "${buildDir}/"`, { stdio: "inherit" });
  // Verify critical files
  const requiredFiles = [
    path.join(buildDir, "output", "log.js"),
    path.join(buildDir, "next-config-ts", "transpile-config.js"),
  ];
  const missing = requiredFiles.filter((f) => !fs.existsSync(f));
  if (missing.length > 0) {
    throw new Error(
      `Next.js runtime build restore incomplete: ${missing.join(", ")} missing after copy`,
    );
  }
}
restoreNextBuildDir();

// Spare copy outside the pnpm store — CI publish steps may silently drop files
// inside .pnpm/ during branch creation. Runtime (start-dist.cjs) restores from
// this path if the pnpm store entry is missing build/.
const nextBuildExtra = path.join(distDir, "next-build-extra");
copyBuildDir(_nextSourceBuildDir, nextBuildExtra);

// Railway uses DOCKERFILE builder (not Railpack). pnpm install --prod covers peer dependencies
// like 'pg' that Next.js tracing may not pull into the standalone build.
const dockerfile = `FROM node:26-alpine
WORKDIR /app
COPY . .
RUN npm install -g pnpm@11.5.0 && pnpm install --prod 2>&1
RUN node scripts/runtime/railway-predeploy.cjs
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 CMD node -e "require('http').get('http://localhost:8080/api/health', r => process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["sh", "-c", "USECLEVR_SERVER_TARGET=railway node -r ./scripts/runtime/load-env.cjs ./scripts/runtime/start-dist.cjs"]
`;
fs.writeFileSync(path.join(distDir, "Dockerfile"), dockerfile);

// Copy pnpm-lock.yaml and .pnpmfile.cjs from repo root for deterministic installs in Dockerfile
const lockfile = path.join(rootDir, "pnpm-lock.yaml");
if (fs.existsSync(lockfile)) {
  fs.copyFileSync(lockfile, path.join(distDir, "pnpm-lock.yaml"));
}
const pnpmfile = path.join(rootDir, ".pnpmfile.cjs");
if (fs.existsSync(pnpmfile)) {
  fs.copyFileSync(pnpmfile, path.join(distDir, ".pnpmfile.cjs"));
}

// Keep node_modules in the build context — the standalone bundle contains the correct
// dependency tree (from pnpm + Next.js tracing). .git is unnecessary in the image.
fs.writeFileSync(path.join(distDir, ".dockerignore"), ".git\n");

// Create start.sh for Railway deploy
const startSh = `#!/bin/sh
set -e
export USECLEVR_SERVER_TARGET=railway
exec node -r ./scripts/runtime/load-env.cjs ./scripts/runtime/start-dist.cjs "$@"
`;
fs.writeFileSync(path.join(distDir, "start.sh"), startSh, { mode: 0o755 });

console.log(`Created distribution in ${distDir}`);
