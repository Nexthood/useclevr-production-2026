import assert from "node:assert/strict";
import { is, SQL, sql, getTableName } from "drizzle-orm";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import { assertChatGptTestEnvironment } from "./chatgpt-test-environment.mjs";

/** Build only the seven exercised tables, with their real defaults and constraints. */
export async function prepareChatGptTestDatabase(suite: "oauth" | "mcp") {
  const connectionString = assertChatGptTestEnvironment(suite);
  const schema = await import("../../src/lib/db/schema");
  const tables = [schema.users, schema.profiles, schema.emailVerificationCodes, schema.datasets,
    schema.datasetRows, schema.chatGptMcpOAuthCodes, schema.mcpAuditLogs];
  const pool = new Pool({ connectionString });
  const dialect = new PgDialect();
  const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
  try {
    const existing = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
    assert.equal(existing.rowCount, 0, "ChatGPT tests require an empty runner-owned database");
    for (const table of tables) {
      const config = getTableConfig(table);
      const columns = config.columns.map((column) => {
        const defaultSql = column.default === undefined ? "" : " DEFAULT " + dialect.sqlToQuery(
          is(column.default, SQL) ? column.default : sql`${sql.param(column.default, column)}`.inlineParams(),
        ).sql;
        const unique = column.isUnique ? ` CONSTRAINT ${quote(column.uniqueName || `${config.name}_${column.name}_unique`)} UNIQUE` : "";
        return `${quote(column.name)} ${column.getSQLType()}${column.notNull ? " NOT NULL" : ""}${column.primary ? " PRIMARY KEY" : ""}${unique}${defaultSql}`;
      });
      await pool.query(`CREATE TABLE ${quote(config.name)} (${columns.join(", ")})`);
      for (const index of config.indexes) {
        const indexColumns = index.config.columns.map((column) => {
          assert.ok("name" in column && typeof column.name === "string", "Test schema index must name a column");
          return quote(column.name);
        });
        await pool.query(`CREATE ${index.config.unique ? "UNIQUE " : ""}INDEX ${quote(index.config.name!)} ON ${quote(config.name)} (${indexColumns.join(", ")})`);
      }
    }
    for (const table of tables) {
      const config = getTableConfig(table);
      for (const foreignKey of config.foreignKeys) {
        const reference = foreignKey.reference();
        assert.ok(tables.some((candidate) => getTableName(candidate) === getTableName(reference.foreignTable)));
        await pool.query(`ALTER TABLE ${quote(config.name)} ADD CONSTRAINT ${quote(foreignKey.getName())} FOREIGN KEY (${reference.columns.map((column) => quote(column.name)).join(", ")}) REFERENCES ${quote(getTableName(reference.foreignTable))} (${reference.foreignColumns.map((column) => quote(column.name)).join(", ")}) ON DELETE ${foreignKey.onDelete || "no action"} ON UPDATE ${foreignKey.onUpdate || "no action"}`);
      }
    }
  } finally {
    await pool.end();
  }
}
