import { debugWarn } from "@/lib/utils/debug"

export type SupportedCurrency = "EUR" | "GBP" | "USD" | "CAD"
export type PricingTier = "TIER_A" | "TIER_B" | "TIER_C"

export type LaunchPrice = {
  currency: SupportedCurrency
  amountMinor: number
  label: string
}

export type CheckoutPriceResolutionInput = {
  billingCountry?: string | null
  paymentProviderCustomerCountry?: string | null
  taxCountry?: string | null
  accountCountry?: string | null
  browserCountry?: string | null
  requestedCurrency?: string | null
  requestedAmountMinor?: number | null
}

export const pricingConfig: Record<PricingTier, { enabled: boolean; prices: Partial<Record<SupportedCurrency, number>> }> = {
  TIER_A: {
    enabled: true,
    prices: {
      EUR: 4000,
      GBP: 3900,
      USD: 4500,
      CAD: 5500,
    },
  },
  TIER_B: {
    enabled: false,
    prices: {},
  },
  TIER_C: {
    enabled: false,
    prices: {},
  },
}

export const countryCurrencyMap: Record<string, SupportedCurrency> = {
  DE: "EUR",
  NL: "EUR",
  BE: "EUR",
  LU: "EUR",
  FR: "EUR",
  AT: "EUR",
  IE: "EUR",
  FI: "EUR",

  GB: "GBP",
  US: "USD",
  CA: "CAD",

  CH: "EUR",
  DK: "EUR",
  SE: "EUR",
  NO: "EUR",
}

export const supportedBillingCountries = Object.keys(countryCurrencyMap).sort()

export const billingCountryOptions = [
  { value: "DE", label: "Germany" },
  { value: "NL", label: "Netherlands" },
  { value: "BE", label: "Belgium" },
  { value: "LU", label: "Luxembourg" },
  { value: "FR", label: "France" },
  { value: "AT", label: "Austria" },
  { value: "IE", label: "Ireland" },
  { value: "FI", label: "Finland" },
  { value: "GB", label: "United Kingdom" },
  { value: "US", label: "United States" },
  { value: "CA", label: "Canada" },
  { value: "CH", label: "Switzerland" },
  { value: "DK", label: "Denmark" },
  { value: "SE", label: "Sweden" },
  { value: "NO", label: "Norway" },
] as const

export const proPriceEnvByCurrency: Record<SupportedCurrency, string> = {
  EUR: "USECLEVR_PRO_PRICE_EUR",
  GBP: "USECLEVR_PRO_PRICE_GBP",
  USD: "USECLEVR_PRO_PRICE_USD",
  CAD: "USECLEVR_PRO_PRICE_CAD",
}

const currencyLocale: Record<SupportedCurrency, string> = {
  EUR: "en-IE",
  GBP: "en-GB",
  USD: "en-US",
  CAD: "en-US",
}

export function normalizeCountryCode(country?: string | null): string | null {
  if (!country) return null
  const normalized = country.trim().toUpperCase()
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null
}

export function getCountryFromLocale(locale?: string | null): string | null {
  if (!locale) return null
  const region = locale.split("-")[1]
  return normalizeCountryCode(region)
}

export function getCurrencyForCountry(country?: string | null): SupportedCurrency {
  const normalized = normalizeCountryCode(country)
  return normalized ? countryCurrencyMap[normalized] ?? "EUR" : "EUR"
}

export function getFixedProPrice(currency: SupportedCurrency): LaunchPrice {
  const amountMinor = pricingConfig.TIER_A.prices[currency]
  if (!pricingConfig.TIER_A.enabled || typeof amountMinor !== "number") {
    throw new Error(`UseClevr Pro launch pricing is not configured for ${currency}.`)
  }

  return {
    currency,
    amountMinor,
    label: formatMonthlyPrice(amountMinor, currency),
  }
}

export function formatMonthlyPrice(amountMinor: number, currency: SupportedCurrency): string {
  return `${new Intl.NumberFormat(currencyLocale[currency], {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amountMinor / 100)}/month`
}

export function getProLaunchPrices(): LaunchPrice[] {
  return (["EUR", "GBP", "USD", "CAD"] as SupportedCurrency[]).map(getFixedProPrice)
}

export function resolveProPriceForCountry(country?: string | null): LaunchPrice {
  return getFixedProPrice(getCurrencyForCountry(country))
}

export function resolveCheckoutProPrice(input: CheckoutPriceResolutionInput): LaunchPrice & { country: string | null; source: string } {
  if (!normalizeCountryCode(input.billingCountry)) {
    throw new Error("Billing country is required for Pro checkout.")
  }

  const candidates: Array<[string, string | null | undefined]> = [
    ["billing_country", input.billingCountry],
    ["payment_provider_customer_country", input.paymentProviderCustomerCountry],
    ["tax_country", input.taxCountry],
    ["account_country", input.accountCountry],
    ["browser_country", input.browserCountry],
  ]
  const [source, country] = candidates.find(([, candidate]) => normalizeCountryCode(candidate)) ?? ["fallback", null]
  const price = resolveProPriceForCountry(country)

  validateRequestedCheckoutPrice(price, input)

  const billingCountry = normalizeCountryCode(input.billingCountry)
  const requestedCurrency = normalizeCurrency(input.requestedCurrency)
  if (billingCountry && requestedCurrency && requestedCurrency !== price.currency) {
    debugWarn("[checkout] Requested currency does not match validated billing country.", {
      billingCountry,
      requestedCurrency,
      expectedCurrency: price.currency,
    })
  }

  return {
    ...price,
    country: normalizeCountryCode(country),
    source,
  }
}

export function getProStripePriceId(currency: SupportedCurrency): string | undefined {
  return process.env[proPriceEnvByCurrency[currency]]?.trim() || undefined
}

export function getMissingProStripePriceEnvLabel(currency: SupportedCurrency): string {
  return proPriceEnvByCurrency[currency]
}

function normalizeCurrency(currency?: string | null): SupportedCurrency | null {
  const normalized = currency?.trim().toUpperCase()
  return normalized === "EUR" || normalized === "GBP" || normalized === "USD" || normalized === "CAD"
    ? normalized
    : null
}

function validateRequestedCheckoutPrice(expected: LaunchPrice, input: CheckoutPriceResolutionInput) {
  const requestedCurrency = normalizeCurrency(input.requestedCurrency)

  if (input.requestedCurrency && !requestedCurrency) {
    throw new Error("Unsupported checkout currency.")
  }

  if (requestedCurrency && requestedCurrency !== expected.currency) {
    throw new Error("Checkout currency does not match the validated billing country.")
  }

  if (typeof input.requestedAmountMinor === "number" && input.requestedAmountMinor !== expected.amountMinor) {
    throw new Error("Checkout price does not match the validated billing country.")
  }
}
