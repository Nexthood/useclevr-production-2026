import { auth } from "@/lib/auth";
import { getConfiguredBillingPlan } from "@/lib/billing/settings-store";
import { getDb } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { debugError } from "@/lib/utils/debug";
import { createStripeCheckoutSession } from "@/services/stripe/checkout";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

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
    const successUrl = `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/app/settings/checkout?cancel=1&plan=${plan.id}`;

    try {
      const db = getDb();
      const profile = db
        ? await db.query.profiles.findFirst({
            where: eq(profiles.userId, user.id),
            columns: { stripeCustomerId: true },
          })
        : null;

      const checkout = await createStripeCheckoutSession({
        userId: user.id,
        userEmail: user.email,
        customerId: profile?.stripeCustomerId ?? null,
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
      debugError("[checkout/confirm] Stripe error:", err);
      const message = err instanceof Error ? err.message : "Payment provider error. Please try again.";
      return NextResponse.json(
        { error: message },
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
