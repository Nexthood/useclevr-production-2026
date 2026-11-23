-- CreditLedger transactionType check accepts every transaction type the credit engine writes.
-- Databases that created the constraint with the legacy lowercase-only type list reject
-- PLAN_ALLOCATION grants, PLAN_RESET plan changes, USAGE_DEBIT charges, TOP_UP_PURCHASE
-- purchases, RELEASE/REFUND/REVERSAL/backfill rows, and roll back the UserCredit insert that
-- shares their transaction. The replacement constraint is NOT VALID so existing rows never
-- block the predeploy transaction; all new writes are checked.
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
          'EXPIRATION'
        )
      )
      NOT VALID;
  END IF;
END $$;
