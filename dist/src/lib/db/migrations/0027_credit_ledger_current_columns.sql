-- Keep credit tables aligned with the current Drizzle model used by reservations.
ALTER TABLE IF EXISTS "UserCredit"
  ADD COLUMN IF NOT EXISTS "includedBalance" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "purchasedBalance" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "totalPaidCents" integer DEFAULT 0 NOT NULL;

UPDATE "UserCredit"
SET
  "includedBalance" = COALESCE(NULLIF("includedBalance", 0), GREATEST(0, "remainingCredits" - COALESCE("purchasedBalance", 0))),
  "purchasedBalance" = COALESCE("purchasedBalance", 0),
  "totalPaidCents" = COALESCE("totalPaidCents", 0);

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
