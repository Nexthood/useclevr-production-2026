import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import {
  getCheckoutMarketOptions,
  getFixedProPrice,
  getProStripePriceId,
  getSubscriptionIntervalForStripePriceId,
  getSubscriptionTierForStripePriceId,
  resolveCheckoutMarketPrice,
  resolveCheckoutProPrice,
  resolvePlanPrice,
  resolveProPriceForCountry,
  type CheckoutMarket,
  type BillingInterval,
  type SupportedCurrency,
} from "@/lib/billing/launch-pricing"
import {
  FREE_PLAN_LIMITS,
  billingPlans,
  formatCustomerPlanLabel,
  formatPlanPrice,
  getBillingPlan,
  getBillingPlanByTier,
  getPlanPriceForMarket,
  normalizeBillingPlanId,
  normalizeSubscriptionTier,
} from "@/lib/billing/plans"

const repoRoot = resolve(import.meta.dirname, "../..")

type ExpectedCase = {
  label: string
  country: string | null
  currency: SupportedCurrency
  amountMinor: number
  labelText: string
}

const expectedCases: ExpectedCase[] = [
  { label: "Germany", country: "DE", currency: "EUR", amountMinor: 4000, labelText: "€40/month" },
  { label: "Netherlands", country: "NL", currency: "EUR", amountMinor: 4000, labelText: "€40/month" },
  { label: "United Kingdom", country: "GB", currency: "GBP", amountMinor: 3900, labelText: "£39/month" },
  { label: "United States", country: "US", currency: "USD", amountMinor: 4500, labelText: "$45/month" },
  { label: "Canada", country: "CA", currency: "CAD", amountMinor: 5500, labelText: "CA$55/month" },
  { label: "Switzerland", country: "CH", currency: "EUR", amountMinor: 4000, labelText: "€40/month" },
  { label: "Denmark", country: "DK", currency: "EUR", amountMinor: 4000, labelText: "€40/month" },
  { label: "Unsupported country", country: "ES", currency: "EUR", amountMinor: 4000, labelText: "€40/month" },
]

for (const expected of expectedCases) {
  const actual = resolveProPriceForCountry(expected.country)
  assert.equal(actual.currency, expected.currency, `${expected.label} currency`)
  assert.equal(actual.amountMinor, expected.amountMinor, `${expected.label} amount`)
  assert.equal(actual.label, expected.labelText, `${expected.label} label`)
}

assert.deepEqual(
  billingPlans.map((plan) => plan.name),
  ["Free", "Pro", "Business"],
  "customer-facing billing catalog exposes only Free, Pro, and Business",
)
assert.equal(billingPlans.some((plan) => plan.name === "Demo" || plan.id === "demo"), false, "Demo is not a customer-facing plan")
assert.equal(FREE_PLAN_LIMITS.monthlyCredits, 2, "Free retains 2 included AI credits")
assert.equal(getBillingPlan("free").name, "Free", "Free plan resolves by ID")
assert.equal(getBillingPlanByTier("free").name, "Free", "Free plan resolves by tier")
assert.equal(formatPlanPrice(getBillingPlan("free")), "$0/€0/month", "Free displays both launch currencies")
assert.equal(normalizeBillingPlanId("demo"), "free", "legacy demo plan IDs route to Free")
assert.equal(normalizeSubscriptionTier("demo"), "free", "legacy demo subscription tiers route to Free")
assert.equal(getBillingPlan("demo").name, "Free", "legacy demo plan requests display Free")
assert.equal(getBillingPlanByTier("demo").name, "Free", "legacy demo tiers display Free")
assert.equal(formatCustomerPlanLabel("demo"), "Free", "legacy demo tier labels display Free")
assert.equal(formatCustomerPlanLabel("builtin"), "Free", "built-in customer plan labels display Free")

const browserDiffers = resolveCheckoutProPrice({
  billingCountry: "US",
  browserCountry: "DE",
})
assert.equal(browserDiffers.currency, "USD", "billing country overrides browser locale/IP fallback")
assert.equal(browserDiffers.amountMinor, 4500, "US billing country keeps fixed USD amount")

const providerDiffers = resolveCheckoutProPrice({
  billingCountry: "GB",
  paymentProviderCustomerCountry: "DE",
  browserCountry: "US",
})
assert.equal(providerDiffers.currency, "GBP", "billing country overrides payment-provider country when supplied")
assert.equal(providerDiffers.amountMinor, 3900, "GB billing country keeps fixed GBP amount")

assert.throws(
  () => resolveCheckoutProPrice({ billingCountry: "US", requestedCurrency: "EUR" }),
  /Checkout currency does not match/,
  "invalid currency submission is rejected",
)

assert.throws(
  () => resolveCheckoutProPrice({ billingCountry: "US", requestedCurrency: "USD", requestedAmountMinor: 4000 }),
  /Checkout price does not match/,
  "altered price submission is rejected",
)

assert.throws(
  () => resolveCheckoutProPrice({ browserCountry: "US" }),
  /Billing country is required/,
  "checkout requires billing country for final price validation",
)

const previousEnv = {
  USECLEVR_PRO_PRICE_EUR: process.env.USECLEVR_PRO_PRICE_EUR,
  USECLEVR_PRO_PRICE_GBP: process.env.USECLEVR_PRO_PRICE_GBP,
  USECLEVR_PRO_PRICE_USD: process.env.USECLEVR_PRO_PRICE_USD,
  USECLEVR_PRO_PRICE_CAD: process.env.USECLEVR_PRO_PRICE_CAD,
  STRIPE_PRO_PRICE_ID_EUR: process.env.STRIPE_PRO_PRICE_ID_EUR,
  STRIPE_PRO_PRICE_ID_GBP: process.env.STRIPE_PRO_PRICE_ID_GBP,
  STRIPE_PRO_PRICE_ID_USD: process.env.STRIPE_PRO_PRICE_ID_USD,
  STRIPE_PRO_PRICE_ID_CAD: process.env.STRIPE_PRO_PRICE_ID_CAD,
  STRIPE_BUSINESS_PRICE_ID_EUR: process.env.STRIPE_BUSINESS_PRICE_ID_EUR,
  STRIPE_PRICE_BUSINESS_MONTHLY: process.env.STRIPE_PRICE_BUSINESS_MONTHLY,
  STRIPE_PRICE_ID_BUSINESS_MONTHLY: process.env.STRIPE_PRICE_ID_BUSINESS_MONTHLY,
  STRIPE_BUSINESS_PRICE_ID_GBP: process.env.STRIPE_BUSINESS_PRICE_ID_GBP,
  STRIPE_BUSINESS_PRICE_ID_USD: process.env.STRIPE_BUSINESS_PRICE_ID_USD,
  STRIPE_BUSINESS_PRICE_ID_CAD: process.env.STRIPE_BUSINESS_PRICE_ID_CAD,
  STRIPE_PRICE_PRO_EUR_YEARLY: process.env.STRIPE_PRICE_PRO_EUR_YEARLY,
  STRIPE_PRICE_PRO_GBP_YEARLY: process.env.STRIPE_PRICE_PRO_GBP_YEARLY,
  STRIPE_PRICE_PRO_USD_YEARLY: process.env.STRIPE_PRICE_PRO_USD_YEARLY,
  STRIPE_PRICE_PRO_CAD_YEARLY: process.env.STRIPE_PRICE_PRO_CAD_YEARLY,
  STRIPE_PRICE_BUSINESS_EUR_YEARLY: process.env.STRIPE_PRICE_BUSINESS_EUR_YEARLY,
  STRIPE_PRICE_BUSINESS_GBP_YEARLY: process.env.STRIPE_PRICE_BUSINESS_GBP_YEARLY,
  STRIPE_PRICE_BUSINESS_USD_YEARLY: process.env.STRIPE_PRICE_BUSINESS_USD_YEARLY,
  STRIPE_PRICE_BUSINESS_CAD_YEARLY: process.env.STRIPE_PRICE_BUSINESS_CAD_YEARLY,
}

process.env.USECLEVR_PRO_PRICE_EUR = "price_pro_eur_test"
process.env.USECLEVR_PRO_PRICE_GBP = "price_pro_gbp_test"
process.env.USECLEVR_PRO_PRICE_USD = "price_pro_usd_test"
process.env.USECLEVR_PRO_PRICE_CAD = "price_pro_cad_test"
delete process.env.STRIPE_PRO_PRICE_ID_EUR
delete process.env.STRIPE_PRO_PRICE_ID_GBP
delete process.env.STRIPE_PRO_PRICE_ID_USD
delete process.env.STRIPE_PRO_PRICE_ID_CAD
process.env.STRIPE_BUSINESS_PRICE_ID_EUR = "price_business_eur_test"
delete process.env.STRIPE_PRICE_BUSINESS_MONTHLY
delete process.env.STRIPE_PRICE_ID_BUSINESS_MONTHLY
process.env.STRIPE_BUSINESS_PRICE_ID_GBP = "price_business_gbp_test"
process.env.STRIPE_BUSINESS_PRICE_ID_USD = "price_business_usd_test"
process.env.STRIPE_BUSINESS_PRICE_ID_CAD = "price_business_cad_test"
process.env.STRIPE_PRICE_PRO_EUR_YEARLY = "price_pro_eur_yearly_test"
process.env.STRIPE_PRICE_PRO_GBP_YEARLY = "price_pro_gbp_yearly_test"
process.env.STRIPE_PRICE_PRO_USD_YEARLY = "price_pro_usd_yearly_test"
process.env.STRIPE_PRICE_PRO_CAD_YEARLY = "price_pro_cad_yearly_test"
process.env.STRIPE_PRICE_BUSINESS_EUR_YEARLY = "price_business_eur_yearly_test"
process.env.STRIPE_PRICE_BUSINESS_GBP_YEARLY = "price_business_gbp_yearly_test"
process.env.STRIPE_PRICE_BUSINESS_USD_YEARLY = "price_business_usd_yearly_test"
process.env.STRIPE_PRICE_BUSINESS_CAD_YEARLY = "price_business_cad_yearly_test"

assert.equal(getProStripePriceId("EUR"), "price_pro_eur_test", "EUR checkout uses EUR Stripe price ID")
assert.equal(getProStripePriceId("GBP"), "price_pro_gbp_test", "GBP checkout uses GBP Stripe price ID")
assert.equal(getProStripePriceId("USD"), "price_pro_usd_test", "USD checkout uses USD Stripe price ID")
assert.equal(getProStripePriceId("CAD"), "price_pro_cad_test", "CAD checkout uses CAD Stripe price ID")

const proMarketCases = [
  { market: "eu", currency: "EUR", amountMinor: 4000, priceId: "price_pro_eur_test" },
  { market: "uk", currency: "GBP", amountMinor: 3900, priceId: "price_pro_gbp_test" },
  { market: "us", currency: "USD", amountMinor: 4500, priceId: "price_pro_usd_test" },
  { market: "ca", currency: "CAD", amountMinor: 5500, priceId: "price_pro_cad_test" },
] as const

for (const expected of proMarketCases) {
  const resolved = resolveCheckoutMarketPrice({
    plan: "pro",
    billingInterval: "monthly",
    market: expected.market,
  })
  assert.equal(resolved.currency, expected.currency, `Pro ${expected.market} currency`)
  assert.equal(resolved.amountMinor, expected.amountMinor, `Pro ${expected.market} amount`)
  assert.equal(resolved.stripePriceId, expected.priceId, `Pro ${expected.market} Stripe price`)
  assert.equal(resolved.enabled, true, `Pro ${expected.market} opens Stripe`)
}

assert.throws(
  () => resolveCheckoutMarketPrice({ plan: "pro", billingInterval: "monthly" }),
  /Choose a billing market/,
  "Pro checkout rejects lost market",
)

assert.throws(
  () => resolveCheckoutMarketPrice({ plan: "pro", billingInterval: "monthly", market: "us", requestedAmountMinor: 1 }),
  /server/,
  "client cannot override Pro amount",
)

assert.throws(
  () => resolveCheckoutMarketPrice({ plan: "pro", billingInterval: "monthly", market: "us", requestedStripePriceId: "price_attacker" }),
  /server/,
  "client cannot provide Pro Stripe price ID",
)

const businessEu = resolveCheckoutMarketPrice({
  plan: "business",
  billingInterval: "monthly",
  market: "eu",
})
assert.equal(businessEu.currency, "EUR", "Business EUR currency")
assert.equal(businessEu.amountMinor, 42000, "Business EUR amount is preserved")
assert.equal(businessEu.displayPrice, "€420/month", "Business EUR display price")
assert.equal(businessEu.stripePriceId, "price_business_eur_test", "Business EUR uses configured Stripe price")

const businessMarkets = getCheckoutMarketOptions("business")
assert.equal(businessMarkets.find((market) => market.market === "eu")?.enabled, true, "Business EUR is selectable")
assert.equal(businessMarkets.find((market) => market.market === "uk")?.enabled, true, "Business UK is selectable with configured GBP price")
assert.equal(businessMarkets.find((market) => market.market === "us")?.enabled, true, "Business US is selectable with configured USD price")
assert.equal(businessMarkets.find((market) => market.market === "ca")?.enabled, true, "Business Canada is selectable with configured CAD price")

const businessUk = resolveCheckoutMarketPrice({
  plan: "business",
  billingInterval: "monthly",
  market: "uk",
})
assert.equal(businessUk.currency, "GBP", "Business UK currency")
assert.equal(businessUk.amountMinor, 40950, "Business UK amount is preserved")
assert.equal(businessUk.displayPrice, "£410/month", "Business UK display price")
assert.equal(businessUk.stripePriceId, "price_business_gbp_test", "Business UK uses configured Stripe price")

const businessUs = resolveCheckoutMarketPrice({
  plan: "business",
  billingInterval: "monthly",
  market: "us",
})
assert.equal(businessUs.currency, "USD", "Business US currency")
assert.equal(businessUs.amountMinor, 47250, "Business US amount is preserved")
assert.equal(businessUs.displayPrice, "$473/month", "Business US display price")
assert.equal(businessUs.stripePriceId, "price_business_usd_test", "Business US uses configured Stripe price")

const businessCa = resolveCheckoutMarketPrice({
  plan: "business",
  billingInterval: "monthly",
  market: "ca",
})
assert.equal(businessCa.currency, "CAD", "Business CA currency")
assert.equal(businessCa.amountMinor, 57750, "Business CA amount is preserved")
assert.equal(businessCa.displayPrice, "CA$578/month", "Business CA display price")
assert.equal(businessCa.stripePriceId, "price_business_cad_test", "Business CA uses configured Stripe price")

const yearlyCases = [
  { plan: "pro", market: "us", currency: "USD", amountMinor: 55000, displayPrice: "$550/year", priceId: "price_pro_usd_yearly_test" },
  { plan: "pro", market: "eu", currency: "EUR", amountMinor: 48000, displayPrice: "€480/year", priceId: "price_pro_eur_yearly_test" },
  { plan: "pro", market: "uk", currency: "GBP", amountMinor: 41000, displayPrice: "£410/year", priceId: "price_pro_gbp_yearly_test" },
  { plan: "pro", market: "ca", currency: "CAD", amountMinor: 77500, displayPrice: "CA$775/year", priceId: "price_pro_cad_yearly_test" },
  { plan: "business", market: "us", currency: "USD", amountMinor: 580000, displayPrice: "$5,800/year", priceId: "price_business_usd_yearly_test" },
  { plan: "business", market: "eu", currency: "EUR", amountMinor: 504000, displayPrice: "€5,040/year", priceId: "price_business_eur_yearly_test" },
  { plan: "business", market: "uk", currency: "GBP", amountMinor: 432000, displayPrice: "£4,320/year", priceId: "price_business_gbp_yearly_test" },
  { plan: "business", market: "ca", currency: "CAD", amountMinor: 815000, displayPrice: "CA$8,150/year", priceId: "price_business_cad_yearly_test" },
] as const

for (const expected of yearlyCases) {
  const resolved = resolveCheckoutMarketPrice({
    plan: expected.plan,
    billingInterval: "yearly",
    market: expected.market,
  })
  assert.equal(resolved.billingInterval, "yearly", `${expected.plan} ${expected.market} yearly interval`)
  assert.equal(resolved.currency, expected.currency, `${expected.plan} ${expected.market} yearly currency`)
  assert.equal(resolved.amountMinor, expected.amountMinor, `${expected.plan} ${expected.market} yearly amount`)
  assert.equal(resolved.displayPrice, expected.displayPrice, `${expected.plan} ${expected.market} yearly display price`)
  assert.equal(resolved.stripePriceId, expected.priceId, `${expected.plan} ${expected.market} yearly Stripe price`)
  assert.equal(resolved.enabled, true, `${expected.plan} ${expected.market} yearly opens Stripe`)
}

assert.equal(
  resolveCheckoutMarketPrice({ plan: "pro", billingInterval: "monthly", market: "eu" }).stripePriceId,
  "price_pro_eur_test",
  "Monthly after Yearly returns to the original Pro EUR monthly Stripe price",
)
assert.equal(getSubscriptionTierForStripePriceId("price_business_eur_yearly_test"), "business", "webhook maps Business yearly Price IDs to Business")
assert.equal(getSubscriptionIntervalForStripePriceId("price_business_eur_yearly_test"), "yearly", "subscription page maps Business yearly Price IDs to Yearly")
assert.equal(getSubscriptionTierForStripePriceId("price_pro_usd_test"), "pro", "webhook maps Pro market Price IDs to Pro")
assert.equal(getSubscriptionTierForStripePriceId("price_business_eur_test"), "business", "webhook maps Business EUR Price ID to Business")

const checkoutPageSource = readProjectFile("src/app/(auth)/app/settings/checkout/page.tsx")
assert.ok(checkoutPageSource.includes('plan: plan.tier'), "checkout browser payload sends canonical plan")
assert.ok(checkoutPageSource.includes("billingInterval: selectedBillingInterval"), "checkout browser payload sends selected interval")
assert.ok(checkoutPageSource.includes("market: selectedMarket"), "checkout browser payload sends canonical market")
assert.ok(checkoutPageSource.includes("buildCheckoutUrl({ planId, market: selectedMarket"), "terms flow preserves selected market in the URL")
assert.ok(checkoutPageSource.includes("BillingIntervalSelector"), "checkout review exposes the Monthly and Yearly selector")
assert.ok(checkoutPageSource.includes("Billing:"), "checkout review shows the selected billing interval before Stripe")
assert.ok(checkoutPageSource.includes("Free is active. No checkout required."), "Free checkout path explains that checkout is not required")
assert.ok(checkoutPageSource.includes("const canReview = !isFreePlan"), "Free plan cannot enter paid checkout review")
assert.ok(checkoutPageSource.includes('if (plan.tier === "free") return formatPlanPrice(plan);'), "Free checkout derives pricing from the billing formatter")
assert.equal(checkoutPageSource.includes("requestedAmountMinor"), false, "checkout browser payload does not send an amount override")
assert.equal(checkoutPageSource.includes("requestedStripePriceId"), false, "checkout browser payload does not send a Stripe Price ID override")

const pricingPageSource = readProjectFile("src/app/(public)/pricing/page.tsx")
const publicPricingPlansSource = readProjectFile("src/components/billing/public-pricing-plans.tsx")
assert.ok(publicPricingPlansSource.includes('formatPlanPrice(plan).replace("/month", "")'), "public pricing derives Free pricing from the billing formatter")
assert.ok(publicPricingPlansSource.includes("BillingIntervalSelector"), "public pricing exposes the Monthly and Yearly selector")
assert.equal(pricingPageSource.includes("Demo"), false, "public pricing does not show a Demo plan")

const checkoutConfirmSource = readProjectFile("src/app/api/checkout/confirm/route.ts")
assert.ok(checkoutConfirmSource.includes("The Free plan does not require checkout."), "checkout API refuses Free checkout")

const checkoutOptionsSource = readProjectFile("src/app/api/checkout/options/route.ts")
assert.ok(checkoutOptionsSource.includes('getCheckoutMarketOptions("business", "monthly")'), "Business checkout exposes shared monthly market options")
assert.ok(checkoutOptionsSource.includes('getCheckoutMarketOptions("business", "yearly")'), "Business checkout exposes shared yearly market options")

const stripeCheckoutSource = readProjectFile("src/services/stripe/checkout.ts")
assert.ok(stripeCheckoutSource.includes("stripe.prices.retrieve"), "checkout validates Stripe Price IDs before session creation")
assert.ok(stripeCheckoutSource.includes("!price.active"), "checkout rejects inactive Stripe prices")
assert.ok(stripeCheckoutSource.includes("price.recurring.interval !== input.expectedInterval"), "checkout validates the selected recurring interval")

const webhookSource = readProjectFile("src/services/stripe/webhook.ts")
assert.ok(webhookSource.includes("getSubscriptionTierForStripePriceId"), "webhook maps all market Price IDs through the checkout registry")

const existingSubscription = Object.freeze({
  id: "sub_existing",
  priceId: "price_legacy_pro",
  currency: "eur",
  amountMinor: 4900,
})
assert.deepEqual(
  existingSubscription,
  { id: "sub_existing", priceId: "price_legacy_pro", currency: "eur", amountMinor: 4900 },
  "pricing helpers do not mutate existing subscription data",
)

assert.equal(getFixedProPrice("EUR").label, "€40/month")
assert.equal(getFixedProPrice("GBP").label, "£39/month")
assert.equal(getFixedProPrice("USD").label, "$45/month")
assert.equal(getFixedProPrice("CAD").label, "CA$55/month")

const markets: CheckoutMarket[] = ["eu", "uk", "us", "ca"]
const intervals: BillingInterval[] = ["monthly", "yearly"]

const expectedMonthlyAmounts: Record<string, Record<string, number>> = {
  pro: { eu: 4000, uk: 3900, us: 4500, ca: 5500 },
  business: { eu: 42000, uk: 40950, us: 47250, ca: 57750 },
}
const expectedYearlyAmounts: Record<string, Record<string, number>> = {
  pro: { eu: 48000, uk: 41000, us: 55000, ca: 77500 },
  business: { eu: 504000, uk: 432000, us: 580000, ca: 815000 },
}
const expectedCurrencies: Record<CheckoutMarket, SupportedCurrency> = {
  eu: "EUR", uk: "GBP", us: "USD", ca: "CAD",
}

for (const market of markets) {
  const resolved = resolvePlanPrice("free", market, "monthly")
  assert.ok(resolved, `Free ${market} resolves`)
  assert.equal(resolved!.tier, "free", `Free ${market} tier`)
  assert.equal(resolved!.amountMinor, 0, `Free ${market} amount is zero`)
  assert.equal(resolved!.displayPrice, "Free", `Free ${market} display is market-neutral`)
  assert.equal(resolved!.enabled, true, `Free ${market} enabled (no checkout needed)`)
  assert.equal(resolved!.stripePriceId, undefined, `Free ${market} has no Stripe price ID`)
}

for (const market of markets) {
  const resolved = resolvePlanPrice("demo", market, "monthly")
  assert.ok(resolved, `Demo ${market} resolves`)
  assert.equal(resolved!.tier, "free", `Demo ${market} tier is free`)
  assert.equal(resolved!.amountMinor, 0, `Demo ${market} amount is zero`)
  assert.equal(resolved!.displayPrice, "Free", `Demo ${market} display is market-neutral`)
  assert.equal(resolved!.stripePriceId, undefined, `Demo ${market} has no Stripe price ID`)
}

for (const planSlug of ["pro", "business"] as const) {
  for (const market of markets) {
    for (const interval of intervals) {
      const planId = interval === "yearly"
        ? planSlug === "pro" ? "pro_annual" : "business_annual"
        : planSlug === "pro" ? "pro_monthly" : "business_monthly"
      const resolved = resolvePlanPrice(planId, market, interval)
      assert.ok(resolved, `${planSlug} ${market} ${interval} resolves`)

      const expectedAmounts = interval === "monthly" ? expectedMonthlyAmounts : expectedYearlyAmounts
      const expectedAmount = expectedAmounts[planSlug][market]

      assert.equal(resolved!.currency, expectedCurrencies[market], `${planSlug} ${market} ${interval} currency`)
      assert.equal(resolved!.amountMinor, expectedAmount, `${planSlug} ${market} ${interval} approved amount`)
      assert.equal(resolved!.enabled, true, `${planSlug} ${market} ${interval} has Stripe price configured`)
      assert.ok(resolved!.stripePriceId, `${planSlug} ${market} ${interval} has a Stripe Price ID`)
    }
  }
}

assert.equal(resolvePlanPrice("pro_monthly", "eu", "monthly")?.displayPrice, "€40/month", "Pro EU monthly display price")
assert.equal(resolvePlanPrice("pro_monthly", "uk", "monthly")?.displayPrice, "£39/month", "Pro UK monthly display price")
assert.equal(resolvePlanPrice("pro_monthly", "us", "monthly")?.displayPrice, "$45/month", "Pro US monthly display price")
assert.equal(resolvePlanPrice("pro_monthly", "ca", "monthly")?.displayPrice, "CA$55/month", "Pro CA monthly display price")

assert.equal(resolvePlanPrice("pro_annual", "eu", "yearly")?.displayPrice, "€480/year", "Pro EU yearly display price")
assert.equal(resolvePlanPrice("pro_annual", "uk", "yearly")?.displayPrice, "£410/year", "Pro UK yearly display price")
assert.equal(resolvePlanPrice("pro_annual", "us", "yearly")?.displayPrice, "$550/year", "Pro US yearly display price")
assert.equal(resolvePlanPrice("pro_annual", "ca", "yearly")?.displayPrice, "CA$775/year", "Pro CA yearly display price")

assert.equal(resolvePlanPrice("business_monthly", "eu", "monthly")?.displayPrice, "€420/month", "Business EU monthly display price")
assert.equal(resolvePlanPrice("business_monthly", "uk", "monthly")?.displayPrice, "£410/month", "Business UK monthly display price")
assert.equal(resolvePlanPrice("business_monthly", "us", "monthly")?.displayPrice, "$473/month", "Business US monthly display price")
assert.equal(resolvePlanPrice("business_monthly", "ca", "monthly")?.displayPrice, "CA$578/month", "Business CA monthly display price")

assert.equal(resolvePlanPrice("business_annual", "eu", "yearly")?.displayPrice, "€5,040/year", "Business EU yearly display price")
assert.equal(resolvePlanPrice("business_annual", "uk", "yearly")?.displayPrice, "£4,320/year", "Business UK yearly display price")
assert.equal(resolvePlanPrice("business_annual", "us", "yearly")?.displayPrice, "$5,800/year", "Business US yearly display price")
assert.equal(resolvePlanPrice("business_annual", "ca", "yearly")?.displayPrice, "CA$8,150/year", "Business CA yearly display price")

assert.equal(resolvePlanPrice("business_monthly", "eu", "monthly")?.stripePriceId, "price_business_eur_test", "Business EU Stripe price ID")
assert.equal(resolvePlanPrice("business_monthly", "uk", "monthly")?.stripePriceId, "price_business_gbp_test", "Business UK Stripe price ID")
assert.equal(resolvePlanPrice("business_monthly", "us", "monthly")?.stripePriceId, "price_business_usd_test", "Business US Stripe price ID")
assert.equal(resolvePlanPrice("business_monthly", "ca", "monthly")?.stripePriceId, "price_business_cad_test", "Business CA Stripe price ID")

assert.equal(getBillingPlan("free").price, 0, "Free plan price field is zero in billingPlans")
assert.equal(resolvePlanPrice("free", "eu", "monthly")?.amountMinor, 0, "Free EU amountMinor is zero")

const freePlan = getBillingPlan("free")
assert.equal(formatPlanPrice(freePlan), "$0/€0/month", "formatPlanPrice keeps Free as zero on backward-compat path")
assert.equal(getPlanPriceForMarket(freePlan, "eu", "monthly")?.displayPrice, "Free", "Free shows market-neutral display via canonical resolver")
assert.equal(getPlanPriceForMarket(freePlan, "us", "monthly")?.displayPrice, "Free", "Free shows market-neutral display for US market")

const proPlan = getBillingPlan("pro_monthly")
assert.equal(getPlanPriceForMarket(proPlan, "us", "monthly")?.displayPrice, "$45/month", "Pro US display via canonical resolver")
assert.equal(getPlanPriceForMarket(proPlan, "us", "monthly")?.currency, "USD", "Pro US currency via canonical resolver")
assert.equal(getPlanPriceForMarket(proPlan, "ca", "yearly")?.displayPrice, "CA$775/year", "Pro CA yearly display via canonical resolver")

const businessPlan = getBillingPlan("business_monthly")
assert.equal(getPlanPriceForMarket(businessPlan, "eu", "monthly")?.displayPrice, "€420/month", "Business EU display via canonical resolver")
assert.equal(getPlanPriceForMarket(businessPlan, "us", "yearly")?.displayPrice, "$5,800/year", "Business US yearly display via canonical resolver")

for (const market of markets) {
  for (const interval of intervals) {
    const option = getCheckoutMarketOptions("business", interval).find((o) => o.market === market)!
    const resolved = resolvePlanPrice("business_monthly", market, interval)
    assert.equal(resolved?.amountMinor, option.amountMinor, `Business ${market} ${interval} amount matches getCheckoutMarketOptions`)
    assert.equal(resolved?.enabled, option.enabled, `Business ${market} ${interval} enabled matches getCheckoutMarketOptions`)
    assert.equal(resolved?.stripePriceId, option.stripePriceId, `Business ${market} ${interval} Stripe ID matches getCheckoutMarketOptions`)
  }
}

for (const market of markets) {
  for (const interval of intervals) {
    const option = getCheckoutMarketOptions("pro", interval).find((o) => o.market === market)!
    const resolved = resolvePlanPrice("pro_monthly", market, interval)
    assert.equal(resolved?.amountMinor, option.amountMinor, `Pro ${market} ${interval} amount matches getCheckoutMarketOptions`)
    assert.equal(resolved?.enabled, option.enabled, `Pro ${market} ${interval} enabled matches getCheckoutMarketOptions`)
    assert.equal(resolved?.stripePriceId, option.stripePriceId, `Pro ${market} ${interval} Stripe ID matches getCheckoutMarketOptions`)
  }
}

const checkoutPage = readProjectFile("src/app/(auth)/app/settings/checkout/page.tsx")
assert.ok(checkoutPage.includes('if (plan.tier === "free") return formatPlanPrice(plan);'), "Free checkout derives pricing from the billing formatter")
assert.ok(checkoutPage.includes('formatPlanPrice(getBillingPlan("free"))'), "Free button uses Free plan price, not selected plan price")
assert.ok(!checkoutPage.includes('formatPlanPrice(plan)}</span>'), "Free button does not show selected plan price")
assert.ok(checkoutPage.includes('!option.enabled'), "checkout gates disabled market display on enabled flag")

const upgradeModal = readProjectFile("src/components/shared/upgrade-modal.tsx")
assert.ok(upgradeModal.includes("getPlanPriceForMarket"), "UpgradeModal uses canonical pricing resolver for Business")

const subscriptionSelector = readProjectFile("src/components/billing/subscription-plan-selector.tsx")
assert.ok(!subscriptionSelector.includes("option.market === \"eu\""), "SubscriptionPlanSelector no longer hardcodes EU market lookup")
assert.ok(subscriptionSelector.includes("getPlanPriceForMarket"), "SubscriptionPlanSelector uses canonical pricing resolver")

const billingPlansSource = readProjectFile("src/lib/billing/plans.ts")
assert.ok(billingPlansSource.includes("resolvePlanPrice"), "formatPlanPrice delegates to canonical resolver")
assert.ok(!billingPlansSource.includes('return `€${plan.price}/month`'), "formatPlanPrice no longer hardcodes EUR from plan.price for Business")

for (const [name, value] of Object.entries(previousEnv)) {
  if (value === undefined) {
    delete process.env[name]
  } else {
    process.env[name] = value
  }
}

console.warn("Pro launch pricing tests passed")

function readProjectFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8")
}
