import { getDb } from "@/lib/db"
import { datasets, profiles } from "@/lib/db/schema"
import { and, eq, count, isNull, ne, or } from "drizzle-orm"
import { getBillingPlanByTier } from "@/lib/billing/plans"
import { isSuperAdminUserId } from "@/lib/auth/builtin-users"
import { isUnlimitedCreditRole } from "@/lib/billing/credit-engine"

/**
 * Canonical dataset count — authoritative definition for plan enforcement,
 * billing display, and usage counters.
 *
 * Matches the Dataset Library query exactly:
 *   userId = ? AND (datasetType IS NULL OR datasetType != 'prebookkeeping')
 *
 * Only durable user/workspace datasets that appear in the Dataset Library
 * count against the plan. Prebookkeeping uploads are processing artifacts
 * that feed into combined analyses; they must not independently consume
 * dataset slots.
 */
export async function getActiveDatasetCount(userId: string): Promise<number> {
  const db = getDb()
  if (!db) return 0

  try {
    const [{ count: total }] = await db
      .select({ count: count() })
      .from(datasets)
      .where(or(isNull(datasets.datasetType), ne(datasets.datasetType, "prebookkeeping")))
    return Number(total ?? 0)
  } catch {
    return 0
  }
}

export interface DatasetLimitInfo {
  limit: number
  currentCount: number
  canCreate: boolean
  planName: string
  tier: string
}

export async function getDatasetLimitInfo(userId: string, role?: string | null, _email?: string | null, datasetType?: string | null): Promise<DatasetLimitInfo> {
  const isSuperadmin = isSuperAdminUserId(userId) || isUnlimitedCreditRole(role)

  if (isSuperadmin) {
    return {
      limit: Infinity,
      currentCount: 0,
      canCreate: true,
      planName: "Superadmin",
      tier: "superadmin",
    }
  }

  const db = getDb()
  const profile = db
    ? await db.query.profiles.findFirst({
        where: eq(profiles.userId, userId),
        columns: { subscriptionTier: true, role: true },
      })
    : null

  const isAdmin = isUnlimitedCreditRole(profile?.role) || isUnlimitedCreditRole(profile?.subscriptionTier)
  if (isAdmin) {
    return {
      limit: Infinity,
      currentCount: 0,
      canCreate: true,
      planName: profile?.role === "admin" || profile?.subscriptionTier === "admin" ? "Admin" : "Superadmin",
      tier: profile?.role === "admin" || profile?.subscriptionTier === "admin" ? "admin" : "superadmin",
    }
  }

  const tier = profile?.subscriptionTier || "free"
  const plan = getBillingPlanByTier(tier)
  const limit = plan.limits.maxDatasets

  // Use canonical active dataset count for plan enforcement
  const currentCount = await getActiveDatasetCount(userId)

  return {
    limit,
    currentCount,
    canCreate: currentCount < limit,
    planName: plan.name,
    tier,
  }
}

export function getDatasetLimitError(limitInfo: DatasetLimitInfo, itemLabel = "datasets"): string | null {
  if (limitInfo.canCreate) return null
  if (limitInfo.limit === Infinity) return null
  return `DATASET_LIMIT_REACHED|Your current plan (${limitInfo.planName}) allows up to ${limitInfo.limit} ${itemLabel}. You currently have ${limitInfo.currentCount} ${itemLabel}.`
}

export async function getPrebookkeepingLimitInfo(userId: string, role?: string | null, email?: string | null): Promise<DatasetLimitInfo> {
  return getDatasetLimitInfo(userId, role, email, "prebookkeeping")
}

export function getPrebookkeepingLimitError(limitInfo: DatasetLimitInfo): string | null {
  return getDatasetLimitError(limitInfo, "pre-bookkeeping uploads")
}

export async function getAccountancyLimitInfo(userId: string, role?: string | null, email?: string | null): Promise<DatasetLimitInfo> {
  const info = await getDatasetLimitInfo(userId, role, email, "accountancy")
  if (info.limit === Infinity) return info
  // Free plan gets a hard cap of 2 Accountancy datasets; Pro/Business use their plan maxDatasets
  const tier = info.tier || "free"
  const baseLimit = tier === "free" ? 2 : info.limit
  return {
    ...info,
    limit: baseLimit,
    canCreate: info.currentCount < baseLimit,
  }
}

export function getAccountancyLimitError(limitInfo: DatasetLimitInfo): string | null {
  return getDatasetLimitError(limitInfo, "accountancy datasets")
}
