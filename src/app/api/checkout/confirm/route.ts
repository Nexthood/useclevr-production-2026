import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { getConfiguredBillingPlan } from "@/lib/billing/settings-store"

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const plan = await getConfiguredBillingPlan(body.planId)

  const searchParams = request.nextUrl.searchParams
  const reviewAccepted = searchParams.get("form") === "review-accepted"

  // Step 2 (T&C done): if payment provider is connected, create a real checkout session
  if (reviewAccepted && plan.paymentProviderConnected) {
    // Stripe integration stub — returns placeholder until STRIPE_SECRET_KEY is active
    return NextResponse.json({
      success: true,
      checkoutId: `checkout_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
      plan,
      status: "ready_for_payment",
      message: "Checkout is ready for payment.",
    })
  }

  // Fallback: save review without payment
  return NextResponse.json({
    success: true,
    checkoutId: `checkout_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
    plan,
    status: plan.paymentProviderConnected ? "ready_for_payment" : "saved_payment_provider_not_connected",
    message: plan.paymentProviderConnected
      ? "Checkout is ready for payment."
      : "Checkout review saved. Payment provider is not connected yet.",
  })
}
