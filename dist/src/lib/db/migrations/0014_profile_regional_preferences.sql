ALTER TABLE "Profile"
  ADD COLUMN IF NOT EXISTS "regionalPreferences" jsonb;

UPDATE "Profile"
SET "regionalPreferences" = jsonb_build_object(
  'displayCurrency', COALESCE(NULLIF("preferredCurrency", ''), 'EUR'),
  'baseCurrency', COALESCE(NULLIF("preferredCurrency", ''), 'EUR'),
  'numberFormat', COALESCE(NULLIF("numberFormat", ''), 'auto'),
  'dateFormat', 'auto',
  'timezone', 'auto',
  'language', 'auto',
  'localeMode', 'auto'
)
WHERE "regionalPreferences" IS NULL;

ALTER TABLE "Profile"
  ALTER COLUMN "regionalPreferences" SET DEFAULT '{
    "displayCurrency": "auto",
    "baseCurrency": "EUR",
    "numberFormat": "auto",
    "dateFormat": "auto",
    "timezone": "auto",
    "language": "auto",
    "localeMode": "auto"
  }'::jsonb,
  ALTER COLUMN "regionalPreferences" SET NOT NULL;
