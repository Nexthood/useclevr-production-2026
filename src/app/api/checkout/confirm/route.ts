import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getConfiguredBillingPlan } from "@/lib/billing/settings-store";
import { auth } from "@/lib/auth";
import { createStripeCheckoutSession } from "@/services/stripe/checkout";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const plan = await getConfiguredBillingPlan(body.planId);

  const searchParams = request.nextUrl.searchParams;
  const reviewAccepted = searchParams.get("form") === "review-accepted";

  // Step 2 – T&C accepted and a Stripe price ID is configured: open real checkout
  if (reviewAccepted && plan.stripePriceId) {
    const session = await auth();
    const user = session?.user;

    if (!user?.email || !user?.id) {
      return NextResponse.json(
        { error: "Please sign in again before completing checkout." },
        { status: 401 },
      );
    }

    const origin = request.nextUrl.origin;
    const successUrl = `${origin}/app/settings/checkout?success=1`;
    const cancelUrl = `${origin}/app/settings/checkout?cancel=1`;

    try {
      const checkout = await createStripeCheckoutSession({
        userId: user.id,
        userEmail: user.email,
        priceId: plan.stripePriceId,
        successUrl,
        cancelUrl,
      });

      if (!checkout.url) {
        return NextResponse.json(
          { error: "Payment provider returned an invalid checkout URL." },
          { status: 502 },
        );
      }

      return NextResponse.json({
        success: true,
        checkoutId: checkout.id,
        plan,
        status: "ready_for_payment",
        checkoutUrl: checkout.url,
        message: "Redirecting to payment…",
      });
    } catch (err) {
      console.error("[checkout/confirm] Stripe error:", err);
      return NextResponse.json(
        { error: "Payment provider error. Please try again." },
        { status: 500 },
      );
    }
  }

  // Free tier / no Stripe price configured: save a local review
  return NextResponse.json({
    success: true,
    checkoutId: `checkout_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
    plan,
    status: "saved_payment_provider_not_connected",
    message: "Checkout review saved. Connect a payment provider to collect cards automatically.",
  });
}
