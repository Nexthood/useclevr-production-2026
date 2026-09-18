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
 * Accepts a Stripe Checkout Session ID (cs_...) or PaymentIntent ID (pi_...).
 * All resolution is done from trusted Stripe server-side data — never from caller input.
 * The normal webhook processing path is reused, including all idempotency protections.
 *
 * Usage: POST /api/admin/replay-topup with body { "sessionId": "cs_live_..." }
 *   or { "paymentIntentId": "pi_3UGl3pJunPTBXsIv0J2gv4u8" }
 */
export async function POST(request: NextRequest) {
  const authSession = await auth()
  const user = authSession?.user

  if (!user?.id || !user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const rawSessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : ""
  const rawPaymentIntentId = typeof body.paymentIntentId === "string" ? body.paymentIntentId.trim() : ""

  // Validate input — only accept Stripe IDs
  if (!rawSessionId && !rawPaymentIntentId) {
    return NextResponse.json(
      { error: "Provide either sessionId (cs_...) or paymentIntentId (pi_...)" },
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
    if (rawSessionId) {
      // Direct session retrieval — must start with cs_
      if (!rawSessionId.startsWith("cs_")) {
        return NextResponse.json(
          { error: "sessionId must be a Stripe Checkout Session ID starting with cs_" },
          { status: 400 },
        )
      }
      checkoutSession = await stripe.checkout.sessions.retrieve(rawSessionId, {
        expand: ["payment_intent"],
      })
    } else if (rawPaymentIntentId) {
      // PaymentIntent diagnostic — verify it exists and is paid
      // We cannot directly resolve the Checkout Session from PaymentIntent via API,
      // so we validate the PI and ask user to provide the cs_ ID if needed
      try {
        const pi = await stripe.paymentIntents.retrieve(rawPaymentIntentId)
        debugLog("[replay-topup] PaymentIntent validated", {
          id: pi.id,
          amount: pi.amount,
          currency: pi.currency,
          status: pi.status,
          paymentStatus: (pi as unknown as { payment_status?: string }).payment_status ?? pi.status,
        })
        return NextResponse.json({
          success: false,
          processed: false,
          synced: false,
          reason: `PaymentIntent ${rawPaymentIntentId} is valid (${pi.amount} ${pi.currency}, status: ${pi.status}). To recover credits, call this endpoint again with sessionId (cs_...) instead of paymentIntentId.`,
          diagnostics: {
            paymentIntentId: pi.id,
            amount: pi.amount,
            currency: pi.currency,
            status: pi.status,
          },
        })
      } catch (err) {
        debugError("[replay-topup] Failed to retrieve PaymentIntent:", err)
        return NextResponse.json(
          { error: "Failed to retrieve PaymentIntent", details: err instanceof Error ? err.message : String(err) },
          { status: 500 },
        )
      }
    }
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

  // Diagnostic information about the retrieved session
  const sessionDiagnostics = {
    sessionId: checkoutSession.id,
    mode: checkoutSession.mode,
    paymentStatus: checkoutSession.payment_status,
    amountTotal: checkoutSession.amount_total,
    currency: checkoutSession.currency,
    customerId: checkoutSession.customer,
    clientReferenceId: checkoutSession.client_reference_id,
    metadata: checkoutSession.metadata,
    lineItemCount: Array.isArray(checkoutSession.line_items) ? checkoutSession.line_items.length : 0,
    createdAt: checkoutSession.created,
    livemode: checkoutSession.livemode,
  }

  debugLog("[replay-topup] Session diagnostics", sessionDiagnostics)

  // Require payment mode
  if (checkoutSession.mode !== "payment") {
    return NextResponse.json(
      { error: "Not a payment-mode checkout session", diagnostics: sessionDiagnostics },
      { status: 400 },
    )
  }

  // Require paid status
  if (checkoutSession.payment_status !== "paid") {
    return NextResponse.json(
      { error: "Session not paid", paymentStatus: checkoutSession.payment_status, diagnostics: sessionDiagnostics },
      { status: 400 },
    )
  }

  // Build synthetic event from Stripe-retrieved session data — preserve livemode
  const syntheticEvent: Stripe.Event = {
    id: `evt_replay_${Date.now()}`,
    object: "event",
    api_version: "2022-08-01",
    created: Math.floor(Date.now() / 1000),
    type: "checkout.session.completed",
    data: {
      object: checkoutSession,
    },
    livemode: checkoutSession.livemode ?? false,
    pending_webhooks: 0,
    request: null,
  }

  // Reuse the normal webhook handler — includes all idempotency checks and legacy resolution
  const result = await handleStripeCreditCheckoutEvent(syntheticEvent)

  return NextResponse.json({
    success: result.processed,
    processed: result.processed,
    synced: result.synced,
    creditsIssued: result.creditsIssued,
    duplicate: result.duplicate,
    reason: result.reason,
    diagnostics: sessionDiagnostics,
  })
}
