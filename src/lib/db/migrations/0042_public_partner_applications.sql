CREATE TABLE IF NOT EXISTS "PartnerProgramApplication" (
  "id" text PRIMARY KEY,
  "program" text NOT NULL CHECK ("program" IN ('work_with_us','reseller_enterprise')),
  "category" text NOT NULL,
  "fullName" text NOT NULL,
  "email" text NOT NULL,
  "country" text NOT NULL CHECK ("country" ~ '^[A-Z]{2}$'),
  "companyName" text,
  "experience" text NOT NULL,
  "privacyAcceptedAt" timestamptz NOT NULL,
  "privacyVersion" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending','under_review','approved','rejected','active')),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "reviewedBy" text,
  "reviewedAt" timestamptz,
  "linkedUserId" text,
  "partnerAccountId" text REFERENCES "PartnerAccount"("id"),
  "onboardedAt" timestamptz,
  "invitationHash" text,
  "invitationExpiresAt" timestamptz,
  "invitationUsedAt" timestamptz,
  "rejectionReason" text,
  CHECK (("status" <> 'active') OR ("linkedUserId" IS NOT NULL AND "partnerAccountId" IS NOT NULL AND "onboardedAt" IS NOT NULL)),
  CHECK (("status" <> 'approved') OR ("reviewedBy" IS NOT NULL AND "reviewedAt" IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS "PartnerProgramApplication_status_created_idx" ON "PartnerProgramApplication" ("status", "createdAt" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "PartnerProgramApplication_email_open_key" ON "PartnerProgramApplication" (lower("email")) WHERE "status" <> 'rejected';
CREATE UNIQUE INDEX IF NOT EXISTS "PartnerProgramApplication_invitation_hash_key" ON "PartnerProgramApplication" ("invitationHash") WHERE "invitationHash" IS NOT NULL;
CREATE TABLE IF NOT EXISTS "PartnerProgramApplicationAudit" (
  "id" text PRIMARY KEY,
  "applicationId" text NOT NULL REFERENCES "PartnerProgramApplication"("id"),
  "actor" text NOT NULL,
  "action" text NOT NULL,
  "reason" text,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "PartnerProgramApplicationAudit_application_idx" ON "PartnerProgramApplicationAudit" ("applicationId", "createdAt");
CREATE TABLE IF NOT EXISTS "PartnerProgramApplicationEmail" (
  "id" text PRIMARY KEY,
  "applicationId" text NOT NULL REFERENCES "PartnerProgramApplication"("id"),
  "kind" text NOT NULL CHECK ("kind" IN ('admin_notice','receipt','approved','rejected')),
  "recipient" text,
  "status" text NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending','sent','failed')),
  "attempts" integer NOT NULL DEFAULT 0,
  "nextAttemptAt" timestamptz NOT NULL DEFAULT now(),
  "sentAt" timestamptz,
  "providerId" text,
  "lastErrorCode" text,
  "payload" jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "PartnerProgramApplicationEmail_retry_idx" ON "PartnerProgramApplicationEmail" ("status", "nextAttemptAt");
CREATE UNIQUE INDEX IF NOT EXISTS "PartnerProgramApplicationEmail_once_key" ON "PartnerProgramApplicationEmail" ("applicationId", "kind");
CREATE TABLE IF NOT EXISTS "PartnerProgramApplicationRateLimit" (
  "fingerprint" text NOT NULL,
  "windowStart" timestamptz NOT NULL,
  "count" integer NOT NULL,
  PRIMARY KEY ("fingerprint", "windowStart")
);
CREATE OR REPLACE FUNCTION partner_program_application_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."program" IS DISTINCT FROM OLD."program" OR NEW."category" IS DISTINCT FROM OLD."category" OR
     NEW."fullName" IS DISTINCT FROM OLD."fullName" OR NEW."email" IS DISTINCT FROM OLD."email" OR
     NEW."country" IS DISTINCT FROM OLD."country" OR NEW."companyName" IS DISTINCT FROM OLD."companyName" OR
     NEW."experience" IS DISTINCT FROM OLD."experience" OR NEW."privacyAcceptedAt" IS DISTINCT FROM OLD."privacyAcceptedAt" OR
     NEW."privacyVersion" IS DISTINCT FROM OLD."privacyVersion" THEN
    RAISE EXCEPTION 'Submitted partner application evidence is immutable';
  END IF;
  IF OLD."status"='rejected' AND NEW."status" <> 'rejected' THEN
    RAISE EXCEPTION 'Rejected applications cannot be reactivated';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS partner_program_application_integrity ON "PartnerProgramApplication";
CREATE TRIGGER partner_program_application_integrity BEFORE UPDATE ON "PartnerProgramApplication"
FOR EACH ROW EXECUTE FUNCTION partner_program_application_integrity();
CREATE OR REPLACE FUNCTION partner_program_application_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Partner application audit history is immutable'; END $$;
DROP TRIGGER IF EXISTS partner_program_application_audit_immutable ON "PartnerProgramApplicationAudit";
CREATE TRIGGER partner_program_application_audit_immutable BEFORE UPDATE OR DELETE ON "PartnerProgramApplicationAudit"
FOR EACH ROW EXECUTE FUNCTION partner_program_application_audit_immutable();
-- Surface existing applications in the shared administration queue without altering partner accounts.
INSERT INTO "PartnerProgramApplication" ("id","program","category","fullName","email","country","companyName","experience","privacyAcceptedAt","privacyVersion","status","createdAt","updatedAt","reviewedBy","reviewedAt","linkedUserId","partnerAccountId","onboardedAt")
SELECT 'legacy-' || p."id", CASE WHEN p."application"->>'partnershipType' IS NULL THEN 'work_with_us' ELSE 'reseller_enterprise' END, COALESCE(p."application"->>'partnershipType','Independent Sales Partner'), p.name,
       COALESCE(p."application"->>'businessEmail',p."userEmail"), p.country, p."application"->>'companyName',
       COALESCE(p."application"->>'experience','Existing partner application'), now(),
       COALESCE(p."application"->>'privacyVersion','legacy'),
       CASE WHEN p.status='active' THEN 'active' WHEN p.status='rejected' THEN 'rejected' WHEN p."commercialReview"->>'status'='under_review' THEN 'under_review' WHEN p."commercialReview"->>'status'='approved' THEN 'approved' ELSE 'pending' END,
       p."createdAt", now(), CASE WHEN p."commercialReview"->>'status' IN ('approved','rejected') THEN 'legacy-migration' END,
       CASE WHEN p."commercialReview"->>'status' IN ('approved','rejected') THEN p."createdAt" END, p."userId", p.id,
       CASE WHEN p.status='active' THEN p."createdAt" END
FROM (
  SELECT p.*, u.email AS "userEmail", row_number() OVER (PARTITION BY lower(COALESCE(p."application"->>'businessEmail',u.email)) ORDER BY p."createdAt" DESC) AS rn
  FROM "PartnerAccount" p JOIN "User" u ON u.id=p."userId" WHERE p.application IS NOT NULL
) p
WHERE p.rn=1
AND NOT EXISTS (
  SELECT 1 FROM "PartnerProgramApplication" a WHERE a."partnerAccountId" = p."id"
)
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "PartnerProgramApplicationAudit" ("id","applicationId","actor","action","reason")
SELECT 'legacy-audit-' || a."id", a."id", 'migration:0042', 'migrated_existing_application', 'Imported into unified partner administration'
FROM "PartnerProgramApplication" a WHERE a."id" LIKE 'legacy-%'
ON CONFLICT ("id") DO NOTHING;
