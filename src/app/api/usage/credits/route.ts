import { auth } from "@/lib/auth/auth"
import { getCreditAccount } from "@/lib/billing/credit-account-service"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    )
  }

  try {
    const account = await getCreditAccount(userId)

    if (!account) {
      return NextResponse.json(
        {
          unlimited: true,
          credits: null,
        },
        { headers: { "Cache-Control": "no-store" } },
      )
    }

    return NextResponse.json(
      {
        unlimited: false,
        plan: account.planId,
        tier: account.tier,
        credits: {
          included: {
            balance: account.includedBalance,
            label: "Included plan credits",
          },
          purchased: {
            balance: account.purchasedBalance,
            monetaryValue: account.totalPaidCents / 100,
            currency: account.currency,
            label: "Purchased top-up credits",
          },
          totalAvailable: account.totalAvailableBalance,
          used: account.usedCredits,
          reserved: account.reservedCredits,
          remaining: account.remainingCredits,
          available: account.remainingCredits - account.reservedCredits,
          resetAt: account.creditsResetAt.toISOString(),
          lastResetAt: account.lastResetAt?.toISOString() ?? null,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    console.error("[CREDITS] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch credits" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    )
  }
}
