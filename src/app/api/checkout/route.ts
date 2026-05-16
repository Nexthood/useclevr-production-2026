import { NextRequest, NextResponse } from "next/server"
import { getBillingPlan } from "@/lib/billing/plans"

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const plan = getBillingPlan(body.productId || body.plan)
  const checkoutUrl = new URL("/app/checkout", request.nextUrl.origin)
  checkoutUrl.searchParams.set("plan", plan.id)
  checkoutUrl.searchParams.set("discount", "auto")

  return NextResponse.json({
    url: checkoutUrl.toString(),
    plan,
    discount: plan.discountLabel || "Auto discount checked",
    paymentStatus: plan.paymentComingSoon ? "payment_coming_soon" : "ready",
  })
}
