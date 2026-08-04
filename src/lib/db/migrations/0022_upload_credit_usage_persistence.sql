-- Preserve upload credit usage independently from currently existing datasets.
-- This backfills legacy Profile.analysisCount usage into UserCredit when older
-- upload paths incremented the profile counter without writing CreditLedger rows.

WITH legacy_usage AS (
  SELECT
    uc."userId",
    GREATEST(uc."usedCredits", LEAST(uc."totalCredits", COALESCE(p."analysisCount", 0))) AS "usedCredits",
    uc."totalCredits",
    uc."remainingCredits",
    uc."reservedCredits"
  FROM "UserCredit" uc
  LEFT JOIN "Profile" p ON p."userId" = uc."userId"
  WHERE COALESCE(p."role", '') NOT IN ('admin', 'superadmin')
    AND COALESCE(p."subscriptionTier", '') NOT IN ('admin', 'superadmin')
    AND COALESCE(p."analysisCount", 0) > uc."usedCredits"
)
UPDATE "UserCredit" uc
SET
  "usedCredits" = lu."usedCredits",
  "remainingCredits" = LEAST(uc."remainingCredits", GREATEST(0, lu."totalCredits" - lu."usedCredits")),
  "reservedCredits" = LEAST(uc."reservedCredits", GREATEST(0, lu."totalCredits" - lu."usedCredits")),
  "lifetimeCreditsUsed" = GREATEST(uc."lifetimeCreditsUsed", lu."usedCredits"),
  "updatedAt" = now()
FROM legacy_usage lu
WHERE uc."userId" = lu."userId";

INSERT INTO "CreditLedger" (
  "id",
  "workspaceId",
  "userId",
  "type",
  "transactionType",
  "status",
  "operationId",
  "idempotencyKey",
  "amount",
  "credits",
  "balanceBefore",
  "balanceAfter",
  "source",
  "feature",
  "action",
  "description",
  "currency",
  "metadata",
  "finalizedAt"
)
SELECT
  'cl_backfill_' || substr(md5(uc."userId" || ':legacy_upload_usage'), 1, 20),
  uc."userId",
  uc."userId",
  'charge',
  'charge',
  'finalized',
  'backfill:legacy-upload-usage:' || uc."userId",
  'backfill:legacy-upload-usage:' || uc."userId",
  -LEAST(uc."totalCredits", COALESCE(p."analysisCount", 0)),
  LEAST(uc."totalCredits", COALESCE(p."analysisCount", 0)),
  uc."totalCredits",
  GREATEST(0, uc."totalCredits" - LEAST(uc."totalCredits", COALESCE(p."analysisCount", 0))),
  'migration',
  'dataset_upload',
  'legacy_upload_usage_backfill',
  'Backfilled legacy upload usage so dataset deletion cannot restore credits.',
  'EUR',
  jsonb_build_object(
    'source', 'Profile.analysisCount',
    'limitation', 'Deleted historical uploads cannot be reconstructed when no persistent legacy counter exists.'
  ),
  now()
FROM "UserCredit" uc
LEFT JOIN "Profile" p ON p."userId" = uc."userId"
WHERE COALESCE(p."role", '') NOT IN ('admin', 'superadmin')
  AND COALESCE(p."subscriptionTier", '') NOT IN ('admin', 'superadmin')
  AND COALESCE(p."analysisCount", 0) > 0
ON CONFLICT ("idempotencyKey") DO NOTHING;
