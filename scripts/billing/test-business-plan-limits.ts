import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import {
  getCheckoutMarketOptions,
  getMarketForCountry,
  getCountryFromLocale,
  resolvePlanPrice,
} from "@/lib/billing/launch-pricing"
import {
  BUSINESS_PLAN_LIMITS,
  FREE_PLAN_LIMITS,
  PRO_PLAN_LIMITS,
  billingPlans,
  getCreditsLimitForTier,
  getDatasetLimitForTier,
} from "@/lib/billing/plans"
import { getDatasetLimitError } from "@/lib/usage/dataset-limits"

const repoRoot = resolve(import.meta.dirname, "../..")

function readProjectFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8")
}

// ---------------------------------------------------------------------------
// 1. Authoritative plan limits
// ---------------------------------------------------------------------------

assert.equal(BUSINESS_PLAN_LIMITS.monthlyCredits, 1500, "Business includes 1,500 AI credits per month")
assert.equal(BUSINESS_PLAN_LIMITS.maxDatasets, 100, "Business allows up to 100 datasets")
assert.equal(PRO_PLAN_LIMITS.monthlyCredits, 500, "Pro remains 500 AI credits per month")
assert.equal(PRO_PLAN_LIMITS.maxDatasets, 25, "Pro remains 25 datasets")
assert.equal(FREE_PLAN_LIMITS.monthlyCredits, 2, "Free remains 2 credits")
assert.equal(FREE_PLAN_LIMITS.maxDatasets, 2, "Free remains 2 datasets")

assert.equal(getCreditsLimitForTier("business"), 1500, "Business tier resolves 1,500 credits")
assert.equal(getDatasetLimitForTier("business"), 100, "Business tier resolves 100 datasets")
assert.equal(getCreditsLimitForTier("pro"), 500, "Pro tier resolves 500 credits")
assert.equal(getDatasetLimitForTier("pro"), 25, "Pro tier resolves 25 datasets")
assert.equal(getCreditsLimitForTier("free"), 2, "Free tier resolves 2 credits")
assert.equal(getDatasetLimitForTier("free"), 2, "Free tier resolves 2 datasets")

const businessPlan = billingPlans.find((plan) => plan.id === "business_monthly")!
const proPlan = billingPlans.find((plan) => plan.id === "pro_monthly")!
assert.equal(businessPlan.limits.monthlyCredits, 1500, "Business catalog plan exposes 1,500 credits")
assert.equal(businessPlan.limits.maxDatasets, 100, "Business catalog plan exposes 100 datasets")
assert.equal(businessPlan.price, 420, "Business monthly price stays €420")
assert.equal(proPlan.limits.monthlyCredits, 500, "Pro catalog plan stays 500 credits")
assert.equal(proPlan.limits.maxDatasets, 25, "Pro catalog plan stays 25 datasets")

// ---------------------------------------------------------------------------
// 2. App pricing copy renders the new Business limits
// ---------------------------------------------------------------------------

const businessFeatures = businessPlan.features.join("\n")
assert.ok(businessFeatures.includes("1,500 AI Credits / Month"), "Business card copy shows 1,500 AI Credits / Month")
assert.ok(businessFeatures.includes("Up to 100 Datasets"), "Business card copy shows Up to 100 Datasets")
assert.ok(!businessFeatures.includes("5000"), "Business card copy no longer shows 5000 credits")
assert.ok(!businessFeatures.includes("250"), "Business card copy no longer shows 250 datasets")
assert.ok(proPlan.features.includes("500 AI Credits / Month"), "Pro card copy keeps 500 AI Credits / Month")
assert.ok(proPlan.features.includes("Up to 25 Datasets"), "Pro card copy keeps Up to 25 Datasets")

const publicPricingSource = readProjectFile("src/components/billing/public-pricing-plans.tsx")
assert.ok(publicPricingSource.includes("plan.features.map"), "Public pricing renders the authoritative plan feature list")
assert.ok(!publicPricingSource.includes("5000"), "Public pricing component has no 5000 credits copy")
assert.ok(!publicPricingSource.includes("250"), "Public pricing component has no 250 datasets copy")

const csvUploadSource = readProjectFile("src/components/forms/csv-upload.tsx")
assert.ok(csvUploadSource.includes('"100 datasets"'), "CSV upload plan summary shows 100 Business datasets")
assert.ok(!csvUploadSource.includes('"250 datasets"'), "CSV upload plan summary no longer shows 250 datasets")

const accountancyUploadSource = readProjectFile("src/components/accountancy/accountancy-upload.tsx")
assert.ok(accountancyUploadSource.includes('"100 datasets"'), "Accountancy plan summary shows 100 Business datasets")
assert.ok(!accountancyUploadSource.includes('"250 datasets"'), "Accountancy plan summary no longer shows 250 datasets")

const knowledgeBaseSource = readProjectFile("src/lib/usy/knowledge-base.ts")
assert.ok(!knowledgeBaseSource.includes("?? 5000"), "USY knowledge base fallback no longer defaults to 5000 credits")
assert.ok(!knowledgeBaseSource.includes("?? 250"), "USY knowledge base fallback no longer defaults to 250 datasets")

// ---------------------------------------------------------------------------
// 3. Currency pills removed; resolved market is the primary displayed price
// ---------------------------------------------------------------------------

assert.ok(!publicPricingSource.includes('size="pill"'), "Currency-option pills are removed from public pricing")
assert.ok(!publicPricingSource.includes('data-public-price="market"'), "No per-market pill price elements remain")
assert.equal(
  (publicPricingSource.match(/data-public-price="primary"/g) ?? []).length,
  1,
  "Exactly one primary price display remains on the pricing card",
)
assert.ok(publicPricingSource.includes("getCountryFromLocale"), "Pricing card resolves market from the browser locale")
assert.ok(publicPricingSource.includes("getMarketForCountry"), "Pricing card uses the authoritative market resolver")
assert.ok(!publicPricingSource.includes('option.market === "eu"'), "Pricing card no longer hardcodes the EU market for the primary price")

assert.equal(getCountryFromLocale("en-GB"), "GB", "UK locale resolves to GB")
assert.equal(getMarketForCountry("GB"), "uk", "UK country resolves to the UK market")
assert.equal(getMarketForCountry("US"), "us", "US country resolves to the US market")
assert.equal(getMarketForCountry("CA"), "ca", "Canada resolves to the CA market")
assert.equal(getMarketForCountry("DE"), "eu", "Germany resolves to the EU market")
assert.equal(getMarketForCountry("ES"), "eu", "Unsupported countries fall back to the EU market")

// The resolved market must be the single displayed price per plan.
const marketDisplayCases = [
  { market: "eu", displayPrice: "€40/month" },
  { market: "uk", displayPrice: "£39/month" },
  { market: "us", displayPrice: "$45/month" },
  { market: "ca", displayPrice: "CA$55/month" },
] as const
for (const expected of marketDisplayCases) {
  const option = getCheckoutMarketOptions("pro", "monthly").find((candidate) => candidate.market === expected.market)!
  assert.equal(option.displayPrice, expected.displayPrice, `Pro ${expected.market} primary display price`)
  const resolved = resolvePlanPrice("pro_monthly", expected.market, "monthly")
  assert.equal(resolved?.displayPrice, expected.displayPrice, `Pro ${expected.market} canonical display price`)
}

// Business keeps its approved market prices — no invented prices.
assert.equal(resolvePlanPrice("business_monthly", "eu", "monthly")?.displayPrice, "€420/month", "Business EU display price unchanged")
assert.equal(resolvePlanPrice("business_monthly", "uk", "monthly")?.displayPrice, "£410/month", "Business UK display price unchanged")
assert.equal(resolvePlanPrice("business_monthly", "us", "monthly")?.displayPrice, "$473/month", "Business US display price unchanged")
assert.equal(resolvePlanPrice("business_monthly", "ca", "monthly")?.displayPrice, "CA$578/month", "Business CA display price unchanged")

// ---------------------------------------------------------------------------
// 4. Dataset enforcement derives from the authoritative plan limit
// ---------------------------------------------------------------------------

const datasetLimitsSource = readProjectFile("src/lib/usage/dataset-limits.ts")
assert.ok(datasetLimitsSource.includes("getBillingPlanByTier"), "Dataset enforcement derives limits from the billing plan catalog")
assert.ok(datasetLimitsSource.includes("plan.limits.maxDatasets"), "Dataset limit reads the plan maxDatasets value")
assert.ok(!datasetLimitsSource.includes("250"), "Dataset enforcement has no hardcoded 250 limit")

// Dataset #101 must be rejected for Business: 100 current datasets against the
// Business limit of 100 leaves canCreate false and produces the limit error.
const businessDatasetLimit = getDatasetLimitForTier("business")
const limitInfo = {
  limit: businessDatasetLimit,
  currentCount: businessDatasetLimit,
  canCreate: false,
  planName: "Business",
  tier: "business",
}
limitInfo.canCreate = limitInfo.currentCount < limitInfo.limit
assert.equal(limitInfo.canCreate, false, "Business cannot create dataset #101")
const datasetError = getDatasetLimitError(limitInfo)
assert.ok(datasetError, "Dataset limit error is produced for Business dataset #101")
assert.ok(datasetError!.includes("100"), "Dataset limit error mentions the 100 dataset Business limit")
assert.ok(!datasetError!.includes("250"), "Dataset limit error no longer mentions 250 datasets")

// ---------------------------------------------------------------------------
// 5. Credit lifecycle provisions the authoritative Business allowance
// ---------------------------------------------------------------------------

const creditEngineSource = readProjectFile("src/lib/billing/credit-engine.ts")
assert.ok(!creditEngineSource.includes("5000"), "Credit engine has no hardcoded 5000 Business allowance")
assert.ok(
  creditEngineSource.includes("const monthlyCredits = getCreditsLimitForTier(tier)"),
  "Initial credit provisioning derives the allowance from the plan catalog",
)
assert.ok(
  creditEngineSource.includes("const monthlyCredits = getCreditsLimitForTier(newTier)"),
  "Plan-change provisioning derives the allowance from the plan catalog",
)
assert.ok(creditEngineSource.includes("checkAndPerformMonthlyReset"), "Monthly reset path exists in the credit engine")
assert.ok(
  creditEngineSource.includes('remainingCredits: monthlyCredits + (creditInfo.purchasedBalance ?? 0)'),
  "Monthly reset preserves purchased credits and provisions the plan allowance",
)
assert.ok(
  creditEngineSource.includes('"purchasedBalance" = CASE'),
  "Included credits are consumed before purchased credits",
)

const webhookSource = readProjectFile("src/services/stripe/webhook.ts")
assert.ok(webhookSource.includes("processPlanChange"), "Stripe webhook refreshes plan credit allowances on tier changes")

const knowledgeBaseBusiness = readProjectFile("src/lib/usy/knowledge-base.ts")
assert.ok(knowledgeBaseBusiness.includes("business?.limits.monthlyCredits"), "USY knowledge base reads the Business plan allowance from the catalog")
assert.ok(knowledgeBaseBusiness.includes("business?.limits.maxDatasets"), "USY knowledge base reads the Business dataset limit from the catalog")

console.warn("Business plan limits and pricing cleanup tests passed")
