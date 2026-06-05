const { Client } = require("pg");

try {
  require("./load-env.cjs");
} catch {
  // Railway normally provides env vars directly.
}

const databaseUrl = (process.env.DIRECT_URL || process.env.DATABASE_URL || "").trim();

if (!databaseUrl) {
  console.error("DATABASE_URL or DIRECT_URL is required for Railway predeploy.");
  process.exit(1);
}

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
  `ALTER TABLE IF EXISTS "Profile" ADD COLUMN IF NOT EXISTS "stripeCustomerId" text`,
  `ALTER TABLE IF EXISTS "Profile" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" text`,
  `ALTER TABLE IF EXISTS "Profile" ADD COLUMN IF NOT EXISTS "stripePriceId" text`,
  `ALTER TABLE IF EXISTS "Profile" ADD COLUMN IF NOT EXISTS "stripeStatus" text`,
  `ALTER TABLE IF EXISTS "Profile" ADD COLUMN IF NOT EXISTS "stripeCurrentPeriodEnd" timestamp`,
  `ALTER TABLE IF EXISTS "Profile" ADD COLUMN IF NOT EXISTS "businessName" text`,
  `ALTER TABLE IF EXISTS "Profile" ADD COLUMN IF NOT EXISTS "businessEmail" text`,
  `ALTER TABLE IF EXISTS "Profile" ADD COLUMN IF NOT EXISTS "industry" text`,
  `ALTER TABLE IF EXISTS "Profile" ADD COLUMN IF NOT EXISTS "location" text`,
  `ALTER TABLE IF EXISTS "Profile" ADD COLUMN IF NOT EXISTS "website" text`,
  `ALTER TABLE IF EXISTS "Profile" ADD COLUMN IF NOT EXISTS "businessDescription" text`,

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
  `CREATE UNIQUE INDEX IF NOT EXISTS "Workspace_slug_key" ON "Workspace" USING btree ("slug")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceInvitation_email_workspaceId_key" ON "WorkspaceInvitation" USING btree ("email","workspaceId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceInvitation_token_key" ON "WorkspaceInvitation" USING btree ("token")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember" USING btree ("workspaceId","userId")`,
];

const constraints = [
  {
    name: "UserActivity_userId_fkey",
    table: "UserActivity",
    sql: `ALTER TABLE "UserActivity" ADD CONSTRAINT "UserActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action`,
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

async function main() {
  console.log("Railway predeploy starting...");
  console.log("DATABASE_URL present:", Boolean(process.env.DATABASE_URL));
  console.log("DIRECT_URL present:", Boolean(process.env.DIRECT_URL));

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

    const userTableExists = await tableExists(client, "User");

    for (const constraint of constraints) {
      const sourceTableExists = await tableExists(client, constraint.table);
      const alreadyExists = await constraintExists(client, constraint.name);

      if (sourceTableExists && userTableExists && !alreadyExists) {
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
    console.error("Railway predeploy failed:");
    console.error(error instanceof Error ? error.stack || error.message : error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
