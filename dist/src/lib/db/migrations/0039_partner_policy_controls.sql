-- Additive controls. Preserve 0038 and all financial/configuration snapshots.
DO $migration$ BEGIN
IF to_regclass('"PartnerEventReview"') IS NOT NULL THEN RETURN; END IF;

-- Existing versions use their original recorded date; no configuration JSON is rewritten.
-- Trigger bypass is confined to this transactional metadata backfill.
ALTER TABLE "PartnerConfig" DISABLE TRIGGER partner_immutable;
ALTER TABLE "PartnerConfig" ADD COLUMN "effectiveAt" timestamptz;
UPDATE "PartnerConfig" SET "effectiveAt"="createdAt";
ALTER TABLE "PartnerConfig" ALTER COLUMN "effectiveAt" SET DEFAULT now();
ALTER TABLE "PartnerConfig" ALTER COLUMN "effectiveAt" SET NOT NULL;
ALTER TABLE "PartnerConfig" ENABLE TRIGGER partner_immutable;
CREATE INDEX "PartnerConfig_effective_idx" ON "PartnerConfig"("effectiveAt","createdAt",id);

ALTER TABLE "PartnerAccount" ADD COLUMN "terminatedAt" timestamptz;
ALTER TABLE "PartnerAccount" ADD COLUMN "payoutHold" boolean NOT NULL DEFAULT false;
UPDATE "PartnerAccount" SET "payoutHold"=true WHERE status='terminated';
-- Legacy terminated accounts with no effective date remain held for manual investigation.

CREATE TABLE "PartnerEventReview" (
  "eventId" text PRIMARY KEY REFERENCES "PartnerEvent"(id),
  "partnerId" text NOT NULL REFERENCES "PartnerAccount"(id),
  "configId" text NOT NULL REFERENCES "PartnerConfig"(id),
  level text NOT NULL CHECK (level IN ('bronze','silver','gold','platinum','diamond')),
  actor text NOT NULL, reason text NOT NULL CHECK (length(trim(reason))>0),
  evidence text NOT NULL CHECK (length(trim(evidence))>0),
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER partner_immutable BEFORE UPDATE OR DELETE ON "PartnerEventReview"
FOR EACH ROW EXECUTE FUNCTION partner_immutable_record();

CREATE FUNCTION partner_termination_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status='terminated' AND (NEW.status<>'terminated' OR NEW."terminatedAt" IS DISTINCT FROM OLD."terminatedAt") THEN
    RAISE EXCEPTION 'Termination status and effective date are immutable';
  END IF;
  IF NEW.status='terminated' AND OLD.status<>'terminated' AND (NEW."terminatedAt" IS NULL OR NOT NEW."payoutHold") THEN
    RAISE EXCEPTION 'Termination requires an effective date and payout review hold';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER partner_termination_integrity BEFORE UPDATE ON "PartnerAccount"
FOR EACH ROW EXECUTE FUNCTION partner_termination_integrity();
END $migration$;
