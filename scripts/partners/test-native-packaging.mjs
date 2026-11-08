import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import vm from "node:vm";

// Exercise the actual packaging functions without invoking the distribution build.
const source = fs.readFileSync(new URL("../package-dist/create-dist.cjs", import.meta.url), "utf8");
assert.ok(
  !source.includes("RUN node scripts/runtime/railway-predeploy.cjs"),
  "Database migrations belong only in Railway predeploy, never in an image build",
);
const nativeHelpers = source.slice(
  source.indexOf("function readDistSharpVersion("),
  source.indexOf("// --- Next.js build directory restore ---"),
);
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "partner-native-packaging-"));
const logs = [];
const run = vm.runInNewContext(`${nativeHelpers}\nensureSharpMuslPackages;`, {
  fs,
  path,
  console: { log: (message) => logs.push(message) },
  execSync: () => {
    throw new Error("Cached-package validation must not download dependencies");
  },
});
function fixture(entry, name, json) {
  const target = path.join(directory, ".pnpm", entry, "node_modules", name);
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, "package.json"), JSON.stringify(json));
  return target;
}
try {
  const sharp = fixture("sharp@0.35.5", "sharp", {
    version: "0.35.5",
    optionalDependencies: { "@img/sharp-linuxmusl-x64": "0.35.5" },
  });
  fs.mkdirSync(path.join(sharp, "..", "@img"));
  fixture("@img+sharp-linuxmusl-x64@0.35.5", "@img/sharp-linuxmusl-x64", {
    optionalDependencies: { "@img/sharp-libvips-linuxmusl-x64": "1.3.1" },
  });
  const vips = fixture(
    "@img+sharp-libvips-linuxmusl-x64@1.3.1",
    "@img/sharp-libvips-linuxmusl-x64",
    { version: "1.3.1" },
  );
  run(directory);
  const nativeVips = path.join(
    directory,
    ".pnpm",
    "@img+sharp-linuxmusl-x64@0.35.5",
    "node_modules",
    "@img",
    "sharp-libvips-linuxmusl-x64",
  );
  assert.equal(fs.realpathSync(nativeVips), fs.realpathSync(vips));
  assert.equal(
    fs.realpathSync(path.join(sharp, "..", "@img", "sharp-libvips-linuxmusl-x64")),
    fs.realpathSync(vips),
  );
  assert.equal(
    logs.some((message) => message.includes("Could not resolve")),
    false,
  );
  run(directory);
  assert.equal(fs.realpathSync(nativeVips), fs.realpathSync(vips));
  console.log(
    "PASS cached musl packages resolve libvips, link both runtime locations and repackage idempotently without downloads",
  );
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
