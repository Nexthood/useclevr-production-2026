const fs = require("node:fs");
const path = require("node:path");

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");
const standaloneDir = path.join(rootDir, ".next", "standalone");
const nextStaticDir = path.join(rootDir, ".next", "static");
const srcAssetsDir = path.join(rootDir, "src", "assets");
const publicDir = path.join(rootDir, "public");
const dbSchemaDir = path.join(rootDir, "src", "lib", "db");
const distRailwayTemplate = path.join(rootDir, "server-settings", "railway", "railway.dist.json");

function assertExists(target, label) {
  if (!fs.existsSync(target)) {
    throw new Error(
      `${label} not found at ${path.relative(rootDir, target)}. Run pnpm build first.`,
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

// Copy database schema and migrations for production CLI tools (drizzle-kit)
if (fs.existsSync(dbSchemaDir)) {
  const destDbDir = path.join(distDir, "src", "lib", "db");
  fs.mkdirSync(destDbDir, { recursive: true });
  fs.cpSync(dbSchemaDir, destDbDir, { recursive: true });
}
fs.cpSync(path.join(rootDir, "drizzle.config.ts"), path.join(distDir, "drizzle.config.ts"));

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
const rootPkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf-8"));
const distEngines = { ...rootPkg.engines };
delete distEngines.pnpm;

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
);

// Write package.json and copy CI deploy template to dist root for hosts
// configured to deploy `dist` as the project root.
const rootDistPackage = {
  name: "useclevr-2026-dist",
  version: rootPkg.version,
  private: true,
  type: "module",
  scripts: {
    start:
      "AUTH_URL=${AUTH_URL:-$NEXTAUTH_URL} AUTH_SECRET=${AUTH_SECRET:-$NEXTAUTH_SECRET} AUTH_TRUST_HOST=true HOSTNAME=0.0.0.0 PORT=${PORT:-8080} node server.js",
    "railway:predeploy": "pnpm exec drizzle-kit push",
    "db:push": "pnpm exec drizzle-kit push",
    "db:migrate": "pnpm exec drizzle-kit migrate",
    prod: "pnpm start",
    "prod:start": "pnpm start",
  },
  dependencies: rootPkg.dependencies,
  devDependencies: { "drizzle-kit": rootPkg.devDependencies["drizzle-kit"] },
  engines: distEngines,
  pnpm: {
    onlyBuiltDependencies: ["core-js", "esbuild", "sharp"],
  },
  packageManager: rootPkg.packageManager,
};

fs.writeFileSync(
  path.join(distDir, "package.json"),
  `${JSON.stringify(rootDistPackage, null, 2)}\n`,
);

fs.writeFileSync(
  path.join(distDir, "pnpm-workspace.yaml"),
  [
    "allowBuilds:",
    "  core-js: true",
    "  esbuild: true",
    "  sharp: true",
    "dangerouslyAllowAllBuilds: true",
    "optional: false",
    "onlyBuiltDependencies:",
    "  - core-js",
    "  - esbuild",
    "  - sharp",
    "",
  ].join("\n"),
);

assertExists(distRailwayTemplate, "Railway dist template");
fs.cpSync(distRailwayTemplate, path.join(distDir, "railway.json"));

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

console.log(`Created distribution in ${distDir}`);
