-- Identity verification can create a pending account and an application-scoped session
-- before the applicant submits legal identity, signs an agreement, or sets credentials.
CREATE OR REPLACE FUNCTION partner_linked_application_deletion_blocker(registration_id text, account_user_id text)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN a."linkedUserId" IS NOT NULL AND a."linkedUserId" <> account_user_id THEN 'different_identity'
    WHEN a.status NOT IN ('pending', 'rejected', 'approved') THEN 'application_status'
    WHEN a.status = 'approved' AND (a."invitationHash" IS NULL OR a."invitationExpiresAt" IS NULL)
      THEN 'application_approval'
    WHEN EXISTS (
      SELECT 1 FROM "PartnerOnboardingSession" s WHERE s."applicationId" = a.id
        AND (s."credentialSetAt" IS NOT NULL OR s."userId" <> account_user_id)
    ) OR EXISTS (
      SELECT 1 FROM "PartnerProgramApplicationEmail" e WHERE e."applicationId" = a.id AND e.kind = 'account_update'
    ) OR EXISTS (
      SELECT 1 FROM "PartnerProgramApplicationAudit" h WHERE h."applicationId" = a.id
        AND h.action IN ('partner_credentials_established', 'existing_login_retained')
    ) THEN 'completed_credentials'
    WHEN (a."onboardedAt" IS NOT NULL OR a."invitationUsedAt" IS NOT NULL) AND (
      a."onboardedAt" IS NULL OR a."invitationUsedAt" IS NULL
      OR a."linkedUserId" IS DISTINCT FROM account_user_id
      OR NOT EXISTS (
        SELECT 1 FROM "PartnerProgramApplicationAudit" h WHERE h."applicationId" = a.id
          AND h.actor = account_user_id AND h.action IN ('invitation_email_verified', 'onboarding_completed')
      )
    ) THEN 'unverified_onboarding'
    WHEN EXISTS (SELECT 1 FROM "PartnerContractProfile" c WHERE c."applicationId" = a.id) THEN 'legal_identity'
    WHEN EXISTS (SELECT 1 FROM "PartnerContractSchedule" c WHERE c."applicationId" = a.id) THEN 'commercial_schedule'
    WHEN EXISTS (SELECT 1 FROM "PartnerContract" c WHERE c."applicationId" = a.id)
      OR EXISTS (SELECT 1 FROM "PartnerContractAudit" c WHERE c."applicationId" = a.id) THEN 'legal_history'
    WHEN EXISTS (
      SELECT 1 FROM "PartnerContractJob" c WHERE c."applicationId" = a.id
        AND (c.kind <> 'prepare' OR c."contractId" IS NOT NULL OR c.status NOT IN ('pending', 'failed', 'done'))
    ) THEN 'contract_job'
    WHEN EXISTS (
      SELECT 1 FROM "PartnerProgramApplicationEmail" e WHERE e."applicationId" = a.id
        AND e.kind NOT IN ('receipt', 'admin_notice', 'rejected', 'approved', 'verification')
    ) OR EXISTS (
      SELECT 1 FROM "PartnerProgramApplicationAudit" h WHERE h."applicationId" = a.id
        AND h.action NOT IN ('submitted', 'under_review', 'rejected', 'add_note', 'migrated_existing_application',
          'approved', 'renew_invitation', 'verification_requested', 'invitation_email_verified', 'onboarding_completed')
    ) THEN 'application_history'
    ELSE NULL
  END
  FROM "PartnerProgramApplication" a
  WHERE a.id = registration_id;
$$;

CREATE OR REPLACE FUNCTION partner_account_deletion_blocker(account_id text)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN p.status = 'active' OR p."approvedAt" IS NOT NULL THEN 'activation'
    WHEN p."terminatedAt" IS NOT NULL OR p.status = 'terminated' THEN 'termination'
    WHEN p."payoutHold" THEN 'payout_hold'
    WHEN p.status NOT IN ('pending', 'rejected') THEN 'status'
    WHEN p.agreement LIKE 'Executed agreement %' OR EXISTS (
      SELECT 1 FROM "PartnerContract" c WHERE c."partnerId" = p.id AND (
        c.status = 'fully_executed' OR c."partnerSignedAt" IS NOT NULL OR c."companySignedAt" IS NOT NULL
        OR c."executedAt" IS NOT NULL OR c."signedArtifactId" IS NOT NULL
        OR EXISTS (SELECT 1 FROM "PartnerContractNativeSignature" s WHERE s."contractId" = c.id)
      )
    ) THEN 'signed_agreement'
    WHEN EXISTS (SELECT 1 FROM "PartnerContract" c WHERE c."partnerId" = p.id) THEN 'agreement'
    WHEN EXISTS (SELECT 1 FROM "PartnerPayout" f WHERE f."partnerId" = p.id) THEN 'payouts'
    WHEN EXISTS (SELECT 1 FROM "PartnerCommission" c WHERE c."partnerId" = p.id) THEN 'commissions'
    WHEN EXISTS (SELECT 1 FROM "PartnerPayment" f WHERE f."partnerId" = p.id) THEN 'payments'
    WHEN EXISTS (SELECT 1 FROM "PartnerAttribution" r WHERE r."partnerId" = p.id) THEN 'referrals'
    WHEN EXISTS (SELECT 1 FROM "PartnerEventReview" e WHERE e."partnerId" = p.id) THEN 'financial_review'
    WHEN p."commercialReview"->>'status' = 'approved'
      OR NULLIF(btrim(p."commercialReview"->>'evidence'), '') IS NOT NULL
      OR NULLIF(btrim(p.notes), '') IS NOT NULL THEN 'review_evidence'
    WHEN linked.blocker IS NOT NULL THEN linked.blocker
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
  LEFT JOIN LATERAL (
    SELECT decision.blocker
    FROM "PartnerProgramApplication" a
    CROSS JOIN LATERAL (
      SELECT partner_linked_application_deletion_blocker(a.id, p."userId") AS blocker
    ) decision
    WHERE a."partnerAccountId" = p.id AND decision.blocker IS NOT NULL
    ORDER BY a.id
    LIMIT 1
  ) linked ON true
  WHERE p.id = account_id;
$$;

-- Preserve application audit rows verbatim for commercial deletion. Keep the
-- standalone application audit trigger from 0046, and check new audit subjects.
CREATE OR REPLACE FUNCTION partner_validate_application_audit_subject()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM "PartnerProgramApplication" WHERE id = NEW."applicationId" FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partner application audit subject does not exist' USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS partner_validate_application_audit_subject ON "PartnerProgramApplicationAudit";
CREATE TRIGGER partner_validate_application_audit_subject BEFORE INSERT ON "PartnerProgramApplicationAudit"
FOR EACH ROW EXECUTE FUNCTION partner_validate_application_audit_subject();
ALTER TABLE "PartnerProgramApplicationAudit"
DROP CONSTRAINT IF EXISTS "PartnerProgramApplicationAudit_applicationId_fkey";

CREATE OR REPLACE FUNCTION partner_guard_application_identity()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Partner application identifiers are immutable';
  END IF;
  IF TG_OP = 'INSERT' AND EXISTS (
    SELECT 1 FROM "PartnerAudit" WHERE id = 'application-deletion:' || NEW.id
  ) THEN
    RAISE EXCEPTION 'Deleted partner application identifiers cannot be reused';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS partner_guard_application_identity ON "PartnerProgramApplication";
CREATE TRIGGER partner_guard_application_identity BEFORE INSERT OR UPDATE OF id ON "PartnerProgramApplication"
FOR EACH ROW EXECUTE FUNCTION partner_guard_application_identity();

CREATE OR REPLACE FUNCTION partner_guard_registration_deletion()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF partner_registration_deletion_authorized(OLD.id) OR EXISTS (
    SELECT 1
    FROM "PartnerAccount" p
    JOIN "PartnerAudit" account_event ON account_event.id = 'account-deletion:' || p.id
    JOIN "PartnerAudit" app_event ON app_event.id = 'application-deletion:' || OLD.id
    WHERE p.id = OLD."partnerAccountId"
      AND partner_account_deletion_blocker(p.id) IS NULL
      AND account_event."partnerId" IS NULL AND app_event."partnerId" IS NULL
      AND account_event.action = 'partner_account_deleted'
      AND app_event.action = 'partner_account_application_deleted'
      AND account_event.actor = app_event.actor AND account_event.reason = app_event.reason
      AND account_event.reason IN ('test_registration', 'duplicate_registration', 'applicant_request')
      AND account_event.data = jsonb_build_object('partnerId', p.id)
      AND app_event.data = jsonb_build_object('applicationId', OLD.id, 'partnerId', p.id)
  ) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Partner registration deletion requires an eligible registration and audit event';
END $$;
