import assert from "node:assert/strict";
import { readFileSync, realpathSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { Client, Pool } from "pg";
const require = createRequire(import.meta.url);
const { MIGRATION_LIMITS, runMigration } = require("../runtime/migration-safety.cjs");

const directory = process.env.MIGRATION_TEST_RUN_DIRECTORY;
assert.ok(directory, "Use pnpm test:migration-safety; direct database execution is forbidden");
assert.equal(path.dirname(directory), realpathSync(os.tmpdir()));
assert.match(path.basename(directory), /^useclevr-migration-[A-Za-z0-9]+$/);
for (const target of [directory, path.join(directory, "socket")]) {
  assert.equal(realpathSync(target), target);
  assert.equal(statSync(target).uid, process.getuid());
  assert.equal(statSync(target).mode & 0o777, 0o700);
}
assert.equal(
  readFileSync(path.join(directory, "runner-owned"), "utf8"),
  "UseClevr disposable migration safety tests\n",
);
const expected = new URL("postgresql://useclevr_test@localhost/useclevr_migration_safety_test");
expected.searchParams.set("host", path.join(directory, "socket"));
assert.equal(process.env.DATABASE_URL, expected.toString());
assert.equal(process.env.DIRECT_URL, expected.toString());
assert.equal(process.env.NODE_ENV, "test");
const pool = new Pool({ connectionString: expected.toString() });
const client = () =>
  new Client({ connectionString: expected.toString(), connectionTimeoutMillis: 1000 });
const short = {
  ...MIGRATION_LIMITS,
  connectionTimeoutMillis: 500,
  lockTimeoutMillis: 100,
  statementTimeoutMillis: 1000,
  transactionTimeoutMillis: 3000,
  idleTimeoutMillis: 2000,
  cleanupTimeoutMillis: 500,
};
const migration = readFileSync(
  new URL("../../src/lib/db/migrations/0037_agent_trust_passport.sql", import.meta.url),
  "utf8",
);
const checksum = async () =>
  (
    await pool.query(
      'SELECT count(*) AS count, md5(string_agg(row_to_json(t)::text,\'\' ORDER BY id)) AS checksum FROM (SELECT id,"userId",prompt,response,"createdAt" FROM "AiInteractionTrace") t',
    )
  ).rows[0];
const absent = async (name) =>
  assert.equal(
    (await pool.query("SELECT to_regclass($1) AS table", ['"' + name + '"'])).rows[0].table,
    null,
  );
try {
  assert.equal(
    (await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rowCount,
    0,
  );
  const version = Number((await pool.query("SHOW server_version_num")).rows[0].server_version_num);
  console.log("Disposable PostgreSQL server_version_num:", version);
  await pool.query(`CREATE TABLE "User" (id text PRIMARY KEY);
    INSERT INTO "User" VALUES ('fixture-owner');
    CREATE TABLE "AiInteractionTrace" (id text PRIMARY KEY,"userId" text NOT NULL REFERENCES "User"(id),prompt text NOT NULL,response text NOT NULL,"createdAt" timestamp NOT NULL DEFAULT now());
    INSERT INTO "AiInteractionTrace" (id,"userId",prompt,response)
    SELECT 'fixture-'||i,'fixture-owner','synthetic prompt','synthetic response' FROM generate_series(1,1000) i;`);
  const before = await checksum();
  const blocker = client();
  await blocker.connect();
  try {
    await blocker.query('BEGIN; SELECT id FROM "AiInteractionTrace" LIMIT 1');
    await assert.rejects(
      runMigration(client(), (db) => db.query(migration), { limits: short }),
      { code: "55P03" },
    );
    await absent("AiAgentPassport");
    assert.equal(
      (
        await pool.query(
          "SELECT count(*) AS count FROM information_schema.columns WHERE table_name='AiInteractionTrace' AND column_name='agentPassportId'",
        )
      ).rows[0].count,
      "0",
    );
  } finally {
    await blocker.query("ROLLBACK");
    await blocker.end();
  }
  console.log("PASS lock timeout aborts real migration 0037 and rolls back partial schema changes");

  await runMigration(client(), (db) => db.query(migration), { limits: short });
  await runMigration(client(), (db) => db.query(migration), { limits: short });
  assert.deepEqual(await checksum(), before);
  assert.equal(
    (
      await pool.query(
        'SELECT count(*) FROM "AiInteractionTrace" WHERE "agentPassportId" IS NOT NULL',
      )
    ).rows[0].count,
    "0",
  );
  console.log(
    "PASS real migration apply/replay preserves complete historical fixture contents and null attribution",
  );

  await assert.rejects(
    runMigration(
      client(),
      async (db) => {
        await db.query('CREATE TABLE "StatementRollback" (id integer)');
        await db.query("SELECT pg_sleep(1)");
      },
      { limits: { ...short, statementTimeoutMillis: 80 } },
    ),
    { code: "57014" },
  );
  await absent("StatementRollback");
  console.log("PASS server statement timeout rolls back writes and releases the connection");

  await assert.rejects(
    runMigration(
      client(),
      async (db) => {
        await db.query('CREATE TABLE "TransactionRollback" (id integer)');
        await db.query("SELECT pg_sleep(1)");
      },
      { limits: { ...short, transactionTimeoutMillis: 150 } },
    ),
    (error) =>
      version >= 170000 ? error.code === "25P04" : error.code === "MIGRATION_TRANSACTION_TIMEOUT",
  );
  await absent("TransactionRollback");
  console.log(
    "PASS transaction deadline terminates execution and rolls back without uncaught client errors",
  );

  const fallback = client();
  const actualQuery = fallback.query.bind(fallback);
  fallback.query = (text, ...args) =>
    text.includes("current_setting('server_version_num')")
      ? Promise.resolve({ rows: [{ version: 160000 }] })
      : actualQuery(text, ...args);
  await assert.rejects(
    runMigration(
      fallback,
      async (db) => {
        await db.query('CREATE TABLE "WatchdogRollback" (id integer)');
        await db.query("SELECT pg_sleep(1)");
      },
      { limits: { ...short, transactionTimeoutMillis: 120 } },
    ),
    { code: "MIGRATION_TRANSACTION_TIMEOUT" },
  );
  await absent("WatchdogRollback");
  console.log(
    "PASS simulated PostgreSQL 16 version branch cancels a real backend query through the connection watchdog",
  );

  await assert.rejects(
    runMigration(
      client(),
      async (db) => {
        await db.query('CREATE TABLE "IdleRollback" (id integer)');
        await new Promise((resolve) => setTimeout(resolve, 250));
      },
      { limits: { ...short, idleTimeoutMillis: 80 } },
    ),
    { code: "25P03" },
  );
  await absent("IdleRollback");
  const logs = [];
  let original;
  await assert.rejects(
    runMigration(
      client(),
      async (db) => {
        try {
          await db.query(
            "DO $$ BEGIN RAISE EXCEPTION 'synthetic private fixture' USING ERRCODE='P0001'; END $$",
          );
        } catch (error) {
          original = error;
          throw error;
        }
      },
      { limits: short, log: (...args) => logs.push(args) },
    ),
    (error) => error === original && error.code === "P0001",
  );
  assert.ok(!JSON.stringify(logs).includes("synthetic private fixture"));
  console.log(
    "PASS idle timeout and SQL failure preserve rollback and original SQLSTATE without logging private content",
  );

  const cli = await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [new URL("../runtime/railway-predeploy.cjs", import.meta.url).pathname],
      {
        cwd: directory,
        env: { PATH: process.env.PATH, HOME: directory, NODE_ENV: "test" },
      },
    );
    let output = "";
    child.stdout.on("data", (data) => (output += data));
    child.stderr.on("data", (data) => (output += data));
    child.on("error", reject);
    child.on("exit", (code) => resolve({ code, output }));
  });
  assert.equal(cli.code, 1);
  assert.match(cli.output, /MIGRATION_DATABASE_REQUIRED/);
  assert.doesNotMatch(cli.output, /schema sync complete|skipping schema sync/);
  console.log("PASS actual predeploy CLI exits nonzero when configuration is missing");

  // Exercise every production schema-sync statement on a second empty database.
  // Schema metadata supplies current prerequisites; no existing database is copied.
  await pool.query("CREATE DATABASE useclevr_predeploy_full_test");
  const fullUrl = new URL(expected);
  fullUrl.pathname = "/useclevr_predeploy_full_test";
  const full = new Pool({ connectionString: fullUrl.toString() });
  try {
    const { is, SQL, sql } = await import("drizzle-orm");
    const { PgTable, getTableConfig, PgDialect } = await import("drizzle-orm/pg-core");
    const schema = await import("../../src/lib/db/schema.ts");
    const dialect = new PgDialect();
    const seen = new Set();
    const quote = (name) => '"' + name.replaceAll('"', '""') + '"';
    for (const table of Object.values(schema).filter((value) => is(value, PgTable))) {
      const config = getTableConfig(table);
      if (seen.has(config.name)) continue;
      seen.add(config.name);
      const columns = config.columns.map((column) => {
        const value =
          column.default === undefined
            ? ""
            : " DEFAULT " +
              dialect.sqlToQuery(
                is(column.default, SQL)
                  ? column.default
                  : sql`${sql.param(column.default, column)}`.inlineParams(),
              ).sql;
        return (
          quote(column.name) +
          " " +
          column.getSQLType() +
          (column.notNull ? " NOT NULL" : "") +
          (column.primary ? " PRIMARY KEY" : "") +
          (column.isUnique ? " UNIQUE" : "") +
          value
        );
      });
      for (const primary of config.primaryKeys)
        columns.push(
          "PRIMARY KEY (" + primary.columns.map((column) => quote(column.name)).join(",") + ")",
        );
      await full.query(`CREATE TABLE ${quote(config.name)} (${columns.join(",")})`);
      for (const index of config.indexes) {
        if (index.config.columns.every((column) => typeof column.name === "string")) {
          await full.query(
            `CREATE ${index.config.unique ? "UNIQUE " : ""}INDEX IF NOT EXISTS ${quote(index.config.name)} ON ${quote(config.name)} (${index.config.columns.map((column) => quote(column.name)).join(",")})`,
          );
        }
      }
    }
    const { main } = require("../runtime/railway-predeploy.cjs");
    const started = Date.now();
    await main({
      env: { DATABASE_URL: fullUrl.toString() },
      restoreRuntime: () => {},
      log: () => {},
    });
    await main({
      env: { DATABASE_URL: fullUrl.toString() },
      restoreRuntime: () => {},
      log: () => {},
    });
    assert.equal(
      (
        await full.query(
          "SELECT count(*) FROM pg_constraint WHERE conname='AiInteractionTrace_agentPassportId_fkey' AND convalidated",
        )
      ).rows[0].count,
      "1",
    );
    console.log(
      `PASS complete production schema-sync apply/replay on current empty fixture prerequisites (${Date.now() - started} ms)`,
    );
  } finally {
    await full.end();
  }
} finally {
  await pool.end();
}
