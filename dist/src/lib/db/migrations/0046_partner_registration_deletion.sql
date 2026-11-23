-- An immutable PartnerAudit event authorizes the removal of an unlinked registration.
CREATE OR REPLACE FUNCTION partner_registration_deletion_authorized(registration_id text)
RETURNS boolean LANGUAGE sql AS $$
  SELECT EXISTS (
    SELECT 1
    FROM "PartnerProgramApplication" application
    JOIN "PartnerAudit" audit ON audit.id = 'application-deletion:' || application.id
    WHERE application.id = registration_id
      AND application.status IN ('pending', 'rejected')
      AND application."partnerAccountId" IS NULL
      AND application."linkedUserId" IS NULL
      AND application."onboardedAt" IS NULL
      AND application."invitationHash" IS NULL
      AND application."invitationExpiresAt" IS NULL
      AND application."invitationUsedAt" IS NULL
      AND audit."partnerId" IS NULL
      AND audit.action = 'application_registration_deleted'
      AND audit.reason IN ('test_registration', 'duplicate_registration', 'applicant_request')
      AND audit.data = jsonb_build_object('applicationId', application.id)
  );
$$;

CREATE OR REPLACE FUNCTION partner_program_application_audit_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND partner_registration_deletion_authorized(OLD."applicationId") THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Partner application audit history is immutable';
END $$;

CREATE OR REPLACE FUNCTION partner_guard_registration_deletion()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT partner_registration_deletion_authorized(OLD.id) THEN
    RAISE EXCEPTION 'Partner registration deletion requires an eligible registration and audit event';
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS partner_guard_registration_deletion ON "PartnerProgramApplication";
CREATE TRIGGER partner_guard_registration_deletion
BEFORE DELETE ON "PartnerProgramApplication"
FOR EACH ROW EXECUTE FUNCTION partner_guard_registration_deletion();
