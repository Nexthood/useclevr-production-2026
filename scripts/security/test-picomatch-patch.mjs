import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const patchMarker = "isSelfRepeatingStarBranch";
const VULNERABLE_SHAPES = ["+(*)", "+(*a)", "*(*a)", "+(a*)", "+(a*b)", "*(*.js)"];
const EXCLUDED_SHAPES = ['+("*a")', "+(\\*a)", "+(*a/b)", "+(*[ab])", "+(a?*)"];
const SEMANTIC_INPUTS = ["", "a", "aa", "ab", "a.a", ".a", "a/b", "abc", "axbayb", "foo.js", "foo.ts", "xaay"];

function findInstalledPicomatchInstances() {
  const pnpmDir = path.join(repoRoot, "node_modules", ".pnpm");
  if (!existsSync(pnpmDir)) {
    return [];
  }
  const instances = [];
  for (const entry of readdirSync(pnpmDir)) {
    if (!entry.startsWith("picomatch@")) continue;
    const packageDir = path.join(pnpmDir, entry, "node_modules", "picomatch");
    if (!existsSync(path.join(packageDir, "package.json"))) continue;
    instances.push({ entry, dir: packageDir, patched: entry.includes("_patch_hash") });
  }
  return instances;
}

const instances = findInstalledPicomatchInstances();

test("every installed picomatch instance carries the extglob ReDoS patch", () => {
  assert.ok(instances.length > 0, "picomatch must be installed for the patch regression test");
  const unpatched = instances.filter((instance) => !instance.patched);
  assert.deepEqual(
    unpatched.map((instance) => instance.entry),
    [],
    "unpatched picomatch instances are linked into the dependency graph",
  );
  for (const instance of instances) {
    const parseSource = readFileSync(path.join(instance.dir, "lib", "parse.js"), "utf8");
    assert.ok(
      parseSource.includes(patchMarker),
      `${instance.entry} lib/parse.js is missing the UseClevr extglob ReDoS patch`,
    );
  }
});

const patchedInstances = instances.filter((instance) => instance.patched);
const versionFromEntry = (entry) => entry.match(/^(picomatch@[^_]+)/)?.[1];

for (const instance of patchedInstances) {
  const require = createRequire(path.join(instance.dir, "index.js"));
  const picomatch = require(instance.dir);
  const label = versionFromEntry(instance.entry);

  test(`${label}: generated regexes no longer nest unbounded quantifiers`, () => {
    for (const pattern of VULNERABLE_SHAPES) {
      assert.ok(
        !/\)[+*]/.test(picomatch.makeRe(pattern).source),
        `${label} ${pattern} still compiles to a nested unbounded repetition`,
      );
    }
  });

  test(`${label}: matching semantics stay equivalent to the explicit opt-out for short inputs`, () => {
    for (const options of [{}, { dot: true }, { windows: true }, { bash: true }]) {
      for (const pattern of VULNERABLE_SHAPES) {
        for (const input of SEMANTIC_INPUTS) {
          assert.equal(
            picomatch.isMatch(input, pattern, options),
            picomatch.isMatch(input, pattern, { ...options, maxExtglobRecursion: false }),
            `${label} ${JSON.stringify({ pattern, input, options })}`,
          );
        }
      }
    }
    assert.ok(picomatch.isMatch("abc", "+(*)c"), `${label} +(*)c must keep matching abc`);
    assert.ok(!picomatch.isMatch("ab", "+(*a)"), `${label} +(*a) must keep rejecting ab`);
    assert.ok(picomatch.isMatch("axbayb", "+(a*b)"), `${label} +(a*b) must keep matching axbayb`);
    assert.ok(!picomatch.isMatch("axbay", "+(a*b)"), `${label} +(a*b) must keep rejecting axbay`);
  });

  test(`${label}: capture mode keeps the existing literal fallback`, () => {
    const regex = picomatch.makeRe("+(*a)", { capture: true });
    assert.ok(regex instanceof RegExp);
    assert.deepEqual(Array.from(regex.exec("+(*a)")), ["+(*a)"]);
    assert.ok(!regex.test("aaa"), `${label} capture fallback must match the literal extglob only`);
  });

  test(`${label}: quoted, escaped, path and bracket syntax keep their previous regexes`, () => {
    for (const pattern of EXCLUDED_SHAPES) {
      assert.equal(
        picomatch.makeRe(pattern).source,
        picomatch.makeRe(pattern, { maxExtglobRecursion: false }).source,
        `${label} ${pattern} must keep the unpatched regex`,
      );
    }
    assert.ok(picomatch.isMatch("*a*a", '+("*a")'));
    assert.ok(picomatch.isMatch("*a*a", "+(\\*a)"));
  });

  test(`${label}: crafted single-branch extglobs finish under a subprocess deadline`, () => {
    const payloads = ["+(*a)", "*(*a)", "+(*a)c", "x+(*a)", "+(*)"];
    for (const pattern of payloads) {
      for (const length of [40, 200]) {
        const expectNoMatch = pattern !== "+(*)";
        const script = `const assert = require("assert");
const picomatch = require(${JSON.stringify(instance.dir)});
const input = ${JSON.stringify("a".repeat(length) + "b")};
const start = Date.now();
const result = picomatch.isMatch(input, ${JSON.stringify(pattern)});
assert.equal(Date.now() - start > 2000, false, "pattern exceeded the safe matching budget");
assert.equal(${expectNoMatch ? `result, false, "crafted input must not match"` : "true, true"});`;
        execFileSync(process.execPath, ["-e", script], { timeout: 8000, cwd: repoRoot });
      }
    }
  });
}

test("both installed picomatch major lines are protected", () => {
  const versions = new Set(patchedInstances.map((instance) => versionFromEntry(instance.entry)));
  assert.ok(versions.has("picomatch@4.0.5"), "the payload/tinyglobby 4.x line must be patched");
  assert.ok(versions.has("picomatch@2.3.2"), "the chokidar/micromatch 2.x line must be patched");
});

test("committed patch files cover the parse.js change for both versions", () => {
  for (const patchFile of ["picomatch@2.3.2.patch", "picomatch@4.0.5.patch"]) {
    const patchSource = readFileSync(path.join(repoRoot, "patches", patchFile), "utf8");
    assert.ok(
      patchSource.includes(patchMarker) && patchSource.includes("analysis.collapse === true"),
      `patches/${patchFile} must contain the extglob collapse fix`,
    );
  }
  const workspace = readFileSync(path.join(repoRoot, "pnpm-workspace.yaml"), "utf8");
  assert.ok(
    workspace.includes("patches/picomatch@2.3.2.patch") && workspace.includes("patches/picomatch@4.0.5.patch"),
    "pnpm-workspace.yaml must register both picomatch patches",
  );
});
