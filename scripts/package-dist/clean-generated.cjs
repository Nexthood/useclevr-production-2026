const fs = require("node:fs");

const { resolveRepoPath, repoRelative } = require("../lib/app-config.cjs");

const args = new Set(process.argv.slice(2));

const generatedTargets = [
  ".next",
  "dist",
  ".turbo",
  ".vercel",
  ".cache",
  "coverage",
  "out",
  "tmp",
];

const devTargets = [
  ".next",
  ".turbo",
  ".cache",
  "tmp",
];

const targets = args.has("--all") || args.has("--prod") || args.has("--generated")
  ? generatedTargets
  : devTargets;

for (const target of targets) {
  const targetPath = resolveRepoPath(target);
  if (!fs.existsSync(targetPath)) continue;

  fs.rmSync(targetPath, { recursive: true, force: true });
  console.log(`Removed ${repoRelative(targetPath)}`);
}
