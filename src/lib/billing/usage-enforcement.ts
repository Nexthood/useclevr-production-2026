import { getDb } from "@/lib/db"
import {
  aiCostLogs,
  dailyAiRequestCounts,
  concurrentAnalysisCounts,
  datasets,
  profiles,
} from "@/lib/db/schema"
import { eq, and, gte, lte, sql, count, sum, desc } from "drizzle-orm"
import { isBuiltinUserId, isSuperAdminUserId } from "@/lib/auth/builtin-users"
import { calculateTokenCost } from "./provider-pricing"
import {
  getBillingPlanByTier,
  getAiRequestsLimitForTier,
  getConcurrentAnalysesLimitForTier,
  getDatasetLimitForTier,
  getRowLimitForTier,
  getFileSizeLimitForTier,
} from "./plans"

export type EnforcementAction =
  | "dataset_analysis"
  | "ai_chat"
  | "dashboard_generation"
  | "report_generation"
  | "forecast_analysis"
  | "multi_dataset_analysis"
  | "data_insight"
  | "file_upload"

export interface EnforcementResult {
  allowed: boolean
  reason?: string
  upgradeMessage?: string
  currentUsage?: {
    dailyRequests: number
    dailyLimit: number
    concurrentAnalyses: number
    concurrentLimit: number
    datasets: number
    datasetLimit: number
  }
}

export interface DailyRequestInfo {
  userId: string
  date: string
  requestCount: number
}

export async function getDailyRequestCount(userId: string): Promise<DailyRequestInfo> {
  const db = getDb()
  const today = new Date().toISOString().split("T")[0]

  if (!db) {
    return { userId, date: today, requestCount: 0 }
  }

  const existing = await db.query.dailyAiRequestCounts.findFirst({
    where: and(
      eq(dailyAiRequestCounts.userId, userId),
      eq(dailyAiRequestCounts.date, today)
    ),
  })

  return {
    userId,
    date: today,
    requestCount: existing?.requestCount || 0,
  }
}

export async function incrementDailyRequestCount(userId: string): Promise<number> {
  const db = getDb()
  const today = new Date().toISOString().split("T")[0]

  if (!db) return 0

  if (isBuiltinUserId(userId) || isSuperAdminUserId(userId)) {
    return 999999
  }

  const existing = await db.query.dailyAiRequestCounts.findFirst({
    where: and(
      eq(dailyAiRequestCounts.userId, userId),
      eq(dailyAiRequestCounts.date, today)
    ),
  })

  if (existing) {
    const newCount = existing.requestCount + 1
    await db
      .update(dailyAiRequestCounts)
      .set({ requestCount: newCount, updatedAt: new Date() })
      .where(eq(dailyAiRequestCounts.id, existing.id))
    return newCount
  }

  const id = `drc_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`
  await db.insert(dailyAiRequestCounts).values({
    id,
    userId,
    date: today,
    requestCount: 1,
  })
  return 1
}

export async function getConcurrentAnalysisCount(userId: string): Promise<number> {
  const db = getDb()
  if (!db) return 0

  if (isBuiltinUserId(userId) || isSuperAdminUserId(userId)) {
    return 0
  }

  const existing = await db.query.concurrentAnalysisCounts.findFirst({
    where: eq(concurrentAnalysisCounts.userId, userId),
  })

  return existing?.activeCount || 0
}

export async function incrementConcurrentAnalyses(userId: string): Promise<boolean> {
  const db = getDb()
  if (!db) return false

  if (isBuiltinUserId(userId) || isSuperAdminUserId(userId)) {
    return true
  }

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
  })
  const tier = profile?.subscriptionTier || "free"
  const limit = getConcurrentAnalysesLimitForTier(tier)

  const existing = await db.query.concurrentAnalysisCounts.findFirst({
    where: eq(concurrentAnalysisCounts.userId, userId),
  })

  if (existing) {
    if (existing.activeCount >= limit) {
      return false
    }
    await db
      .update(concurrentAnalysisCounts)
      .set({
        activeCount: existing.activeCount + 1,
        updatedAt: new Date(),
      })
      .where(eq(concurrentAnalysisCounts.id, existing.id))
    return true
  }

  const id = `cac_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`
  await db.insert(concurrentAnalysisCounts).values({
    id,
    userId,
    activeCount: 1,
  })
  return true
}

export async function decrementConcurrentAnalyses(userId: string): Promise<void> {
  const db = getDb()
  if (!db) return

  if (isBuiltinUserId(userId) || isSuperAdminUserId(userId)) {
    return
  }

  const existing = await db.query.concurrentAnalysisCounts.findFirst({
    where: eq(concurrentAnalysisCounts.userId, userId),
  })

  if (existing && existing.activeCount > 0) {
    await db
      .update(concurrentAnalysisCounts)
      .set({
        activeCount: existing.activeCount - 1,
        updatedAt: new Date(),
      })
      .where(eq(concurrentAnalysisCounts.id, existing.id))
  }
}

export async function checkActionEnforcement(
  userId: string,
  action: EnforcementAction
): Promise<EnforcementResult> {
  if (isBuiltinUserId(userId) || isSuperAdminUserId(userId)) {
    return { allowed: true }
  }

  const db = getDb()
  if (!db) {
    return { allowed: false, reason: "Database unavailable" }
  }

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
  })
  const tier = profile?.subscriptionTier || "free"

  const dailyInfo = await getDailyRequestCount(userId)
  const dailyLimit = getAiRequestsLimitForTier(tier)

  if (dailyInfo.requestCount >= dailyLimit) {
    return {
      allowed: false,
      reason: `Daily AI request limit reached (${dailyInfo.requestCount}/${dailyLimit})`,
      upgradeMessage: `Upgrade to Pro or Business for higher daily limits (${dailyLimit}+ requests/day).`,
      currentUsage: {
        dailyRequests: dailyInfo.requestCount,
        dailyLimit,
        concurrentAnalyses: 0,
        concurrentLimit: getConcurrentAnalysesLimitForTier(tier),
        datasets: 0,
        datasetLimit: getDatasetLimitForTier(tier),
      },
    }
  }

  if (action === "dataset_analysis" || action === "forecast_analysis") {
    const concurrentCount = await getConcurrentAnalysisCount(userId)
    const concurrentLimit = getConcurrentAnalysesLimitForTier(tier)

    if (concurrentCount >= concurrentLimit) {
      return {
        allowed: false,
        reason: `Concurrent analysis limit reached (${concurrentCount}/${concurrentLimit})`,
        upgradeMessage: `Upgrade to Business for higher concurrent analysis limits.`,
        currentUsage: {
          dailyRequests: dailyInfo.requestCount,
          dailyLimit,
          concurrentAnalyses: concurrentCount,
          concurrentLimit,
          datasets: 0,
          datasetLimit: getDatasetLimitForTier(tier),
        },
      }
    }
  }

  if (action === "file_upload" || action === "dataset_analysis") {
    const [{ count: datasetCount }] = await db
      .select({ count: count() })
      .from(datasets)
      .where(eq(datasets.userId, userId))
    const datasetLimit = getDatasetLimitForTier(tier)

    if (datasetCount >= datasetLimit) {
      return {
        allowed: false,
        reason: `Dataset limit reached (${datasetCount}/${datasetLimit})`,
        upgradeMessage: `Upgrade to a higher plan for more datasets.`,
        currentUsage: {
          dailyRequests: dailyInfo.requestCount,
          dailyLimit,
          concurrentAnalyses: await getConcurrentAnalysisCount(userId),
          concurrentLimit: getConcurrentAnalysesLimitForTier(tier),
          datasets: Number(datasetCount),
          datasetLimit,
        },
      }
    }
  }

  return {
    allowed: true,
    currentUsage: {
      dailyRequests: dailyInfo.requestCount,
      dailyLimit,
      concurrentAnalyses: await getConcurrentAnalysisCount(userId),
      concurrentLimit: getConcurrentAnalysesLimitForTier(tier),
      datasets: 0,
      datasetLimit: getDatasetLimitForTier(tier),
    },
  }
}

export async function logAiCost(input: {
  userId: string
  organizationId?: string | null
  subscriptionPlan?: string | null
  provider: string
  model: string
  actionType: string
  inputTokens: number
  outputTokens: number
  estimatedCostEur: number
  creditsCharged: number
  requestStatus: "success" | "failed" | "blocked"
  errorMessage?: string | null
  datasetId?: string | null
  latencyMs?: number | null
  metadata?: Record<string, unknown>
}): Promise<void> {
  const db = getDb()
  if (!db) return

  const id = `acl_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`
  await db.insert(aiCostLogs).values({
    id,
    userId: input.userId,
    organizationId: input.organizationId || null,
    subscriptionPlan: input.subscriptionPlan || null,
    provider: input.provider as any,
    model: input.model,
    actionType: input.actionType as any,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    totalTokens: input.inputTokens + input.outputTokens,
    estimatedCostEur: Math.round(input.estimatedCostEur * 100),
    creditsCharged: input.creditsCharged,
    requestStatus: input.requestStatus,
    errorMessage: input.errorMessage || null,
    datasetId: input.datasetId || null,
    requestMetadata: input.metadata || {},
    latencyMs: input.latencyMs || null,
  })
}

export async function getUserCostAnalytics(
  userId: string,
  options: { fromDate?: Date; toDate?: Date } = {}
) {
  const db = getDb()
  if (!db) return null

  const { fromDate, toDate } = options
  const conditions = [eq(aiCostLogs.userId, userId)]
  if (fromDate) conditions.push(gte(aiCostLogs.createdAt, fromDate))
  if (toDate) conditions.push(lte(aiCostLogs.createdAt, toDate))

  const totalCostResult = await db
    .select({ total: sum(aiCostLogs.estimatedCostEur) })
    .from(aiCostLogs)
    .where(and(...conditions))

  const totalCreditsResult = await db
    .select({ total: sum(aiCostLogs.creditsCharged) })
    .from(aiCostLogs)
    .where(and(...conditions))

  const byProvider = await db
    .select({
      provider: aiCostLogs.provider,
      totalCost: sum(aiCostLogs.estimatedCostEur),
      totalCredits: sum(aiCostLogs.creditsCharged),
      requestCount: count(),
    })
    .from(aiCostLogs)
    .where(and(...conditions))
    .groupBy(aiCostLogs.provider)

  const byAction = await db
    .select({
      actionType: aiCostLogs.actionType,
      totalCost: sum(aiCostLogs.estimatedCostEur),
      totalCredits: sum(aiCostLogs.creditsCharged),
      requestCount: count(),
    })
    .from(aiCostLogs)
    .where(and(...conditions))
    .groupBy(aiCostLogs.actionType)

  const byModel = await db
    .select({
      model: aiCostLogs.model,
      provider: aiCostLogs.provider,
      totalCost: sum(aiCostLogs.estimatedCostEur),
      totalCredits: sum(aiCostLogs.creditsCharged),
      requestCount: count(),
    })
    .from(aiCostLogs)
    .where(and(...conditions))
    .groupBy(aiCostLogs.model, aiCostLogs.provider)

  return {
    totalCostEur: Number(totalCostResult[0]?.total || 0) / 100,
    totalCreditsUsed: Number(totalCreditsResult[0]?.total || 0),
    byProvider: byProvider.map((p) => ({
      provider: p.provider,
      totalCostEur: Number(p.totalCost || 0) / 100,
      totalCreditsUsed: Number(p.totalCredits || 0),
      requestCount: Number(p.requestCount),
    })),
    byAction: byAction.map((a) => ({
      actionType: a.actionType,
      totalCostEur: Number(a.totalCost || 0) / 100,
      totalCreditsUsed: Number(a.totalCredits || 0),
      requestCount: Number(a.requestCount),
    })),
    byModel: byModel.map((m) => ({
      model: m.model,
      provider: m.provider,
      totalCostEur: Number(m.totalCost || 0) / 100,
      totalCreditsUsed: Number(m.totalCredits || 0),
      requestCount: Number(m.requestCount),
    })),
  }
}

export async function validateFileSize(userId: string, fileSizeMb: number): Promise<{
  allowed: boolean
  limit: number
  message?: string
}> {
  const db = getDb()
  if (!db) return { allowed: false, limit: 10 }

  if (isBuiltinUserId(userId) || isSuperAdminUserId(userId)) {
    return { allowed: true, limit: 1000 }
  }

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
  })
  const tier = profile?.subscriptionTier || "free"
  const limit = getFileSizeLimitForTier(tier)

  if (fileSizeMb > limit) {
    return {
      allowed: false,
      limit,
      message: `File size (${fileSizeMb}MB) exceeds your plan limit of ${limit}MB. Upgrade to Pro or Business for larger files.`,
    }
  }

  return { allowed: true, limit }
}

export async function validateRowCount(userId: string, rowCount: number): Promise<{
  allowed: boolean
  limit: number
  message?: string
}> {
  const db = getDb()
  if (!db) return { allowed: false, limit: 5000 }

  if (isBuiltinUserId(userId) || isSuperAdminUserId(userId)) {
    return { allowed: true, limit: 500000 }
  }

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
  })
  const tier = profile?.subscriptionTier || "free"
  const limit = getRowLimitForTier(tier)

  if (rowCount > limit) {
    return {
      allowed: false,
      limit,
      message: `Row count (${rowCount.toLocaleString()}) exceeds your plan limit of ${limit.toLocaleString()} rows. Upgrade to a higher plan for larger datasets.`,
    }
  }

  return { allowed: true, limit }
}
