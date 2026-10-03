ALTER TABLE "AiProviderConfig"
  ADD COLUMN IF NOT EXISTS "isFallback" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "priority" integer DEFAULT 100 NOT NULL;

WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "userId"
      ORDER BY
        "isDefault" DESC,
        "updatedAt" DESC,
        "createdAt" DESC
    ) AS rank
  FROM "AiProviderConfig"
)
UPDATE "AiProviderConfig"
SET "priority" = ranked.rank * 10
FROM ranked
WHERE "AiProviderConfig"."id" = ranked."id"
  AND "AiProviderConfig"."priority" = 100;

WITH fallback_candidates AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "userId"
      ORDER BY
        "isDefault" ASC,
        "priority" ASC,
        "updatedAt" DESC
    ) AS rank
  FROM "AiProviderConfig"
  WHERE "isEnabled" = true
)
UPDATE "AiProviderConfig"
SET "isFallback" = true
FROM fallback_candidates
WHERE "AiProviderConfig"."id" = fallback_candidates."id"
  AND fallback_candidates.rank = 1
  AND "AiProviderConfig"."isDefault" = false;

CREATE INDEX IF NOT EXISTS "AiProviderConfig_user_fallback_idx"
  ON "AiProviderConfig" ("userId", "isFallback");
