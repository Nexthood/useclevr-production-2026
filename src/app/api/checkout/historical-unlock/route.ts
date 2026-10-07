import { auth } from "@/lib/auth/auth"
import { buildCheckoutCancelUrl, buildCheckoutSuccessUrl } from "@/lib/billing/checkout-redirect"
import {
  HISTORICAL_UNLOCK_TIERS,
  getHistoricalUnlockDisplayPrice,
  loadHistoricalAccessState,
  resolveHistoricalAccessState,
  resolveHistoricalUnlockCurrency,
} from "@/lib/billing/historical-unlock"
import { getDb } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import {
  createHistoricalUnlockCheckoutSession,
  StripeHistoricalUnlockConfigurationError,
} from "@/services/stripe/historical-unlock"

export const dynamic = "force-dynamic"

/**
 * GET /api/checkout/historical-unlock — report-only status endpoint for the
 * authenticated account. Reflects webhook-confirmed entitlement state; it
 * never grants or changes the entitlement. The post-checkout success page
 * polls this endpoint; the success redirect alone never unlocks data.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const state = await loadHistoricalAccessState(session.user.id)

  return NextResponse.json({
    unlocked: state.historicalDataUnlocked,
    subscriptionEnded: state.subscriptionEnded,
    activePaidTier: state.activePaidTier,
    unlockPurchaseAvailable: state.unlockPurchaseAvailable,
    ...(state.historicalDataUnlocked && state.unlockTier
      ? { unlockTier: state.unlockTier }
      : {}),
  })
}

/**
 * POST /api/checkout/historical-unlock — create the one-time Stripe Checkout
 * for the permanent historical data unlock.
 *
 * Security invariants:
 *  - Authenticated account only; the applicable unlock tier and Stripe Price
 *    are resolved on the server from the archived paid tier. Client-supplied
 *    tier/price fields are ignored and can never influence the price.
 *  - Membership conflicts with existing entitlements fail closed: an already
 *    unlocked account is never charged twice, and an active Pro/Business
 *    subscription never needs the unlock.
 */
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const db = getDb()
  if (!db) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 500 })
  }

  // The request body is read only for provider selection parity with the rest
  // of the checkout API; tier and price are never taken from the client.
  await request.json().catch(() => ({}))

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, session.user.id),
    columns: {
      userId: true,
      subscriptionTier: true,
      role: true,
      lastPaidSubscriptionTier: true,
      subscriptionEndedAt: true,
      historicalDataUnlocked: true,
      historicalDataUnlockTier: true,
      stripeCustomerId: true,
      preferredCurrency: true,
    },
  })

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 })
  }

  const state = resolveHistoricalAccessState(profile)

  if (state.historicalDataUnlocked) {
    return NextResponse.json(
      {
        error: "Your historical data is already permanently unlocked.",
        code: "already_unlocked",
      },
      { status: 409 },
    )
  }

  if (state.activePaidTier) {
    return NextResponse.json(
      {
        error: "An active subscription already grants access to your historical data.",
        code: "subscription_active",
      },
      { status: 409 },
    )
  }

  if (!state.unlockPurchaseAvailable || !state.unlockTier) {
    return NextResponse.json(
      { error: "Historical data unlock is not available for this account.", code: "not_available" },
      { status: 400 },
    )
  }

  const unlockTier = state.unlockTier
  // The customer currency is resolved on the server from the account's saved
  // billing currency preference (existing UseClevr supported set, USD base
  // fallback). The client can neither choose nor override it.
  const unlockCurrency = resolveHistoricalUnlockCurrency(profile.preferredCurrency)
  const display = getHistoricalUnlockDisplayPrice(unlockTier, unlockCurrency)
  const priceIdConfigured = Boolean(resolveUnlockPriceConfigured(unlockTier))
  if (!priceIdConfigured) {
    return NextResponse.json(
      {
        error: "Historical data unlock is not configured. Set " + HISTORICAL_UNLOCK_TIERS[unlockTier].stripePriceEnvName + ".",
        code: "unlock_price_not_configured",
      },
      { status: 503 },
    )
  }

  const successPath = "/app/settings/subscription?tab=billing&unlock=success"
  const cancelPath = "/app/settings/subscription?tab=billing&unlock=cancel"
  const successUrl = buildCheckoutSuccessUrl("_", undefined, new URL(request.url).origin, successPath)
  const cancelUrl = buildCheckoutCancelUrl(cancelPath, new URL(request.url).origin)

  try {
    const checkout = await createHistoricalUnlockCheckoutSession({
      userId: session.user.id,
      userEmail: session.user.email,
      customerId: profile.stripeCustomerId,
      tier: unlockTier,
      currency: unlockCurrency,
      successUrl,
      cancelUrl,
    })

    return NextResponse.json({
      success: true,
      checkoutUrl: checkout.url,
      checkoutId: checkout.id,
      tier: unlockTier,
      amountMinor: display.amountMinor,
      amount: display.amount,
      currency: display.currency,
      status: "pending_webhook",
    })
  } catch (error) {
    if (error instanceof StripeHistoricalUnlockConfigurationError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 503 },
      )
    }

    const code = "checkout_session_failed"
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create checkout session",
        code,
      },
      { status: 500 },
    )
  }
}

function resolveUnlockPriceConfigured(tier: "pro" | "business"): string | undefined {
  const envName = HISTORICAL_UNLOCK_TIERS[tier].stripePriceEnvName
  const raw = process.env[envName]?.trim()
  return raw || undefined
}
