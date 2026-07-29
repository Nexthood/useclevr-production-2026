CREATE TABLE IF NOT EXISTS "business_profile" (
  "id" text PRIMARY KEY,
  "organization_id" text NOT NULL,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "business_profile_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "Business"("id") ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS "business_profile_organization_id_key"
  ON "business_profile" ("organization_id");

INSERT INTO "business_profile" ("id", "organization_id", "payload", "created_at", "updated_at")
SELECT
  'business_profile_' || replace("id", 'business_', ''),
  "id",
  "companySetup",
  COALESCE("createdAt", now()),
  COALESCE("updatedAt", now())
FROM "Business"
WHERE "companySetup" IS NOT NULL
  AND "companySetup" <> '{}'::jsonb
ON CONFLICT ("organization_id") DO UPDATE
SET
  "payload" = EXCLUDED."payload",
  "updated_at" = EXCLUDED."updated_at";
