import { debugError } from "@/lib/utils/debug";
import { auth } from "@/lib/auth/auth";
import { getCreditAccount } from "@/lib/billing/credit-account-service";
import { initializeUserCredits, getUserCreditInfo } from "@/lib/billing/credit-engine";
import { getDb } from "@/lib/db";
import { eq } from "drizzle-orm";
import { profiles } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } })
    }

    const userId = session.user.id

    const db = getDb()
    const profile = db ? await db.query.profiles.findFirst({
      where: eq(profiles.userId, userId),
      columns: { subscriptionTier: true },
    }) : null
    const subscriptionTier = profile?.subscriptionTier || "free"

    await initializeUserCredits(userId, subscriptionTier) || await getUserCreditInfo(userId)
    const account = await getCreditAccount(userId)

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

    const availableCredits = Math.max(0, account.remainingCredits - account.reservedCredits)

    return Response.json({
      unlimited: false,
      subscriptionTier: account.tier,
      planId: account.planId,
      total: account.totalAvailableBalance,
      analysisCount: account.usedCredits,
      usedCredits: account.usedCredits,
      availableCredits,
      reservedCredits: account.reservedCredits,
      remainingCredits: account.remainingCredits,
      includedBalance: account.includedBalance,
      purchasedBalance: account.purchasedBalance,
      totalPaidCents: account.totalPaidCents,
      nextResetAt: account.creditsResetAt.toISOString(),
      limitReached: availableCredits <= 0,
      canAnalyze: availableCredits > 0,
    }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    debugError("[USAGE] Error fetching usage:", error)
    return Response.json({ error: "Failed to fetch usage" }, { status: 500, headers: { "Cache-Control": "no-store" } })
  }
}
