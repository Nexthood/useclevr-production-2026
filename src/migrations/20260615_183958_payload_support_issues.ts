import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_support_issues_priority" AS ENUM('normal', 'urgent');
  CREATE TYPE "public"."enum_support_issues_status" AS ENUM('open', 'in_progress', 'resolved');
  CREATE TABLE "support_issues" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"user_id" varchar NOT NULL,
  	"user_email" varchar NOT NULL,
  	"subject" varchar NOT NULL,
  	"message" varchar NOT NULL,
  	"category" varchar DEFAULT 'General' NOT NULL,
  	"priority" "enum_support_issues_priority" DEFAULT 'normal' NOT NULL,
  	"status" "enum_support_issues_status" DEFAULT 'open' NOT NULL,
  	"admin_note" varchar,
  	"admin_name" varchar,
  	"admin_note_updated_at" timestamp(3) with time zone,
  	"resolved_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "payload_mcp_tool_list_dashboard_datasets" boolean DEFAULT true;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "payload_mcp_tool_get_dashboard_dataset_insights" boolean DEFAULT true;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "support_issues_id" varchar;
  CREATE INDEX "support_issues_user_id_idx" ON "support_issues" USING btree ("user_id");
  CREATE INDEX "support_issues_user_email_idx" ON "support_issues" USING btree ("user_email");
  CREATE INDEX "support_issues_status_idx" ON "support_issues" USING btree ("status");
  CREATE INDEX "support_issues_updated_at_idx" ON "support_issues" USING btree ("updated_at");
  CREATE INDEX "support_issues_created_at_idx" ON "support_issues" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_support_issues_fk" FOREIGN KEY ("support_issues_id") REFERENCES "public"."support_issues"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_support_issues_id_idx" ON "payload_locked_documents_rels" USING btree ("support_issues_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "support_issues" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "support_issues" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_support_issues_fk";
  
  DROP INDEX "payload_locked_documents_rels_support_issues_id_idx";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "payload_mcp_tool_list_dashboard_datasets";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "payload_mcp_tool_get_dashboard_dataset_insights";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "support_issues_id";
  DROP TYPE "public"."enum_support_issues_priority";
  DROP TYPE "public"."enum_support_issues_status";`)
}
