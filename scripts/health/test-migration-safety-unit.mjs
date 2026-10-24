import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { main } = require("../runtime/railway-predeploy.cjs");
const { MIGRATION_LIMITS, runMigration, safeFailure } = require("../runtime/migration-safety.cjs");

class FakeClient extends EventEmitter {
  constructor(version = 170000) {
    super();
    this.version = version;
    this.queries = [];
    this.closed = 0;
  }
  async connect() {}
  async query(text, values) {
    this.queries.push({ text, values });
    return { rows: [{ version: this.version }] };
  }
  async end() {
    this.closed++;
  }
}

assert.deepEqual(MIGRATION_LIMITS, {
  connectionTimeoutMillis: 10000,
  lockTimeoutMillis: 3000,
  statementTimeoutMillis: 60000,
  transactionTimeoutMillis: 120000,
  idleTimeoutMillis: 30000,
  cleanupTimeoutMillis: 5000,
});
await assert.rejects(
  main({
    env: {},
    restoreRuntime: () => assert.fail("Do not restore or connect without a database"),
  }),
  { code: "MIGRATION_DATABASE_REQUIRED" },
);
for (const version of [120000, 160000, 170000]) {
  const client = new FakeClient(version);
  await runMigration(client, async (db) => db.query("fixture migration"));
  assert.equal(client.closed, 1);
  assert.equal(
    client.queries.some((q) => q.text.includes("transaction_timeout'")),
    version >= 170000,
  );
  assert.equal(client.queries.at(-1).text, "COMMIT");
}
await assert.rejects(
  runMigration(new FakeClient(110000), async () => assert.fail()),
  { code: "MIGRATION_VERSION_UNSUPPORTED" },
);
console.log(
  "PASS missing configuration fails before work; detected PostgreSQL version selects native timeout or watchdog",
);

const client = new FakeClient();
const original = Object.assign(new Error("synthetic private payload"), { code: "P0001" });
const logs = [];
const query = client.query.bind(client);
client.query = async (text, values) => {
  if (text === "ROLLBACK") throw new Error("synthetic rollback payload");
  return query(text, values);
};
await assert.rejects(
  runMigration(
    client,
    async () => {
      throw original;
    },
    { log: (...args) => logs.push(args) },
  ),
  (error) => error === original,
);
assert.ok(!JSON.stringify(logs).includes("payload"));
assert.equal(safeFailure(original).code, "P0001");
console.log(
  "PASS rollback failure preserves original error and diagnostics omit messages, SQL, credentials, and row content",
);

const uncertain = new FakeClient();
const commitFailure = Object.assign(new Error("synthetic transport payload"), {
  code: "ECONNRESET",
});
const uncertainQuery = uncertain.query.bind(uncertain);
const uncertainLogs = [];
uncertain.query = (text, values) =>
  text === "COMMIT" ? Promise.reject(commitFailure) : uncertainQuery(text, values);
await assert.rejects(
  runMigration(uncertain, async () => {}, { log: (...args) => uncertainLogs.push(args) }),
  (error) => error === commitFailure,
);
assert.ok(uncertainLogs.some((entry) => entry[1]?.commitOutcomeUnknown === true));
assert.ok(!JSON.stringify(uncertainLogs).includes("payload"));
console.log(
  "PASS lost COMMIT acknowledgement reports unknown outcome without replacing the transport error",
);

let connects = 0;
const unavailable = new FakeClient();
unavailable.connect = async () => {
  connects++;
  throw Object.assign(new Error("synthetic URI"), { code: "ECONNREFUSED" });
};
await assert.rejects(
  runMigration(unavailable, async () => assert.fail()),
  { code: "ECONNREFUSED" },
);
assert.equal(connects, 1);
assert.equal(unavailable.closed, 1);
const hanging = new FakeClient();
hanging.connect = () => new Promise(() => {});
await assert.rejects(
  runMigration(hanging, async () => assert.fail(), {
    limits: { ...MIGRATION_LIMITS, connectionTimeoutMillis: 20, transactionTimeoutMillis: 20 },
  }),
  { code: "MIGRATION_TRANSACTION_TIMEOUT" },
);
assert.equal(hanging.closed, 1);
const cleanup = new FakeClient();
cleanup.end = async () => {
  throw new Error("synthetic cleanup failure");
};
await assert.rejects(
  runMigration(cleanup, async () => {}),
  /synthetic cleanup failure/,
);
console.log(
  "PASS connection failures are not retried; stalled connections and cleanup cannot report success",
);

let options;
await main({
  env: { DATABASE_URL: "postgresql://fixture@localhost/fixture" },
  restoreRuntime: () => {},
  createClient: (input) => {
    options = input;
    return new FakeClient();
  },
  migrate: async () => {},
  log: () => {},
});
assert.equal(options.connectionTimeoutMillis, 10000);
console.log(
  "PASS the real predeploy entrypoint uses bounded connections and the shared transaction guard",
);
