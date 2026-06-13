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

// Copy missing AWS SDK transitive deps that Next.js tracing misses
fixAwsSdkPackages(path.join(distDir, "node_modules"));
ensureSharpMuslPackages(path.join(distDir, "node_modules"));

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

// Allow build scripts for packages that need them in pnpm v11+
rootDistPackage.pnpm = {
  onlyBuiltDependencies: ["core-js", "esbuild", "sharp"],
};

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

// Remove package-manager lockfiles and configs that are not needed.
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

// --- AWS SDK package fix ---
// Next.js standalone build tracing only symlinks @aws-sdk/client-s3 but skips
// many transitive @aws-sdk/*, @smithy/*, and @aws-crypto/* packages. Copy the
// missing entries from the root node_modules/.pnpm store and recreate symlinks.
function fixAwsSdkPackages(distNmDir) {
  const pnpmDir = path.join(distNmDir, ".pnpm");
  if (!fs.existsSync(pnpmDir)) return;
  const rootPnpm = path.join(rootDir, "node_modules", ".pnpm");

  const missingPrefixes = ["@aws-sdk+", "@smithy+", "@aws-crypto+"];
  const scopes = ["@aws-sdk", "@smithy", "@aws-crypto"];

  // 1. Copy missing entries from root pnpm store
  for (const entry of fs.readdirSync(rootPnpm, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const shouldCopy = missingPrefixes.some((p) => entry.name.startsWith(p));
    if (!shouldCopy) continue;

    const src = path.join(rootPnpm, entry.name);
    const dest = path.join(pnpmDir, entry.name);
    if (!fs.existsSync(dest)) {
      execSync(`cp -a "${src}" "${dest}"`, { stdio: "ignore" });
    }
  }

  // 2. Create symlinks for each scope directory
  for (const scope of scopes) {
    const scopeDir = path.join(distNmDir, scope);
    if (!fs.existsSync(scopeDir)) {
      fs.mkdirSync(scopeDir, { recursive: true });
    }

    const pnpmPrefix = scope + "+";
    for (const entry of fs.readdirSync(pnpmDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (!entry.name.startsWith(pnpmPrefix)) continue;

      const pkgPath = path.join(pnpmDir, entry.name, "node_modules", scope);
      if (!fs.existsSync(pkgPath)) continue;

      for (const pkg of fs.readdirSync(pkgPath, { withFileTypes: true })) {
        if (!pkg.isDirectory() && !pkg.isSymbolicLink()) continue;
        const linkPath = path.join(scopeDir, pkg.name);
        if (!fs.existsSync(linkPath)) {
          const target = path.join("..", ".pnpm", entry.name, "node_modules", scope, pkg.name);
          fs.symlinkSync(target, linkPath, "junction");
        }
      }
    }
  }

  // 3. Create top-level symlinks for non-scoped transitive deps (e.g. tslib, fast-xml-parser)
  // that sibling pnpm entries bring in. Next.js standalone tracing often omits these.
  const seenBare = new Set();
  for (const entry of fs.readdirSync(pnpmDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (!missingPrefixes.some((p) => entry.name.startsWith(p))) continue;

    const entryNmDir = path.join(pnpmDir, entry.name, "node_modules");
    if (!fs.existsSync(entryNmDir)) continue;

    for (const child of fs.readdirSync(entryNmDir, { withFileTypes: true })) {
      const isScoped = child.name.startsWith("@");
      if (isScoped) continue;
      if (!child.isDirectory() && !child.isSymbolicLink()) continue;
      if (seenBare.has(child.name)) continue;
      seenBare.add(child.name);

      const topLink = path.join(distNmDir, child.name);
      if (fs.existsSync(topLink)) continue;

      // Find the pnpm store entry for this bare module
      const bareEntry = findPnpmEntry(pnpmDir, child.name);
      if (bareEntry) {
        // Bare modules are directly in node_modules/, not in a subdirectory like @scope/.
        // The target relative to node_modules/ is .pnpm/..., without the ../ prefix
        // that is needed for scoped packages (@scope/pkg → ../.pnpm/...).
        const target = path.join(".pnpm", bareEntry, "node_modules", child.name);
        fs.symlinkSync(target, topLink, "junction");
      }
    }
  }
}

function findPnpmEntry(pnpmDir, bareName) {
  if (!fs.existsSync(pnpmDir)) return null;
  for (const entry of fs.readdirSync(pnpmDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith("node_modules")) continue;
    // Scoped pnpm entries start with @ — they are not canonical entries for bare modules
    if (entry.name.startsWith("@")) continue;
    // Match bareName@version pattern (e.g. tslib@2.8.1)
    const prefix = bareName + "@";
    if (!entry.name.startsWith(prefix)) continue;
    const candidatePkg = path.join(pnpmDir, entry.name, "node_modules", bareName);
    if (fs.existsSync(candidatePkg)) {
      return entry.name;
    }
  }
  return null;
}

// --- Sharp native module fix ---
// Railway uses Alpine Linux (musl libc) but CI builds on Ubuntu (glibc).
// pnpm skips musl platform packages on glibc, so they must be fetched from npm
// and placed directly into the dist pnpm store so sharp can load at runtime.
function ensureSharpMuslPackages(distNmDir) {
  const pnpmDir = path.join(distNmDir, ".pnpm");
  if (!fs.existsSync(pnpmDir)) return;

  const muslPackages = [
    { entry: "@img+sharp-linuxmusl-x64@0.34.5", npmName: "@img/sharp-linuxmusl-x64", version: "0.34.5" },
    { entry: "@img+sharp-libvips-linuxmusl-x64@1.2.4", npmName: "@img/sharp-libvips-linuxmusl-x64", version: "1.2.4" },
  ];

  for (const pkg of muslPackages) {
    const destEntry = path.join(pnpmDir, pkg.entry);
    if (fs.existsSync(destEntry)) continue;

    const scope = pkg.npmName.split("/")[0];
    const bareName = pkg.npmName.split("/")[1];
    const tmpDir = fs.mkdtempSync(path.join(pnpmDir, ".tmp-sharp-musl-"));

    try {
      const tarball = path.join(tmpDir, "pkg.tgz");
      const url = `https://registry.npmjs.org/${pkg.npmName}/-/${bareName}-${pkg.version}.tgz`;
      execSync(`curl -sfL -o "${tarball}" "${url}"`, { stdio: "ignore" });
      execSync(`tar xzf "${tarball}" -C "${tmpDir}"`, { stdio: "ignore" });

      const pkgDir = path.join(tmpDir, "package");
      const storePath = path.join(pnpmDir, pkg.entry, "node_modules", scope, bareName);
      fs.mkdirSync(path.dirname(storePath), { recursive: true });
      fs.renameSync(pkgDir, storePath);

      console.log(`  Added missing platform package: ${pkg.npmName}@${pkg.version}`);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // Create symlink inside sharp's node_modules/@img/ for each musl package
  const sharpPnpmDir = path.join(pnpmDir, "sharp@0.34.5");
  if (!fs.existsSync(sharpPnpmDir)) return;
  const imgDir = path.join(sharpPnpmDir, "node_modules", "@img");
  if (!fs.existsSync(imgDir)) return;

  for (const pkg of muslPackages) {
    const symlinkPath = path.join(imgDir, pkg.npmName.split("/")[1]);
    if (fs.existsSync(symlinkPath)) continue;
    // Resolve back up to .pnpm/ then forward into the pnpm store entry
    // From: sharp@0.34.5/node_modules/@img/
    // To:   ../../../@img+sharp-linuxmusl-x64@0.34.5/node_modules/@img/sharp-linuxmusl-x64
    const target = path.join("..", "..", "..", pkg.entry, "node_modules", pkg.npmName);
    fs.symlinkSync(target, symlinkPath, "junction");
    console.log(`  Created symlink sharp/node_modules/@img -> ${target}`);
  }
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

// Railway uses DOCKERFILE builder (not Railpack). The dist folder contains the complete
// node_modules from Next.js standalone tracing. No pnpm/npm install needed.
const dockerfile = `FROM node:26-alpine
WORKDIR /app
COPY . .
RUN node scripts/runtime/railway-predeploy.cjs
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 CMD node -e "require('http').get('http://localhost:8080/api/health', r => process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
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
