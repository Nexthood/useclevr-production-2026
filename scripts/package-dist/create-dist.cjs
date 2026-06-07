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

// Remove package-manager indicators so Railpack uses the prebuilt standalone bundle without
// trying to install dependencies in the generated deployment folder.
// Note: pnpm-lock.yaml and other lockfiles are removed because Railway Dockerfile uses npm install
// with the precompiled standalone bundle. The lockfiles are kept in .aiignore for token optimization
// during AI development work, not for deployment considerations.
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

// Strip host-config files that Next.js tracing may have pulled in from the project root
for (const f of ["vercel.json", "railway.json"]) {
  const fp = path.join(distDir, f);
  if (fs.existsSync(fp)) fs.rmSync(fp, { force: true });
}

// Restore pruned `next/dist/build/` — Next.js standalone tracing removes this directory,
// but `next/dist/server/next.js` dynamically requires `../build/output/log` at runtime.
function restoreNextBuildDir(targetNodeModulesDir, sourceNodeModulesDir) {
  const candidates = [];
  // pnpm: check .pnpm/next@*/node_modules/next/
  const pnpmDir = path.join(targetNodeModulesDir, ".pnpm");
  if (fs.existsSync(pnpmDir)) {
    for (const entry of fs.readdirSync(pnpmDir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.startsWith("next@")) {
        candidates.push(path.join(pnpmDir, entry.name, "node_modules", "next"));
      }
    }
  }
  // flat: check next/ directly
  const flatNext = path.join(targetNodeModulesDir, "next");
  if (fs.existsSync(path.join(flatNext, "package.json"))) {
    candidates.push(flatNext);
  }

  const sourceCandidates = [];
  const sourcePnpmDir = path.join(sourceNodeModulesDir, ".pnpm");
  if (fs.existsSync(sourcePnpmDir)) {
    for (const entry of fs.readdirSync(sourcePnpmDir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.startsWith("next@")) {
        sourceCandidates.push(path.join(sourcePnpmDir, entry.name, "node_modules", "next"));
      }
    }
  }
  const sourceFlatNext = path.join(sourceNodeModulesDir, "next");
  if (fs.existsSync(path.join(sourceFlatNext, "package.json"))) {
    sourceCandidates.push(sourceFlatNext);
  }

  for (const pkgDir of candidates) {
    const buildDir = path.join(pkgDir, "dist", "build");
    const packageDirName = path.basename(path.dirname(path.dirname(pkgDir)));
    const matchingSource = sourceCandidates.find(
      (candidate) => path.basename(path.dirname(path.dirname(candidate))) === packageDirName,
    );
    const sourceBuild = matchingSource
      ? path.join(matchingSource, "dist", "build")
      : sourceCandidates
          .map((candidate) => path.join(candidate, "dist", "build"))
          .find((candidate) => fs.existsSync(candidate));

    if (!sourceBuild || !fs.existsSync(sourceBuild)) {
      throw new Error(`Next.js runtime build directory not found for ${packageDirName}`);
    }

    fs.rmSync(buildDir, { recursive: true, force: true });
    fs.cpSync(sourceBuild, buildDir, { recursive: true });
    console.log(`Restored complete next/dist/build/ into ${path.relative(targetNodeModulesDir, pkgDir)}`);
  }
}
restoreNextBuildDir(path.join(distDir, "node_modules"), path.join(rootDir, "node_modules"));

// Railway uses DOCKERFILE builder (not Railpack). The standalone build already includes
// all production dependencies in node_modules/ (from pnpm + Next.js tracing). The Docker
// image copies the entire prebuilt dist directory — no npm install needed.
const dockerfile = `FROM node:26-alpine
WORKDIR /app
COPY . .
EXPOSE 8080
CMD ["sh", "-c", "USECLEVR_SERVER_TARGET=railway node -r ./scripts/runtime/load-env.cjs ./scripts/runtime/start-dist.cjs"]
`;
fs.writeFileSync(path.join(distDir, "Dockerfile"), dockerfile);

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
