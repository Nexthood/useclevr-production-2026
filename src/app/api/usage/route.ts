import { debugError } from "@/lib/utils/debug";

/**
 * Usage API Route
 * 
 * Returns current user's usage counts and subscription status
 */

import { auth } from "@/lib/auth/auth";
import { getCreditAccount } from "@/lib/billing/credit-account-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } })
    }

    const account = await getCreditAccount(session.user.id)

    if (!account) {
      return Response.json({
        unlimited: true,
        subscriptionTier: session.user.role || "superadmin",
        total: 0,
        analysisCount: 0,
        usedCredits: 0,
        availableCredits: 0,
        reservedCredits: 0,
        remainingCredits: 0,
        nextResetAt: null,
        limitReached: false,
        canAnalyze: true,
      }, { headers: { "Cache-Control": "no-store" } })
    }

    return Response.json({
      unlimited: false,
      subscriptionTier: account.tier,
      planId: account.planId,
      total: account.totalAvailableBalance,
      analysisCount: account.usedCredits,
      usedCredits: account.usedCredits,
      availableCredits: account.totalAvailableBalance - account.usedCredits - account.reservedCredits,
      reservedCredits: account.reservedCredits,
      remainingCredits: account.remainingCredits,
      includedBalance: account.includedBalance,
      purchasedBalance: account.purchasedBalance,
      totalPaidCents: account.totalPaidCents,
      nextResetAt: account.creditsResetAt.toISOString(),
      limitReached: account.totalAvailableBalance - account.reservedCredits <= 0,
      canAnalyze: account.totalAvailableBalance - account.reservedCredits > 0,
    }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    debugError("[USAGE] Error fetching usage:", error)
    return Response.json({ error: "Failed to fetch usage" }, { status: 500, headers: { "Cache-Control": "no-store" } })
  }
}
