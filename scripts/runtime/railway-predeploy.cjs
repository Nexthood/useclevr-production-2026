const path = require("node:path");
const fs = require("node:fs");
const { Client } = require("pg");

try {
  require("./load-env.cjs");
} catch {
  // Railway normally provides env vars directly.
}

const databaseUrl = (process.env.DIRECT_URL || process.env.DATABASE_URL || "").trim();

const shouldUseSsl =
  databaseUrl.includes("sslmode=require") ||
  databaseUrl.includes("sslmode=verify-full") ||
  databaseUrl.includes("neon.tech") ||
  databaseUrl.includes("railway.app");

const statements = [
  `CREATE TABLE IF NOT EXISTS "AppSetting" (
    "key" varchar(120) PRIMARY KEY NOT NULL,
    "value" jsonb NOT NULL,
    "updatedAt" timestamp DEFAULT now() NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "Business" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
    "name" text NOT NULL,
    "companyNumber" text,
    "address" text,
    "email" text,
    "industry" text,
    "website" text,
    "description" text,
    "status" varchar(30) DEFAULT 'draft' NOT NULL,
    "isPrimary" boolean DEFAULT false NOT NULL,
    "localeSettings" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "invoiceSettings" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "companySetup" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "archivedAt" timestamp,
    "archiveExpiresAt" timestamp,
    "createdAt" timestamp DEFAULT now() NOT NULL,
    "updatedAt" timestamp DEFAULT now() NOT NULL
  )`,

  `ALTER TABLE IF EXISTS "Dataset" ADD COLUMN IF NOT EXISTS "mimeType" varchar(100)`,
  `ALTER TABLE IF EXISTS "Dataset" ADD COLUMN IF NOT EXISTS "storageKey" varchar(500)`,
  `ALTER TABLE IF EXISTS "Dataset" ADD COLUMN IF NOT EXISTS "checksum" varchar(64)`,
  `ALTER TABLE IF EXISTS "Dataset" ADD COLUMN IF NOT EXISTS "data" jsonb DEFAULT '[]'::jsonb NOT NULL`,
  `ALTER TABLE IF EXISTS "Dataset" ADD COLUMN IF NOT EXISTS "previewRowCount" integer DEFAULT 1000`,
  `ALTER TABLE IF EXISTS "Dataset" ADD COLUMN IF NOT EXISTS "previewGenerated" boolean DEFAULT false`,
  `ALTER TABLE IF EXISTS "Dataset" ADD COLUMN IF NOT EXISTS "fullAnalysisCompleted" boolean DEFAULT false`,
  `ALTER TABLE IF EXISTS "Dataset" ADD COLUMN IF NOT EXISTS "analysisStatus" varchar(50) DEFAULT 'uploading'`,
  `ALTER TABLE IF EXISTS "Dataset" ADD COLUMN IF NOT EXISTS "analysisProgress" integer DEFAULT 0`,
  `ALTER TABLE IF EXISTS "Dataset" ADD COLUMN IF NOT EXISTS "analysisMessage" text`,
  `ALTER TABLE IF EXISTS "Dataset" ADD COLUMN IF NOT EXISTS "analysisError" text`,
  `ALTER TABLE IF EXISTS "Dataset" ADD COLUMN IF NOT EXISTS "invalidRowCount" integer DEFAULT 0`,
  `ALTER TABLE IF EXISTS "Dataset" ADD COLUMN IF NOT EXISTS "missingValueCounts" jsonb`,
  `ALTER TABLE IF EXISTS "Dataset" ADD COLUMN IF NOT EXISTS "precomputedMetrics" jsonb`,
  `ALTER TABLE IF EXISTS "Dataset" ADD COLUMN IF NOT EXISTS "columnMapping" jsonb`,
  `ALTER TABLE IF EXISTS "Dataset" ADD COLUMN IF NOT EXISTS "detectedColumns" jsonb`,
  `ALTER TABLE IF EXISTS "Dataset" ADD COLUMN IF NOT EXISTS "aiInsights" jsonb`,

  `ALTER TABLE IF EXISTS "Profile" ADD COLUMN IF NOT EXISTS "analysisCount" integer DEFAULT 0 NOT NULL`,
  `ALTER TABLE IF EXISTS "Profile" ADD COLUMN IF NOT EXISTS "preferredCurrency" varchar(3) DEFAULT 'EUR' NOT NULL`,
  `ALTER TABLE IF EXISTS "Profile" ADD COLUMN IF NOT EXISTS "numberFormat" varchar(10) DEFAULT 'auto' NOT NULL`,
  `ALTER TABLE IF EXISTS "Profile" ADD COLUMN IF NOT EXISTS "themePreference" varchar(20) DEFAULT 'system' NOT NULL`,
  `ALTER TABLE IF EXISTS "Profile" ADD COLUMN IF NOT EXISTS "mentorshipUsed" integer DEFAULT 0 NOT NULL`,
  `ALTER TABLE IF EXISTS "Profile" ALTER COLUMN "updatedAt" SET DEFAULT now()`,
  `ALTER TABLE IF EXISTS "Profile" ADD COLUMN IF NOT EXISTS "stripeCustomerId" text`,
  `ALTER TABLE IF EXISTS "Profile" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" text`,
  `ALTER TABLE IF EXISTS "Profile" ADD COLUMN IF NOT EXISTS "stripePriceId" text`,
  `ALTER TABLE IF EXISTS "Profile" ADD COLUMN IF NOT EXISTS "stripeStatus" text`,
  `ALTER TABLE IF EXISTS "Profile" ADD COLUMN IF NOT EXISTS "stripeCurrentPeriodEnd" timestamp`,
  `ALTER TABLE IF EXISTS "Profile" ADD COLUMN IF NOT EXISTS "businessName" text`,
  `ALTER TABLE IF EXISTS "Profile" ADD COLUMN IF NOT EXISTS "firstName" varchar(120)`,
  `ALTER TABLE IF EXISTS "Profile" ADD COLUMN IF NOT EXISTS "companyName" text`,
  `ALTER TABLE IF EXISTS "Profile" ADD COLUMN IF NOT EXISTS "role" varchar(80)`,
  `ALTER TABLE IF EXISTS "Profile" ADD COLUMN IF NOT EXISTS "businessEmail" text`,
  `ALTER TABLE IF EXISTS "Profile" ADD COLUMN IF NOT EXISTS "industry" text`,
  `ALTER TABLE IF EXISTS "Profile" ADD COLUMN IF NOT EXISTS "location" text`,
  `ALTER TABLE IF EXISTS "Profile" ADD COLUMN IF NOT EXISTS "website" text`,
  `ALTER TABLE IF EXISTS "Profile" ADD COLUMN IF NOT EXISTS "businessDescription" text`,

  `ALTER TABLE IF EXISTS "Business" ADD COLUMN IF NOT EXISTS "companyNumber" text`,
  `ALTER TABLE IF EXISTS "Business" ADD COLUMN IF NOT EXISTS "companySetup" jsonb DEFAULT '{}'::jsonb NOT NULL`,
  `ALTER TABLE IF EXISTS "Business" ADD COLUMN IF NOT EXISTS "archivedAt" timestamp`,
  `ALTER TABLE IF EXISTS "Business" ADD COLUMN IF NOT EXISTS "archiveExpiresAt" timestamp`,
  `ALTER TABLE IF EXISTS "Dataset" ALTER COLUMN "updatedAt" SET DEFAULT now()`,
  `ALTER TABLE IF EXISTS "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_list_dashboard_datasets" boolean DEFAULT false`,
  `ALTER TABLE IF EXISTS "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_get_dashboard_dataset_insights" boolean DEFAULT false`,

  `DO $$
  BEGIN
    CREATE TYPE "public"."enum_support_issues_priority" AS ENUM ('normal', 'urgent');
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END $$`,

  `DO $$
  BEGIN
    CREATE TYPE "public"."enum_support_issues_status" AS ENUM ('open', 'in_progress', 'resolved');
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END $$`,

  `CREATE TABLE IF NOT EXISTS "support_issues" (
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
  )`,

  `ALTER TABLE IF EXISTS "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "support_issues_id" varchar`,
  `CREATE INDEX IF NOT EXISTS "support_issues_user_id_idx" ON "support_issues" USING btree ("user_id")`,
  `CREATE INDEX IF NOT EXISTS "support_issues_user_email_idx" ON "support_issues" USING btree ("user_email")`,
  `CREATE INDEX IF NOT EXISTS "support_issues_status_idx" ON "support_issues" USING btree ("status")`,
  `CREATE INDEX IF NOT EXISTS "support_issues_updated_at_idx" ON "support_issues" USING btree ("updated_at")`,
  `CREATE INDEX IF NOT EXISTS "support_issues_created_at_idx" ON "support_issues" USING btree ("created_at")`,
  `DO $$
  BEGIN
    IF to_regclass('public.payload_locked_documents_rels') IS NOT NULL THEN
      CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_support_issues_id_idx"
        ON "payload_locked_documents_rels" USING btree ("support_issues_id");
    END IF;
  END $$`,

  `CREATE TABLE IF NOT EXISTS "ReferralEvent" (
    "id" text PRIMARY KEY NOT NULL,
    "code" varchar(32) NOT NULL,
    "type" varchar(20) NOT NULL,
    "eventKey" varchar(255) NOT NULL,
    "referredUserId" text,
    "referredEmail" varchar(255),
    "createdAt" timestamp DEFAULT now() NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "ReferralStats" (
    "code" varchar(32) PRIMARY KEY NOT NULL,
    "ownerUserId" text,
    "ownerEmail" varchar(255),
    "clicks" integer DEFAULT 0 NOT NULL,
    "signups" integer DEFAULT 0 NOT NULL,
    "paidReferrals" integer DEFAULT 0 NOT NULL,
    "creditsEarned" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp DEFAULT now() NOT NULL,
    "updatedAt" timestamp DEFAULT now() NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "SupportTicket" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
    "userEmail" varchar(255) NOT NULL,
    "subject" text NOT NULL,
    "message" text NOT NULL,
    "category" varchar(80) DEFAULT 'General' NOT NULL,
    "priority" varchar(20) DEFAULT 'normal' NOT NULL,
    "status" varchar(30) DEFAULT 'open' NOT NULL,
    "adminNote" text DEFAULT '' NOT NULL,
    "createdAt" timestamp DEFAULT now() NOT NULL,
    "updatedAt" timestamp DEFAULT now() NOT NULL,
    "resolvedAt" timestamp
  )`,

  `CREATE TABLE IF NOT EXISTS "EmailVerificationCode" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text,
    "email" varchar(255) NOT NULL,
    "codeHash" text NOT NULL,
    "purpose" varchar(20) NOT NULL,
    "expiresAt" timestamp NOT NULL,
    "usedAt" timestamp,
    "attempts" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp DEFAULT now() NOT NULL
  )`,

  `INSERT INTO "support_issues" (
    "id",
    "user_id",
    "user_email",
    "subject",
    "message",
    "category",
    "priority",
    "status",
    "admin_note",
    "admin_name",
    "created_at",
    "updated_at",
    "resolved_at"
  )
  SELECT
    "id",
    "userId",
    "userEmail",
    "subject",
    "message",
    "category",
    CASE WHEN "priority" = 'urgent' THEN 'urgent' ELSE 'normal' END::"enum_support_issues_priority",
    CASE
      WHEN "status" = 'in_progress' THEN 'in_progress'
      WHEN "status" = 'resolved' THEN 'resolved'
      ELSE 'open'
    END::"enum_support_issues_status",
    "adminNote",
    '',
    "createdAt",
    "updatedAt",
    "resolvedAt"
  FROM "SupportTicket"
  ON CONFLICT ("id") DO NOTHING`,

  `CREATE TABLE IF NOT EXISTS "UserActivity" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
    "userEmail" varchar(255),
    "type" varchar(80) NOT NULL,
    "feature" varchar(80) NOT NULL,
    "title" text NOT NULL,
    "description" text,
    "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp DEFAULT now() NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "Waitlist" (
    "id" text PRIMARY KEY NOT NULL,
    "email" varchar(255) NOT NULL,
    "source" varchar(50) DEFAULT 'landing_page',
    "status" varchar(50) DEFAULT 'new',
    "createdAt" timestamp DEFAULT now() NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "Workspace" (
    "id" text PRIMARY KEY NOT NULL,
    "name" varchar(255) NOT NULL,
    "slug" varchar(255) NOT NULL,
    "description" text,
    "avatarUrl" text,
    "ownerId" text NOT NULL,
    "createdAt" timestamp DEFAULT now() NOT NULL,
    "updatedAt" timestamp DEFAULT now() NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "WorkspaceInvitation" (
    "id" text PRIMARY KEY NOT NULL,
    "workspaceId" text NOT NULL,
    "email" varchar(255) NOT NULL,
    "role" varchar(50) NOT NULL,
    "invitedBy" text NOT NULL,
    "token" varchar(255) NOT NULL,
    "expiresAt" timestamp NOT NULL,
    "status" varchar(50) DEFAULT 'pending' NOT NULL,
    "createdAt" timestamp DEFAULT now() NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS "WorkspaceMember" (
    "id" text PRIMARY KEY NOT NULL,
    "workspaceId" text NOT NULL,
    "userId" text NOT NULL,
    "role" varchar(50) NOT NULL,
    "invitedBy" text,
    "joinedAt" timestamp DEFAULT now() NOT NULL
  )`,

  `CREATE UNIQUE INDEX IF NOT EXISTS "AppSetting_key_key" ON "AppSetting" USING btree ("key")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ReferralEvent_eventKey_key" ON "ReferralEvent" USING btree ("eventKey")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ReferralStats_code_key" ON "ReferralStats" USING btree ("code")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Waitlist_email_key" ON "Waitlist" USING btree ("email")`,
  `CREATE INDEX IF NOT EXISTS "EmailVerificationCode_email_purpose_idx" ON "EmailVerificationCode" USING btree ("email","purpose")`,
  `CREATE INDEX IF NOT EXISTS "EmailVerificationCode_userId_purpose_idx" ON "EmailVerificationCode" USING btree ("userId","purpose")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Workspace_slug_key" ON "Workspace" USING btree ("slug")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceInvitation_email_workspaceId_key" ON "WorkspaceInvitation" USING btree ("email","workspaceId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceInvitation_token_key" ON "WorkspaceInvitation" USING btree ("token")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember" USING btree ("workspaceId","userId")`,
];

function readMigrationStatement(relativePath) {
  const migrationPath = path.join(__dirname, "..", "..", relativePath);
  if (!fs.existsSync(migrationPath)) {
    throw new Error(`Required migration file is missing: ${relativePath}`);
  }
  return fs.readFileSync(migrationPath, "utf8");
}

const migrationStatements = [
  readMigrationStatement("src/lib/db/migrations/0004_byoai_provider_config.sql"),
  readMigrationStatement("src/lib/db/migrations/0005_ai_provider_manager.sql"),
  readMigrationStatement("src/lib/db/migrations/0006_ai_provider_priority.sql"),
  readMigrationStatement("src/lib/db/migrations/0007_ai_request_audit_logs.sql"),
  readMigrationStatement("src/lib/db/migrations/0015_retail_pos_integrations.sql"),
  readMigrationStatement("src/lib/db/migrations/0016_byok_provider_audit_metadata.sql"),
  readMigrationStatement("src/lib/db/migrations/0017_square_provider_environment.sql"),
  readMigrationStatement("src/lib/db/migrations/0018_business_profile_ssot.sql"),
  readMigrationStatement("src/lib/db/migrations/0019_prebookkeeping_review_learning.sql"),
  readMigrationStatement("src/lib/db/migrations/0021_ai_governance_fresh_install_support.sql"),
  readMigrationStatement("src/lib/db/migrations/0020_ai_governance_overrides.sql"),
  readMigrationStatement("src/lib/db/migrations/0022_upload_credit_usage_persistence.sql"),
  readMigrationStatement("src/lib/db/migrations/0024_credit_topup_reconciliation.sql"),
  readMigrationStatement("src/lib/db/migrations/0025_billing_settings.sql"),
  readMigrationStatement("src/lib/db/migrations/0026_ai_cost_log_schema.sql"),
  readMigrationStatement("src/lib/db/migrations/0027_credit_ledger_current_columns.sql"),
];

const constraints = [
  {
    name: "payload_locked_documents_rels_support_issues_fk",
    table: "payload_locked_documents_rels",
    targetTable: "support_issues",
    sql: `ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_support_issues_fk" FOREIGN KEY ("support_issues_id") REFERENCES "public"."support_issues"("id") ON DELETE cascade ON UPDATE no action`,
  },
  {
    name: "Business_userId_fkey",
    table: "Business",
    sql: `ALTER TABLE "Business" ADD CONSTRAINT "Business_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action`,
  },
  {
    name: "UserActivity_userId_fkey",
    table: "UserActivity",
    sql: `ALTER TABLE "UserActivity" ADD CONSTRAINT "UserActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action`,
  },
  {
    name: "EmailVerificationCode_userId_fkey",
    table: "EmailVerificationCode",
    sql: `ALTER TABLE "EmailVerificationCode" ADD CONSTRAINT "EmailVerificationCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action`,
  },
  {
    name: "WorkspaceInvitation_workspaceId_fkey",
    table: "WorkspaceInvitation",
    sql: `ALTER TABLE "WorkspaceInvitation" ADD CONSTRAINT "WorkspaceInvitation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE cascade ON UPDATE no action`,
  },
  {
    name: "WorkspaceMember_workspaceId_fkey",
    table: "WorkspaceMember",
    sql: `ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE cascade ON UPDATE no action`,
  },
  {
    name: "WorkspaceMember_userId_fkey",
    table: "WorkspaceMember",
    sql: `ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action`,
  },
  {
    name: "Workspace_ownerId_fkey",
    table: "Workspace",
    sql: `ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action`,
  },
];

// Tables that have an updatedAt column requiring an auto-update trigger
const updateTriggerTables = [
  "Profile",
  "Business",
  "BusinessEntity",
  "Dataset",
  "SupportTicket",
  "Workspace",
  "ReferralStats",
  "AppSetting",
];

// Idempotent trigger function that sets updatedAt to the current timestamp on every row update
const updateTriggerFn = `
  CREATE OR REPLACE FUNCTION update_updatedat_column()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
`;

async function functionExists(client, fnName) {
  const result = await client.query(`SELECT 1 FROM pg_proc WHERE proname = $1 LIMIT 1`, [fnName]);
  return result.rowCount > 0;
}

async function triggerExists(client, triggerName, tableName) {
  const result = await client.query(
    `SELECT 1 FROM pg_trigger WHERE tgname = $1 AND tgrelid = to_regclass($2) LIMIT 1`,
    [triggerName, `public."${tableName}"`],
  );
  return result.rowCount > 0;
}

async function tableExists(client, tableName) {
  const result = await client.query(`SELECT to_regclass($1) AS exists`, [`public."${tableName}"`]);

  return Boolean(result.rows[0]?.exists);
}

async function constraintExists(client, constraintName) {
  const result = await client.query(`SELECT 1 FROM pg_constraint WHERE conname = $1 LIMIT 1`, [
    constraintName,
  ]);

  return result.rowCount > 0;
}

function restoreNextBuildDir() {
  // Restore next/dist/build/ from next-build-extra spare copy into any pnpm store
  // entry that lacks it. Next.js standalone needs ../build/output/log at runtime
  // but the CI publish step may drop files inside .pnpm/ during git branch creation.
  const buildExtra = path.join(__dirname, "..", "..", "next-build-extra");
  if (!fs.existsSync(buildExtra)) return;
  const nm = path.join(__dirname, "..", "..", "node_modules");
  const pnpmDir = path.join(nm, ".pnpm");
  if (!fs.existsSync(pnpmDir)) return;
  let restored = 0;
  for (const entry of fs.readdirSync(pnpmDir, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name.startsWith("next@")) {
      const nextDir = path.join(pnpmDir, entry.name, "node_modules", "next");
      const buildDir = path.join(nextDir, "dist", "build");
      const logFile = path.join(buildDir, "output", "log.js");
      if (!fs.existsSync(logFile)) {
        try {
          fs.rmSync(buildDir, { recursive: true, force: true });
          fs.mkdirSync(buildDir, { recursive: true });
          fs.cpSync(buildExtra, buildDir, { recursive: true });
          restored++;
        } catch {
          // Non-critical — runtime fallback in start-dist.cjs handles this too
        }
      }
    }
  }
  if (restored > 0) {
    console.log("Restored next/dist/build/ into " + restored + " next package(s)");
  }
}

async function main() {
  console.log("Railway predeploy starting...");

  // Restore next/dist/build/ before any database work — this ensures the Next.js
  // runtime files are present in the pnpm store even if CI publishing dropped them.
  restoreNextBuildDir();

  console.log("DATABASE_URL present:", Boolean(process.env.DATABASE_URL));
  console.log("DIRECT_URL present:", Boolean(process.env.DIRECT_URL));

  if (!databaseUrl) {
    console.log("No database URL — skipping schema sync.");
    return;
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: shouldUseSsl ? { rejectUnauthorized: false } : undefined,
  });

  await client.connect();

  try {
    await client.query("BEGIN");

    for (const statement of statements) {
      await client.query(statement);
    }

    for (const statement of migrationStatements) {
      await client.query(statement);
    }

    for (const constraint of constraints) {
      const sourceTableExists = await tableExists(client, constraint.table);
      const targetTableExists = await tableExists(client, constraint.targetTable || "User");
      const alreadyExists = await constraintExists(client, constraint.name);

      if (sourceTableExists && targetTableExists && !alreadyExists) {
        await client.query(constraint.sql);
      }
    }

    // Apply auto-updatedAt triggers
    {
      const fnName = "update_updatedat_column";
      const fnExists = await functionExists(client, fnName);

      if (!fnExists) {
        await client.query(updateTriggerFn);
        console.log(`Created function ${fnName}`);
      }

      for (const tableName of updateTriggerTables) {
        const tName = tableName;
        const triggerName = `trg_${tName}_updatedat`;
        const tblExists = await tableExists(client, tName);
        const trgExists = await triggerExists(client, triggerName, tName);

        if (tblExists && !trgExists) {
          await client.query(
            `CREATE TRIGGER "${triggerName}" BEFORE UPDATE ON "public"."${tName}" FOR EACH ROW EXECUTE FUNCTION update_updatedat_column()`,
          );
          console.log(`Created trigger ${triggerName} on ${tName}`);
        }
      }
    }

    await client.query("COMMIT");
    console.log("Railway predeploy schema sync complete.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Railway predeploy schema sync failed:");
    console.error(error instanceof Error ? error.stack || error.message : error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
