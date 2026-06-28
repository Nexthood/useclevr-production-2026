import { getDb } from "@/lib/db"
import { datasets } from "@/lib/db/schema"
import { eq, count } from "drizzle-orm"
import { getDatasetLimitForTier, type BillingPlan } from "@/lib/billing/plans"
import { getAnalystCreditUsage } from "@/lib/usage/analyst-credits"

export interface DatasetLimitInfo {
  limit: number
  currentCount: number
  canCreate: boolean
  planName: string
  tier: string
}

export async function getDatasetLimitInfo(userId: string, role?: string | null): Promise<DatasetLimitInfo> {
  const db = getDb()
  const usage = await getAnalystCreditUsage(userId, role)
  const tier = usage.subscriptionTier || "free"
  const limit = usage.unlimited ? Infinity : getDatasetLimitForTier(tier)

  let currentCount = 0
  if (db) {
    try {
      const [{ count: total }] = await db
        .select({ count: count() })
        .from(datasets)
        .where(eq(datasets.userId, userId))
      currentCount = total ?? 0
    } catch {
      currentCount = 0
    }
  }

  const planName = usage.unlimitedLabel || (tier === "business" ? "Business" : tier === "pro" ? "Pro" : "Free")

  return {
    limit,
    currentCount,
    canCreate: limit === Infinity || currentCount < limit,
    planName,
    tier,
  }
}

export function getDatasetLimitError(limitInfo: DatasetLimitInfo): string | null {
  if (limitInfo.canCreate) return null
  if (limitInfo.limit === Infinity) return null
  return `DATASET_LIMIT_REACHED|Your current plan (${limitInfo.planName}) allows up to ${limitInfo.limit} datasets. You currently have ${limitInfo.currentCount} datasets.`
}
