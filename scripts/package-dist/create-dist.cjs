const fs = require("node:fs");
const path = require("node:path");

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

// Verify build exists
assertExists(standaloneDir, "Next standalone build");
assertExists(path.join(standaloneDir, "server.js"), "Standalone server");
assertExists(path.join(standaloneDir, ".next", "BUILD_ID"), "Standalone .next build");

// Clean and create output directories
fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

// Copy Node.js bundle (standalone) directly to dist root
copyDir(standaloneDir, distDir, { excludeRootDirs: ["dist"] });

// Copy Next.js static assets
if (fs.existsSync(nextStaticDir)) {
  copyDir(nextStaticDir, path.join(distDir, ".next", "static"));
}

// Railway's source snapshot can omit dot-directories from the service root. Keep a non-dot copy and
// restore it inside the image before runtime starts.
copyDir(path.join(distDir, ".next"), path.join(distDir, "next-build"));

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
const distEngines = { ...rootPkg.engines };
delete distEngines.pnpm;

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

// Write package.json for hosts configured to deploy `dist` as the project root.
const rootDistPackage = {
  name: "useclevr-2026-dist",
  version: rootPkg.version,
  private: true,
  type: "module",
  packageManager: rootPkg.packageManager,
  scripts: {
    start: "node -r ./scripts/runtime/load-env.cjs ./scripts/runtime/start-dist.cjs",
    "start:local":
      "USECLEVR_SERVER_TARGET=local node -r ./scripts/runtime/load-env.cjs ./scripts/runtime/start-dist.cjs",
    "start:railway":
      "USECLEVR_SERVER_TARGET=railway node -r ./scripts/runtime/load-env.cjs ./scripts/runtime/start-dist.cjs",
    "start:vercel":
      "USECLEVR_SERVER_TARGET=vercel node -r ./scripts/runtime/load-env.cjs ./scripts/runtime/start-dist.cjs",
    "railway:predeploy": "node ./scripts/runtime/railway-predeploy.cjs",
    "db:push": "node ./node_modules/drizzle-kit/bin.cjs push",
    "db:migrate": "node ./node_modules/drizzle-kit/bin.cjs migrate",
  },
  dependencies: {
    ...rootPkg.dependencies,
    "drizzle-kit": rootPkg.devDependencies["drizzle-kit"],
    tsx: rootPkg.devDependencies.tsx,
  },
  devDependencies: {},
  engines: distEngines,
};

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
  }
}

// Write pnpm-workspace.yaml for pnpm to recognize this as a workspace
fs.writeFileSync(
  path.join(distDir, "pnpm-workspace.yaml"),
  [
    "packages:",
    "  - .",
    "",
    "allowBuilds:",
    "  core-js: true",
    "  esbuild: true",
    "  sharp: true",
    "",
  ].join("\n")
);

// Create start.sh for Railway deploy
const startSh = `#!/bin/bash
set -e
exec node -r ./scripts/runtime/load-env.cjs ./scripts/runtime/start-dist.cjs "$@"
`;
fs.writeFileSync(path.join(distDir, "start.sh"), startSh, { mode: 0o755 });

console.log(`Created distribution in ${distDir}`);
