import { getDb } from "@/lib/db"
import { aiCostLogs, profiles, aiProviderConfigs } from "@/lib/db/schema"
import { and, count, desc, eq, gte, lte, sql, sum, isNull } from "drizzle-orm"

export interface AiCostOptimizerSnapshot {
  summary: {
    totalCostEur: number
    totalCreditsUsed: number
    totalRequests: number
    uniqueUsers: number
    uniqueOrganizations: number
    avgCostPerRequestEur: number
    avgCreditsPerRequest: number
    successRate: number
  }
  providerBreakdown: Array<{
    provider: string
    costEur: number
    creditsUsed: number
    requests: number
    avgCostPerRequestEur: number
  }>
  planBreakdown: Array<{
    plan: string
    costEur: number
    creditsUsed: number
    requests: number
    avgCostPerRequestEur: number
    uniqueUsers: number
  }>
  organizationBreakdown: Array<{
    organizationId: string | null
    costEur: number
    requests: number
    avgCostPerRequestEur: number
    uniqueUsers: number
  }>
  topCustomers: Array<{
    userId: string
    email: string | null
    fullName: string | null
    tier: string | null
    costEur: number
    creditsUsed: number
    requests: number
    avgCostPerRequestEur: number
  }>
  recommendations: Array<{
    severity: "info" | "warning" | "danger"
    title: string
    detail: string
  }>
}

export interface ProviderConfigurationStatus {
  configured: boolean
  providers: Array<{
    name: string
    type: string
    configured: boolean
    model?: string
  }>
  hasAnyProvider: boolean
}

export async function getProviderConfigurationStatus(): Promise<ProviderConfigurationStatus> {
  const db = getDb()

  const providers = [
    { name: "Google Gemini", type: "google-gemini", envKey: "GEMINI_API_KEY" },
    { name: "OpenAI", type: "openai", envKey: "OPENAI_API_KEY" },
    { name: "Anthropic", type: "anthropic", envKey: "ANTHROPIC_API_KEY" },
    { name: "Local/Ollama", type: "ollama", envKey: null },
  ]

  const configuredProviders: Array<{
    name: string
    type: string
    configured: boolean
    model?: string
  }> = []

  for (const provider of providers) {
    if (provider.envKey) {
      const isConfigured = !!process.env[provider.envKey]
      configuredProviders.push({
        name: provider.name,
        type: provider.type,
        configured: isConfigured,
      })
    } else {
      configuredProviders.push({
        name: provider.name,
        type: provider.type,
        configured: false,
      })
    }
  }

  if (db) {
    try {
      const userConfigs = await db
        .select({
          providerType: aiProviderConfigs.providerType,
          providerName: aiProviderConfigs.providerName,
          isEnabled: aiProviderConfigs.isEnabled,
        })
        .from(aiProviderConfigs)
        .where(eq(aiProviderConfigs.isEnabled, true))
        .limit(10)

      for (const config of userConfigs) {
        const existing = configuredProviders.find((p) => p.type === config.providerType)
        if (existing) {
          existing.configured = true
        }
      }
    } catch {
    }
  }

  const hasAnyProvider = configuredProviders.some((p) => p.configured)

  return {
    configured: hasAnyProvider,
    providers: configuredProviders,
    hasAnyProvider,
  }
}

function getEmptySnapshot(): AiCostOptimizerSnapshot {
  return {
    summary: {
      totalCostEur: 0,
      totalCreditsUsed: 0,
      totalRequests: 0,
      uniqueUsers: 0,
      uniqueOrganizations: 0,
      avgCostPerRequestEur: 0,
      avgCreditsPerRequest: 0,
      successRate: 0,
    },
    providerBreakdown: [],
    planBreakdown: [],
    organizationBreakdown: [],
    topCustomers: [],
    recommendations: [],
  }
}

export async function getAiCostOptimizerSnapshot(params?: {
  fromDate?: string | null
  toDate?: string | null
}): Promise<AiCostOptimizerSnapshot> {
  const db = getDb()
  if (!db) {
    return getEmptySnapshot()
  }

  try {
    const logsExist = await db.select({ count: count() }).from(aiCostLogs).limit(1)
  } catch (error) {
    console.warn("[AI_COST_OPTIMIZER] Table might not exist yet:", error)
    return getEmptySnapshot()
  }

  const conditions = []
  if (params?.fromDate) {
    conditions.push(gte(aiCostLogs.createdAt, new Date(params.fromDate)))
  }
  if (params?.toDate) {
    conditions.push(lte(aiCostLogs.createdAt, new Date(params.toDate)))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [totalCostResult, totalCreditsResult, totalRequestsResult, uniqueUsersResult, uniqueOrganizationsResult, statusBreakdown] = await Promise.all([
    db
      .select({ total: sum(aiCostLogs.estimatedCostEur) })
      .from(aiCostLogs)
      .where(whereClause),
    db
      .select({ total: sum(aiCostLogs.creditsCharged) })
      .from(aiCostLogs)
      .where(whereClause),
    db.select({ count: count() }).from(aiCostLogs).where(whereClause),
    db.selectDistinct({ userId: aiCostLogs.userId }).from(aiCostLogs).where(whereClause),
    db
      .selectDistinct({ organizationId: aiCostLogs.organizationId })
      .from(aiCostLogs)
      .where(and(whereClause ?? sql`true`, sql`${aiCostLogs.organizationId} IS NOT NULL`)),
    db
      .select({ status: aiCostLogs.requestStatus, count: count() })
      .from(aiCostLogs)
      .where(whereClause)
      .groupBy(aiCostLogs.requestStatus),
  ])

  const [providerBreakdown, planBreakdown, organizationBreakdown, topCustomers] = await Promise.all([
    db
      .select({
        provider: aiCostLogs.provider,
        cost: sum(aiCostLogs.estimatedCostEur),
        creditsUsed: sum(aiCostLogs.creditsCharged),
        requests: count(),
      })
      .from(aiCostLogs)
      .where(whereClause)
      .groupBy(aiCostLogs.provider)
      .orderBy(desc(sql`sum(${aiCostLogs.estimatedCostEur})`)),
    db
      .select({
        plan: aiCostLogs.subscriptionPlan,
        cost: sum(aiCostLogs.estimatedCostEur),
        creditsUsed: sum(aiCostLogs.creditsCharged),
        requests: count(),
        uniqueUsers: sql<number>`COUNT(DISTINCT ${aiCostLogs.userId})`,
      })
      .from(aiCostLogs)
      .where(whereClause)
      .groupBy(aiCostLogs.subscriptionPlan)
      .orderBy(desc(sql`sum(${aiCostLogs.estimatedCostEur})`)),
    db
      .select({
        organizationId: aiCostLogs.organizationId,
        cost: sum(aiCostLogs.estimatedCostEur),
        requests: count(),
        uniqueUsers: sql<number>`COUNT(DISTINCT ${aiCostLogs.userId})`,
      })
      .from(aiCostLogs)
      .where(and(whereClause ?? sql`true`, sql`${aiCostLogs.organizationId} IS NOT NULL`))
      .groupBy(aiCostLogs.organizationId)
      .orderBy(desc(sql`sum(${aiCostLogs.estimatedCostEur})`)),
    db
      .select({
        userId: aiCostLogs.userId,
        cost: sum(aiCostLogs.estimatedCostEur),
        creditsUsed: sum(aiCostLogs.creditsCharged),
        requests: count(),
      })
      .from(aiCostLogs)
      .where(whereClause)
      .groupBy(aiCostLogs.userId)
      .orderBy(desc(sql`sum(${aiCostLogs.estimatedCostEur})`))
      .limit(10),
  ])

  const topCustomerProfiles = await Promise.all(
    topCustomers.map(async (customer) => {
      const profile = await db.query.profiles.findFirst({
        where: eq(profiles.userId, customer.userId),
        columns: { email: true, fullName: true, subscriptionTier: true },
      })

      return {
        userId: customer.userId,
        email: profile?.email ?? null,
        fullName: profile?.fullName ?? null,
        tier: profile?.subscriptionTier ?? null,
        costEur: Number(customer.cost || 0) / 100,
        creditsUsed: Number(customer.creditsUsed || 0),
        requests: Number(customer.requests),
        avgCostPerRequestEur: Number(customer.requests) > 0 ? Number(customer.cost || 0) / 100 / Number(customer.requests) : 0,
      }
    }),
  )

  const totalRequests = Number(totalRequestsResult[0]?.count || 0)
  const totalCostEur = Number(totalCostResult[0]?.total || 0) / 100
  const totalCreditsUsed = Number(totalCreditsResult[0]?.total || 0)
  const successCount = statusBreakdown.find((entry) => entry.status === "success")?.count || 0
  const successRate = totalRequests > 0 ? Number(successCount) / totalRequests : 0

  const recommendations = [] as AiCostOptimizerSnapshot["recommendations"]

  if (providerBreakdown.length > 0) {
    const highestCostProvider = providerBreakdown[0]
    const highestCostPerRequest = providerBreakdown.reduce((best, provider) => {
      const avg = Number(provider.requests) > 0 ? Number(provider.cost || 0) / 100 / Number(provider.requests) : 0
      return avg > best.avg ? { provider, avg } : best
    }, { provider: providerBreakdown[0], avg: 0 })

    if (highestCostPerRequest.provider && Number(highestCostPerRequest.provider.requests) > 0) {
      recommendations.push({
        severity: "warning",
        title: "High-cost routing pattern",
        detail: `${highestCostPerRequest.provider.provider} is carrying the most expensive requests at ${highestCostPerRequest.avg.toFixed(3)}€ per request. Review provider selection for routine tasks.`,
      })
    }
  }

  if (topCustomerProfiles.length > 0) {
    const biggestCustomer = topCustomerProfiles[0]
    if (biggestCustomer.costEur > 20) {
      recommendations.push({
        severity: "info",
        title: "Large customer cost spike",
        detail: `${biggestCustomer.fullName || biggestCustomer.email || biggestCustomer.userId} drove ${biggestCustomer.costEur.toFixed(2)}€ in cost across ${biggestCustomer.requests} requests. Confirm the plan still matches the workload.`,
      })
    }
  }

  if (successRate < 0.95 && totalRequests > 0) {
    recommendations.push({
      severity: "danger",
      title: "Request failures are affecting efficiency",
      detail: `${(100 - successRate * 100).toFixed(1)}% of requests are not succeeding, which is likely inflating wasted spend and credits.`,
    })
  }

  return {
    summary: {
      totalCostEur,
      totalCreditsUsed,
      totalRequests,
      uniqueUsers: uniqueUsersResult.length,
      uniqueOrganizations: uniqueOrganizationsResult.length,
      avgCostPerRequestEur: totalRequests > 0 ? totalCostEur / totalRequests : 0,
      avgCreditsPerRequest: totalRequests > 0 ? totalCreditsUsed / totalRequests : 0,
      successRate,
    },
    providerBreakdown: providerBreakdown.map((entry) => ({
      provider: entry.provider,
      costEur: Number(entry.cost || 0) / 100,
      creditsUsed: Number(entry.creditsUsed || 0),
      requests: Number(entry.requests),
      avgCostPerRequestEur: Number(entry.requests) > 0 ? Number(entry.cost || 0) / 100 / Number(entry.requests) : 0,
    })),
    planBreakdown: planBreakdown.map((entry) => ({
      plan: entry.plan || "unknown",
      costEur: Number(entry.cost || 0) / 100,
      creditsUsed: Number(entry.creditsUsed || 0),
      requests: Number(entry.requests),
      avgCostPerRequestEur: Number(entry.requests) > 0 ? Number(entry.cost || 0) / 100 / Number(entry.requests) : 0,
      uniqueUsers: Number(entry.uniqueUsers),
    })),
    organizationBreakdown: organizationBreakdown.map((entry) => ({
      organizationId: entry.organizationId,
      costEur: Number(entry.cost || 0) / 100,
      requests: Number(entry.requests),
      avgCostPerRequestEur: Number(entry.requests) > 0 ? Number(entry.cost || 0) / 100 / Number(entry.requests) : 0,
      uniqueUsers: Number(entry.uniqueUsers),
    })),
    topCustomers: topCustomerProfiles,
    recommendations,
  }
}
