import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, symlinkSync, chmodSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { assertChatGptTestEnvironment, chatGptTestProcessEnvironment, testDatabaseUrl } from "./chatgpt-test-environment.mjs";

test("database and provider environment cannot enter the test child", () => {
  const child = chatGptTestProcessEnvironment({
    PATH: process.env.PATH, DATABASE_URL: "must-not-propagate", DIRECT_URL: "must-not-propagate",
    PGHOST: "must-not-propagate", PGPORT: "must-not-propagate", PGDATABASE: "must-not-propagate",
    PGSERVICE: "must-not-propagate", PGPASSFILE: "must-not-propagate", PGOPTIONS: "must-not-propagate",
    NODE_OPTIONS: "must-not-propagate", RESEND_API_KEY: "must-not-propagate", GOOGLE_API_KEY: "must-not-propagate",
    DOCKER_HOST: "must-not-propagate", DOCKER_CONTEXT: "must-not-propagate",
  });
  assert.deepEqual(Object.keys(child).sort(), ["HOME", "LANG", "PATH", "TMPDIR"]);
  assert.ok(!Object.values(child).includes("must-not-propagate"));
});

test("direct execution, remote URLs, socket overrides and shared directories fail closed", () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "useclevr-chatgpt-"));
  mkdirSync(path.join(directory, "socket"), { mode: 0o700 });
  const saved = { ...process.env };
  try {
    delete process.env.CHATGPT_TEST_RUN_DIRECTORY;
    assert.throws(() => assertChatGptTestEnvironment("oauth"), /Use pnpm test:chatgpt/);
    process.env.CHATGPT_TEST_RUN_DIRECTORY = directory;
    process.env.CHATGPT_TEST_SUITE = "oauth";
    process.env.NODE_ENV = "test";
    process.env.NEON_USE_SERVERLESS = "false";
    process.env.NEON_USE_WS_POOL = "false";
    writeFileSync(path.join(directory, "runner-owned"), "UseClevr disposable ChatGPT tests\n");
    const validUrl = testDatabaseUrl(directory, "oauth");
    process.env.DATABASE_URL = validUrl;
    process.env.DIRECT_URL = validUrl;
    assert.equal(assertChatGptTestEnvironment("oauth"), validUrl);
    for (const url of [
      "postgresql://localhost/development", "postgresql://example.invalid/production",
      `${validUrl}&host=example.invalid`, `${validUrl}&port=6543`,
      testDatabaseUrl(directory, "mcp"),
    ]) {
      process.env.DATABASE_URL = url;
      assert.throws(() => assertChatGptTestEnvironment("oauth"));
    }
    process.env.DATABASE_URL = validUrl;
    process.env.DIRECT_URL = "postgresql://example.invalid/production";
    assert.throws(() => assertChatGptTestEnvironment("oauth"));
    process.env.DIRECT_URL = validUrl;
    assert.throws(() => assertChatGptTestEnvironment("mcp"));
    chmodSync(directory, 0o755);
    assert.throws(() => assertChatGptTestEnvironment("oauth"));
    chmodSync(directory, 0o700);
    rmSync(path.join(directory, "runner-owned"));
    assert.throws(() => assertChatGptTestEnvironment("oauth"));
    process.env.CHATGPT_TEST_RUN_DIRECTORY = process.cwd();
    assert.throws(() => assertChatGptTestEnvironment("oauth"));
    const link = path.join(directory, "link");
    symlinkSync(directory, link);
    process.env.CHATGPT_TEST_RUN_DIRECTORY = link;
    assert.throws(() => assertChatGptTestEnvironment("oauth"));
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
    rmSync(directory, { recursive: true, force: true });
  }
});

test("both real entrypoints reject inherited database configuration before database access", () => {
  for (const file of ["test-chatgpt-oauth-flow.ts", "test-chatgpt-mcp-integration.ts"]) {
    const result = spawnSync(process.execPath,
      ["--experimental-test-module-mocks", "--import", "tsx", `scripts/analysis/${file}`], {
        cwd: new URL("../../", import.meta.url), encoding: "utf8", timeout: 15_000,
        env: { ...chatGptTestProcessEnvironment(), DATABASE_URL: "postgresql://example.invalid/production" },
      });
    assert.equal(result.status, 1, "Direct test invocation must fail without connecting");
    assert.match(result.stderr, /Use pnpm test:chatgpt/);
    assert.ok(!result.stderr.includes("ECONN") && !result.stderr.includes("ENOTFOUND"));
  }
});
