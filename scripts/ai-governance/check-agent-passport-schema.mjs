import { Client } from "pg";

// Catalog metadata only. The connection and transaction both enforce read-only
// access; no account, passport, trace, or credential values enter the output.
const sql = `
WITH required_columns(table_name, column_name, nullable) AS (VALUES
  ('AiAgentPassport', 'id', 'NO'),
  ('AiAgentPassport', 'userId', 'NO'),
  ('AiAgentPassport', 'agentKey', 'NO'),
  ('AiAgentPassport', 'ownerName', 'NO'),
  ('AiAgentPassport', 'purpose', 'NO'),
  ('AiAgentPassport', 'declaredScope', 'NO'),
  ('AiAgentPassport', 'riskClass', 'NO'),
  ('AiAgentPassport', 'lifecycle', 'NO'),
  ('AiAgentPassport', 'createdAt', 'NO'),
  ('AiAgentPassport', 'updatedAt', 'NO'),
  ('AiInteractionTrace', 'agentPassportId', 'YES')
), required_constraints(table_name, constraint_name, kind) AS (VALUES
  ('AiAgentPassport', 'AiAgentPassport_pkey', 'p'),
  ('AiAgentPassport', 'AiAgentPassport_userId_fkey', 'f'),
  ('AiAgentPassport', 'AiAgentPassport_riskClass_check', 'c'),
  ('AiAgentPassport', 'AiAgentPassport_lifecycle_check', 'c'),
  ('AiAgentPassport', 'AiAgentPassport_ownerName_check', 'c'),
  ('AiAgentPassport', 'AiAgentPassport_purpose_check', 'c'),
  ('AiAgentPassport', 'AiAgentPassport_declaredScope_check', 'c'),
  ('AiInteractionTrace', 'AiInteractionTrace_agentPassportId_fkey', 'f')
), checks AS (
  SELECT 'column:' || r.table_name || '.' || r.column_name AS check_name,
    EXISTS (SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = r.table_name
        AND c.column_name = r.column_name AND c.is_nullable = r.nullable) AS present
  FROM required_columns r
  UNION ALL
  SELECT 'constraint:' || r.constraint_name,
    EXISTS (SELECT 1 FROM pg_constraint c
      WHERE c.conrelid = to_regclass(format('public.%I', r.table_name))
        AND c.conname = r.constraint_name AND c.contype::text = r.kind AND c.convalidated)
  FROM required_constraints r
  UNION ALL
  SELECT 'index:AiAgentPassport_userId_agentKey_key',
    EXISTS (SELECT 1 FROM pg_index i
      WHERE i.indexrelid = to_regclass('public."AiAgentPassport_userId_agentKey_key"')
        AND i.indrelid = to_regclass('public."AiAgentPassport"')
        AND i.indisvalid AND i.indisunique)
  UNION ALL
  SELECT 'index:AiInteractionTrace_agentPassportId_createdAt_idx',
    EXISTS (SELECT 1 FROM pg_index i
      WHERE i.indexrelid = to_regclass('public."AiInteractionTrace_agentPassportId_createdAt_idx"')
        AND i.indrelid = to_regclass('public."AiInteractionTrace"') AND i.indisvalid)
)
SELECT check_name, present FROM checks ORDER BY check_name`;

const connectionString = (process.env.DATABASE_URL || process.env.DIRECT_URL || "").trim();
if (!connectionString) {
  console.error("Set DATABASE_URL or DIRECT_URL for the target application database.");
  process.exitCode = 1;
} else {
  const client = new Client({
    connectionString,
    options: "-c default_transaction_read_only=on",
    connectionTimeoutMillis: 10000,
    query_timeout: 10000,
    statement_timeout: 10000,
  });
  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");
    const { rows } = await client.query(sql);
    await client.query("ROLLBACK");
    const missing = rows.filter((row) => !row.present).map((row) => row.check_name);
    console.log(
      JSON.stringify(
        { migration: "0037", schemaObjectsPresent: missing.length === 0, missing },
        null,
        2,
      ),
    );
    if (missing.length) process.exitCode = 1;
  } catch (error) {
    // Driver messages can contain connection details. Emit only the error code.
    console.error(
      "Read-only Passport schema check failed:",
      error.code || "connection/query error",
    );
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}
