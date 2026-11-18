-- Additive migration. Operators apply only after backup, policy review, and approval.
DO $migration$ BEGIN
IF to_regclass('"PartnerAudit"') IS NOT NULL THEN RETURN; END IF;
CREATE TABLE "ReferralCodeOwner" (
  "userId" text PRIMARY KEY REFERENCES "User"("id"),
  "code" text NOT NULL UNIQUE REFERENCES "ReferralStats"("code"), UNIQUE("userId",code)
);
-- Preserve every historical code/attribution; select one stable code per account.
INSERT INTO "ReferralCodeOwner" ("userId", "code")
SELECT DISTINCT ON (r."ownerUserId") r."ownerUserId", r."code"
FROM "ReferralStats" r JOIN "User" u ON u.id = r."ownerUserId"
ORDER BY r."ownerUserId", r."createdAt", r."code";

CREATE TABLE "PartnerConfig" (
  id text PRIMARY KEY, config jsonb NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now(),
  actor text NOT NULL, reason text NOT NULL
);
CREATE TABLE "PartnerAccount" (
  id text PRIMARY KEY, "userId" text NOT NULL UNIQUE REFERENCES "User"(id),
  code text NOT NULL UNIQUE REFERENCES "ReferralCodeOwner"(code), name text NOT NULL,
  country text NOT NULL CHECK (country ~ '^[A-Z]{2}$'), market text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','suspended','terminated')),
  agreement text NOT NULL, notes text NOT NULL DEFAULT '', level text NOT NULL DEFAULT 'bronze'
    CHECK (level IN ('bronze','silver','gold','platinum','diamond')),
  "candidateLevel" text, "candidateSince" timestamptz, "approvedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(), UNIQUE (id,"userId"),
  FOREIGN KEY ("userId",code) REFERENCES "ReferralCodeOwner"("userId",code)
);
CREATE TABLE "PartnerAttribution" (
  id text PRIMARY KEY, "referralId" text NOT NULL UNIQUE REFERENCES "ReferralAttribution"(id),
  "partnerId" text NOT NULL REFERENCES "PartnerAccount"(id), "userId" text NOT NULL UNIQUE REFERENCES "User"(id),
  "relatedParty" text NOT NULL DEFAULT 'unknown' CHECK ("relatedParty" IN ('unknown','unrelated','related')),
  "signedUpAt" timestamptz NOT NULL, "eligibilityStart" timestamptz, "eligibilityEnd" timestamptz,
  CHECK ("eligibilityEnd" IS NULL OR "eligibilityEnd" > "eligibilityStart")
);
CREATE INDEX "PartnerAttribution_partner_idx" ON "PartnerAttribution"("partnerId");
CREATE TABLE "PartnerFxRate" (
  id text PRIMARY KEY, currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'), day text NOT NULL,
  numerator numeric(30,0) NOT NULL CHECK (numerator > 0), denominator numeric(30,0) NOT NULL CHECK (denominator > 0),
  source text NOT NULL, actor text NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now(), UNIQUE(currency,day)
);
CREATE TABLE "PartnerEvent" (
  id text PRIMARY KEY, type text NOT NULL, "objectId" text NOT NULL, evidence jsonb NOT NULL,
  status text NOT NULL DEFAULT 'held', reason text, "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE "PartnerPayment" (
  id text PRIMARY KEY, "invoiceId" text NOT NULL UNIQUE, "chargeId" text NOT NULL UNIQUE, "subscriptionId" text NOT NULL,
  "attributionId" text NOT NULL REFERENCES "PartnerAttribution"(id), "partnerId" text NOT NULL REFERENCES "PartnerAccount"(id),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'), "grossMinor" numeric(20,0) NOT NULL,
  "netMinor" numeric(20,0) NOT NULL, "usdMinor" numeric(20,0) NOT NULL,
  "fxRateId" text REFERENCES "PartnerFxRate"(id), "paidAt" timestamptz NOT NULL,
  CHECK ("grossMinor" > 0 AND "netMinor" >= 0 AND "netMinor" <= "grossMinor" AND "usdMinor" >= 0)
);
CREATE INDEX "PartnerPayment_revenue_idx" ON "PartnerPayment"("partnerId","paidAt");
CREATE INDEX "PartnerPayment_attribution_idx" ON "PartnerPayment"("attributionId","subscriptionId");
CREATE TABLE "PartnerCommission" (
  id text PRIMARY KEY, "paymentId" text NOT NULL UNIQUE REFERENCES "PartnerPayment"(id),
  "partnerId" text NOT NULL REFERENCES "PartnerAccount"(id), "configId" text NOT NULL REFERENCES "PartnerConfig"(id),
  level text NOT NULL, "rateBps" integer NOT NULL CHECK ("rateBps" BETWEEN 0 AND 10000),
  "amountMinor" numeric(20,0) NOT NULL CHECK ("amountMinor" >= 0), currency text NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','approved','paid','reversed')), "earnedAt" timestamptz NOT NULL
);
CREATE TABLE "PartnerAdjustment" (
  id text PRIMARY KEY, "paymentId" text NOT NULL REFERENCES "PartnerPayment"(id),
  "eventId" text NOT NULL REFERENCES "PartnerEvent"(id), kind text NOT NULL,
  "grossTargetMinor" numeric(20,0) NOT NULL, "grossDeltaMinor" numeric(20,0) NOT NULL, "commissionDeltaMinor" numeric(20,0) NOT NULL,
  "netDeltaMinor" numeric(20,0) NOT NULL, "usdDeltaMinor" numeric(20,0) NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(), UNIQUE("eventId","paymentId")
);
CREATE TABLE "PartnerSubscription" (
  id text PRIMARY KEY, "userId" text NOT NULL REFERENCES "User"(id), status text NOT NULL,
  "periodEnd" timestamptz NOT NULL, "eventCreated" integer NOT NULL, canceled boolean NOT NULL DEFAULT false
);
CREATE TABLE "PartnerPayout" (
  id text PRIMARY KEY, "partnerId" text NOT NULL REFERENCES "PartnerAccount"(id), currency text NOT NULL,
  "amountMinor" numeric(20,0) NOT NULL CHECK ("amountMinor" > 0), reference text NOT NULL UNIQUE,
  actor text NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE "PartnerPayoutItem" (
  id text PRIMARY KEY, "payoutId" text NOT NULL REFERENCES "PartnerPayout"(id),
  "commissionId" text NOT NULL REFERENCES "PartnerCommission"(id), "amountMinor" numeric(20,0) NOT NULL
);
CREATE TABLE "PartnerAudit" (
  id text PRIMARY KEY, "partnerId" text REFERENCES "PartnerAccount"(id), actor text NOT NULL,
  action text NOT NULL, reason text NOT NULL, data jsonb NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "PartnerCommission_partner_idx" ON "PartnerCommission"("partnerId","earnedAt",id);
CREATE INDEX "PartnerAdjustment_payment_idx" ON "PartnerAdjustment"("paymentId");
CREATE INDEX "PartnerPayoutItem_commission_idx" ON "PartnerPayoutItem"("commissionId");
CREATE INDEX "PartnerAudit_partner_idx" ON "PartnerAudit"("partnerId","createdAt");
CREATE INDEX "PartnerEvent_status_object_idx" ON "PartnerEvent"(status,"objectId");
CREATE INDEX "PartnerSubscription_user_idx" ON "PartnerSubscription"("userId");
CREATE FUNCTION partner_immutable_record() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Partner financial and audit records are append-only'; END $$;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['PartnerConfig','PartnerFxRate','PartnerPayment','PartnerAdjustment','PartnerPayout','PartnerPayoutItem','PartnerAudit'] LOOP
    EXECUTE format('CREATE TRIGGER partner_immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION partner_immutable_record()', t);
  END LOOP;
END $$;
CREATE FUNCTION partner_commission_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' OR (to_jsonb(NEW) - 'state') IS DISTINCT FROM (to_jsonb(OLD) - 'state') THEN
    RAISE EXCEPTION 'Commission snapshots are immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER partner_commission_snapshot BEFORE UPDATE OR DELETE ON "PartnerCommission"
FOR EACH ROW EXECUTE FUNCTION partner_commission_snapshot();
CREATE FUNCTION partner_attribution_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "ReferralAttribution" r JOIN "PartnerAccount" p ON p.id=NEW."partnerId"
    WHERE r.id=NEW."referralId" AND r."referredUserId"=NEW."userId" AND r."referrerUserId"=p."userId"
      AND NEW."userId"<>p."userId" AND r."signupRewardStatus"='none' AND r."paidRewardStatus"='none') THEN
    RAISE EXCEPTION 'Commercial attribution must match an unrewarded verified referral';
  END IF;
  IF TG_OP='UPDATE' AND ((to_jsonb(NEW)-ARRAY['relatedParty','eligibilityStart','eligibilityEnd']) IS DISTINCT FROM
    (to_jsonb(OLD)-ARRAY['relatedParty','eligibilityStart','eligibilityEnd']) OR
    (OLD."eligibilityStart" IS NOT NULL AND (NEW."eligibilityStart",NEW."eligibilityEnd") IS DISTINCT FROM (OLD."eligibilityStart",OLD."eligibilityEnd"))) THEN
    RAISE EXCEPTION 'Partner attribution and established eligibility dates are immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER partner_attribution_integrity BEFORE INSERT OR UPDATE ON "PartnerAttribution"
FOR EACH ROW EXECUTE FUNCTION partner_attribution_integrity();
CREATE FUNCTION partner_reward_exclusion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "PartnerAttribution" WHERE "referralId"=OLD.id) AND
    (NEW."signupRewardStatus"<>'none' OR NEW."paidRewardStatus"<>'none' OR NEW."referredUserId"<>OLD."referredUserId" OR NEW."referrerUserId"<>OLD."referrerUserId") THEN
    RAISE EXCEPTION 'Commercial referrals cannot also receive customer credit rewards or change owners';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER partner_reward_exclusion BEFORE UPDATE ON "ReferralAttribution"
FOR EACH ROW EXECUTE FUNCTION partner_reward_exclusion();
CREATE FUNCTION partner_event_evidence_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' OR (to_jsonb(NEW)-ARRAY['status','reason']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','reason']) THEN
    RAISE EXCEPTION 'Verified event evidence is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER partner_event_evidence_immutable BEFORE UPDATE OR DELETE ON "PartnerEvent"
FOR EACH ROW EXECUTE FUNCTION partner_event_evidence_immutable();
END $migration$;
