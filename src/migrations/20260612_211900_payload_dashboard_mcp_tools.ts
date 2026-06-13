import { MigrateDownArgs, MigrateUpArgs, sql } from "@payloadcms/db-postgres"

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_mcp_api_keys"
      ADD COLUMN IF NOT EXISTS "payload_mcp_tool_list_dashboard_datasets" boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS "payload_mcp_tool_get_dashboard_dataset_insights" boolean DEFAULT false;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_mcp_api_keys"
      DROP COLUMN IF EXISTS "payload_mcp_tool_list_dashboard_datasets",
      DROP COLUMN IF EXISTS "payload_mcp_tool_get_dashboard_dataset_insights";
  `)
}
