DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS lakebase_vector CASCADE;
EXCEPTION
  WHEN undefined_file OR feature_not_supported OR insufficient_privilege THEN
    RAISE NOTICE 'lakebase_vector is unavailable in this Neon branch; continuing with fallback retrieval.';
END $$;

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS lakebase_text CASCADE;
EXCEPTION
  WHEN undefined_file OR feature_not_supported OR insufficient_privilege THEN
    RAISE NOTICE 'lakebase_text is unavailable in this Neon branch; continuing with fallback retrieval.';
END $$;

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector CASCADE;
EXCEPTION
  WHEN undefined_file OR feature_not_supported OR insufficient_privilege THEN
    RAISE NOTICE 'pgvector is unavailable in this Neon branch; continuing with JSONB embedding storage and PostgreSQL full-text search.';
END $$;

CREATE TABLE IF NOT EXISTS "RetrievalDocument" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" text NOT NULL,
  "datasetId" text NOT NULL,
  "datasetType" varchar(50) NOT NULL,
  "sourceType" varchar(80) NOT NULL,
  "sourceRecordId" text NOT NULL,
  "content" text NOT NULL,
  "contentTsv" tsvector GENERATED ALWAYS AS (to_tsvector('simple', "content")) STORED,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "embedding" jsonb,
  "embeddingModel" varchar(160),
  "embeddingDimensions" integer,
  "contentHash" varchar(64) NOT NULL,
  "language" varchar(16) DEFAULT 'und' NOT NULL,
  "ingestionStatus" varchar(30) DEFAULT 'ready' NOT NULL,
  "ingestionError" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "RetrievalDocument_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE cascade,
  CONSTRAINT "RetrievalDocument_datasetId_fkey"
    FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE cascade,
  CONSTRAINT "RetrievalDocument_datasetType_check"
    CHECK ("datasetType" IN ('standard', 'retail', 'profitability', 'accountancy', 'prebookkeeping')),
  CONSTRAINT "RetrievalDocument_embedding_dimensions_check"
    CHECK ("embeddingDimensions" IS NULL OR "embeddingDimensions" > 0)
);

CREATE TABLE IF NOT EXISTS "AccuracyIngestionJob" (
  "id" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL,
  "datasetId" text NOT NULL,
  "datasetType" varchar(50) NOT NULL,
  "status" varchar(30) DEFAULT 'pending' NOT NULL,
  "documentCount" integer DEFAULT 0 NOT NULL,
  "embeddedCount" integer DEFAULT 0 NOT NULL,
  "skippedCount" integer DEFAULT 0 NOT NULL,
  "errorMessage" text,
  "startedAt" timestamp,
  "completedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "AccuracyIngestionJob_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE cascade,
  CONSTRAINT "AccuracyIngestionJob_datasetId_fkey"
    FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE cascade,
  CONSTRAINT "AccuracyIngestionJob_datasetType_check"
    CHECK ("datasetType" IN ('standard', 'retail', 'profitability', 'accountancy', 'prebookkeeping')),
  CONSTRAINT "AccuracyIngestionJob_status_check"
    CHECK ("status" IN ('pending', 'running', 'completed', 'failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "RetrievalDocument_source_unique_idx"
  ON "RetrievalDocument" ("userId", "datasetId", "sourceType", "sourceRecordId");

CREATE INDEX IF NOT EXISTS "RetrievalDocument_userId_datasetId_idx"
  ON "RetrievalDocument" ("userId", "datasetId");

CREATE INDEX IF NOT EXISTS "RetrievalDocument_datasetType_idx"
  ON "RetrievalDocument" ("datasetType");

CREATE INDEX IF NOT EXISTS "RetrievalDocument_contentHash_idx"
  ON "RetrievalDocument" ("contentHash");

CREATE INDEX IF NOT EXISTS "RetrievalDocument_metadata_gin_idx"
  ON "RetrievalDocument" USING gin ("metadata");

CREATE INDEX IF NOT EXISTS "RetrievalDocument_content_fts_idx"
  ON "RetrievalDocument" USING gin ("contentTsv");

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'lakebase_text') THEN
    CREATE INDEX "RetrievalDocument_content_bm25_idx"
      ON "RetrievalDocument" USING lakebase_bm25 ("contentTsv");
  END IF;
EXCEPTION
  WHEN duplicate_table OR duplicate_object THEN
    NULL;
  WHEN undefined_object OR feature_not_supported THEN
    RAISE NOTICE 'lakebase_bm25 index is unavailable; PostgreSQL full-text search index remains active.';
END $$;

COMMENT ON COLUMN "RetrievalDocument"."embedding" IS
  'JSONB embedding storage for Phase 1. Create a VECTOR(n) companion column and lakebase_ann index only after the production embedding model and dimension are fixed.';

CREATE INDEX IF NOT EXISTS "AccuracyIngestionJob_datasetId_idx"
  ON "AccuracyIngestionJob" ("datasetId");

CREATE INDEX IF NOT EXISTS "AccuracyIngestionJob_userId_status_idx"
  ON "AccuracyIngestionJob" ("userId", "status");

ALTER TABLE "RetrievalDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccuracyIngestionJob" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "RetrievalDocument_tenant_isolation" ON "RetrievalDocument";
CREATE POLICY "RetrievalDocument_tenant_isolation" ON "RetrievalDocument"
  USING ("userId" = current_setting('app.current_user_id', true));

DROP POLICY IF EXISTS "AccuracyIngestionJob_tenant_isolation" ON "AccuracyIngestionJob";
CREATE POLICY "AccuracyIngestionJob_tenant_isolation" ON "AccuracyIngestionJob"
  USING ("userId" = current_setting('app.current_user_id', true));
