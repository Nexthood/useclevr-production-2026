-- Native signing adds no hosted configuration and updates no partner account.
ALTER TABLE "PartnerContract" DROP CONSTRAINT IF EXISTS "PartnerContract_mode_check";
ALTER TABLE "PartnerContract" ADD CONSTRAINT "PartnerContract_mode_check" CHECK (mode IN ('draft','mock','dropbox_test','dropbox_live','native'));
ALTER TABLE "PartnerContract" DROP CONSTRAINT IF EXISTS "PartnerContract_provider_check";
ALTER TABLE "PartnerContract" ADD CONSTRAINT "PartnerContract_provider_check" CHECK (provider IN ('preview','mock','dropbox_sign','native'));
ALTER TABLE "PartnerContractDelivery" ADD COLUMN IF NOT EXISTS payload jsonb;
CREATE TABLE IF NOT EXISTS "PartnerContractNativeInvitation" (
 id text PRIMARY KEY, "contractId" text NOT NULL REFERENCES "PartnerContract"(id),
 role text NOT NULL CHECK (role IN ('partner','company')), email text NOT NULL,
 "tokenHash" text NOT NULL UNIQUE, "documentChecksum" text NOT NULL,
 "expiresAt" timestamptz NOT NULL, "usedAt" timestamptz, "revokedAt" timestamptz,
 "codeHash" text, "codeExpiresAt" timestamptz, "codeSentAt" timestamptz,
 attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
 "codeRequests" integer NOT NULL DEFAULT 0 CHECK ("codeRequests" BETWEEN 0 AND 3),
 "sessionHash" text UNIQUE, "sessionExpiresAt" timestamptz, "verifiedAt" timestamptz,
 "reviewedAt" timestamptz, "signedAt" timestamptz,
 "createdAt" timestamptz NOT NULL DEFAULT now(),
 CHECK (("usedAt" IS NULL) = ("verifiedAt" IS NULL)),
 CHECK ("signedAt" IS NULL OR ("verifiedAt" IS NOT NULL AND "reviewedAt" IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS "PartnerNativeInvitation_active_role" ON "PartnerContractNativeInvitation" ("contractId",role) WHERE "revokedAt" IS NULL;
CREATE TABLE IF NOT EXISTS "PartnerContractNativeSignature" (
 id text PRIMARY KEY, "contractId" text NOT NULL REFERENCES "PartnerContract"(id),
 role text NOT NULL CHECK (role IN ('partner','company')), payload jsonb NOT NULL,
 checksum text NOT NULL CHECK (checksum ~ '^[a-f0-9]{64}$'),
 "keyId" text NOT NULL, signature text NOT NULL,
 "createdAt" timestamptz NOT NULL DEFAULT now(), UNIQUE ("contractId",role)
);
DROP TRIGGER IF EXISTS partner_contract_append_only ON "PartnerContractNativeSignature";
CREATE TRIGGER partner_contract_append_only BEFORE UPDATE OR DELETE ON "PartnerContractNativeSignature" FOR EACH ROW EXECUTE FUNCTION partner_contract_append_only();
CREATE OR REPLACE FUNCTION partner_native_invitation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Signing invitations are retained'; END IF;
 IF OLD."revokedAt" IS NOT NULL AND to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN RAISE EXCEPTION 'Invitation revocation is permanent'; END IF;
 IF (NEW.id,NEW."contractId",NEW.role,NEW.email,NEW."tokenHash",NEW."documentChecksum",NEW."expiresAt",NEW."createdAt") IS DISTINCT FROM (OLD.id,OLD."contractId",OLD.role,OLD.email,OLD."tokenHash",OLD."documentChecksum",OLD."expiresAt",OLD."createdAt") THEN RAISE EXCEPTION 'Signing invitation binding is immutable'; END IF;
 IF NEW.attempts<OLD.attempts OR NEW."codeRequests"<OLD."codeRequests" THEN RAISE EXCEPTION 'Verification budgets cannot reset'; END IF;
 IF OLD."usedAt" IS NOT NULL AND (NEW."usedAt",NEW."verifiedAt",NEW."sessionHash",NEW."sessionExpiresAt") IS DISTINCT FROM (OLD."usedAt",OLD."verifiedAt",OLD."sessionHash",OLD."sessionExpiresAt") THEN RAISE EXCEPTION 'Verification proof is immutable'; END IF;
 IF OLD."signedAt" IS NOT NULL AND to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN RAISE EXCEPTION 'Signing proof is immutable'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS partner_native_invitation_guard ON "PartnerContractNativeInvitation";
CREATE TRIGGER partner_native_invitation_guard BEFORE UPDATE OR DELETE ON "PartnerContractNativeInvitation" FOR EACH ROW EXECUTE FUNCTION partner_native_invitation_guard();
CREATE OR REPLACE FUNCTION partner_native_signature_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c "PartnerContract"%ROWTYPE;
BEGIN
 SELECT * INTO c FROM "PartnerContract" WHERE id=NEW."contractId" FOR UPDATE;
 IF c.mode<>'native' OR c.status NOT IN ('awaiting_partner_signature','awaiting_company_signature') OR c."expiresAt"<=now() OR NEW.payload->>'sourceChecksum' IS DISTINCT FROM c."documentChecksum" OR NEW.payload->>'contractId' IS DISTINCT FROM c.id OR NEW.payload->>'role' IS DISTINCT FROM NEW.role THEN RAISE EXCEPTION 'Active immutable native agreement required'; END IF;
 IF NEW.role='company' AND NOT EXISTS(SELECT 1 FROM "PartnerContractNativeSignature" WHERE "contractId"=c.id AND role='partner') THEN RAISE EXCEPTION 'Partner signature required first'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS partner_native_signature_guard ON "PartnerContractNativeSignature";
CREATE TRIGGER partner_native_signature_guard BEFORE INSERT ON "PartnerContractNativeSignature" FOR EACH ROW EXECUTE FUNCTION partner_native_signature_guard();
CREATE OR REPLACE FUNCTION partner_contract_activation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE latest "PartnerContract"%ROWTYPE;
BEGIN
 IF NEW.status <> 'active' THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.status='active' THEN RETURN NEW; END IF;
 SELECT * INTO latest FROM "PartnerContract" WHERE "partnerId"=NEW.id ORDER BY "createdAt" DESC,"revision" DESC LIMIT 1;
 IF latest.id IS NULL OR latest.status<>'fully_executed' OR latest.mode NOT IN ('dropbox_live','native') OR latest."executedAt" IS NULL OR latest."verifiedAt" IS NULL OR latest."signedArtifactId" IS NULL OR latest."auditArtifactId" IS NULL OR latest."partnerSignedAt" IS NULL OR latest."companySignedAt" IS NULL THEN RAISE EXCEPTION 'A fully executed production agreement is required for commercial activation'; END IF;
 IF latest.mode='native' AND (SELECT count(*) FROM "PartnerContractNativeSignature" WHERE "contractId"=latest.id)<>2 THEN RAISE EXCEPTION 'Both native signatures required'; END IF;
 IF current_setting('app.partner_contract_activation',true) IS DISTINCT FROM NEW.id THEN RAISE EXCEPTION 'Explicit audited administrator activation is required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM "PartnerContractTemplate" t JOIN "PartnerContractSchedule" s ON s.id=latest."scheduleId" WHERE t.id=latest."templateId" AND t."approvedAt" IS NOT NULL AND t."revokedAt" IS NULL AND s."approvedAt" IS NOT NULL AND s."revokedAt" IS NULL) THEN RAISE EXCEPTION 'Current legal approval is required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM "PartnerProgramApplication" a JOIN "PartnerContractProfile" p ON p.id=latest."profileId" WHERE a.id=latest."applicationId" AND a."partnerAccountId"=NEW.id AND a."linkedUserId"=NEW."userId" AND a."onboardedAt" IS NOT NULL AND a.status IN ('approved','active') AND p."reviewedAt" IS NOT NULL) THEN RAISE EXCEPTION 'Verified application and legal identity binding required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM "PartnerContractArtifact" s JOIN "PartnerContractArtifact" a ON a.id=latest."auditArtifactId" WHERE s.id=latest."signedArtifactId" AND s."contractId"=latest.id AND s.kind='signed' AND s.checksum=latest."signedDocumentChecksum" AND a."contractId"=latest.id AND a.kind='audit' AND a.checksum=latest."auditEvidenceChecksum") THEN RAISE EXCEPTION 'Private signed PDF and execution evidence required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM "PartnerContractProviderApproval" p WHERE p.fingerprint=latest.snapshot->>'runtimeHash' AND p.status='approved' AND p.id=(SELECT id FROM "PartnerContractProviderApproval" WHERE fingerprint=p.fingerprint ORDER BY "createdAt" DESC,id DESC LIMIT 1)) THEN RAISE EXCEPTION 'Owner provider approval required'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS partner_contract_activation_guard ON "PartnerAccount";
CREATE TRIGGER partner_contract_activation_guard BEFORE INSERT OR UPDATE OF status ON "PartnerAccount" FOR EACH ROW EXECUTE FUNCTION partner_contract_activation_guard();
