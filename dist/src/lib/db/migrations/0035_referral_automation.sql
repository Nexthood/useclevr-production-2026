-- Referral automation lifecycle tables.
--
-- ReferralAttribution is the canonical per-referred-user referral record. The
-- unique index on "referredUserId" enforces one-referral-per-account at the
-- database level, so a later referral link can never switch the referrer, and
-- a replayed signup confirmation can never create a second conversion.
-- Reward state lives on the attribution row so Signups / Paid Users / Credits
-- Earned stay reproducible from canonical records.
--
-- ReferralEvent gains provenance ("legacy" for pre-existing manually recorded
-- rows, "automated" for lifecycle events, "admin" for superadmin corrections)
-- and a metadata column for admin action audit details. Existing rows are
-- preserved untouched; no historical event is promoted to verified state.
--
-- The CreditLedger transactionType check is replaced so REFERRAL_REWARD grants
-- pass on databases created with the legacy constraint (same pattern as
-- 0032_widen_credit_ledger_transaction_type.sql; NOT VALID so existing rows
-- never block the predeploy transaction).

CREATE TABLE IF NOT EXISTS "ReferralAttribution" (
  "id" text PRIMARY KEY NOT NULL,
  "code" varchar(32) NOT NULL,
  "referrerUserId" text NOT NULL,
  "referrerEmail" varchar(255),
  "referredUserId" text NOT NULL,
  "referredEmail" varchar(255),
  "status" varchar(20) DEFAULT 'signed_up' NOT NULL,
  "signupConfirmedAt" timestamp,
  "paidConfirmedAt" timestamp,
  "signupRewardStatus" varchar(24) DEFAULT 'pending' NOT NULL,
  "signupRewardCredits" integer DEFAULT 0 NOT NULL,
  "signupRewardLedgerId" text,
  "signupRewardGrantedAt" timestamp,
  "paidRewardStatus" varchar(24) DEFAULT 'none' NOT NULL,
  "paidRewardCredits" integer DEFAULT 0 NOT NULL,
  "paidRewardLedgerId" text,
  "paidRewardGrantedAt" timestamp,
  "proRewardStatus" varchar(24) DEFAULT 'none' NOT NULL,
  "proRewardMonths" integer DEFAULT 0 NOT NULL,
  "proRewardDecidedAt" timestamp,
  "stripeEventId" text,
  "stripeSessionId" text,
  "stripeSubscriptionId" text,
  "stripeCustomerId" text,
  "refundObservedAt" timestamp,
  "adminAudit" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "ReferralAttribution_referredUserId_key" ON "ReferralAttribution" USING btree ("referredUserId");
CREATE INDEX IF NOT EXISTS "ReferralAttribution_code_idx" ON "ReferralAttribution" USING btree ("code");
CREATE INDEX IF NOT EXISTS "ReferralAttribution_referrerUserId_idx" ON "ReferralAttribution" USING btree ("referrerUserId");
CREATE INDEX IF NOT EXISTS "ReferralAttribution_status_idx" ON "ReferralAttribution" USING btree ("status");

ALTER TABLE IF EXISTS "ReferralEvent" ADD COLUMN IF NOT EXISTS "source" varchar(20) DEFAULT 'legacy' NOT NULL;
ALTER TABLE IF EXISTS "ReferralEvent" ADD COLUMN IF NOT EXISTS "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;

ALTER TABLE IF EXISTS "CreditLedger"
  DROP CONSTRAINT IF EXISTS "CreditLedger_transactionType_check";

DO $$
BEGIN
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
          'subscription_downgrade',
          'PLAN_ALLOCATION',
          'PLAN_RESET',
          'TOP_UP_PURCHASE',
          'USAGE_DEBIT',
          'RELEASE',
          'REFUND',
          'REVERSAL',
          'ADMIN_ADJUSTMENT',
          'PROMOTIONAL_CREDIT',
          'REFERRAL_REWARD',
          'EXPIRATION'
        )
      )
      NOT VALID;
  END IF;
END $$;
