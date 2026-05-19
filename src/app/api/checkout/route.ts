import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getConfiguredBillingPlan } from "@/lib/billing/settings-store";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const plan = await getConfiguredBillingPlan(body.productId || body.plan);
  const checkoutUrl = new URL("/app/settings/checkout", request.nextUrl.origin);
  checkoutUrl.searchParams.set("plan", plan.id);
  checkoutUrl.searchParams.set("discount", "auto");

  return NextResponse.json({
    url: checkoutUrl.toString(),
    plan,
    discount: plan.discountLabel || "Auto discount checked",
    paymentStatus: plan.stripePriceId ? "ready" : "payment_provider_not_connected",
  });
}
