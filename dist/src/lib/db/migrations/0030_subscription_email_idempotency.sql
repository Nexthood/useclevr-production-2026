ALTER TABLE IF EXISTS "Profile"
  ADD COLUMN IF NOT EXISTS "lastSubscriptionActivationEmailSent" timestamp;
ALTER TABLE IF EXISTS "Profile"
  ADD COLUMN IF NOT EXISTS "lastSubscriptionCancellationEmailSent" timestamp;
ALTER TABLE IF EXISTS "Profile"
  ADD COLUMN IF NOT EXISTS "lastSubscriptionCancellationScheduledEmailSent" timestamp;
