import { debugWarn } from "@/lib/utils/debug"

export type SupportedCurrency = "EUR" | "GBP" | "USD" | "CAD"
export type PricingTier = "TIER_A" | "TIER_B" | "TIER_C"
export type CheckoutMarket = "eu" | "uk" | "us" | "ca"
export type CheckoutPlanSlug = "pro" | "business"
export type BillingInterval = "monthly"

export type LaunchPrice = {
  currency: SupportedCurrency
  amountMinor: number
  label: string
}

export type CheckoutMarketPrice = {
  plan: CheckoutPlanSlug
  billingPlanId: "pro_monthly" | "business_monthly"
  billingInterval: BillingInterval
  market: CheckoutMarket
  marketLabel: string
  currency: SupportedCurrency
  amountMinor: number | null
  displayPrice: string
  stripePriceId?: string
  priceEnvNames: string[]
  enabled: boolean
}

export type CheckoutPriceResolutionInput = {
  plan?: CheckoutPlanSlug | null
  market?: string | null
  billingInterval?: string | null
  billingCountry?: string | null
  paymentProviderCustomerCountry?: string | null
  taxCountry?: string | null
  accountCountry?: string | null
  browserCountry?: string | null
  requestedCurrency?: string | null
  requestedAmountMinor?: number | null
  requestedStripePriceId?: string | null
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

export const checkoutMarkets: ReadonlyArray<{
  market: CheckoutMarket
  label: string
  currency: SupportedCurrency
}> = [
  { market: "eu", label: "EU", currency: "EUR" },
  { market: "uk", label: "UK", currency: "GBP" },
  { market: "us", label: "US", currency: "USD" },
  { market: "ca", label: "Canada", currency: "CAD" },
]

const proPriceEnvNamesByMarket: Record<CheckoutMarket, string[]> = {
  eu: ["STRIPE_PRICE_PRO_EUR_MONTHLY", "STRIPE_PRICE_PRO_MONTHLY", "STRIPE_PRICE_ID_PRO_MONTHLY", "USECLEVR_PRO_PRICE_EUR", "STRIPE_PRO_PRICE_ID_EUR"],
  uk: ["STRIPE_PRICE_PRO_GBP_MONTHLY", "USECLEVR_PRO_PRICE_GBP", "STRIPE_PRO_PRICE_ID_GBP"],
  us: ["STRIPE_PRICE_PRO_USD_MONTHLY", "USECLEVR_PRO_PRICE_USD", "STRIPE_PRO_PRICE_ID_USD"],
  ca: ["STRIPE_PRICE_PRO_CAD_MONTHLY", "USECLEVR_PRO_PRICE_CAD", "STRIPE_PRO_PRICE_ID_CAD"],
}

const businessPriceEnvNamesByMarket: Record<CheckoutMarket, string[]> = {
  eu: ["STRIPE_PRICE_BUSINESS_EUR_MONTHLY", "STRIPE_PRICE_BUSINESS_MONTHLY", "STRIPE_PRICE_ID_BUSINESS_MONTHLY", "STRIPE_BUSINESS_PRICE_ID_EUR"],
  uk: ["STRIPE_PRICE_BUSINESS_GBP_MONTHLY", "STRIPE_BUSINESS_PRICE_ID_GBP"],
  us: ["STRIPE_PRICE_BUSINESS_USD_MONTHLY", "STRIPE_BUSINESS_PRICE_ID_USD"],
  ca: ["STRIPE_PRICE_BUSINESS_CAD_MONTHLY", "STRIPE_BUSINESS_PRICE_ID_CAD"],
}

const approvedBusinessAmountByMarket: Partial<Record<CheckoutMarket, number>> = {
  eu: 42000,
  uk: 40950,
  us: 47250,
  ca: 57750,
}

const proMarketByCurrency: Record<SupportedCurrency, CheckoutMarket> = {
  EUR: "eu",
  GBP: "uk",
  USD: "us",
  CAD: "ca",
}

export class CheckoutPricingError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "CheckoutPricingError"
    this.code = code
  }
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

export function getMarketForCountry(country?: string | null): CheckoutMarket {
  return proMarketByCurrency[getCurrencyForCountry(country)]
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
  return readFirstConfiguredEnv(proPriceEnvNamesByMarket[proMarketByCurrency[currency]])
}

export function getMissingProStripePriceEnvLabel(currency: SupportedCurrency): string {
  return proPriceEnvNamesByMarket[proMarketByCurrency[currency]].join(" or ")
}

export function getCheckoutMarketOptions(plan: CheckoutPlanSlug): CheckoutMarketPrice[] {
  return checkoutMarkets.map(({ market, label, currency }) => {
    const amountMinor = getApprovedAmountMinor(plan, market)
    const priceEnvNames = getPriceEnvNames(plan, market)
    const stripePriceId = readFirstConfiguredEnv(priceEnvNames)

    return {
      plan,
      billingPlanId: plan === "pro" ? "pro_monthly" : "business_monthly",
      billingInterval: "monthly",
      market,
      marketLabel: label,
      currency,
      amountMinor,
      displayPrice: amountMinor === null ? "Unavailable" : formatMonthlyPrice(amountMinor, currency),
      stripePriceId,
      priceEnvNames,
      enabled: Boolean(stripePriceId) && amountMinor !== null,
    }
  })
}

export function resolveCheckoutMarketPrice(input: CheckoutPriceResolutionInput): CheckoutMarketPrice {
  const plan = normalizeCheckoutPlanSlug(input.plan)
  const billingInterval = input.billingInterval || "monthly"
  if (billingInterval !== "monthly") {
    throw new CheckoutPricingError("invalid_billing_interval", "Only monthly checkout is available.")
  }

  const market = normalizeCheckoutMarket(input.market)
  if (!market) {
    throw new CheckoutPricingError(`${plan}_market_lost`, "Choose a billing market before checkout.")
  }

  if (input.requestedCurrency || typeof input.requestedAmountMinor === "number" || input.requestedStripePriceId) {
    throw new CheckoutPricingError(
      plan === "pro" ? "invalid_pro_price_mapping" : "invalid_business_price_mapping",
      "Checkout price is resolved securely on the server.",
    )
  }

  const option = getCheckoutMarketOptions(plan).find((candidate) => candidate.market === market)
  if (!option) {
    throw new CheckoutPricingError(`${plan}_market_lost`, "Choose a supported billing market before checkout.")
  }

  if (option.amountMinor === null) {
    throw new CheckoutPricingError(
      `${plan}_price_not_configured`,
      `${option.marketLabel} pricing is not available for ${plan === "pro" ? "Pro" : "Business"} yet.`,
    )
  }

  if (!option.stripePriceId) {
    throw new CheckoutPricingError(
      `${plan}_price_not_configured`,
      `${option.marketLabel} checkout is not configured for ${plan === "pro" ? "Pro" : "Business"} yet.`,
    )
  }

  return option
}

export function getStripePriceIdForCheckout(plan: CheckoutPlanSlug, market: CheckoutMarket): string | undefined {
  return readFirstConfiguredEnv(getPriceEnvNames(plan, market))
}

export function getMissingCheckoutStripePriceEnvLabel(plan: CheckoutPlanSlug, market: CheckoutMarket): string {
  return getPriceEnvNames(plan, market).join(" or ")
}

export function getSubscriptionTierForStripePriceId(priceId: string): CheckoutPlanSlug | null {
  for (const plan of ["pro", "business"] as CheckoutPlanSlug[]) {
    for (const option of getCheckoutMarketOptions(plan)) {
      if (option.stripePriceId === priceId) return plan
    }
  }

  return null
}

export function normalizeCheckoutPlanSlug(plan: string | null | undefined): CheckoutPlanSlug {
  const normalized = plan?.trim().toLowerCase()
  if (normalized === "business" || normalized === "business_monthly") return "business"
  return "pro"
}

export function normalizeCheckoutMarket(market: string | null | undefined): CheckoutMarket | null {
  const normalized = market?.trim().toLowerCase()
  return normalized === "eu" || normalized === "uk" || normalized === "us" || normalized === "ca"
    ? normalized
    : null
}

function normalizeCurrency(currency?: string | null): SupportedCurrency | null {
  const normalized = currency?.trim().toUpperCase()
  return normalized === "EUR" || normalized === "GBP" || normalized === "USD" || normalized === "CAD"
    ? normalized
    : null
}

function getApprovedAmountMinor(plan: CheckoutPlanSlug, market: CheckoutMarket): number | null {
  if (plan === "pro") return getFixedProPrice(checkoutMarkets.find((entry) => entry.market === market)!.currency).amountMinor
  return approvedBusinessAmountByMarket[market] ?? null
}

function getPriceEnvNames(plan: CheckoutPlanSlug, market: CheckoutMarket): string[] {
  return plan === "pro" ? proPriceEnvNamesByMarket[market] : businessPriceEnvNamesByMarket[market]
}

function readFirstConfiguredEnv(names: string[]): string | undefined {
  return names.map((name) => process.env[name]?.trim()).find((value): value is string => Boolean(value))
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
