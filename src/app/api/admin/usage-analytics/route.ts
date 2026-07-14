import { NextResponse } from "next/server"
import { auth } from "@/lib/auth/auth"
import { isSuperAdminUserId } from "@/lib/auth/builtin-users"
import { getDb } from "@/lib/db"
import { aiCostLogs, userCredits, profiles, datasets } from "@/lib/db/schema"
import { eq, gte, lte, sql, count, sum, desc } from "drizzle-orm"

export async function GET(request: Request) {
  const session = await auth()
  const adminUserId = session?.user?.id

  const role = String(session?.user?.role ?? "")
  const hasSuperAdminRole = Boolean(adminUserId && isSuperAdminUserId(adminUserId)) || role === "superadmin" || role === "admin"

  if (!adminUserId || !hasSuperAdminRole) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const fromDate = searchParams.get("fromDate")
  const toDate = searchParams.get("toDate")

  const db = getDb()
  if (!db) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 })
  }

  try {
    const dateConditions: any[] = []
    if (fromDate) dateConditions.push(gte(aiCostLogs.createdAt, new Date(fromDate)))
    if (toDate) dateConditions.push(lte(aiCostLogs.createdAt, new Date(toDate)))
    const dateWhere = dateConditions.length > 0 ? sql`${dateConditions.join(" AND ")}` : undefined

    const totalCostResult = await db
      .select({ total: sum(aiCostLogs.estimatedCostEur) })
      .from(aiCostLogs)
      .where(dateWhere ? sql`${dateWhere}` : undefined)

    const totalCreditsResult = await db
      .select({ total: sum(aiCostLogs.creditsCharged) })
      .from(aiCostLogs)
      .where(dateWhere ? sql`${dateWhere}` : undefined)

    const totalRequests = await db
      .select({ count: count() })
      .from(aiCostLogs)
      .where(dateWhere ? sql`${dateWhere}` : undefined)

    const byProvider = await db
      .select({
        provider: aiCostLogs.provider,
        totalCost: sum(aiCostLogs.estimatedCostEur),
        totalCredits: sum(aiCostLogs.creditsCharged),
        requestCount: count(),
      })
      .from(aiCostLogs)
      .where(dateWhere ? sql`${dateWhere}` : undefined)
      .groupBy(aiCostLogs.provider)

    const byPlan = await db
      .select({
        plan: aiCostLogs.subscriptionPlan,
        totalCost: sum(aiCostLogs.estimatedCostEur),
        totalCredits: sum(aiCostLogs.creditsCharged),
        requestCount: count(),
      })
      .from(aiCostLogs)
      .where(dateWhere ? sql`${dateWhere}` : undefined)
      .groupBy(aiCostLogs.subscriptionPlan)

    const topUsers = await db
      .select({
        userId: aiCostLogs.userId,
        totalCost: sum(aiCostLogs.estimatedCostEur),
        totalCredits: sum(aiCostLogs.creditsCharged),
        requestCount: count(),
      })
      .from(aiCostLogs)
      .where(dateWhere ? sql`${dateWhere}` : undefined)
      .groupBy(aiCostLogs.userId)
      .orderBy(desc(sql`sum(${aiCostLogs.estimatedCostEur})`))
      .limit(20)

    const userProfiles = await Promise.all(
      topUsers.slice(0, 10).map(async (u) => {
        const profile = await db.query.profiles.findFirst({
          where: eq(profiles.userId, u.userId),
          columns: { email: true, fullName: true, subscriptionTier: true },
        })
        return { ...u, email: profile?.email, fullName: profile?.fullName, tier: profile?.subscriptionTier }
      })
    )

    const byStatus = await db
      .select({
        status: aiCostLogs.requestStatus,
        count: count(),
      })
      .from(aiCostLogs)
      .where(dateWhere ? sql`${dateWhere}` : undefined)
      .groupBy(aiCostLogs.requestStatus)

    const byAction = await db
      .select({
        actionType: aiCostLogs.actionType,
        totalCost: sum(aiCostLogs.estimatedCostEur),
        totalCredits: sum(aiCostLogs.creditsCharged),
        requestCount: count(),
      })
      .from(aiCostLogs)
      .where(dateWhere ? sql`${dateWhere}` : undefined)
      .groupBy(aiCostLogs.actionType)

    const creditStats = await db
      .select({
        totalCredits: sum(userCredits.totalCredits),
        usedCredits: sum(userCredits.usedCredits),
        remainingCredits: sum(userCredits.remainingCredits),
        userCount: count(),
      })
      .from(userCredits)

    const datasetStats = await db
      .select({
        totalDatasets: count(),
      })
      .from(datasets)

    const planDistribution = await db
      .select({
        tier: profiles.subscriptionTier,
        count: count(),
      })
      .from(profiles)
      .groupBy(profiles.subscriptionTier)

    return NextResponse.json({
      summary: {
        totalCostEur: Number(totalCostResult[0]?.total || 0) / 100,
        totalCreditsUsed: Number(totalCreditsResult[0]?.total || 0),
        totalRequests: Number(totalRequests[0]?.count || 0),
        uniqueUsers: topUsers.length,
      },
      byProvider: byProvider.map((p) => ({
        provider: p.provider,
        costEur: Number(p.totalCost || 0) / 100,
        creditsUsed: Number(p.totalCredits || 0),
        requests: Number(p.requestCount),
      })),
      byPlan: byPlan.map((p) => ({
        plan: p.plan || "unknown",
        costEur: Number(p.totalCost || 0) / 100,
        creditsUsed: Number(p.totalCredits || 0),
        requests: Number(p.requestCount),
      })),
      topUsers: userProfiles.map((u) => ({
        userId: u.userId,
        email: u.email,
        fullName: u.fullName,
        tier: u.tier,
        costEur: Number(u.totalCost || 0) / 100,
        creditsUsed: Number(u.totalCredits || 0),
        requests: Number(u.requestCount),
      })),
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: Number(s.count),
      })),
      byAction: byAction.map((a) => ({
        actionType: a.actionType,
        costEur: Number(a.totalCost || 0) / 100,
        creditsUsed: Number(a.totalCredits || 0),
        requests: Number(a.requestCount),
      })),
      creditStats: {
        totalAllocated: Number(creditStats[0]?.totalCredits || 0),
        totalUsed: Number(creditStats[0]?.usedCredits || 0),
        totalRemaining: Number(creditStats[0]?.remainingCredits || 0),
        userCount: Number(creditStats[0]?.userCount || 0),
      },
      datasetStats: {
        totalDatasets: Number(datasetStats[0]?.totalDatasets || 0),
      },
      planDistribution: planDistribution.map((p) => ({
        tier: p.tier,
        count: Number(p.count),
      })),
    })
  } catch (error) {
    console.error("[ADMIN_USAGE_ANALYTICS] Error:", error)
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 })
  }
}
