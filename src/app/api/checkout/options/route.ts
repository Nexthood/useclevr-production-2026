import { getBillingSettings } from "@/lib/billing/settings-store";
import { logMissingStripePriceId } from "@/lib/billing/plans";
import { getProLaunchPrices, getProStripePriceId } from "@/lib/billing/launch-pricing";
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
      stripePriceStatusByCurrency: plan.id === "pro_monthly"
        ? {
            EUR: Boolean(getProStripePriceId("EUR")),
            GBP: Boolean(getProStripePriceId("GBP")),
            USD: Boolean(getProStripePriceId("USD")),
            CAD: Boolean(getProStripePriceId("CAD")),
          }
        : null,
      stripePriceId: plan.stripePriceId ?? null,
      status: plan.tier === "free" || plan.stripePriceId ? "ready" : "payment_provider_not_connected",
    })),
  });
}
