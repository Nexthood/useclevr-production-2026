/**
 * Hermetic test-schema bootstrap for scripts/risk-intelligence/test-risk-clevrsync-parity.ts.
 *
 * The GitHub Actions validation job runs every test:all suite against a bare
 * ephemeral PostgreSQL service (DATABASE_URL postgresql://ci:ci@localhost:5432/ci)
 * with no migrations applied. The parity suite is the only test:all member that
 * exercises real SQL persistence, so this bootstrap creates exactly the three
 * relations it touches ("User", "Dataset", "DatasetRow") idempotently, faithful
 * to the current shapes in src/lib/db/schema.ts and following the same
 * CREATE TABLE IF NOT EXISTS + ALTER ADD COLUMN IF NOT EXISTS idempotent pattern
 * used by scripts/runtime/railway-predeploy.cjs.
 *
 * Local developer databases already carry the full migration history, so every
 * statement is a no-op there and no journal, schema push, or provider state is
 * ever touched.
 */
import { Pool } from "pg"

const CREATE_USER_TABLE = `
  CREATE TABLE IF NOT EXISTS "User" (
    "id" text PRIMARY KEY NOT NULL,
    "name" text,
    "email" varchar(255),
    "emailVerified" timestamp,
    "image" text,
    "password" text,
    "createdAt" timestamp DEFAULT now(),
    CONSTRAINT "User_email_unique" UNIQUE("email")
  )`

const CREATE_DATASET_TABLE = `
  CREATE TABLE IF NOT EXISTS "Dataset" (
    "id" text PRIMARY KEY NOT NULL,
    "userId" text NOT NULL,
    "name" varchar(255) NOT NULL,
    "fileName" varchar(255) NOT NULL,
    "fileSize" integer,
    "mimeType" varchar(100),
    "storageKey" varchar(500),
    "checksum" varchar(64),
    "rowCount" integer DEFAULT 0 NOT NULL,
    "columnCount" integer DEFAULT 0 NOT NULL,
    "columns" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "data" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "columnTypes" jsonb,
    "previewRowCount" integer DEFAULT 1000,
    "previewGenerated" boolean DEFAULT false,
    "fullAnalysisCompleted" boolean DEFAULT false,
    "analysisStatus" varchar(50) DEFAULT 'uploading',
    "analysisProgress" integer DEFAULT 0,
    "analysisMessage" text,
    "analysisError" text,
    "invalidRowCount" integer DEFAULT 0,
    "missingValueCounts" jsonb,
    "precomputedMetrics" jsonb,
    "columnMapping" jsonb,
    "detectedColumns" jsonb,
    "aiInsights" jsonb,
    "datasetType" varchar(50) DEFAULT 'standard',
    "businessModel" varchar(50) DEFAULT 'generic',
    "source" varchar(50) DEFAULT 'unknown' NOT NULL,
    "status" varchar(255) DEFAULT 'processing' NOT NULL,
    "analysis" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp DEFAULT now() NOT NULL,
    "updatedAt" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "Dataset_userId_fkey" FOREIGN KEY ("userId")
      REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action
  )`

const CREATE_DATASET_ROW_TABLE = `
  CREATE TABLE IF NOT EXISTS "DatasetRow" (
    "id" text PRIMARY KEY NOT NULL,
    "datasetId" text NOT NULL,
    "rowIndex" integer NOT NULL,
    "data" jsonb NOT NULL,
    "createdAt" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "DatasetRow_datasetId_fkey" FOREIGN KEY ("datasetId")
      REFERENCES "public"."Dataset"("id") ON DELETE cascade ON UPDATE no action
  )`

/** Converge partially created databases onto the current Dataset column set. */
const ALTER_DATASET_COLUMNS = [
  `ALTER TABLE "Dataset" ADD COLUMN IF NOT EXISTS "mimeType" varchar(100)`,
  `ALTER TABLE "Dataset" ADD COLUMN IF NOT EXISTS "storageKey" varchar(500)`,
  `ALTER TABLE "Dataset" ADD COLUMN IF NOT EXISTS "checksum" varchar(64)`,
  `ALTER TABLE "Dataset" ADD COLUMN IF NOT EXISTS "columnTypes" jsonb`,
  `ALTER TABLE "Dataset" ADD COLUMN IF NOT EXISTS "previewRowCount" integer DEFAULT 1000`,
  `ALTER TABLE "Dataset" ADD COLUMN IF NOT EXISTS "previewGenerated" boolean DEFAULT false`,
  `ALTER TABLE "Dataset" ADD COLUMN IF NOT EXISTS "fullAnalysisCompleted" boolean DEFAULT false`,
  `ALTER TABLE "Dataset" ADD COLUMN IF NOT EXISTS "analysisStatus" varchar(50) DEFAULT 'uploading'`,
  `ALTER TABLE "Dataset" ADD COLUMN IF NOT EXISTS "analysisProgress" integer DEFAULT 0`,
  `ALTER TABLE "Dataset" ADD COLUMN IF NOT EXISTS "analysisMessage" text`,
  `ALTER TABLE "Dataset" ADD COLUMN IF NOT EXISTS "analysisError" text`,
  `ALTER TABLE "Dataset" ADD COLUMN IF NOT EXISTS "invalidRowCount" integer DEFAULT 0`,
  `ALTER TABLE "Dataset" ADD COLUMN IF NOT EXISTS "missingValueCounts" jsonb`,
  `ALTER TABLE "Dataset" ADD COLUMN IF NOT EXISTS "precomputedMetrics" jsonb`,
  `ALTER TABLE "Dataset" ADD COLUMN IF NOT EXISTS "columnMapping" jsonb`,
  `ALTER TABLE "Dataset" ADD COLUMN IF NOT EXISTS "detectedColumns" jsonb`,
  `ALTER TABLE "Dataset" ADD COLUMN IF NOT EXISTS "aiInsights" jsonb`,
  `ALTER TABLE "Dataset" ADD COLUMN IF NOT EXISTS "datasetType" varchar(50) DEFAULT 'standard'`,
  `ALTER TABLE "Dataset" ADD COLUMN IF NOT EXISTS "businessModel" varchar(50) DEFAULT 'generic'`,
  `ALTER TABLE "Dataset" ADD COLUMN IF NOT EXISTS "source" varchar(50) DEFAULT 'unknown'`,
  `ALTER TABLE "Dataset" ADD COLUMN IF NOT EXISTS "analysis" jsonb DEFAULT '{}'::jsonb`,
]

const PARITY_TABLE_INDEXES = [
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User" USING btree ("email")`,
  `CREATE INDEX IF NOT EXISTS "Dataset_userId_businessModel_idx" ON "Dataset" USING btree ("userId", "businessModel")`,
  `CREATE INDEX IF NOT EXISTS "DatasetRow_datasetId_idx" ON "DatasetRow" USING btree ("datasetId")`,
  `CREATE INDEX IF NOT EXISTS "DatasetRow_datasetId_rowIndex_idx" ON "DatasetRow" USING btree ("datasetId", "rowIndex")`,
]

/**
 * Ensure the parity-suite relations exist on the configured DATABASE_URL.
 * Never writes a migrations journal, never drops anything, and never touches
 * relations beyond the three named above.
 */
export async function ensureRiskClevrSyncParityTables() {
  const connectionString = (process.env.DATABASE_URL || process.env.DIRECT_URL || "").trim()
  if (!connectionString) {
    throw new Error("[PARITY TEST DB] DATABASE_URL not set - cannot prepare the hermetic test schema")
  }

  const pool = new Pool({ connectionString, max: 2 })
  const statements = [
    CREATE_USER_TABLE,
    CREATE_DATASET_TABLE,
    CREATE_DATASET_ROW_TABLE,
    ...ALTER_DATASET_COLUMNS,
    ...PARITY_TABLE_INDEXES,
  ]
  try {
    for (const statement of statements) {
      await pool.query(statement)
    }
  } finally {
    await pool.end()
  }
}
