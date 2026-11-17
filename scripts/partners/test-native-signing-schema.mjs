import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { inspectNativeSchema, nativeSchemaSql } from "./check-native-signing-schema.mjs";

test("native inspection uses a read-only transaction and reports only missing object names", async () => {
  const calls = [];
  const client = {
    async query(sql) {
      calls.push(sql);
      return {
        rows:
          sql === nativeSchemaSql
            ? [{ check_name: "table:PartnerContractNativeSignature", present: false }]
            : [],
      };
    },
  };
  assert.deepEqual(await inspectNativeSchema(client), {
    migration: "0045",
    prerequisiteObjectsPresent: false,
    missing: ["table:PartnerContractNativeSignature"],
  });
  assert.deepEqual(calls, ["BEGIN READ ONLY", nativeSchemaSql, "ROLLBACK"]);
});

test("native inspection rolls back a failed query and never hides it", async () => {
  const calls = [];
  const failure = new Error("synthetic query failure");
  const client = {
    async query(sql) {
      calls.push(sql);
      if (sql === nativeSchemaSql) throw failure;
      return { rows: [] };
    },
  };
  await assert.rejects(inspectNativeSchema(client), (error) => error === failure);
  assert.equal(calls.at(-1), "ROLLBACK");
});

test("native inspection rejects an empty or partial catalog result", async () => {
  for (const rows of [[], [{ check_name: "table:PartnerContract", present: true }]]) {
    assert.equal(
      (
        await inspectNativeSchema({
          async query() {
            return { rows };
          },
        })
      ).prerequisiteObjectsPresent,
      false,
    );
  }
});

test("native CLI fails closed without exposing connection credentials", () => {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("./check-native-signing-schema.mjs", import.meta.url))],
    {
      env: {
        PATH: process.env.PATH,
        DATABASE_URL:
          "postgresql://private_fixture:sensitive_fixture_password@127.0.0.1:1/private_fixture_db",
      },
      encoding: "utf8",
      timeout: 15000,
    },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Read-only native schema check failed/);
  assert.ok(!result.stderr.includes("sensitive_fixture_password"));
  assert.ok(!result.stderr.includes("private_fixture"));
  assert.equal(result.stdout, "");
});
