-- Additive contract infrastructure. Existing account rows are not updated.
CREATE TABLE IF NOT EXISTS "PartnerContractTemplate" (
 "id" text PRIMARY KEY, "agreementType" text NOT NULL CHECK ("agreementType" IN ('independent_sales','authorized_reseller')),
 "version" text NOT NULL, "title" text NOT NULL, "body" text NOT NULL, "checksum" text NOT NULL CHECK ("checksum" ~ '^[a-f0-9]{64}$'),
 "approvedBy" text, "approvedAt" timestamptz, "legalReviewReference" text, "revokedAt" timestamptz, "createdAt" timestamptz NOT NULL DEFAULT now(),
 UNIQUE ("agreementType","version"), CHECK (("approvedAt" IS NULL) = ("approvedBy" IS NULL)), CHECK ("approvedAt" IS NULL OR length("legalReviewReference") >= 5)
);
CREATE TABLE IF NOT EXISTS "PartnerContractProfile" (
 "id" text PRIMARY KEY, "applicationId" text NOT NULL REFERENCES "PartnerProgramApplication"("id"), "version" integer NOT NULL CHECK ("version">0),
 "identity" jsonb NOT NULL, "checksum" text NOT NULL, "consentVersion" text NOT NULL, "consentAt" timestamptz NOT NULL, "submittedBy" text NOT NULL,
 "reviewedBy" text, "reviewedAt" timestamptz, "reviewEvidence" text, "createdAt" timestamptz NOT NULL DEFAULT now(), UNIQUE("applicationId","version"),
 CHECK (("reviewedAt" IS NULL) = ("reviewedBy" IS NULL)), CHECK ("reviewedAt" IS NULL OR length("reviewEvidence") >= 10)
);
CREATE TABLE IF NOT EXISTS "PartnerContractSchedule" (
 "id" text PRIMARY KEY, "applicationId" text NOT NULL REFERENCES "PartnerProgramApplication"("id"), "version" text NOT NULL,
 "agreementType" text NOT NULL CHECK ("agreementType" IN ('independent_sales','authorized_reseller')), "schedule" jsonb NOT NULL, "checksum" text NOT NULL,
 "financialConfigHash" text NOT NULL, "createdBy" text NOT NULL, "approvedBy" text, "approvedAt" timestamptz, "legalReviewReference" text, "revokedAt" timestamptz,
 "createdAt" timestamptz NOT NULL DEFAULT now(), UNIQUE("applicationId","version"), CHECK (("approvedAt" IS NULL) = ("approvedBy" IS NULL)), CHECK ("approvedAt" IS NULL OR length("legalReviewReference") >= 5)
);
CREATE TABLE IF NOT EXISTS "PartnerContractProviderApproval" (
 "id" text PRIMARY KEY, "fingerprint" text NOT NULL, "status" text NOT NULL CHECK ("status" IN ('approved','revoked')),
 "approvedBy" text NOT NULL, "legalReviewReference" text NOT NULL CHECK (length("legalReviewReference")>=5), "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS "PartnerContractProviderApproval_latest_idx" ON "PartnerContractProviderApproval" ("fingerprint","createdAt" DESC,"id" DESC);
CREATE TABLE IF NOT EXISTS "PartnerContract" (
 "id" text PRIMARY KEY, "applicationId" text NOT NULL REFERENCES "PartnerProgramApplication"("id"), "partnerId" text NOT NULL REFERENCES "PartnerAccount"("id"),
 "revision" integer NOT NULL CHECK ("revision">0), "agreementType" text NOT NULL, "templateId" text NOT NULL REFERENCES "PartnerContractTemplate"("id"), "templateVersion" text NOT NULL,
 "profileId" text NOT NULL REFERENCES "PartnerContractProfile"("id"), "scheduleId" text NOT NULL REFERENCES "PartnerContractSchedule"("id"), "commercialTermsVersion" text NOT NULL,
 "snapshot" jsonb NOT NULL, "mode" text NOT NULL CHECK ("mode" IN ('draft','mock','dropbox_test','dropbox_live')),
 "status" text NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending','generated','sending','sent','awaiting_partner_signature','awaiting_company_signature','fully_executed','rejected','cancelled','expired','error','send_uncertain')),
 "provider" text NOT NULL CHECK ("provider" IN ('preview','mock','dropbox_sign')), "providerReference" text, "sourceArtifactId" text, "documentChecksum" text,
 "signedArtifactId" text, "signedDocumentChecksum" text, "auditArtifactId" text, "auditEvidenceChecksum" text, "providerSnapshot" jsonb,
 "partnerSignedAt" timestamptz, "companySignedAt" timestamptz, "verifiedAt" timestamptz, "executedAt" timestamptz,
 "expiresAt" timestamptz NOT NULL, "lastErrorCode" text, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(),
 UNIQUE("applicationId","revision"),
 CHECK ("companySignedAt" IS NULL OR ("partnerSignedAt" IS NOT NULL AND "companySignedAt">="partnerSignedAt")),
 CHECK ("status" <> 'fully_executed' OR ("partnerSignedAt" IS NOT NULL AND "companySignedAt" IS NOT NULL AND "verifiedAt" IS NOT NULL AND "executedAt" IS NOT NULL AND "signedArtifactId" IS NOT NULL AND "signedDocumentChecksum" IS NOT NULL AND "auditArtifactId" IS NOT NULL AND "auditEvidenceChecksum" IS NOT NULL AND "providerReference" IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS "PartnerContract_partner_latest_idx" ON "PartnerContract"("partnerId","createdAt" DESC,"revision" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "PartnerContract_provider_ref_key" ON "PartnerContract"("provider","providerReference") WHERE "providerReference" IS NOT NULL;
CREATE TABLE IF NOT EXISTS "PartnerContractArtifact" (
 "id" text PRIMARY KEY, "contractId" text NOT NULL REFERENCES "PartnerContract"("id"), "kind" text NOT NULL CHECK ("kind" IN ('source','signed','audit')),
 "mediaType" text NOT NULL CHECK ("mediaType" IN ('application/pdf','application/json')), "checksum" text NOT NULL CHECK ("checksum" ~ '^[a-f0-9]{64}$'),
 "keyId" text NOT NULL, "encryptedBytes" bytea NOT NULL, "byteLength" integer NOT NULL CHECK ("byteLength">0 AND "byteLength"<=10485760),
 "retainUntil" timestamptz, "createdAt" timestamptz NOT NULL DEFAULT now(), UNIQUE("contractId","kind","checksum")
);
CREATE TABLE IF NOT EXISTS "PartnerContractAudit" (
 "id" text PRIMARY KEY, "contractId" text REFERENCES "PartnerContract"("id"), "applicationId" text REFERENCES "PartnerProgramApplication"("id"),
 "actor" text NOT NULL, "action" text NOT NULL, "reason" text NOT NULL, "evidence" jsonb NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "PartnerContractAudit_contract_idx" ON "PartnerContractAudit"("contractId","createdAt");
CREATE TABLE IF NOT EXISTS "PartnerContractWebhook" (
 "id" text PRIMARY KEY, "eventKey" text NOT NULL UNIQUE, "providerReference" text NOT NULL, "eventType" text NOT NULL, "eventTime" timestamptz NOT NULL,
 "bodyChecksum" text NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "PartnerContractJob" (
 "id" text PRIMARY KEY, "key" text NOT NULL UNIQUE, "kind" text NOT NULL CHECK ("kind" IN ('prepare','send','reconcile','remind','cancel')),
 "applicationId" text REFERENCES "PartnerProgramApplication"("id"), "contractId" text REFERENCES "PartnerContract"("id"),
 "status" text NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending','running','done','failed','uncertain')),
 "attempts" integer NOT NULL DEFAULT 0, "nextAttemptAt" timestamptz NOT NULL DEFAULT now(), "leaseUntil" timestamptz, "lastErrorCode" text, "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "PartnerContractJob_due_idx" ON "PartnerContractJob"("status","nextAttemptAt");
CREATE TABLE IF NOT EXISTS "PartnerContractDelivery" (
 "id" text PRIMARY KEY, "contractId" text NOT NULL REFERENCES "PartnerContract"("id"), "kind" text NOT NULL,
 "recipientRole" text NOT NULL CHECK ("recipientRole" IN ('partner','company')), "recipient" text NOT NULL,
 "status" text NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending','sending','sent','failed','uncertain')),
 "attempts" integer NOT NULL DEFAULT 0, "nextAttemptAt" timestamptz NOT NULL DEFAULT now(), "leaseUntil" timestamptz,
 "sentAt" timestamptz, "firstAttemptAt" timestamptz, "idempotencyExpiresAt" timestamptz, "payloadChecksum" text, "providerId" text, "lastErrorCode" text, "createdAt" timestamptz NOT NULL DEFAULT now(), UNIQUE("contractId","kind","recipientRole")
);
CREATE INDEX IF NOT EXISTS "PartnerContractDelivery_due_idx" ON "PartnerContractDelivery"("status","nextAttemptAt");
CREATE OR REPLACE FUNCTION partner_contract_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Contract evidence is append-only'; END $$;
DO $$ DECLARE name text; BEGIN
 FOREACH name IN ARRAY ARRAY['PartnerContractArtifact','PartnerContractAudit','PartnerContractWebhook','PartnerContractProviderApproval'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS partner_contract_append_only ON %I',name);
  EXECUTE format('CREATE TRIGGER partner_contract_append_only BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION partner_contract_append_only()',name);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION partner_contract_version_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE newbase jsonb; oldbase jsonb;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Contract versions are retained'; END IF;
 newbase=to_jsonb(NEW)-ARRAY['approvedBy','approvedAt','legalReviewReference','revokedAt','reviewedBy','reviewedAt','reviewEvidence'];
 oldbase=to_jsonb(OLD)-ARRAY['approvedBy','approvedAt','legalReviewReference','revokedAt','reviewedBy','reviewedAt','reviewEvidence'];
 IF newbase IS DISTINCT FROM oldbase THEN RAISE EXCEPTION 'Create a new contract version instead of editing evidence'; END IF;
 IF (to_jsonb(OLD)->>'approvedAt') IS NOT NULL AND (to_jsonb(NEW)-'revokedAt') IS DISTINCT FROM (to_jsonb(OLD)-'revokedAt') THEN RAISE EXCEPTION 'Approved version is immutable'; END IF;
 IF (to_jsonb(OLD)->>'reviewedAt') IS NOT NULL AND to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN RAISE EXCEPTION 'Reviewed identity is immutable'; END IF;
 IF (to_jsonb(OLD)->>'revokedAt') IS NOT NULL AND to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN RAISE EXCEPTION 'Revocation is permanent'; END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE name text; BEGIN
 FOREACH name IN ARRAY ARRAY['PartnerContractTemplate','PartnerContractProfile','PartnerContractSchedule'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS partner_contract_version_immutable ON %I',name);
  EXECUTE format('CREATE TRIGGER partner_contract_version_immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION partner_contract_version_immutable()',name);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION partner_contract_execution_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Contract versions cannot be deleted'; END IF;
 IF (to_jsonb(NEW)-ARRAY['status','providerReference','sourceArtifactId','documentChecksum','signedArtifactId','signedDocumentChecksum','auditArtifactId','auditEvidenceChecksum','providerSnapshot','partnerSignedAt','companySignedAt','verifiedAt','executedAt','lastErrorCode','updatedAt']) IS DISTINCT FROM
    (to_jsonb(OLD)-ARRAY['status','providerReference','sourceArtifactId','documentChecksum','signedArtifactId','signedDocumentChecksum','auditArtifactId','auditEvidenceChecksum','providerSnapshot','partnerSignedAt','companySignedAt','verifiedAt','executedAt','lastErrorCode','updatedAt']) THEN RAISE EXCEPTION 'Contract identity and terms are immutable'; END IF;
 IF OLD."documentChecksum" IS NOT NULL AND (NEW."documentChecksum",NEW."sourceArtifactId") IS DISTINCT FROM (OLD."documentChecksum",OLD."sourceArtifactId") THEN RAISE EXCEPTION 'Generated document is immutable'; END IF;
 IF OLD."providerReference" IS NOT NULL AND NEW."providerReference" IS DISTINCT FROM OLD."providerReference" THEN RAISE EXCEPTION 'Provider request binding is immutable'; END IF;
 IF OLD."status"='fully_executed' AND (to_jsonb(NEW)-'updatedAt') IS DISTINCT FROM (to_jsonb(OLD)-'updatedAt') THEN RAISE EXCEPTION 'Executed agreement is immutable'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS partner_contract_execution_immutable ON "PartnerContract";
CREATE TRIGGER partner_contract_execution_immutable BEFORE UPDATE OR DELETE ON "PartnerContract" FOR EACH ROW EXECUTE FUNCTION partner_contract_execution_immutable();
CREATE OR REPLACE FUNCTION partner_contract_activation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE latest "PartnerContract"%ROWTYPE;
BEGIN
 IF NEW.status <> 'active' THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.status='active' THEN RETURN NEW; END IF;
 SELECT * INTO latest FROM "PartnerContract" WHERE "partnerId"=NEW.id ORDER BY "createdAt" DESC,"revision" DESC LIMIT 1;
 IF latest.id IS NULL OR latest.status<>'fully_executed' OR latest.mode<>'dropbox_live' OR latest."executedAt" IS NULL OR latest."verifiedAt" IS NULL OR latest."signedArtifactId" IS NULL OR latest."auditArtifactId" IS NULL OR latest."partnerSignedAt" IS NULL OR latest."companySignedAt" IS NULL THEN RAISE EXCEPTION 'A fully executed production agreement is required for commercial activation'; END IF;
 IF current_setting('app.partner_contract_activation',true) IS DISTINCT FROM NEW.id THEN RAISE EXCEPTION 'Explicit audited administrator activation is required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM "PartnerContractTemplate" t JOIN "PartnerContractSchedule" s ON s.id=latest."scheduleId" WHERE t.id=latest."templateId" AND t."approvedAt" IS NOT NULL AND t."revokedAt" IS NULL AND s."approvedAt" IS NOT NULL AND s."revokedAt" IS NULL) THEN RAISE EXCEPTION 'Current legal approval is required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM "PartnerProgramApplication" a JOIN "PartnerContractProfile" p ON p.id=latest."profileId" WHERE a.id=latest."applicationId" AND a."partnerAccountId"=NEW.id AND a."linkedUserId"=NEW."userId" AND a."onboardedAt" IS NOT NULL AND a.status IN ('approved','active') AND p."reviewedAt" IS NOT NULL) THEN RAISE EXCEPTION 'Verified application and legal identity binding required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM "PartnerContractArtifact" s JOIN "PartnerContractArtifact" a ON a.id=latest."auditArtifactId" WHERE s.id=latest."signedArtifactId" AND s."contractId"=latest.id AND s.kind='signed' AND s.checksum=latest."signedDocumentChecksum" AND a."contractId"=latest.id AND a.kind='audit' AND a.checksum=latest."auditEvidenceChecksum") THEN RAISE EXCEPTION 'Private signed PDF and execution evidence required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM "PartnerContractProviderApproval" p WHERE p.fingerprint=latest.snapshot->>'runtimeHash' AND p.status='approved' AND p.id=(SELECT id FROM "PartnerContractProviderApproval" WHERE fingerprint=p.fingerprint ORDER BY "createdAt" DESC,id DESC LIMIT 1)) THEN RAISE EXCEPTION 'Owner provider approval required'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS partner_contract_activation_guard ON "PartnerAccount";
CREATE TRIGGER partner_contract_activation_guard BEFORE INSERT OR UPDATE OF status ON "PartnerAccount" FOR EACH ROW EXECUTE FUNCTION partner_contract_activation_guard();
