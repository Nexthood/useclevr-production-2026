import { auth } from "@/lib/auth/auth";
import {
  CheckoutPricingError,
  getMarketForCountry,
  normalizeCountryCode,
  normalizeCheckoutPlanSlug,
  resolveCheckoutMarketPrice,
} from "@/lib/billing/launch-pricing";
import { logMissingStripePriceId } from "@/lib/billing/plans";
import { getConfiguredBillingPlan } from "@/lib/billing/settings-store";
import { getDb } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { issueCheckoutToken } from "@/lib/stripe/checkout-token";
import { debugError, debugWarn } from "@/lib/utils/debug";
import {
  createStripeCheckoutSession,
  retrieveStripeCustomerCountry,
  StripeCheckoutConfigurationError,
} from "@/services/stripe/checkout";
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
  const planSlug = normalizeCheckoutPlanSlug(body.plan || body.productId || body.planId);
  const billingPlanId = planSlug === "business" ? "business_monthly" : "pro_monthly";
  const plan = await getConfiguredBillingPlan(billingPlanId);
  logMissingStripePriceId(plan, "checkout");

  if (plan.tier === "free") {
    return NextResponse.json(
      { error: "The Free plan does not require checkout." },
      { status: 400 },
    );
  }

  const db = getDb();
  const profile = db
    ? await db.query.profiles.findFirst({
        where: eq(profiles.userId, user.id),
        columns: { stripeCustomerId: true, location: true },
      })
    : null;
  const paymentProviderCustomerCountry = profile?.stripeCustomerId
    ? await retrieveCustomerCountrySafely(profile.stripeCustomerId, "checkout")
    : null;
  let priceId = plan.stripePriceId;
  let checkoutPriceMetadata: Record<string, string> = {};
  const requestedMarket = body.market || (body.billingCountry ? getMarketForCountry(body.billingCountry) : null);

  try {
    const resolvedPrice = resolveCheckoutMarketPrice({
      plan: planSlug,
      market: requestedMarket,
      billingInterval: body.billingInterval,
      requestedCurrency: body.currency || body.requestedCurrency,
      requestedAmountMinor: typeof body.amountMinor === "number" ? body.amountMinor : body.requestedAmountMinor,
      requestedStripePriceId: body.stripePriceId || body.priceId,
    });
    priceId = resolvedPrice.stripePriceId;
    checkoutPriceMetadata = {
      plan: planSlug,
      billingPlanId,
      billingInterval: resolvedPrice.billingInterval,
      market: resolvedPrice.market,
      resolvedCurrency: resolvedPrice.currency,
      resolvedAmountMinor: String(resolvedPrice.amountMinor),
      fixedPricingTier: planSlug === "pro" ? "TIER_A" : "BUSINESS_APPROVED",
    };
    logCountryMismatch("checkout", {
      billingCountry: body.billingCountry,
      paymentProviderCustomerCountry,
      taxCountry: body.taxCountry,
      accountCountry: body.accountCountry || profile?.location,
      resolvedCurrency: resolvedPrice.currency,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout price validation failed.";
    const code = error instanceof CheckoutPricingError ? error.code : "checkout_price_validation_failed";
    debugWarn("[checkout] Price validation failed.", {
      planId: plan.id,
      market: requestedMarket,
      billingCountry: body.billingCountry,
      requestedCurrency: body.currency || body.requestedCurrency,
      requestedAmountMinor: body.amountMinor ?? body.requestedAmountMinor,
    });
    return NextResponse.json({ error: message, code }, { status: 400 });
  }

  if (!priceId) {
    return NextResponse.json(
      { error: "Stripe checkout is not configured for this plan.", code: `${planSlug}_price_not_configured` },
      { status: 503 },
    );
  }

  const origin = request.nextUrl.origin;
  const checkoutToken = issueCheckoutToken(null, user.id);
  const successUrl = `${origin}/checkout/success?t=${checkoutToken}&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/app/settings/checkout?cancel=1&plan=${plan.id}&market=${checkoutPriceMetadata.market}`;

  try {
    const checkout = await createStripeCheckoutSession({
      userId: user.id,
      userEmail: user.email,
      customerId: profile?.stripeCustomerId ?? null,
      priceId,
      expectedCurrency: checkoutPriceMetadata.resolvedCurrency,
      plan: planSlug,
      successUrl,
      cancelUrl,
      metadata: checkoutPriceMetadata,
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
    const code = error instanceof StripeCheckoutConfigurationError ? error.code : "checkout_session_failed";
    return NextResponse.json({ error: message, code }, { status: 500 });
  }
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
