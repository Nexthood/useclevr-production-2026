import { getDb } from "@/lib/db"
import { datasets, profiles } from "@/lib/db/schema"
import { eq, count } from "drizzle-orm"
import { getBillingPlanByTier } from "@/lib/billing/plans"

export interface DatasetLimitInfo {
  limit: number
  currentCount: number
  canCreate: boolean
  planName: string
  tier: string
}

export async function getDatasetLimitInfo(userId: string, role?: string | null): Promise<DatasetLimitInfo> {
  const db = getDb()
  const profile = db
    ? await db.query.profiles.findFirst({
        where: eq(profiles.userId, userId),
        columns: { subscriptionTier: true, role: true },
      })
    : null

  const tier = profile?.subscriptionTier || "free"
  const plan = getBillingPlanByTier(tier)
  const limit = plan.limits.maxDatasets

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

  return {
    limit,
    currentCount,
    canCreate: currentCount < limit,
    planName: plan.name,
    tier,
  }
}

export function getDatasetLimitError(limitInfo: DatasetLimitInfo): string | null {
  if (limitInfo.canCreate) return null
  if (limitInfo.limit === Infinity) return null
  return `DATASET_LIMIT_REACHED|Your current plan (${limitInfo.planName}) allows up to ${limitInfo.limit} datasets. You currently have ${limitInfo.currentCount} datasets.`
}
