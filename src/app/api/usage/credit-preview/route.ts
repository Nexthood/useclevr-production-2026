import { auth } from "@/lib/auth/auth"
import { getCreditAccount, getCreditPricingPreview } from "@/lib/billing/credit-account-service"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const feature = searchParams.get("feature") || "standard_analysis"
  const rowCount = Number(searchParams.get("rowCount") || 0)
  const fileSizeBytes = Number(searchParams.get("fileSizeBytes") || 0)
  const estimatedTokens = Number(searchParams.get("estimatedTokens") || 0)

  try {
    const account = await getCreditAccount(userId)
    const pricing = await getCreditPricingPreview(feature, {
      rowCount: rowCount || undefined,
      fileSizeBytes: fileSizeBytes || undefined,
      estimatedTokens: estimatedTokens || undefined,
    })

    if (!pricing) {
      return NextResponse.json({ error: "Invalid feature" }, { status: 400 })
    }

    return NextResponse.json({
      feature: pricing.actionType,
      creditCost: pricing.creditCost,
      estimatedMonetaryEquivalent: pricing.estimatedMonetaryEquivalent,
      currency: pricing.currency,
      pricingVersion: pricing.pricingVersion,
      explanation: pricing.explanation,
      balance: account
        ? {
            included: account.includedBalance,
            purchased: account.purchasedBalance,
            totalAvailable: account.totalAvailableBalance,
            remainingAfter: Math.max(0, account.totalAvailableBalance - pricing.creditCost),
            includedAfter: Math.max(0, account.includedBalance - pricing.creditCost),
            purchasedAfter: account.purchasedBalance,
          }
        : null,
    })
  } catch (error) {
    console.error("[CREDIT_PREVIEW] Error:", error)
    return NextResponse.json({ error: "Failed to calculate credit preview" }, { status: 500 })
  }
}
