-- An audit subject is a historical identifier, even after an eligible account is removed.
-- Keep existing audit rows immutable and validate that new entries refer to a current account.
CREATE OR REPLACE FUNCTION partner_validate_audit_subject()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."partnerId" IS NOT NULL THEN
    PERFORM 1 FROM "PartnerAccount" WHERE id = NEW."partnerId" FOR KEY SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Partner audit subject does not exist' USING ERRCODE = 'foreign_key_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS partner_validate_audit_subject ON "PartnerAudit";
CREATE TRIGGER partner_validate_audit_subject BEFORE INSERT ON "PartnerAudit"
FOR EACH ROW EXECUTE FUNCTION partner_validate_audit_subject();
ALTER TABLE "PartnerAudit" DROP CONSTRAINT IF EXISTS "PartnerAudit_partnerId_fkey";

CREATE OR REPLACE FUNCTION partner_guard_account_identity()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Partner account identifiers are immutable';
  END IF;
  IF TG_OP = 'INSERT' AND EXISTS (
    SELECT 1 FROM "PartnerAudit" WHERE id = 'account-deletion:' || NEW.id
  ) THEN
    RAISE EXCEPTION 'Deleted partner account identifiers cannot be reused';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS partner_guard_account_identity ON "PartnerAccount";
CREATE TRIGGER partner_guard_account_identity BEFORE INSERT OR UPDATE OF id ON "PartnerAccount"
FOR EACH ROW EXECUTE FUNCTION partner_guard_account_identity();

CREATE INDEX IF NOT EXISTS "PartnerProgramApplication_partner_account_idx"
ON "PartnerProgramApplication" ("partnerAccountId") WHERE "partnerAccountId" IS NOT NULL;

CREATE OR REPLACE FUNCTION partner_account_deletion_blocker(account_id text)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN p.status NOT IN ('pending', 'rejected') OR p."approvedAt" IS NOT NULL
      OR p."terminatedAt" IS NOT NULL OR p."payoutHold"
      THEN 'status'
    WHEN p."commercialReview"->>'status' = 'approved'
      OR NULLIF(btrim(p."commercialReview"->>'evidence'), '') IS NOT NULL
      OR NULLIF(btrim(p.notes), '') IS NOT NULL
      THEN 'review_evidence'
    WHEN p.agreement LIKE 'Executed agreement %'
      OR EXISTS (SELECT 1 FROM "PartnerContract" c WHERE c."partnerId" = p.id)
      THEN 'agreement'
    WHEN EXISTS (SELECT 1 FROM "PartnerAttribution" r WHERE r."partnerId" = p.id)
      OR EXISTS (SELECT 1 FROM "PartnerPayment" f WHERE f."partnerId" = p.id)
      OR EXISTS (SELECT 1 FROM "PartnerCommission" c WHERE c."partnerId" = p.id)
      OR EXISTS (SELECT 1 FROM "PartnerPayout" f WHERE f."partnerId" = p.id)
      OR EXISTS (SELECT 1 FROM "PartnerEventReview" e WHERE e."partnerId" = p.id)
      THEN 'financial_history'
    WHEN EXISTS (
      SELECT 1 FROM "PartnerProgramApplication" a
      WHERE a."partnerAccountId" = p.id AND (
        a.status NOT IN ('pending', 'rejected')
        OR (a."linkedUserId" IS NOT NULL AND a."linkedUserId" <> p."userId")
        OR a."onboardedAt" IS NOT NULL OR a."invitationHash" IS NOT NULL
        OR a."invitationExpiresAt" IS NOT NULL OR a."invitationUsedAt" IS NOT NULL
        OR EXISTS (SELECT 1 FROM "PartnerOnboardingChallenge" o WHERE o."applicationId" = a.id)
        OR EXISTS (SELECT 1 FROM "PartnerOnboardingSession" o WHERE o."applicationId" = a.id)
        OR EXISTS (SELECT 1 FROM "PartnerContractProfile" c WHERE c."applicationId" = a.id)
        OR EXISTS (SELECT 1 FROM "PartnerContractSchedule" c WHERE c."applicationId" = a.id)
        OR EXISTS (SELECT 1 FROM "PartnerContract" c WHERE c."applicationId" = a.id)
        OR EXISTS (SELECT 1 FROM "PartnerContractAudit" c WHERE c."applicationId" = a.id)
        OR EXISTS (SELECT 1 FROM "PartnerContractJob" c WHERE c."applicationId" = a.id)
        OR EXISTS (
          SELECT 1 FROM "PartnerProgramApplicationEmail" e
          WHERE e."applicationId" = a.id AND e.kind NOT IN ('receipt', 'admin_notice', 'rejected')
        )
        OR EXISTS (
          SELECT 1 FROM "PartnerProgramApplicationAudit" h
          WHERE h."applicationId" = a.id
            AND h.action NOT IN ('submitted', 'under_review', 'rejected', 'add_note', 'migrated_existing_application')
        )
      )
    ) THEN 'linked_application'
    WHEN EXISTS (
      SELECT 1 FROM "PartnerProgramApplication" a
      WHERE a."partnerAccountId" IS DISTINCT FROM p.id AND (
        a."linkedUserId" = p."userId" OR (
          a.status <> 'rejected' AND lower(a.email) IN (
            lower(u.email), lower(p.application->>'email'), lower(p.application->>'businessEmail')
          )
        )
      )
    ) THEN 'other_application'
    WHEN EXISTS (
      SELECT 1 FROM "PartnerAudit" h WHERE h."partnerId" = p.id
      AND NOT (
        h.action IN ('partner_registered', 'application_submitted')
        OR (h.action = 'application_reviewed' AND coalesce(h.data->>'before', 'pending') <> 'approved'
          AND coalesce(h.data->>'after', '') IN ('pending', 'under_review', 'rejected'))
        OR (h.action = 'partner_changed' AND coalesce(h.data#>>'{before,status}', '') IN ('pending', 'rejected')
          AND coalesce(h.data#>>'{after,status}', '') = 'rejected')
      )
    ) THEN 'audit_history'
    ELSE NULL
  END
  FROM "PartnerAccount" p
  LEFT JOIN "User" u ON u.id = p."userId"
  WHERE p.id = account_id;
$$;

CREATE OR REPLACE FUNCTION partner_guard_account_deletion()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF partner_account_deletion_blocker(OLD.id) IS NOT NULL OR NOT EXISTS (
    SELECT 1 FROM "PartnerAudit" h
    WHERE h.id = 'account-deletion:' || OLD.id AND h."partnerId" IS NULL
      AND h.action = 'partner_account_deleted'
      AND h.reason IN ('test_registration', 'duplicate_registration', 'applicant_request')
      AND h.data = jsonb_build_object('partnerId', OLD.id)
  ) THEN
    RAISE EXCEPTION 'Partner account deletion requires eligibility and an administrative audit event';
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS partner_guard_account_deletion ON "PartnerAccount";
CREATE TRIGGER partner_guard_account_deletion BEFORE DELETE ON "PartnerAccount"
FOR EACH ROW EXECUTE FUNCTION partner_guard_account_deletion();
