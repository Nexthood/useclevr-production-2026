import { isSuperAdminUserId } from "@/lib/auth/builtin-users"
import { FREE_PLAN_LIMITS, getDatasetLimitForTier } from "@/lib/billing/plans"
import { getDb } from "@/lib/db"
import { datasets, profiles } from "@/lib/db/schema"
import { debugError } from "@/lib/utils/debug"
import { count, eq } from "drizzle-orm"

export const FREE_ANALYST_CREDITS = FREE_PLAN_LIMITS.maxDatasets
export const TRIAL_DAYS = 14

export const ROW_LIMITS = {
  FREE: 5_000,
  PRO: 100_000,
  BUSINESS: 300_000,
  ADMIN: 500_000,
  SUPERADMIN: Infinity,
} as const

export type AnalystCreditUsage = {
  analysisCount: number
  total: number
  subscriptionTier: string
  canAnalyze: boolean
  limitReached: boolean
  unlimited: boolean
  unlimitedLabel: string | null
  trialActive: boolean
  trialEndsAt: string | null
  trialDaysRemaining: number
  datasetCount: number
}

const defaultUsage: AnalystCreditUsage = {
  analysisCount: 0,
  total: FREE_ANALYST_CREDITS,
  subscriptionTier: "free",
  canAnalyze: true,
  limitReached: false,
  unlimited: false,
  unlimitedLabel: null,
  trialActive: false,
  trialEndsAt: null,
  trialDaysRemaining: 0,
  datasetCount: 0,
}

function getTrialStatus(createdAt: Date | null | undefined, subscriptionTier: string) {
  if (!createdAt || subscriptionTier !== "free") {
    return { trialActive: false, trialEndsAt: null, trialDaysRemaining: 0 }
  }

  const trialEndsAt = new Date(createdAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
  const remainingMs = trialEndsAt.getTime() - Date.now()
  const trialActive = remainingMs > 0

  return {
    trialActive,
    trialEndsAt: trialEndsAt.toISOString(),
    trialDaysRemaining: trialActive ? Math.ceil(remainingMs / (24 * 60 * 60 * 1000)) : 0,
  }
}

function isAdminAccess(value?: string | null) {
  return value === "admin"
}

function getUnlimitedLabel(tier: string, role?: string | null, userId?: string | null) {
  if (isSuperAdminUserId(userId)) {
    return "Superadmin unlimited"
  }

  if (tier === "admin" || role === "admin") {
    return "Admin unlimited"
  }

  if (tier === "pro" || tier === "business") {
    return "Unlimited"
  }

  return null
}

export async function getAnalystCreditUsage(userId?: string | null, role?: string | null): Promise<AnalystCreditUsage> {
  if (isSuperAdminUserId(userId)) {
    return {
      analysisCount: 0,
      total: 0,
      subscriptionTier: "superadmin",
      canAnalyze: true,
      limitReached: false,
      unlimited: true,
      unlimitedLabel: getUnlimitedLabel("superadmin", role, userId),
      trialActive: false,
      trialEndsAt: null,
      trialDaysRemaining: 0,
      datasetCount: 0,
    }
  }

  if (userId && isAdminAccess(role)) {
    const subscriptionTier = role || "admin"
    return {
      analysisCount: 0,
      total: 0,
      subscriptionTier,
      canAnalyze: true,
      limitReached: false,
      unlimited: true,
      unlimitedLabel: getUnlimitedLabel(subscriptionTier, role, userId),
      trialActive: false,
      trialEndsAt: null,
      trialDaysRemaining: 0,
      datasetCount: 0,
    }
  }

  if (!userId) {
    return defaultUsage
  }

  const db = getDb()
  if (!db) {
    return defaultUsage
  }

  try {
    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, userId),
      columns: {
        analysisCount: true,
        createdAt: true,
        role: true,
        subscriptionTier: true,
      },
    })

    const profileRole = role || profile?.role || null
    const storedTier = profile?.subscriptionTier || "free"
    const adminAccess = isAdminAccess(storedTier) || isAdminAccess(profileRole)
    const subscriptionTier = adminAccess && storedTier === "free" ? profileRole || storedTier : storedTier
    const isPaid = subscriptionTier === "pro" || subscriptionTier === "business"
    const trial = getTrialStatus(profile?.createdAt, subscriptionTier)
    const hasUnlimitedAccess = isPaid || adminAccess
    const unlimitedLabel = hasUnlimitedAccess ? getUnlimitedLabel(subscriptionTier, profileRole, userId) : null
    const [{ count: datasetTotal }] = await db
      .select({ count: count() })
      .from(datasets)
      .where(eq(datasets.userId, userId))
    const datasetCount = Number(datasetTotal ?? 0)
    const limitedDatasetTotal = getDatasetLimitForTier(subscriptionTier)
    const usageTotal = hasUnlimitedAccess ? 0 : limitedDatasetTotal
    const analysisCount = hasUnlimitedAccess ? 0 : Math.min(datasetCount, usageTotal)

    return {
      analysisCount,
      total: usageTotal,
      subscriptionTier,
      canAnalyze: hasUnlimitedAccess || datasetCount < limitedDatasetTotal,
      limitReached: !hasUnlimitedAccess && datasetCount >= limitedDatasetTotal,
      unlimited: hasUnlimitedAccess,
      unlimitedLabel,
      datasetCount,
      ...trial,
    }
  } catch (error) {
    debugError("[USAGE] Failed to load analyst credits:", error)
    return defaultUsage
  }
}

export async function consumeAnalystCredit(userId?: string | null, role?: string | null): Promise<AnalystCreditUsage> {
  if (!userId || isSuperAdminUserId(userId)) {
    return getAnalystCreditUsage(userId, role)
  }

  const db = getDb()
  if (!db) {
    return defaultUsage
  }

  const usage = await getAnalystCreditUsage(userId, role)
  if (usage.unlimited || ["pro", "business", "superadmin", "admin"].includes(usage.subscriptionTier)) {
    return usage
  }

  const analysisCount = Math.min(usage.analysisCount + 1, FREE_ANALYST_CREDITS)

  try {
    await db.update(profiles)
      .set({
        analysisCount,
        updatedAt: new Date(),
      })
      .where(eq(profiles.userId, userId))

    return {
      ...usage,
      analysisCount,
      canAnalyze: analysisCount < FREE_ANALYST_CREDITS,
      limitReached: analysisCount >= FREE_ANALYST_CREDITS,
      unlimited: false,
      unlimitedLabel: null,
    }
  } catch (error) {
    debugError("[USAGE] Failed to consume analyst credit:", error)
    return usage
  }
}

export async function requireAnalystCredit(userId?: string | null, role?: string | null): Promise<AnalystCreditUsage> {
  return getAnalystCreditUsage(userId, role)
}

export async function getRowLimitForUser(userId?: string | null, role?: string | null): Promise<number> {
  if (isSuperAdminUserId(userId)) {
    return ROW_LIMITS.SUPERADMIN
  }

  if (userId && role === "admin") {
    return ROW_LIMITS.ADMIN
  }

  if (!userId) {
    return ROW_LIMITS.FREE
  }

  const db = getDb()
  if (!db) {
    return ROW_LIMITS.FREE
  }

  try {
    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, userId),
      columns: {
        subscriptionTier: true,
        role: true,
      },
    })

    const tier = profile?.subscriptionTier || "free"
    const profileRole = profile?.role || null
    const isAdmin = profileRole === "admin"

    if (tier === "superadmin") return ROW_LIMITS.SUPERADMIN
    if (isAdmin || tier === "admin") return ROW_LIMITS.ADMIN
    if (tier === "business") return ROW_LIMITS.BUSINESS
    if (tier === "pro") return ROW_LIMITS.PRO
    return ROW_LIMITS.FREE
  } catch {
    return ROW_LIMITS.FREE
  }
}

export function formatRowLimitError(rowCount: number, limit: number, planName: string): string {
  if (limit === Infinity) {
    return `ROW_LIMIT_EXCEEDED|Your dataset has ${rowCount.toLocaleString()} rows which exceeds the maximum supported rows.`
  }
  return `ROW_LIMIT_EXCEEDED|Your ${planName} plan allows up to ${limit.toLocaleString()} rows per file. Your file has ${rowCount.toLocaleString()} rows. Upgrade to a higher plan to handle larger datasets.`
}
