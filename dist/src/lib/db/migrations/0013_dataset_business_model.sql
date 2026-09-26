ALTER TABLE "Dataset"
  ADD COLUMN IF NOT EXISTS "businessModel" varchar(50) DEFAULT 'generic';

UPDATE "Dataset"
SET "businessModel" = CASE
  WHEN "datasetType" = 'retail' THEN 'local_retail'
  WHEN "businessModel" IS NULL OR "businessModel" = '' THEN 'generic'
  ELSE "businessModel"
END
WHERE "businessModel" IS NULL
   OR "businessModel" = ''
   OR ("businessModel" = 'generic' AND "datasetType" = 'retail');

ALTER TABLE "Dataset"
  DROP CONSTRAINT IF EXISTS "Dataset_businessModel_check";

ALTER TABLE "Dataset"
  ADD CONSTRAINT "Dataset_businessModel_check"
  CHECK ("businessModel" IN (
    'local_retail',
    'ecommerce',
    'saas',
    'startup',
    'investor',
    'marketplace',
    'generic'
  ));

CREATE INDEX IF NOT EXISTS "Dataset_userId_businessModel_idx"
  ON "Dataset" ("userId", "businessModel");
