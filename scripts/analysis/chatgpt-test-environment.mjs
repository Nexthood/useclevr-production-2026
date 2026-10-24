import assert from "node:assert/strict";
import { readFileSync, realpathSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export const testDatabases = {
  oauth: "useclevr_chatgpt_oauth_test",
  mcp: "useclevr_chatgpt_mcp_test",
};

export function chatGptTestProcessEnvironment(parent = process.env) {
  return {
    PATH: parent.PATH || "/usr/bin:/bin",
    HOME: os.homedir(),
    TMPDIR: realpathSync(os.tmpdir()),
    LANG: "C.UTF-8",
  };
}

export function testDatabaseUrl(runDirectory, suite) {
  assert.ok(Object.hasOwn(testDatabases, suite), "Unknown ChatGPT test suite");
  const url = new URL(`postgresql://useclevr_test@localhost/${testDatabases[suite]}`);
  url.searchParams.set("host", path.join(runDirectory, "socket"));
  return url.toString();
}

// Run before importing application modules or creating any database client.
export function assertChatGptTestEnvironment(suite) {
  const directory = process.env.CHATGPT_TEST_RUN_DIRECTORY;
  assert.ok(directory, "Use pnpm test:chatgpt; direct execution cannot select a database");
  assert.equal(path.dirname(directory), realpathSync(os.tmpdir()));
  assert.match(path.basename(directory), /^useclevr-chatgpt-[A-Za-z0-9]+$/);
  assert.equal(realpathSync(directory), directory, "Test directory must not be a symlink");
  const stats = statSync(directory);
  assert.equal(stats.uid, process.getuid?.());
  assert.equal(stats.mode & 0o777, 0o700);
  const socket = path.join(directory, "socket");
  assert.equal(realpathSync(socket), socket, "Test socket directory must not be a symlink");
  assert.equal(statSync(socket).uid, process.getuid?.());
  assert.equal(statSync(socket).mode & 0o777, 0o700);
  assert.equal(process.env.CHATGPT_TEST_SUITE, suite);
  assert.equal(readFileSync(path.join(directory, "runner-owned"), "utf8"), "UseClevr disposable ChatGPT tests\n");
  const expected = testDatabaseUrl(directory, suite);
  assert.equal(process.env.DATABASE_URL, expected, "Only the runner-owned Unix socket database is allowed");
  assert.equal(process.env.DIRECT_URL, expected);
  assert.equal(process.env.NODE_ENV, "test");
  assert.equal(process.env.NEON_USE_SERVERLESS, "false");
  assert.equal(process.env.NEON_USE_WS_POOL, "false");
  return expected;
}
