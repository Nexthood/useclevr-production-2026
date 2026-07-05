import { NextResponse } from "next/server"
import { auth } from "@/lib/auth/auth"
import { isBuiltinUserId } from "@/lib/auth/builtin-users"
import { getUserCreditInfo, getCreditLedger } from "@/lib/billing/credit-engine"
import { getUserCostAnalytics, getDailyRequestCount, getConcurrentAnalysisCount } from "@/lib/billing/usage-enforcement"
import { getDb } from "@/lib/db"
import { profiles, datasets } from "@/lib/db/schema"
import { eq, count } from "drizzle-orm"

export async function GET() {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (isBuiltinUserId(userId)) {
    return NextResponse.json({
      plan: "builtin",
      credits: {
        total: 999999999,
        used: 0,
        remaining: 999999999,
        unlimited: true,
      },
      limits: {
        datasets: "unlimited",
        aiRequestsPerDay: "unlimited",
        concurrentAnalyses: "unlimited",
      },
    })
  }

  try {
    const creditInfo = await getUserCreditInfo(userId)
    const db = getDb()

    let profile = null
    let datasetCount = 0
    let dailyRequests = { requestCount: 0, limit: 200 }
    let concurrentAnalyses = 0

    if (db) {
      profile = await db.query.profiles.findFirst({
        where: eq(profiles.userId, userId),
      })

      const [{ count: dsCount }] = await db
        .select({ count: count() })
        .from(datasets)
        .where(eq(datasets.userId, userId))
      datasetCount = Number(dsCount || 0)
    }

    const tier = profile?.subscriptionTier || "free"
    const dailyRequestData = await getDailyRequestCount(userId)
    concurrentAnalyses = await getConcurrentAnalysisCount(userId)

    const tierLimits: Record<string, { datasets: number; aiRequestsPerDay: number; concurrentAnalyses: number }> = {
      free: { datasets: 2, aiRequestsPerDay: 20, concurrentAnalyses: 1 },
      pro: { datasets: 25, aiRequestsPerDay: 200, concurrentAnalyses: 3 },
      business: { datasets: 100, aiRequestsPerDay: 1000, concurrentAnalyses: 10 },
    }

    const limits = tierLimits[tier] || tierLimits.free

    const costAnalytics = await getUserCostAnalytics(userId)

    return NextResponse.json({
      plan: tier,
      credits: {
        total: creditInfo?.totalCredits || 0,
        used: creditInfo?.usedCredits || 0,
        remaining: creditInfo?.remainingCredits || 0,
        resetAt: creditInfo?.creditsResetAt?.toISOString(),
        unlimited: tier !== "free",
      },
      usage: {
        datasets: {
          current: datasetCount,
          limit: limits.datasets,
        },
        aiRequests: {
          today: dailyRequestData.requestCount,
          dailyLimit: limits.aiRequestsPerDay,
        },
        concurrentAnalyses: {
          current: concurrentAnalyses,
          limit: limits.concurrentAnalyses,
        },
      },
      analytics: costAnalytics,
    })
  } catch (error) {
    console.error("[USAGE_CREDITS] Error:", error)
    return NextResponse.json({ error: "Failed to fetch usage" }, { status: 500 })
  }
}
