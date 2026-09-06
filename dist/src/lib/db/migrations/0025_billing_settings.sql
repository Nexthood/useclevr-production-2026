-- Add billing settings JSONB column to Profile for spending controls and limits.
ALTER TABLE "Profile"
  ADD COLUMN IF NOT EXISTS "billingSettings" jsonb DEFAULT '{}' NOT NULL;
