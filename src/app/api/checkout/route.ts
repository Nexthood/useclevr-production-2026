import { auth } from "@/lib/auth/auth";
import { getConfiguredBillingPlan } from "@/lib/billing/settings-store";
import { getDb } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { issueCheckoutToken } from "@/lib/stripe/checkout-token";
import { debugError } from "@/lib/utils/debug";
import { createStripeCheckoutSession } from "@/services/stripe/checkout";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const session = await auth();
  const user = session?.user;

  if (!user?.email || !user?.id) {
    return NextResponse.json(
      { error: "Please sign in again before completing checkout." },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const plan = await getConfiguredBillingPlan(body.productId || body.plan);

  if (plan.tier === "free") {
    return NextResponse.json(
      { error: "The Free plan does not require checkout." },
      { status: 400 },
    );
  }

  if (!plan.stripePriceId) {
    return NextResponse.json(
      { error: "Stripe checkout is not configured for this plan." },
      { status: 503 },
    );
  }

  const origin = request.nextUrl.origin;
  const checkoutToken = issueCheckoutToken(null, user.id);
  const successUrl = `${origin}/checkout/success?t=${checkoutToken}&session_id={CHECKOUT_SESSION_ID}`;
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

    return NextResponse.json({
      success: true,
      url: checkout.url,
      checkoutUrl: checkout.url,
      checkoutId: checkout.id,
      plan,
      discount: plan.discountLabel || "Auto discount checked",
      paymentStatus: "ready",
    });
  } catch (error) {
    debugError("[checkout] Stripe checkout session failed:", error);
    const message = error instanceof Error ? error.message : "Checkout could not be started.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
