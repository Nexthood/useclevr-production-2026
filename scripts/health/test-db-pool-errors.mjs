import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../../src/lib/db/index.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const keys = ["DATABASE_URL", "DIRECT_URL", "NODE_ENV", "NEON_USE_SERVERLESS", "NEON_USE_WS_POOL"];
const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
const originalError = console.error;
const messages = [];
console.error = (...args) => messages.push(args);
try {
  process.env.DATABASE_URL = "postgresql://fixture@127.0.0.1:1/fixture";
  process.env.DIRECT_URL = "";
  process.env.NODE_ENV = "production";
  process.env.NEON_USE_SERVERLESS = "false";
  for (const ws of [false, true]) {
    process.env.NEON_USE_WS_POOL = String(ws);
    let pool;
    let queries = 0;
    class MockPool extends EventEmitter {
      constructor(options) {
        super();
        this.options = options;
        pool = this;
      }
      async query() {
        queries++;
        throw Object.assign(new Error("sensitive query"), { code: "ECONNRESET" });
      }
    }
    const drizzle = (connection) => connection;
    const imports = {
      "@/lib/utils/debug": { debugLog() {}, debugError() {} },
      "@neondatabase/serverless": { Pool: MockPool },
      "drizzle-orm/neon-http": { drizzle },
      "drizzle-orm/neon-serverless": { drizzle },
      "drizzle-orm/node-postgres": { drizzle },
      pg: { Pool: MockPool },
      "./schema": {},
    };
    const exports = {};
    new Function("exports", "require", js)(exports, (name) => {
      assert.ok(Object.hasOwn(imports, name), `Unexpected dependency: ${name}`);
      return imports[name];
    });
    assert.equal(pool.listenerCount("error"), 1);
    assert.doesNotThrow(() => pool.emit("error", new Error("sensitive connection details")));
    assert.deepEqual(messages.pop(), [
      "[DB] Idle database connection failed; the pool discarded the connection.",
    ]);
    assert.equal(pool.options.connectionString, process.env.DATABASE_URL);
    assert.equal(pool.options.ssl, undefined, "TLS policy is unchanged");
    await assert.rejects(exports.db.query("fixture"), { code: "ECONNRESET" });
    assert.equal(queries, 1, "Failed queries are not retried or hidden");
    console.log(
      `PASS ${ws ? "Neon WebSocket" : "PostgreSQL"} idle errors handled; query failures propagate`,
    );
  }
} finally {
  console.error = originalError;
  for (const key of keys) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
}
