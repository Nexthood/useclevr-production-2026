-- Historical data retention entitlement on Profile. Backward compatible:
-- nullable / defaulted columns only, no data is read, written, or deleted.
--
-- lastPaidSubscriptionTier keeps the verified paid tier ("pro" or "business")
-- after subscriptionTier returns to "free" so the one-time historical data
-- unlock price is resolved server-side.
-- subscriptionEndedAt marks when the most recent paid subscription ended;
-- datasets created before it form the preserved historical data set.
-- historicalDataUnlocked grants permanent read access to historical data
-- (one-time Stripe payment, webhook-verified only) without reactivating a
-- paid plan. historicalDataUnlockTier records the tier the unlock price was
-- resolved from, and historicalDataUnlockPaymentId stores the Stripe
-- PaymentIntent reference that granted the entitlement so webhook replays
-- stay idempotent and duplicate purchases cannot create a second grant.
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "lastPaidSubscriptionTier" varchar(20);
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "subscriptionEndedAt" timestamp;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "historicalDataUnlocked" boolean DEFAULT false NOT NULL;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "historicalDataUnlockedAt" timestamp;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "historicalDataUnlockTier" varchar(20);
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "historicalDataUnlockPaymentId" text;
