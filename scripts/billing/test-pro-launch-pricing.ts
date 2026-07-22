import assert from "node:assert/strict"

import {
  getFixedProPrice,
  getProStripePriceId,
  resolveCheckoutProPrice,
  resolveProPriceForCountry,
  type SupportedCurrency,
} from "@/lib/billing/launch-pricing"

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
}

process.env.USECLEVR_PRO_PRICE_EUR = "price_pro_eur_test"
process.env.USECLEVR_PRO_PRICE_GBP = "price_pro_gbp_test"
process.env.USECLEVR_PRO_PRICE_USD = "price_pro_usd_test"
process.env.USECLEVR_PRO_PRICE_CAD = "price_pro_cad_test"

assert.equal(getProStripePriceId("EUR"), "price_pro_eur_test", "EUR checkout uses EUR Stripe price ID")
assert.equal(getProStripePriceId("GBP"), "price_pro_gbp_test", "GBP checkout uses GBP Stripe price ID")
assert.equal(getProStripePriceId("USD"), "price_pro_usd_test", "USD checkout uses USD Stripe price ID")
assert.equal(getProStripePriceId("CAD"), "price_pro_cad_test", "CAD checkout uses CAD Stripe price ID")

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

Object.assign(process.env, previousEnv)

console.log("Pro launch pricing tests passed")
