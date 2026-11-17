import { Client } from "pg";
import { pathToFileURL } from "node:url";

// Object presence is evidence of native prerequisites, not a migration receipt or release approval.
export const nativeSchemaSql = `
WITH required_tables(name) AS (VALUES
 ('PartnerContract'), ('PartnerContractDelivery'), ('PartnerContractTemplate'),
 ('PartnerContractSchedule'), ('PartnerContractProviderApproval'),
 ('PartnerContractNativeInvitation'), ('PartnerContractNativeSignature')
), required_triggers(table_name, name) AS (VALUES
 ('PartnerContractNativeInvitation', 'partner_native_invitation_guard'),
 ('PartnerContractNativeSignature', 'partner_native_signature_guard'),
 ('PartnerContractNativeSignature', 'partner_contract_append_only'),
 ('PartnerAccount', 'partner_contract_activation_guard')
), checks AS (
 SELECT 'table:' || name AS check_name, to_regclass(format('public.%I', name)) IS NOT NULL AS present
 FROM required_tables
 UNION ALL
 SELECT 'trigger:' || r.table_name || '.' || r.name,
 EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid=to_regclass(format('public.%I',r.table_name))
 AND t.tgname=r.name AND NOT t.tgisinternal AND t.tgenabled IN ('O','A')) FROM required_triggers r
 UNION ALL
 SELECT 'column:PartnerContractDelivery.payload', EXISTS (SELECT 1 FROM information_schema.columns
 WHERE table_schema='public' AND table_name='PartnerContractDelivery' AND column_name='payload' AND data_type='jsonb')
 UNION ALL
 SELECT 'index:PartnerNativeInvitation_active_role', EXISTS (SELECT 1 FROM pg_index
 WHERE indexrelid=to_regclass('public."PartnerNativeInvitation_active_role"') AND indisvalid AND indisunique)
 UNION ALL
 SELECT 'constraint:' || r.name, EXISTS (SELECT 1 FROM pg_constraint c
 WHERE c.conrelid=to_regclass('public."PartnerContract"') AND c.conname=r.name
 AND c.contype='c' AND c.convalidated AND pg_get_constraintdef(c.oid) LIKE '%''native''%')
 FROM (VALUES ('PartnerContract_mode_check'), ('PartnerContract_provider_check')) AS r(name)
 UNION ALL
 SELECT 'function:partner_contract_activation_guard.native', EXISTS (SELECT 1 FROM pg_proc p
 JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
 AND p.proname='partner_contract_activation_guard' AND p.pronargs=0
 AND p.prosrc LIKE '%PartnerContractNativeSignature%' AND p.prosrc LIKE '%Both native signatures required%')
)
SELECT check_name, present FROM checks ORDER BY check_name`;

export async function inspectNativeSchema(client) {
  await client.query("BEGIN READ ONLY");
  try {
    const { rows } = await client.query(nativeSchemaSql);
    const missing = rows.filter((row) => row.present !== true).map((row) => row.check_name);
    return {
      migration: "0045",
      prerequisiteObjectsPresent: rows.length === 16 && missing.length === 0,
      missing,
    };
  } finally {
    await client.query("ROLLBACK");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const connectionString = (process.env.DATABASE_URL || process.env.DIRECT_URL || "").trim();
  if (!connectionString) {
    console.error(
      "Set DATABASE_URL or DIRECT_URL privately for the intended application database.",
    );
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
      const result = await inspectNativeSchema(client);
      console.log(JSON.stringify(result, null, 2));
      if (!result.prerequisiteObjectsPresent) process.exitCode = 1;
    } catch {
      console.error("Read-only native schema check failed; verify access and schema privately.");
      process.exitCode = 1;
    } finally {
      await client.end();
    }
  }
}
