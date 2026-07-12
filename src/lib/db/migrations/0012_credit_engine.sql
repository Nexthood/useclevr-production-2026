ALTER TABLE "UserCredit"
  ADD COLUMN IF NOT EXISTS "reservedCredits" integer DEFAULT 0 NOT NULL;

UPDATE "UserCredit"
SET "reservedCredits" = 0
WHERE "reservedCredits" IS NULL;

ALTER TABLE "CreditLedger"
  ADD COLUMN IF NOT EXISTS "workspaceId" text,
  ADD COLUMN IF NOT EXISTS "transactionType" varchar(30),
  ADD COLUMN IF NOT EXISTS "status" varchar(30) DEFAULT 'finalized' NOT NULL,
  ADD COLUMN IF NOT EXISTS "operationId" text,
  ADD COLUMN IF NOT EXISTS "idempotencyKey" text,
  ADD COLUMN IF NOT EXISTS "credits" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "source" varchar(50),
  ADD COLUMN IF NOT EXISTS "feature" varchar(100),
  ADD COLUMN IF NOT EXISTS "provider" varchar(50),
  ADD COLUMN IF NOT EXISTS "model" varchar(100),
  ADD COLUMN IF NOT EXISTS "inputTokens" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "outputTokens" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "thinkingTokens" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "cachedTokens" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "embeddingTokens" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "estimatedProviderCost" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "currency" varchar(3) DEFAULT 'EUR' NOT NULL,
  ADD COLUMN IF NOT EXISTS "pricingVersion" varchar(40),
  ADD COLUMN IF NOT EXISTS "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS "finalizedAt" timestamp;

UPDATE "CreditLedger"
SET
  "workspaceId" = COALESCE("workspaceId", "userId"),
  "transactionType" = COALESCE(
    "transactionType",
    CASE "type"
      WHEN 'credit_grant' THEN 'grant'
      WHEN 'credit_used' THEN 'charge'
      WHEN 'credit_refund' THEN 'refund'
      WHEN 'credit_adjustment' THEN 'adjustment'
      WHEN 'monthly_reset' THEN 'subscription_reset'
      WHEN 'subscription_upgrade' THEN 'subscription_reset'
      WHEN 'subscription_downgrade' THEN 'subscription_reset'
      ELSE "type"
    END
  ),
  "credits" = CASE WHEN "credits" = 0 THEN ABS("amount") ELSE "credits" END,
  "feature" = COALESCE("feature", "action"),
  "source" = COALESCE("source", 'legacy'),
  "finalizedAt" = CASE
    WHEN "status" = 'finalized' THEN COALESCE("finalizedAt", "createdAt")
    ELSE "finalizedAt"
  END
WHERE "workspaceId" IS NULL
   OR "transactionType" IS NULL
   OR "feature" IS NULL
   OR "source" IS NULL
   OR ("status" = 'finalized' AND "finalizedAt" IS NULL);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'CreditLedger_status_check'
      AND conrelid = '"CreditLedger"'::regclass
  ) THEN
    ALTER TABLE "CreditLedger"
      ADD CONSTRAINT "CreditLedger_status_check"
      CHECK ("status" IN ('pending', 'finalized', 'released', 'refunded', 'failed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'CreditLedger_transactionType_check'
      AND conrelid = '"CreditLedger"'::regclass
  ) THEN
    ALTER TABLE "CreditLedger"
      ADD CONSTRAINT "CreditLedger_transactionType_check"
      CHECK (
        "transactionType" IS NULL OR
        "transactionType" IN (
          'grant',
          'purchase',
          'subscription_reset',
          'reservation',
          'charge',
          'release',
          'refund',
          'adjustment',
          'expiry',
          'credit_grant',
          'credit_used',
          'credit_refund',
          'credit_adjustment',
          'monthly_reset',
          'subscription_upgrade',
          'subscription_downgrade'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "CreditLedger_workspaceId_idx"
  ON "CreditLedger" ("workspaceId");

CREATE INDEX IF NOT EXISTS "CreditLedger_operationId_idx"
  ON "CreditLedger" ("operationId");

CREATE UNIQUE INDEX IF NOT EXISTS "CreditLedger_idempotencyKey_key"
  ON "CreditLedger" ("idempotencyKey")
  WHERE "idempotencyKey" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "CreditLedger_feature_status_idx"
  ON "CreditLedger" ("feature", "status");

CREATE INDEX IF NOT EXISTS "CreditLedger_provider_model_idx"
  ON "CreditLedger" ("provider", "model");

CREATE INDEX IF NOT EXISTS "CreditLedger_workspace_feature_createdAt_idx"
  ON "CreditLedger" ("workspaceId", "feature", "createdAt");
