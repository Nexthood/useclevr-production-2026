-- Add missing columns to CreditLedger and UserCredit tables for subscription plan changes
-- These columns are required by processPlanChange in credit-engine.ts

-- CreditLedger columns needed for plan change ledger entries
ALTER TABLE IF EXISTS "CreditLedger"
  ADD COLUMN IF NOT EXISTS "includedBalanceBefore" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "includedBalanceAfter" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "purchasedBalanceBefore" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "purchasedBalanceAfter" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "monetaryAmount" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "datasetId" text,
  ADD COLUMN IF NOT EXISTS "reportId" text,
  ADD COLUMN IF NOT EXISTS "analysisId" text,
  ADD COLUMN IF NOT EXISTS "requestId" text,
  ADD COLUMN IF NOT EXISTS "paymentProvider" varchar(50),
  ADD COLUMN IF NOT EXISTS "providerTransactionId" varchar(255),
  ADD COLUMN IF NOT EXISTS "paymentStatus" varchar(50);

-- UserCredit columns needed for subscription tier tracking
ALTER TABLE IF EXISTS "UserCredit"
  ADD COLUMN IF NOT EXISTS "includedBalance" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "purchasedBalance" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "totalPaidCents" integer DEFAULT 0 NOT NULL;

-- Update any null values to defaults
UPDATE "CreditLedger"
SET
  "includedBalanceBefore" = COALESCE("includedBalanceBefore", 0),
  "includedBalanceAfter" = COALESCE("includedBalanceAfter", 0),
  "purchasedBalanceBefore" = COALESCE("purchasedBalanceBefore", 0),
  "purchasedBalanceAfter" = COALESCE("purchasedBalanceAfter", 0),
  "monetaryAmount" = COALESCE("monetaryAmount", 0)
WHERE "includedBalanceBefore" IS NULL
   OR "includedBalanceAfter" IS NULL
   OR "purchasedBalanceBefore" IS NULL
   OR "purchasedBalanceAfter" IS NULL
   OR "monetaryAmount" IS NULL;

UPDATE "UserCredit"
SET
  "includedBalance" = COALESCE("includedBalance", GREATEST(0, "remainingCredits" - COALESCE("purchasedBalance", 0))),
  "purchasedBalance" = COALESCE("purchasedBalance", 0),
  "totalPaidCents" = COALESCE("totalPaidCents", 0)
WHERE "includedBalance" IS NULL
   OR "purchasedBalance" IS NULL
   OR "totalPaidCents" IS NULL;
