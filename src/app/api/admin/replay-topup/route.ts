import { auth } from "@/lib/auth/auth"
import Stripe from "stripe"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { handleStripeCreditCheckoutEvent } from "@/services/stripe/credit-webhook"
import { debugError, debugLog } from "@/lib/utils/debug"

export const dynamic = "force-dynamic"

/**
 * Safe idempotent recovery for missed credit top-up payments.
 *
 * Accepts ONLY a Stripe Checkout Session ID (cs_...).
 * All resolution is done from trusted Stripe server-side data — never from caller input.
 * The normal webhook processing path is reused, including all idempotency protections.
 */
export async function POST(request: NextRequest) {
  const authSession = await auth()
  const user = authSession?.user

  if (!user?.id || !user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const rawSessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : ""

  // Only accept Stripe Checkout Session IDs — no payment intent IDs, no arbitrary input
  if (!rawSessionId || !rawSessionId.startsWith("cs_")) {
    return NextResponse.json(
      { error: "Provide a valid Stripe Checkout Session ID (cs_...)" },
      { status: 400 },
    )
  }

  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 })
  }

  const stripe = new Stripe(secretKey, {})

  let checkoutSession: Stripe.Checkout.Session | null = null
  try {
    checkoutSession = await stripe.checkout.sessions.retrieve(rawSessionId, {
      expand: ["payment_intent"],
    })
  } catch (err) {
    debugError("[replay-topup] Failed to retrieve Stripe session:", err)
    return NextResponse.json(
      { error: "Failed to retrieve Stripe session", details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }

  if (!checkoutSession) {
    return NextResponse.json(
      { error: "Could not retrieve checkout session" },
      { status: 500 },
    )
  }

  // Require payment mode
  if (checkoutSession.mode !== "payment") {
    return NextResponse.json(
      { error: "Not a payment-mode checkout session" },
      { status: 400 },
    )
  }

  // Require paid status
  if (checkoutSession.payment_status !== "paid") {
    return NextResponse.json(
      { error: "Session not paid", paymentStatus: checkoutSession.payment_status },
      { status: 400 },
    )
  }

  // Build synthetic event from Stripe-retrieved session data only
  const syntheticEvent: Stripe.Event = {
    id: `evt_replay_${Date.now()}`,
    object: "event",
    api_version: "2022-08-01",
    created: Math.floor(Date.now() / 1000),
    type: "checkout.session.completed",
    data: {
      object: checkoutSession,
    },
    livemode: false,
    pending_webhooks: 0,
    request: null,
  }

  // Reuse the normal webhook handler — includes all idempotency checks
  const result = await handleStripeCreditCheckoutEvent(syntheticEvent)

  if (!result.processed) {
    return NextResponse.json(
      { error: "Replay failed", reason: result.reason },
      { status: 500 },
    )
  }

  return NextResponse.json({
    success: true,
    processed: result.processed,
    synced: result.synced,
    creditsIssued: result.creditsIssued,
    duplicate: result.duplicate,
    reason: result.reason,
  })
}
