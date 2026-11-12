-- Extend the existing account; one application per authenticated account.
ALTER TABLE "PartnerAccount" ADD COLUMN IF NOT EXISTS application jsonb;
ALTER TABLE "PartnerAccount" DROP CONSTRAINT IF EXISTS "PartnerAccount_status_check";
ALTER TABLE "PartnerAccount" ADD CONSTRAINT "PartnerAccount_status_check"
  CHECK (status IN ('pending','active','rejected','suspended','terminated'));

CREATE OR REPLACE FUNCTION partner_application_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.application IS DISTINCT FROM OLD.application THEN
    RAISE EXCEPTION 'Submitted application evidence is immutable';
  END IF;
  IF OLD.status='rejected' AND NEW.status<>'rejected' THEN
    RAISE EXCEPTION 'Rejected applications cannot be reactivated';
  END IF;
  IF NEW.status='rejected' AND OLD.status NOT IN ('pending','rejected') THEN
    RAISE EXCEPTION 'Only pending applications can be rejected';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS partner_application_integrity ON "PartnerAccount";
CREATE TRIGGER partner_application_integrity BEFORE UPDATE ON "PartnerAccount"
FOR EACH ROW EXECUTE FUNCTION partner_application_integrity();
