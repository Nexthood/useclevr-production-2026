import { getDb } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import type { SupportedCurrency } from "@/lib/billing/launch-pricing"
import { isSuperAdminUserId } from "@/lib/auth/builtin-users"
import { isUnlimitedCreditRole } from "@/lib/billing/credit-engine"
import { debugError } from "@/lib/utils/debug"
import { eq } from "drizzle-orm"

/**
 * Historical data unlock — configuration and server-authoritative state.
 *
 * A cancelled or expired Pro/Business subscription downgrades the account to
 * Free without ever deleting customer data. Preserved historical datasets
 * created before the subscription ended are keyed to a durable entitlement:
 *
 *  - An active Pro/Business subscription grants full historical access.
 *  - A superadmin/admin account keeps unrestricted access.
 *  - A one-time Stripe payment (webhook-verified only) grants a PERMANENT
 *    historical data unlock. It never reactivates any paid plan tier.
 *  - Without either, historical datasets stay preserved in LOCKED READ-ONLY
 *    state: the customer can still see the data exists, but cannot read row
 *    content or run analysis on it.
 *
 * The applicable unlock price is always resolved server-side from the
 * archived paid tier. Client input can never select the tier or Stripe Price.
 */

// The unlock uses one Stripe Price per tier with Stripe FIXED multi-currency
// amounts (currency_options). USD is the base/default currency; EUR, GBP, and
// CAD are fixed regional prices — never exchange-rate conversions.
export type HistoricalUnlockTier = "pro" | "business"

export type HistoricalUnlockCurrency = SupportedCurrency

export const HISTORICAL_UNLOCK_BASE_CURRENCY: HistoricalUnlockCurrency = "USD"

export const HISTORICAL_UNLOCK_CURRENCIES = ["USD", "EUR", "GBP", "CAD"] as const

const historicalUnlockCurrencySet: ReadonlySet<HistoricalUnlockCurrency> = new Set(HISTORICAL_UNLOCK_CURRENCIES)

export function isHistoricalUnlockCurrency(currency: string | null | undefined): currency is HistoricalUnlockCurrency {
  return historicalUnlockCurrencySet.has((currency || "").trim().toUpperCase() as HistoricalUnlockCurrency)
}

export const HISTORICAL_UNLOCK_METADATA_PURPOSE = "historical_data_unlock"

export const HISTORICAL_DATA_LOCKED_CODE = "HISTORICAL_DATA_LOCKED"

export const HISTORICAL_DATA_SAFE_MESSAGE =
  "Your subscription has ended. Your existing data is safe."

export const HISTORICAL_DATA_LOCKED_MESSAGE =
  "Your subscription has ended. Your existing data is safe and preserved. " +
  "Reactivate your subscription or complete the one-time historical data " +
  "unlock to access this historical dataset again."

export interface HistoricalUnlockTierConfig {
  tier: HistoricalUnlockTier
  stripePriceEnvName: string
  /** Stripe base/default currency and amount for the one-time Price. */
  baseCurrency: HistoricalUnlockCurrency
  baseAmountMinor: number
  /** Fixed regional amounts (currency_options) — exact, never converted. */
  amountsByCurrency: Record<HistoricalUnlockCurrency, number>
  displayName: string
}

export const HISTORICAL_UNLOCK_TIERS: Record<HistoricalUnlockTier, HistoricalUnlockTierConfig> = {
  pro: {
    tier: "pro",
    stripePriceEnvName: "STRIPE_PRO_HISTORICAL_UNLOCK_PRICE_ID",
    baseCurrency: "USD",
    baseAmountMinor: 2900,
    amountsByCurrency: { USD: 2900, EUR: 2500, GBP: 2200, CAD: 4000 },
    displayName: "Unlock Historical Data",
  },
  business: {
    tier: "business",
    stripePriceEnvName: "STRIPE_BUSINESS_HISTORICAL_UNLOCK_PRICE_ID",
    baseCurrency: "USD",
    baseAmountMinor: 14900,
    amountsByCurrency: { USD: 14900, EUR: 13000, GBP: 11200, CAD: 21000 },
    displayName: "Unlock Historical Business Data",
  },
}

export function isPaidSubscriptionTier(tier: string | null | undefined): tier is HistoricalUnlockTier {
  return tier === "pro" || tier === "business"
}

export function getHistoricalUnlockPriceEnvName(tier: HistoricalUnlockTier): string {
  return HISTORICAL_UNLOCK_TIERS[tier].stripePriceEnvName
}

/**
 * Resolve the configured one-time Stripe Price id for a tier. Never invents an
 * id: an unconfigured tier returns undefined and checkout fails closed.
 */
export function getHistoricalUnlockPriceIdForTier(tier: HistoricalUnlockTier): string | undefined {
  return process.env[getHistoricalUnlockPriceEnvName(tier)]?.trim() || undefined
}

/**
 * Server-authoritative tier resolution from a Stripe Price id. Only the two
 * configured one-time unlock prices map to a tier; anything else fails closed.
 */
export function resolveHistoricalUnlockTierFromPriceId(priceId: string | null | undefined): HistoricalUnlockTier | null {
  const normalized = priceId?.trim()
  if (!normalized) return null

  for (const tier of ["pro", "business"] as HistoricalUnlockTier[]) {
    if (getHistoricalUnlockPriceIdForTier(tier) === normalized) return tier
  }
  return null
}

/**
 * Server-authoritative customer currency for the unlock purchase. Reads the
 * account's billing currency preference through the existing UseClevr
 * supported-currency set (USD / EUR / GBP / CAD) and falls back to the
 * USD base for missing or unsupported preferences. The client never
 * sends or overrides this currency.
 */
export function resolveHistoricalUnlockCurrency(preferredCurrency: string | null | undefined): HistoricalUnlockCurrency {
  const normalized = preferredCurrency?.trim().toUpperCase()
  return isHistoricalUnlockCurrency(normalized) ? normalized : HISTORICAL_UNLOCK_BASE_CURRENCY
}

export interface HistoricalUnlockDisplayPrice {
  tier: HistoricalUnlockTier
  amountMinor: number
  amount: number
  currency: HistoricalUnlockCurrency
  displayName: string
}

/**
 * The fixed regional price for the tier in the resolved currency. Currency
 * always comes from server resolution — the display mirrors the exact amount
 * Stripe will charge, with no exchange-rate math anywhere.
 */
export function getHistoricalUnlockDisplayPrice(
  tier: HistoricalUnlockTier,
  currency: HistoricalUnlockCurrency = HISTORICAL_UNLOCK_BASE_CURRENCY,
): HistoricalUnlockDisplayPrice {
  const config = HISTORICAL_UNLOCK_TIERS[tier]
  const amountMinor = config.amountsByCurrency[currency]
  return {
    tier: config.tier,
    amountMinor,
    amount: amountMinor / 100,
    currency,
    displayName: config.displayName,
  }
}

export type HistoricalAccessProfileInput = {
  userId: string
  subscriptionTier?: string | null
  role?: string | null
  lastPaidSubscriptionTier?: string | null
  subscriptionEndedAt?: Date | string | null
  historicalDataUnlocked?: boolean | null
  historicalDataUnlockTier?: string | null
}

export interface HistoricalAccessState {
  /** Active subscription tier when the account currently pays for Pro/Business. */
  activePaidTier: HistoricalUnlockTier | null
  /** Last verified paid tier, kept after a downgrade for unlock pricing. */
  previousPaidTier: HistoricalUnlockTier | null
  /** True when a previously paid subscription ended and the account sits on Free. */
  subscriptionEnded: boolean
  /** Durable one-time unlock entitlement. */
  historicalDataUnlocked: boolean
  /** Historical datasets are in LOCKED READ-ONLY state. */
  historicalDatasetsLocked: boolean
  /** A one-time unlock purchase is available for this account. */
  unlockPurchaseAvailable: boolean
  /** Tier that selects server-side the applicable one-time unlock price. */
  unlockTier: HistoricalUnlockTier | null
  subscriptionEndedAt: Date | null
  /** Superadmin/admin accounts keep their existing unrestricted behavior. */
  unlimitedAccess: boolean
}

/**
 * Pure state resolution. Single source of truth for every lock/unlock
 * decision — UI display, dataset access, and purchase availability all read
 * from this one function so the rules can never diverge.
 */
export function resolveHistoricalAccessState(
  profile: HistoricalAccessProfileInput,
): HistoricalAccessState {
  const unlimitedAccess = isSuperAdminUserId(profile.userId) || isUnlimitedCreditRole(profile.role)

  const activePaidTier = isPaidSubscriptionTier(profile.subscriptionTier)
    ? (profile.subscriptionTier as HistoricalUnlockTier)
    : null
  const previousPaidTier = isPaidSubscriptionTier(profile.lastPaidSubscriptionTier)
    ? (profile.lastPaidSubscriptionTier as HistoricalUnlockTier)
    : null

  const endedAtRaw = profile.subscriptionEndedAt
  const subscriptionEndedAt = endedAtRaw ? new Date(endedAtRaw) : null
  // Unlimited accounts never enter the ended state — their access stays
  // unrestricted exactly as before this entitlement existed.
  const subscriptionEnded = !unlimitedAccess && !activePaidTier && Boolean(subscriptionEndedAt)
  const historicalDataUnlocked = !activePaidTier && profile.historicalDataUnlocked === true

  const historicalDatasetsLocked =
    !unlimitedAccess && !activePaidTier && !historicalDataUnlocked && subscriptionEnded

  return {
    activePaidTier,
    previousPaidTier,
    subscriptionEnded,
    historicalDataUnlocked,
    historicalDatasetsLocked,
    unlockPurchaseAvailable: Boolean(subscriptionEnded && !historicalDataUnlocked && previousPaidTier),
    unlockTier: previousPaidTier,
    subscriptionEndedAt,
    unlimitedAccess,
  }
}

/**
 * Load the historical access state for a user from the Profile row.
 * Read failures fail open (no lock) so an outage never blocks normal accounts;
 * grant-side security never depends on this helper.
 */
export async function loadHistoricalAccessState(userId: string): Promise<HistoricalAccessState> {
  const fallback: HistoricalAccessState = {
    activePaidTier: null,
    previousPaidTier: null,
    subscriptionEnded: false,
    historicalDataUnlocked: false,
    historicalDatasetsLocked: false,
    unlockPurchaseAvailable: false,
    unlockTier: null,
    subscriptionEndedAt: null,
    unlimitedAccess: isSuperAdminUserId(userId),
  }

  if (!userId) return fallback

  const db = getDb()
  if (!db) return fallback

  try {
    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, userId),
      columns: {
        userId: true,
        subscriptionTier: true,
        role: true,
        lastPaidSubscriptionTier: true,
        subscriptionEndedAt: true,
        historicalDataUnlocked: true,
        historicalDataUnlockTier: true,
      },
    })
    if (!profile) return fallback
    return resolveHistoricalAccessState(profile)
  } catch (error) {
    debugError("[historical-unlock] access state lookup failed:", error)
    return fallback
  }
}

/**
 * A dataset is historical-locked when the account is in ended state without a
 * permanent unlock and the dataset was created before the subscription ended.
 * Datasets created while on Free stay fully usable within Free plan limits.
 */
export function isDatasetLockedByHistoricalState(
  state: Pick<HistoricalAccessState, "historicalDatasetsLocked" | "subscriptionEndedAt">,
  datasetCreatedAt: Date | string | null | undefined,
): boolean {
  if (!state.historicalDatasetsLocked) return false
  if (!state.subscriptionEndedAt || !datasetCreatedAt) return false
  const createdAt = new Date(datasetCreatedAt)
  return createdAt.getTime() < state.subscriptionEndedAt.getTime()
}

/**
 * One-call helper for routes that load a single dataset: resolves the account
 * state and decides whether this dataset's content is historical-locked.
 */
export async function isHistoricalDatasetLocked(
  userId: string,
  datasetCreatedAt: Date | string | null | undefined,
): Promise<boolean> {
  const state = await loadHistoricalAccessState(userId)
  return isDatasetLockedByHistoricalState(state, datasetCreatedAt)
}

export function buildHistoricalDatasetLockedResponse(reason?: string) {
  return {
    locked: true as const,
    code: HISTORICAL_DATA_LOCKED_CODE,
    error: "Historical data locked",
    message: HISTORICAL_DATA_LOCKED_MESSAGE,
    ...(reason ? { reason } : {}),
  }
}
