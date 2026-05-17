import { NextRequest, NextResponse } from "next/server"
import { getBillingSettings } from "@/lib/billing/settings-store"

export async function GET(request: NextRequest) {
  const settings = await getBillingSettings()

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
      paymentProviderConnected: plan.paymentProviderConnected ?? false,
      tscAndConditionsUrl: plan.tscAndConditionsUrl ?? null,
      status: plan.paymentProviderConnected ? "ready" : "payment_provider_not_connected",
    })),
  })
}
