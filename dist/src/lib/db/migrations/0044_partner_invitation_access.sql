ALTER TABLE "PartnerProgramApplication" ADD COLUMN IF NOT EXISTS "companyWebsite" text;
ALTER TABLE "PartnerProgramApplicationEmail" DROP CONSTRAINT IF EXISTS "PartnerProgramApplicationEmail_kind_check";
ALTER TABLE "PartnerProgramApplicationEmail" ADD CONSTRAINT "PartnerProgramApplicationEmail_kind_check"
 CHECK ("kind" IN ('admin_notice','receipt','approved','rejected','verification','account_update'));
CREATE TABLE IF NOT EXISTS "PartnerOnboardingChallenge" (
 "applicationId" text PRIMARY KEY REFERENCES "PartnerProgramApplication"("id"),
 "invitationHash" text NOT NULL, "codeHash" text NOT NULL,
 "expiresAt" timestamptz NOT NULL, "sentAt" timestamptz NOT NULL,
 "attempts" integer NOT NULL DEFAULT 0 CHECK ("attempts" BETWEEN 0 AND 5)
);
CREATE TABLE IF NOT EXISTS "PartnerOnboardingSession" (
 "tokenHash" text PRIMARY KEY, "applicationId" text NOT NULL REFERENCES "PartnerProgramApplication"("id"),
 "userId" text NOT NULL REFERENCES "User"("id"), "expiresAt" timestamptz NOT NULL,
 "credentialSetAt" timestamptz, "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "PartnerOnboardingSession_application_idx" ON "PartnerOnboardingSession" ("applicationId");

ALTER TABLE "PartnerCommission" ADD COLUMN IF NOT EXISTS "contractId" text REFERENCES "PartnerContract"("id");
CREATE INDEX IF NOT EXISTS "PartnerCommission_contract_idx" ON "PartnerCommission" ("contractId");

-- Receipts and decisions remain unique; invitations and verification codes have separate deliveries.
DROP INDEX IF EXISTS "PartnerProgramApplicationEmail_once_key";
CREATE UNIQUE INDEX "PartnerProgramApplicationEmail_once_key" ON "PartnerProgramApplicationEmail" ("applicationId", "kind")
 WHERE "kind" IN ('admin_notice','receipt','rejected');
