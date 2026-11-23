ALTER TABLE "AiRequestAuditLog"
  ADD COLUMN IF NOT EXISTS "routingReason" text,
  ADD COLUMN IF NOT EXISTS "latencyMs" integer,
  ADD COLUMN IF NOT EXISTS "inputTokens" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "outputTokens" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "totalTokens" integer DEFAULT 0 NOT NULL;

WITH ranked_defaults AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "userId"
      ORDER BY
        "isDefault" DESC,
        "priority" ASC,
        "updatedAt" DESC
    ) AS rank
  FROM "AiProviderConfig"
  WHERE "isDefault" = true
)
UPDATE "AiProviderConfig"
SET "isDefault" = false
FROM ranked_defaults
WHERE "AiProviderConfig"."id" = ranked_defaults."id"
  AND ranked_defaults.rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "AiProviderConfig_one_default_per_user_idx"
  ON "AiProviderConfig" ("userId")
  WHERE "isDefault" = true;
