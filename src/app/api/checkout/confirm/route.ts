import { auth } from "@/lib/auth/auth";
import {
  getMissingProStripePriceEnvLabel,
  getProStripePriceId,
  normalizeCountryCode,
  resolveCheckoutProPrice,
} from "@/lib/billing/launch-pricing";
import { getMissingStripePriceEnvLabel, logMissingStripePriceId } from "@/lib/billing/plans";
import { getConfiguredBillingPlan } from "@/lib/billing/settings-store";
import { getDb } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { issueCheckoutToken } from "@/lib/stripe/checkout-token";
import { debugError, debugWarn } from "@/lib/utils/debug";
import { createStripeCheckoutSession, retrieveStripeCustomerCountry } from "@/services/stripe/checkout";
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
  const plan = await getConfiguredBillingPlan(body.planId);
  logMissingStripePriceId(plan, "checkout/confirm");

  const searchParams = request.nextUrl.searchParams;
  const reviewAccepted = searchParams.get("form") === "review-accepted";
  const db = getDb();
  const profile = db
    ? await db.query.profiles.findFirst({
        where: eq(profiles.userId, user.id),
        columns: { stripeCustomerId: true, location: true },
      })
    : null;
  const paymentProviderCustomerCountry = profile?.stripeCustomerId
    ? await retrieveCustomerCountrySafely(profile.stripeCustomerId, "checkout/confirm")
    : null;
  let priceId = plan.stripePriceId;
  let checkoutPriceMetadata: Record<string, string> = {};

  try {
    if (plan.id === "pro_monthly") {
      if (!normalizeCountryCode(body.billingCountry)) {
        return NextResponse.json({ error: "Billing country is required for Pro checkout." }, { status: 400 });
      }
      const resolvedPrice = resolveCheckoutProPrice({
        billingCountry: body.billingCountry,
        paymentProviderCustomerCountry,
        taxCountry: body.taxCountry,
        accountCountry: body.accountCountry || profile?.location,
        browserCountry: body.browserCountry,
        requestedCurrency: body.currency || body.requestedCurrency,
        requestedAmountMinor: typeof body.amountMinor === "number" ? body.amountMinor : body.requestedAmountMinor,
      });
      priceId = getProStripePriceId(resolvedPrice.currency);
      checkoutPriceMetadata = {
        billingCountry: String(body.billingCountry || ""),
        resolvedCountry: resolvedPrice.country || "",
        resolvedCountrySource: resolvedPrice.source,
        resolvedCurrency: resolvedPrice.currency,
        resolvedAmountMinor: String(resolvedPrice.amountMinor),
        fixedPricingTier: "TIER_A",
      };
      logCountryMismatch("checkout/confirm", {
        billingCountry: body.billingCountry,
        paymentProviderCustomerCountry,
        taxCountry: body.taxCountry,
        accountCountry: body.accountCountry || profile?.location,
        resolvedCurrency: resolvedPrice.currency,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout price validation failed.";
    debugWarn("[checkout/confirm] Price validation failed.", {
      planId: plan.id,
      billingCountry: body.billingCountry,
      requestedCurrency: body.currency || body.requestedCurrency,
      requestedAmountMinor: body.amountMinor ?? body.requestedAmountMinor,
    });
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Step 2 – T&C accepted and a Stripe price ID is configured: open real checkout
  if (reviewAccepted && priceId) {
    const origin = request.nextUrl.origin;
    const checkoutToken = issueCheckoutToken(null, user.id);
    const successUrl = `${origin}/checkout/success?t=${checkoutToken}&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/app/settings/checkout?cancel=1&plan=${plan.id}`;

    try {
      const checkout = await createStripeCheckoutSession({
        userId: user.id,
        userEmail: user.email,
        customerId: profile?.stripeCustomerId ?? null,
        priceId,
        successUrl,
        cancelUrl,
        metadata: checkoutPriceMetadata,
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

  if (plan.tier === "free") {
    return NextResponse.json(
      { error: "The Free plan does not require checkout." },
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      error: `Card checkout is not configured for this plan. Set ${
        plan.id === "pro_monthly"
          ? getMissingProStripePriceEnvLabel(resolveCheckoutProPrice({ billingCountry: body.billingCountry }).currency)
          : getMissingStripePriceEnvLabel(plan.id)
      }.`,
    },
    { status: 503 },
  );
}

async function retrieveCustomerCountrySafely(customerId: string, context: string) {
  try {
    return await retrieveStripeCustomerCountry(customerId);
  } catch (error) {
    debugWarn(`[${context}] Stripe customer country could not be resolved.`, error);
    return null;
  }
}

function logCountryMismatch(context: string, input: Record<string, string | null | undefined>) {
  const billingCountry = normalizeCountryCode(input.billingCountry);
  if (!billingCountry) return;

  for (const [source, country] of Object.entries(input)) {
    if (source === "billingCountry" || source === "resolvedCurrency") continue;
    const normalized = normalizeCountryCode(country);
    if (normalized && normalized !== billingCountry) {
      debugWarn(`[${context}] Checkout country mismatch.`, {
        billingCountry,
        mismatchSource: source,
        mismatchCountry: normalized,
        resolvedCurrency: input.resolvedCurrency,
      });
    }
  }
}
