CREATE TABLE IF NOT EXISTS "PrebookkeepingLearningRule" (
  "id" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL,
  "supplierKey" text,
  "descriptionKeyword" text,
  "merchantKey" text,
  "category" varchar(80) NOT NULL,
  "source" varchar(40) DEFAULT 'manual_edit' NOT NULL,
  "usageCount" integer DEFAULT 0 NOT NULL,
  "lastUsedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "PrebookkeepingLearningRule_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "PrebookkeepingLearningRule_userId_idx"
  ON "PrebookkeepingLearningRule" ("userId");

CREATE INDEX IF NOT EXISTS "PrebookkeepingLearningRule_supplierKey_idx"
  ON "PrebookkeepingLearningRule" ("userId", "supplierKey");

CREATE INDEX IF NOT EXISTS "PrebookkeepingLearningRule_descriptionKeyword_idx"
  ON "PrebookkeepingLearningRule" ("userId", "descriptionKeyword");

CREATE TABLE IF NOT EXISTS "PrebookkeepingAuditEvent" (
  "id" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL,
  "datasetId" text NOT NULL,
  "rowIndex" integer,
  "action" varchar(80) NOT NULL,
  "before" jsonb,
  "after" jsonb,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "PrebookkeepingAuditEvent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE cascade,
  CONSTRAINT "PrebookkeepingAuditEvent_datasetId_fkey"
    FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "PrebookkeepingAuditEvent_datasetId_idx"
  ON "PrebookkeepingAuditEvent" ("datasetId");

CREATE INDEX IF NOT EXISTS "PrebookkeepingAuditEvent_userId_idx"
  ON "PrebookkeepingAuditEvent" ("userId");
