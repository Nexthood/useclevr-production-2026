CREATE TABLE IF NOT EXISTS "SubscriptionPlan" (
  "id" text PRIMARY KEY,
  "name" varchar(100) NOT NULL,
  "tier" varchar(50) NOT NULL,
  "monthlyCredits" integer NOT NULL,
  "maxDatasets" integer NOT NULL,
  "maxFileSizeMb" integer NOT NULL,
  "maxRowsPerDataset" integer NOT NULL,
  "maxTeamMembers" integer NOT NULL,
  "maxAiRequestsPerDay" integer NOT NULL,
  "maxConcurrentAnalyses" integer NOT NULL,
  "creditResetDay" integer NOT NULL,
  "priceEur" integer NOT NULL,
  "stripePriceId" text,
  "isActive" boolean DEFAULT true NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionPlan_tier_key"
  ON "SubscriptionPlan" ("tier");

INSERT INTO "SubscriptionPlan" (
  "id",
  "name",
  "tier",
  "monthlyCredits",
  "maxDatasets",
  "maxFileSizeMb",
  "maxRowsPerDataset",
  "maxTeamMembers",
  "maxAiRequestsPerDay",
  "maxConcurrentAnalyses",
  "creditResetDay",
  "priceEur"
)
VALUES
  ('free', 'Free', 'free', 2, 2, 10, 5000, 1, 20, 1, 1, 0),
  ('pro_monthly', 'Pro', 'pro', 500, 25, 100, 100000, 5, 200, 3, 1, 40),
  ('business_monthly', 'Business', 'business', 5000, 250, 500, 300000, 20, 1000, 10, 1, 420),
  ('demo', 'Demo', 'demo', 2, 1, 10, 5000, 1, 10, 1, 1, 0)
ON CONFLICT ("id") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "tier" = EXCLUDED."tier",
  "monthlyCredits" = EXCLUDED."monthlyCredits",
  "maxDatasets" = EXCLUDED."maxDatasets",
  "maxFileSizeMb" = EXCLUDED."maxFileSizeMb",
  "maxRowsPerDataset" = EXCLUDED."maxRowsPerDataset",
  "maxTeamMembers" = EXCLUDED."maxTeamMembers",
  "maxAiRequestsPerDay" = EXCLUDED."maxAiRequestsPerDay",
  "maxConcurrentAnalyses" = EXCLUDED."maxConcurrentAnalyses",
  "creditResetDay" = EXCLUDED."creditResetDay",
  "priceEur" = EXCLUDED."priceEur",
  "updatedAt" = now();

CREATE TABLE IF NOT EXISTS "UserCredit" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "planId" text NOT NULL,
  "totalCredits" integer NOT NULL,
  "usedCredits" integer DEFAULT 0 NOT NULL,
  "reservedCredits" integer DEFAULT 0 NOT NULL,
  "remainingCredits" integer NOT NULL,
  "creditsResetAt" timestamp NOT NULL,
  "lastResetAt" timestamp,
  "lifetimeCreditsEarned" integer DEFAULT 0 NOT NULL,
  "lifetimeCreditsUsed" integer DEFAULT 0 NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "UserCredit_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE,
  CONSTRAINT "UserCredit_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan" ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserCredit_userId_key"
  ON "UserCredit" ("userId");

CREATE INDEX IF NOT EXISTS "UserCredit_creditsResetAt_idx"
  ON "UserCredit" ("creditsResetAt");

CREATE TABLE IF NOT EXISTS "CreditLedger" (
  "id" text PRIMARY KEY,
  "workspaceId" text,
  "userId" text NOT NULL,
  "type" varchar(30) NOT NULL,
  "transactionType" varchar(30),
  "status" varchar(30) DEFAULT 'finalized' NOT NULL,
  "operationId" text,
  "idempotencyKey" text,
  "amount" integer NOT NULL,
  "credits" integer DEFAULT 0 NOT NULL,
  "balanceBefore" integer NOT NULL,
  "balanceAfter" integer NOT NULL,
  "source" varchar(50),
  "feature" varchar(100),
  "provider" varchar(50),
  "model" varchar(100),
  "inputTokens" integer DEFAULT 0 NOT NULL,
  "outputTokens" integer DEFAULT 0 NOT NULL,
  "thinkingTokens" integer DEFAULT 0 NOT NULL,
  "cachedTokens" integer DEFAULT 0 NOT NULL,
  "embeddingTokens" integer DEFAULT 0 NOT NULL,
  "estimatedProviderCost" integer DEFAULT 0 NOT NULL,
  "currency" varchar(3) DEFAULT 'EUR' NOT NULL,
  "pricingVersion" varchar(40),
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "action" varchar(100) NOT NULL,
  "description" text,
  "relatedDatasetId" text,
  "relatedPlanId" text,
  "adminUserId" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "finalizedAt" timestamp,
  CONSTRAINT "CreditLedger_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "CreditLedger_userId_idx"
  ON "CreditLedger" ("userId");

CREATE INDEX IF NOT EXISTS "CreditLedger_type_idx"
  ON "CreditLedger" ("type");

CREATE INDEX IF NOT EXISTS "CreditLedger_createdAt_idx"
  ON "CreditLedger" ("createdAt");

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
