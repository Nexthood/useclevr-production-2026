import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import {
  getCheckoutMarketOptions,
  getFixedProPrice,
  getProStripePriceId,
  getSubscriptionTierForStripePriceId,
  resolveCheckoutMarketPrice,
  resolveCheckoutProPrice,
  resolveProPriceForCountry,
  type SupportedCurrency,
} from "@/lib/billing/launch-pricing"

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
assert.equal(businessMarkets.find((market) => market.market === "uk")?.enabled, false, "Business UK remains unavailable without approved pricing")
assert.equal(businessMarkets.find((market) => market.market === "us")?.enabled, false, "Business US remains unavailable without approved pricing")
assert.equal(businessMarkets.find((market) => market.market === "ca")?.enabled, false, "Business Canada remains unavailable without approved pricing")

assert.throws(
  () => resolveCheckoutMarketPrice({ plan: "business", billingInterval: "monthly", market: "uk" }),
  /not available/,
  "Business unsupported markets are rejected safely",
)

assert.equal(getSubscriptionTierForStripePriceId("price_pro_usd_test"), "pro", "webhook maps Pro market Price IDs to Pro")
assert.equal(getSubscriptionTierForStripePriceId("price_business_eur_test"), "business", "webhook maps Business EUR Price ID to Business")

const checkoutPageSource = readProjectFile("src/app/(auth)/app/settings/checkout/page.tsx")
assert.ok(checkoutPageSource.includes('plan: plan.tier'), "checkout browser payload sends canonical plan")
assert.ok(checkoutPageSource.includes('billingInterval: "monthly"'), "checkout browser payload sends canonical interval")
assert.ok(checkoutPageSource.includes("market: selectedMarket"), "checkout browser payload sends canonical market")
assert.ok(checkoutPageSource.includes("buildCheckoutUrl({ planId, market: selectedMarket"), "terms flow preserves selected market in the URL")
assert.equal(checkoutPageSource.includes("requestedAmountMinor"), false, "checkout browser payload does not send an amount override")
assert.equal(checkoutPageSource.includes("requestedStripePriceId"), false, "checkout browser payload does not send a Stripe Price ID override")

const checkoutOptionsSource = readProjectFile("src/app/api/checkout/options/route.ts")
assert.ok(checkoutOptionsSource.includes('getCheckoutMarketOptions("business")'), "Business checkout exposes shared market options")

const stripeCheckoutSource = readProjectFile("src/services/stripe/checkout.ts")
assert.ok(stripeCheckoutSource.includes("stripe.prices.retrieve"), "checkout validates Stripe Price IDs before session creation")
assert.ok(stripeCheckoutSource.includes("!price.active"), "checkout rejects inactive Stripe prices")
assert.ok(stripeCheckoutSource.includes('price.recurring.interval !== "month"'), "checkout rejects non-monthly Stripe prices")

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
