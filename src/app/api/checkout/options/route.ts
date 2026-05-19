import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getBillingSettings } from "@/lib/billing/settings-store";

export async function GET(_request: NextRequest) {
  const settings = await getBillingSettings();

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
      stripePriceId: plan.stripePriceId ?? null,
      status: plan.stripePriceId ? "ready" : "payment_provider_not_connected",
    })),
  });
}
