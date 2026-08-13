import { getBillingSettings } from "@/lib/billing/settings-store";
import { logMissingStripePriceId } from "@/lib/billing/plans";
import { getCheckoutMarketOptions, getProLaunchPrices, getProStripePriceId, getStripePriceIdForCheckout } from "@/lib/billing/launch-pricing";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function GET(_request: NextRequest) {
  const settings = await getBillingSettings();
  settings.plans.forEach((plan) => logMissingStripePriceId(plan, "checkout/options"));

  return NextResponse.json({
    plans: settings.plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      tier: plan.tier,
      price: plan.price,
      interval: plan.interval,
      description: plan.description,
      features: plan.features,
      discountLabel: plan.discountLabel ?? null,
      launchPrices: plan.id === "pro_monthly" ? getProLaunchPrices() : null,
      marketOptions: plan.id === "pro_monthly"
        ? [
            ...getCheckoutMarketOptions("pro", "monthly").map(sanitizeMarketOption),
            ...getCheckoutMarketOptions("pro", "yearly").map(sanitizeMarketOption),
          ]
        : plan.id === "business_monthly"
          ? [
              ...getCheckoutMarketOptions("business", "monthly").map(sanitizeMarketOption),
              ...getCheckoutMarketOptions("business", "yearly").map(sanitizeMarketOption),
            ]
          : null,
      stripePriceStatusByCurrency: plan.id === "pro_monthly"
        ? {
            EUR: Boolean(getProStripePriceId("EUR")),
            GBP: Boolean(getProStripePriceId("GBP")),
            USD: Boolean(getProStripePriceId("USD")),
            CAD: Boolean(getProStripePriceId("CAD")),
          }
        : plan.id === "business_monthly"
          ? {
              EUR: Boolean(getStripePriceIdForCheckout("business", "eu")),
              GBP: Boolean(getStripePriceIdForCheckout("business", "uk")),
              USD: Boolean(getStripePriceIdForCheckout("business", "us")),
              CAD: Boolean(getStripePriceIdForCheckout("business", "ca")),
            }
          : null,
      stripePriceId: plan.stripePriceId ?? null,
      status: plan.tier === "free" || plan.stripePriceId ? "ready" : "payment_provider_not_connected",
    })),
  });
}

function sanitizeMarketOption(option: ReturnType<typeof getCheckoutMarketOptions>[number]) {
  return {
    plan: option.plan,
    billingInterval: option.billingInterval,
    market: option.market,
    marketLabel: option.marketLabel,
    currency: option.currency,
    amountMinor: option.amountMinor,
    displayPrice: option.displayPrice,
    enabled: option.enabled,
  };
}
