CREATE TABLE IF NOT EXISTS "AICostLog" (
  "id" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL,
  "organizationId" text,
  "subscriptionPlan" varchar(50),
  "provider" varchar(50) NOT NULL,
  "model" varchar(100) NOT NULL,
  "actionType" varchar(50) NOT NULL,
  "inputTokens" integer DEFAULT 0 NOT NULL,
  "outputTokens" integer DEFAULT 0 NOT NULL,
  "totalTokens" integer DEFAULT 0 NOT NULL,
  "estimatedCostEur" integer NOT NULL,
  "creditsCharged" integer NOT NULL,
  "requestStatus" varchar(20) DEFAULT 'success' NOT NULL,
  "errorMessage" text,
  "datasetId" text,
  "requestMetadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "latencyMs" integer,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE IF EXISTS "AICostLog" ADD COLUMN IF NOT EXISTS "id" text;
ALTER TABLE IF EXISTS "AICostLog" ADD COLUMN IF NOT EXISTS "userId" text;
ALTER TABLE IF EXISTS "AICostLog" ADD COLUMN IF NOT EXISTS "organizationId" text;
ALTER TABLE IF EXISTS "AICostLog" ADD COLUMN IF NOT EXISTS "subscriptionPlan" varchar(50);
ALTER TABLE IF EXISTS "AICostLog" ADD COLUMN IF NOT EXISTS "provider" varchar(50) DEFAULT 'system';
ALTER TABLE IF EXISTS "AICostLog" ADD COLUMN IF NOT EXISTS "model" varchar(100) DEFAULT 'system';
ALTER TABLE IF EXISTS "AICostLog" ADD COLUMN IF NOT EXISTS "actionType" varchar(50) DEFAULT 'report_generation';
ALTER TABLE IF EXISTS "AICostLog" ADD COLUMN IF NOT EXISTS "inputTokens" integer DEFAULT 0;
ALTER TABLE IF EXISTS "AICostLog" ADD COLUMN IF NOT EXISTS "outputTokens" integer DEFAULT 0;
ALTER TABLE IF EXISTS "AICostLog" ADD COLUMN IF NOT EXISTS "totalTokens" integer DEFAULT 0;
ALTER TABLE IF EXISTS "AICostLog" ADD COLUMN IF NOT EXISTS "estimatedCostEur" integer DEFAULT 0;
ALTER TABLE IF EXISTS "AICostLog" ADD COLUMN IF NOT EXISTS "creditsCharged" integer DEFAULT 0;
ALTER TABLE IF EXISTS "AICostLog" ADD COLUMN IF NOT EXISTS "requestStatus" varchar(20) DEFAULT 'success';
ALTER TABLE IF EXISTS "AICostLog" ADD COLUMN IF NOT EXISTS "errorMessage" text;
ALTER TABLE IF EXISTS "AICostLog" ADD COLUMN IF NOT EXISTS "datasetId" text;
ALTER TABLE IF EXISTS "AICostLog" ADD COLUMN IF NOT EXISTS "requestMetadata" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS "AICostLog" ADD COLUMN IF NOT EXISTS "latencyMs" integer;
ALTER TABLE IF EXISTS "AICostLog" ADD COLUMN IF NOT EXISTS "createdAt" timestamp DEFAULT now();

UPDATE "AICostLog"
SET
  "provider" = COALESCE("provider", 'system'),
  "model" = COALESCE("model", 'system'),
  "actionType" = COALESCE("actionType", 'report_generation'),
  "inputTokens" = COALESCE("inputTokens", 0),
  "outputTokens" = COALESCE("outputTokens", 0),
  "totalTokens" = COALESCE("totalTokens", COALESCE("inputTokens", 0) + COALESCE("outputTokens", 0)),
  "estimatedCostEur" = COALESCE("estimatedCostEur", 0),
  "creditsCharged" = COALESCE("creditsCharged", 0),
  "requestStatus" = COALESCE("requestStatus", 'success'),
  "requestMetadata" = COALESCE("requestMetadata", '{}'::jsonb),
  "createdAt" = COALESCE("createdAt", now());

ALTER TABLE IF EXISTS "AICostLog" ALTER COLUMN "provider" SET DEFAULT 'system';
ALTER TABLE IF EXISTS "AICostLog" ALTER COLUMN "model" SET DEFAULT 'system';
ALTER TABLE IF EXISTS "AICostLog" ALTER COLUMN "actionType" SET DEFAULT 'report_generation';
ALTER TABLE IF EXISTS "AICostLog" ALTER COLUMN "inputTokens" SET DEFAULT 0;
ALTER TABLE IF EXISTS "AICostLog" ALTER COLUMN "outputTokens" SET DEFAULT 0;
ALTER TABLE IF EXISTS "AICostLog" ALTER COLUMN "totalTokens" SET DEFAULT 0;
ALTER TABLE IF EXISTS "AICostLog" ALTER COLUMN "estimatedCostEur" SET DEFAULT 0;
ALTER TABLE IF EXISTS "AICostLog" ALTER COLUMN "creditsCharged" SET DEFAULT 0;
ALTER TABLE IF EXISTS "AICostLog" ALTER COLUMN "requestStatus" SET DEFAULT 'success';
ALTER TABLE IF EXISTS "AICostLog" ALTER COLUMN "requestMetadata" SET DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS "AICostLog" ALTER COLUMN "createdAt" SET DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'AICostLog'
      AND constraint_type = 'PRIMARY KEY'
  ) THEN
    UPDATE "AICostLog"
    SET "id" = 'acl_' || md5(random()::text || clock_timestamp()::text)
    WHERE "id" IS NULL;

    IF NOT EXISTS (
      SELECT 1
      FROM "AICostLog"
      GROUP BY "id"
      HAVING count(*) > 1
    ) THEN
      ALTER TABLE "AICostLog" ALTER COLUMN "id" SET NOT NULL;
      ALTER TABLE "AICostLog" ADD CONSTRAINT "AICostLog_pkey" PRIMARY KEY ("id");
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "AICostLog" WHERE "userId" IS NULL) THEN
    ALTER TABLE "AICostLog" ALTER COLUMN "userId" SET NOT NULL;
  END IF;

  ALTER TABLE "AICostLog" ALTER COLUMN "provider" SET NOT NULL;
  ALTER TABLE "AICostLog" ALTER COLUMN "model" SET NOT NULL;
  ALTER TABLE "AICostLog" ALTER COLUMN "actionType" SET NOT NULL;
  ALTER TABLE "AICostLog" ALTER COLUMN "inputTokens" SET NOT NULL;
  ALTER TABLE "AICostLog" ALTER COLUMN "outputTokens" SET NOT NULL;
  ALTER TABLE "AICostLog" ALTER COLUMN "totalTokens" SET NOT NULL;
  ALTER TABLE "AICostLog" ALTER COLUMN "estimatedCostEur" SET NOT NULL;
  ALTER TABLE "AICostLog" ALTER COLUMN "creditsCharged" SET NOT NULL;
  ALTER TABLE "AICostLog" ALTER COLUMN "requestStatus" SET NOT NULL;
  ALTER TABLE "AICostLog" ALTER COLUMN "requestMetadata" SET NOT NULL;
  ALTER TABLE "AICostLog" ALTER COLUMN "createdAt" SET NOT NULL;
END $$;

DO $$
BEGIN
  IF to_regclass('public."User"') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.table_constraints
       WHERE table_schema = 'public'
         AND table_name = 'AICostLog'
         AND constraint_name = 'AICostLog_userId_fkey'
     )
     AND NOT EXISTS (
       SELECT 1
       FROM "AICostLog" cost_log
       LEFT JOIN "User" app_user ON app_user."id" = cost_log."userId"
       WHERE app_user."id" IS NULL
     ) THEN
    ALTER TABLE "AICostLog"
      ADD CONSTRAINT "AICostLog_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE cascade;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "AICostLog_userId_idx" ON "AICostLog" ("userId");
CREATE INDEX IF NOT EXISTS "AICostLog_organizationId_idx" ON "AICostLog" ("organizationId");
CREATE INDEX IF NOT EXISTS "AICostLog_provider_idx" ON "AICostLog" ("provider");
CREATE INDEX IF NOT EXISTS "AICostLog_model_idx" ON "AICostLog" ("model");
CREATE INDEX IF NOT EXISTS "AICostLog_actionType_idx" ON "AICostLog" ("actionType");
CREATE INDEX IF NOT EXISTS "AICostLog_createdAt_idx" ON "AICostLog" ("createdAt");
CREATE INDEX IF NOT EXISTS "AICostLog_requestStatus_idx" ON "AICostLog" ("requestStatus");
