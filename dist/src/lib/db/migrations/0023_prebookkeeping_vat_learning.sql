ALTER TABLE "PrebookkeepingLearningRule"
  ADD COLUMN IF NOT EXISTS "countryKey" text;

ALTER TABLE "PrebookkeepingLearningRule"
  ADD COLUMN IF NOT EXISTS "vatRate" double precision;

CREATE INDEX IF NOT EXISTS "PrebookkeepingLearningRule_vatRule_idx"
  ON "PrebookkeepingLearningRule" ("userId", "countryKey", "category");
