import type Stripe from "stripe"
import { eq } from "drizzle-orm"

import { debugError, debugLog } from "@/lib/utils/debug"
import { getDb } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import { recordActivity } from "@/lib/activity/activity-store"
import { revalidatePath } from "next/cache"
import {
  HISTORICAL_UNLOCK_CURRENCIES,
  HISTORICAL_UNLOCK_METADATA_PURPOSE,
  HISTORICAL_UNLOCK_TIERS,
  getHistoricalUnlockPriceIdForTier,
  isHistoricalUnlockCurrency,
  resolveHistoricalUnlockTierFromPriceId,
  type HistoricalUnlockCurrency,
  type HistoricalUnlockTier,
} from "@/lib/billing/historical-unlock"
import { getStripe } from "@/services/stripe/credit-checkout"

export interface CreateHistoricalUnlockCheckoutOptions {
  userId: string
  userEmail: string
  customerId?: string | null
  /** Resolved server-side from the archived paid tier — never client input. */
  tier: HistoricalUnlockTier
  /** Resolved server-side from the account billing currency — never client input. */
  currency: HistoricalUnlockCurrency
  successUrl: string
  cancelUrl: string
}

/**
 * Creates the one-time Stripe Checkout session for the permanent historical
 * data unlock. Checkout mode is payment (never subscription), the Stripe Price
 * id and the presented currency are resolved on the server, and the session is
 * bound to the authenticated user via client_reference_id and trusted
 * metadata. The configured Price carries Stripe FIXED multi-currency amounts
 * (currency_options): the resolved currency selects its fixed regional price —
 * never an exchange-rate conversion. The success redirect never grants the
 * unlock — the Stripe webhook is authoritative.
 */
export async function createHistoricalUnlockCheckoutSession({
  userId,
  userEmail,
  customerId,
  tier,
  currency,
  successUrl,
  cancelUrl,
}: CreateHistoricalUnlockCheckoutOptions): Promise<Stripe.Checkout.Session> {
  const config = HISTORICAL_UNLOCK_TIERS[tier]
  if (config.amountsByCurrency[currency] === undefined) {
    throw new StripeHistoricalUnlockConfigurationError(
      "historical_unlock_currency_unsupported",
      `The historical data unlock does not support the currency ${currency}.`,
    )
  }

  const stripePriceId = getHistoricalUnlockPriceIdForTier(tier)
  if (!stripePriceId) {
    throw new StripeHistoricalUnlockConfigurationError(
      "historical_unlock_price_not_configured",
      `The historical data unlock is not configured. Set ${config.stripePriceEnvName}.`,
    )
  }

  const stripe = getStripe()
  await validateHistoricalUnlockPrice(stripe, tier, currency, stripePriceId)

  const sessionCreateParams = {
    ...(customerId ? { customer: customerId } : { customer_email: userEmail }),
    client_reference_id: userId,
    currency,
    metadata: {
      // Trusted ownership fields: stamped server-side; webhook verification
      // re-derives the tier from the Stripe Price and the archived account tier.
      purpose: HISTORICAL_UNLOCK_METADATA_PURPOSE,
      userId,
      userEmail,
      unlockTier: tier,
      unlockCurrency: currency,
      stripePriceId,
    },
    line_items: [{ price: stripePriceId, quantity: 1 }],
    mode: "payment",
    success_url: successUrl,
    cancel_url: cancelUrl,
    payment_method_types: ["card"],
    invoice_creation: { enabled: true },
  } as Stripe.Checkout.SessionCreateParams & { adaptive_pricing?: { enabled: boolean } }

  // Stripe Adaptive Pricing is disabled so the unlock is presented (and
  // charged) at exactly the fixed regional amount of the resolved currency —
  // the same rule the credit top-up checkout applies. With adaptive pricing
  // off, Checkout charges the Price's own currency_options amount for the
  // session currency instead of converting.
  sessionCreateParams.adaptive_pricing = { enabled: false }

  const session = await stripe.checkout.sessions.create(sessionCreateParams)

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL for the historical data unlock.")
  }

  return session
}

export class StripeHistoricalUnlockConfigurationError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "StripeHistoricalUnlockConfigurationError"
    this.code = code
  }
}

export interface HistoricalUnlockWebhookResult {
  processed: boolean
  synced: boolean
  reason?: string
  unlocked?: boolean
  duplicate?: boolean
}

function normalizePriceId(price: string | undefined | null): string | null {
  return price && price.length > 0 ? price : null
}

function getStripeIdOf(value: string | { id?: string } | null | undefined): string | null {
  if (!value) return null
  return typeof value === "string" ? value : value.id || null
}

async function validateHistoricalUnlockPrice(
  stripe: Stripe,
  tier: HistoricalUnlockTier,
  currency: HistoricalUnlockCurrency,
  stripePriceId: string,
): Promise<void> {
  const config = HISTORICAL_UNLOCK_TIERS[tier]
  let price: Stripe.Price
  try {
    price = await stripe.prices.retrieve(stripePriceId)
  } catch {
    throw new StripeHistoricalUnlockConfigurationError(
      "historical_unlock_price_unavailable",
      `The configured historical unlock Stripe Price could not be loaded (${config.stripePriceEnvName}). Verify the price exists in Stripe.`,
    )
  }

  if (!price.active) {
    throw new StripeHistoricalUnlockConfigurationError(
      "historical_unlock_price_inactive",
      "The configured historical data unlock price is inactive.",
    )
  }

  if (price.type !== "one_time") {
    throw new StripeHistoricalUnlockConfigurationError(
      "historical_unlock_price_recurring",
      "The historical data unlock must use a one-time Stripe Price, not a recurring subscription price.",
    )
  }

  // The price's base currency and amount must match the USD configuration.
  if (price.currency.toUpperCase() !== config.baseCurrency) {
    throw new StripeHistoricalUnlockConfigurationError(
      "historical_unlock_currency_mismatch",
      `The historical data unlock price base currency (${price.currency}) does not match the configured base currency (${config.baseCurrency}).`,
    )
  }

  if (price.unit_amount !== config.baseAmountMinor) {
    throw new StripeHistoricalUnlockConfigurationError(
      "historical_unlock_amount_mismatch",
      `The historical data unlock price amount (${price.unit_amount}) does not match the configured amount (${config.baseAmountMinor}).`,
    )
  }

  // Stripe FIXED multi-currency amounts: every supported currency must carry
  // its exact configured currency_options amount. A missing option or a
  // converted/drifting amount fails closed so no customer is ever charged an
  // exchange-rate approximation of a fixed regional price.
  const currencyOptions = price.currency_options ?? {}
  for (const optionCurrency of HISTORICAL_UNLOCK_CURRENCIES) {
    const optionAmount = config.amountsByCurrency[optionCurrency]
    const option = currencyOptions[optionCurrency.toLowerCase()]
    if (!option || option.unit_amount !== optionAmount) {
      throw new StripeHistoricalUnlockConfigurationError(
        "historical_unlock_amount_mismatch",
        `The historical data unlock price lacks the exact fixed ${optionCurrency} amount (${optionAmount}). Configure the Stripe Price currency_options for all supported currencies.`,
      )
    }
  }

  if (config.amountsByCurrency[currency] === undefined) {
    throw new StripeHistoricalUnlockConfigurationError(
      "historical_unlock_currency_unsupported",
      `The historical data unlock does not support the currency ${currency}.`,
    )
  }
}

/**
 * Webhook-verified processing of a completed one-time historical data unlock
 * checkout. The entitlement is granted ONLY here — never from a success
 * redirect. Deterministic rules:
 *
 *  1. Checkout mode must be payment and the session must carry the trusted
 *     historical_data_unlock purpose metadata stamped at creation.
 *  2. The unlock tier is re-derived server-side from the Stripe Price id and
 *     cross-checked against the metadata tier; the charged amount and currency
 *     must match the tier configuration exactly. Any mismatch fails closed.
 *  3. The paying profile is resolved strictly by the trusted userId bound at
 *     session creation, and the paying Stripe customer must match that
 *     profile. Payments belonging to another customer never land anywhere.
 *  4. The PaymentIntent id is the idempotency key: replays and second
 *     purchases of the same entitlement are recorded once, charged never.
 *  5. The account stays on its current tier (Free) with unchanged credits —
 *     no recurring subscription and no Pro/Business entitlement is created.
 */
export async function handleHistoricalUnlockCheckoutEvent(
  event: Stripe.Event,
): Promise<HistoricalUnlockWebhookResult> {
  if (event.type !== "checkout.session.completed") {
    return { processed: false, synced: false, reason: `Not a checkout.session.completed event: ${event.type}` }
  }

  const session = event.data.object as Stripe.Checkout.Session

  if (session.mode !== "payment") {
    return { processed: false, synced: false, reason: `Checkout mode is ${session.mode || "unknown"}.` }
  }

  const metadata = session.metadata || {}
  if (metadata.purpose !== HISTORICAL_UNLOCK_METADATA_PURPOSE) {
    return { processed: false, synced: false, reason: "Not a historical data unlock session." }
  }

  const paymentStatus = session.payment_status
  if (paymentStatus !== "paid" && paymentStatus !== "no_payment_required") {
    debugLog("[historical-unlock] payment not completed, no unlock.", {
      sessionId: session.id,
      paymentStatus,
    })
    return {
      processed: true,
      synced: false,
      reason: `Payment status is "${paymentStatus}" — historical data stays locked.`,
    }
  }

  const paymentIntentId = getStripeIdOf(session.payment_intent)
  if (!paymentIntentId) {
    return { processed: false, synced: false, reason: "Checkout session has no payment_intent." }
  }

  // Tier derivation is price-first and authoritative; metadata must agree.
  const stripePriceId = normalizePriceId(metadata.stripePriceId)
  const resolvedTier = resolveHistoricalUnlockTierFromPriceId(stripePriceId)
  const metadataTier = metadata.unlockTier === "pro" || metadata.unlockTier === "business" ? metadata.unlockTier : null

  if (!resolvedTier || !metadataTier || resolvedTier !== metadataTier) {
    debugError("[historical-unlock] untrusted tier metadata — failing closed.", {
      sessionId: session.id,
      stripePriceId,
      metadataTier,
      resolvedTier,
    })
    return {
      processed: true,
      synced: false,
      reason: "Untrusted historical unlock session — requires admin recovery.",
    }
  }

  // Charged currency and amount must match the EXACT fixed tier/currency
  // combination. Adaptive pricing is off and the Price carries fixed
  // currency_options, so any converted or unknown amount fails closed.
  const config = HISTORICAL_UNLOCK_TIERS[resolvedTier]
  const chargedCurrency = (session.currency || "").trim().toUpperCase()
  const expectedAmountMinor = config.amountsByCurrency[chargedCurrency as HistoricalUnlockCurrency]
  if (
    !isHistoricalUnlockCurrency(chargedCurrency) ||
    expectedAmountMinor === undefined ||
    session.amount_total !== expectedAmountMinor
  ) {
    debugError("[historical-unlock] amount or currency mismatch — failing closed.", {
      sessionId: session.id,
      amountTotal: session.amount_total,
      currency: session.currency,
      resolvedTier,
      expectedAmountsMinor: config.amountsByCurrency,
    })
    return {
      processed: true,
      synced: false,
      reason: "Historical unlock payment amount mismatch — requires admin recovery.",
    }
  }

  const userId = normalizePriceId(metadata.userId) || normalizePriceId(session.client_reference_id)
  if (!userId) {
    return { processed: true, synced: false, reason: "Historical unlock session has no trusted account binding." }
  }

  const db = getDb()
  if (!db) {
    return { processed: true, synced: false, reason: "Database unavailable." }
  }

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
  })

  if (!profile) {
    return { processed: true, synced: false, reason: `No profile for historical unlock user ${userId}.` }
  }

  // Cross-account protection: the paying Stripe customer must be the profile's
  // bound Stripe customer. A missing binding on a legacy profile is bound here;
  // any conflicting binding is a payment-attribution attempt and fails safe.
  const sessionCustomerId = getStripeIdOf(session.customer)
  const profileCustomerId = profile.stripeCustomerId ?? null
  if (profileCustomerId && sessionCustomerId && profileCustomerId !== sessionCustomerId) {
    debugError("[historical-unlock] cross-account payment attribution attempt", {
      sessionId: session.id,
      paymentIntentId,
      userId: profile.userId,
      sessionCustomerId,
      profileCustomerId,
    })
    return {
      processed: true,
      synced: false,
      reason: "Payment does not belong to this account — no unlock granted.",
    }
  }

  // Idempotency: this payment already granted the entitlement.
  if (profile.historicalDataUnlocked && profile.historicalDataUnlockPaymentId === paymentIntentId) {
    debugLog("[historical-unlock] webhook replay detected — entitlement already present.", {
      sessionId: session.id,
      paymentIntentId,
      userId: profile.userId,
    })
    return {
      processed: true,
      synced: true,
      unlocked: true,
      duplicate: true,
      reason: "Historical data already unlocked with this payment.",
    }
  }

  // A second distinct payment can never create a second entitlement (or a
  // second charge for something already purchased — checkouts are gated).
  if (profile.historicalDataUnlocked && profile.historicalDataUnlockPaymentId) {
    debugError("[historical-unlock] duplicate unlock purchase rejected.", {
      sessionId: session.id,
      paymentIntentId,
      existingPaymentId: profile.historicalDataUnlockPaymentId,
      userId: profile.userId,
    })
    return {
      processed: true,
      synced: true,
      unlocked: true,
      duplicate: true,
      reason: "Historical data is already permanently unlocked — no additional grant.",
    }
  }

  await db
    .update(profiles)
    .set({
      historicalDataUnlocked: true,
      historicalDataUnlockedAt: new Date(),
      historicalDataUnlockTier: resolvedTier,
      historicalDataUnlockPaymentId: paymentIntentId,
      ...(profileCustomerId || !sessionCustomerId ? {} : { stripeCustomerId: sessionCustomerId }),
      updatedAt: new Date(),
    })
    .where(eq(profiles.userId, profile.userId))

  await recordActivity({
    userId: profile.userId,
    userEmail: profile.email,
    type: "subscribed",
    feature: "subscription",
    title: "Historical data unlocked",
    description: "Your historical data is permanently unlocked. Your data was never deleted.",
    metadata: {
      unlockTier: resolvedTier,
      stripePaymentIntentId: paymentIntentId,
      stripeSessionId: session.id,
    },
  })

  revalidatePath("/app")
  revalidatePath("/app/settings")
  revalidatePath("/app/settings/subscription")
  revalidatePath("/app/datasets")

  return {
    processed: true,
    synced: true,
    unlocked: true,
  }
}
