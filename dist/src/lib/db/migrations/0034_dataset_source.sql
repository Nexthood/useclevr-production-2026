-- Dataset.source is the normalized, authoritative upload-source metadata that
-- powers upload-history statistics. Existing rows are backfilled only from
-- immutable stored metadata (analysis.uploadSource markers, datasetType
-- connector categories, and the original file extension). Unprovable origins
-- stay 'unknown' and are never fabricated. The statement is idempotent.
ALTER TABLE "Dataset" ADD COLUMN IF NOT EXISTS "source" varchar(50) NOT NULL DEFAULT 'unknown';

UPDATE "Dataset"
SET "source" = CASE
  WHEN LOWER(COALESCE("analysis"->>'uploadSource', '')) = 'clevrsync' THEN 'clevrsync'
  WHEN LOWER(COALESCE("datasetType", '')) = 'snowflake' THEN 'snowflake'
  WHEN LOWER(COALESCE("datasetType", '')) = 'api' THEN 'api'
  WHEN LOWER("fileName") LIKE '%.csv' THEN 'csv'
  WHEN LOWER("fileName") LIKE '%.xlsx' OR LOWER("fileName") LIKE '%.xls' THEN 'excel'
  ELSE 'unknown'
END
WHERE COALESCE("source", 'unknown') = 'unknown';
