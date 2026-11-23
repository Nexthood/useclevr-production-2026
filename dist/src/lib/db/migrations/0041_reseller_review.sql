-- Submitted application evidence remains immutable. Review decisions are separate.
ALTER TABLE "PartnerAccount" ADD COLUMN IF NOT EXISTS "commercialReview" jsonb;
ALTER TABLE "PartnerAccount" DROP CONSTRAINT IF EXISTS "PartnerAccount_commercial_review_check";
ALTER TABLE "PartnerAccount" ADD CONSTRAINT "PartnerAccount_commercial_review_check"
  CHECK ("commercialReview" IS NULL OR (
    jsonb_typeof("commercialReview") = 'object' AND
    "commercialReview"->>'status' IS NOT NULL AND
    "commercialReview"->>'status' IN ('pending','under_review','approved','rejected')
  ));
