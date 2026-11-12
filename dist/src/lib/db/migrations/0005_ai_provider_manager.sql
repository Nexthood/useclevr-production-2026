ALTER TABLE "AiProviderConfig"
  ADD COLUMN IF NOT EXISTS "isEnabled" boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS "isDefault" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "lastTestLatencyMs" integer,
  ADD COLUMN IF NOT EXISTS "lastTestModels" jsonb DEFAULT '[]'::jsonb NOT NULL;

UPDATE "AiProviderConfig"
SET
  "isEnabled" = COALESCE("selected", true),
  "isDefault" = COALESCE("selected", true)
WHERE "isDefault" = false;

DROP INDEX IF EXISTS "AiProviderConfig_userId_key";

CREATE INDEX IF NOT EXISTS "AiProviderConfig_userId_idx"
  ON "AiProviderConfig" ("userId");

CREATE INDEX IF NOT EXISTS "AiProviderConfig_user_default_idx"
  ON "AiProviderConfig" ("userId", "isDefault");
