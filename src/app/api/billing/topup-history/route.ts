import { auth } from "@/lib/auth/auth"
import { getCreditTopUpHistory } from "@/lib/billing/credit-topup-service"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const topUps = await getCreditTopUpHistory(userId, 50)

    // Customer-facing response never includes internal payment provider
    // references. Those stay in the database for refunds, reconciliation,
    // webhook processing, idempotency, and support.
    return NextResponse.json({
      topUps: topUps.map((t) => ({
        id: t.id,
        provider: t.provider,
        amount: t.amountMinor / 100,
        currency: t.currency,
        creditsGranted: t.creditsGranted,
        creditPackageId: t.creditPackageId,
        pricingVersion: t.pricingVersion,
        status: t.status,
        createdAt: t.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error("[CREDIT_TOPUP_HISTORY] Error:", error)
    return NextResponse.json({ error: "Failed to fetch top-up history" }, { status: 500 })
  }
}
