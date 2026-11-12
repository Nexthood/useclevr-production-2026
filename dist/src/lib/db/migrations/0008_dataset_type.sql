ALTER TABLE "Dataset" ADD COLUMN IF NOT EXISTS "datasetType" varchar(50) DEFAULT 'standard';

CREATE INDEX IF NOT EXISTS "Dataset_datasetType_idx" ON "Dataset" ("datasetType");
