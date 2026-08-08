import { type SupportedCurrency } from "./launch-pricing"

export type CreditProvider = "stripe" | "square"

export interface CreditPackageConfig {
  id: string
  name: string
  description: string
  creditsGranted: number
  monetaryAmountCents: number
  currency: SupportedCurrency
  providers: Partial<Record<CreditProvider, string>>
  active: boolean
  pricingVersion: string
}

export const CREDIT_TOP_UP_PRICING_VERSION = "v1"

const CREDIT_PACKAGES_BASE = [
  {
    id: "topup_100",
    name: "100 credits",
    creditsGranted: 100,
    monetaryAmountCents: 1000,
  },
  {
    id: "topup_550",
    name: "550 credits",
    creditsGranted: 550,
    monetaryAmountCents: 5000,
  },
  {
    id: "topup_1200",
    name: "1,200 credits",
    creditsGranted: 1200,
    monetaryAmountCents: 10000,
  },
  {
    id: "topup_3000",
    name: "3,000 credits",
    creditsGranted: 3000,
    monetaryAmountCents: 25000,
  },
  {
    id: "topup_7500",
    name: "7,500 credits",
    creditsGranted: 7500,
    monetaryAmountCents: 60000,
  },
] as const

const SUPPORTED_TOP_UP_CURRENCIES: SupportedCurrency[] = ["EUR", "GBP", "USD", "CAD"]

function stripePriceEnvName(credits: number, currency: SupportedCurrency): string {
  return `USECLEVR_CREDITS_TOP_UP_${credits}_${currency}_STRIPE_PRICE_ID`
}

function squareCatalogEnvName(credits: number, currency: SupportedCurrency): string {
  return `USECLEVR_CREDITS_TOP_UP_${credits}_${currency}_SQUARE_CATALOG_ITEM_ID`
}

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value && value.length > 0 ? value : undefined
}

export const creditTopUpPackages: CreditPackageConfig[] = SUPPORTED_TOP_UP_CURRENCIES.flatMap(
  (currency) =>
    CREDIT_PACKAGES_BASE.map((pkg) => {
      const stripePriceId = readEnv(stripePriceEnvName(pkg.creditsGranted, currency))
      const squareCatalogId = readEnv(squareCatalogEnvName(pkg.creditsGranted, currency))
      const providers: Partial<Record<CreditProvider, string>> = {}
      if (stripePriceId) providers.stripe = stripePriceId
      if (squareCatalogId) providers.square = squareCatalogId

      return {
        id: `${pkg.id}_${currency.toLowerCase()}`,
        name: pkg.name,
        description: `${currency} top-up package`,
        creditsGranted: pkg.creditsGranted,
        monetaryAmountCents: pkg.monetaryAmountCents,
        currency,
        providers,
        active: Boolean(stripePriceId || squareCatalogId),
        pricingVersion: CREDIT_TOP_UP_PRICING_VERSION,
      } satisfies CreditPackageConfig
    }),
)

export function getAllCreditTopUpPackages(): CreditPackageConfig[] {
  return creditTopUpPackages
}

export function getActiveCreditTopUpPackages(): CreditPackageConfig[] {
  return creditTopUpPackages.filter((pkg) => pkg.active)
}

export function getCreditTopUpPackageById(packageId: string | undefined): CreditPackageConfig | null {
  if (!packageId) return null
  return creditTopUpPackages.find((pkg) => pkg.id === packageId) ?? null
}

export function getCreditTopUpPackageByStripePriceId(priceId: string | undefined): CreditPackageConfig | null {
  if (!priceId) return null
  return creditTopUpPackages.find(
    (pkg) => pkg.providers.stripe === priceId && pkg.active,
  ) ?? null
}

export function getCreditTopUpPackageBySquareCatalogId(catalogId: string | undefined): CreditPackageConfig | null {
  if (!catalogId) return null
  return creditTopUpPackages.find(
    (pkg) => pkg.providers.square === catalogId && pkg.active,
  ) ?? null
}

export function resolveCreditTopUpPackageByAmount(
  currency: SupportedCurrency,
  amountMinor: number,
  provider: CreditProvider,
): CreditPackageConfig | null {
  return creditTopUpPackages.find(
    (pkg) => pkg.currency === currency && pkg.monetaryAmountCents === amountMinor && pkg.active && pkg.providers[provider],
  ) ?? null
}

export function creditsFromMonetaryAmount(_amountMinor: number, _currency: SupportedCurrency = "EUR"): number {
  return Math.round(_amountMinor / 100) * 10
}
