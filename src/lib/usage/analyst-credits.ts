import { isSuperAdminUserId, isSuperadmin } from "@/lib/auth/builtin-users"
import { getUserCreditInfo, initializeUserCredits, isUnlimitedCreditRole } from "@/lib/billing/credit-engine"
import { FREE_PLAN_LIMITS, getCreditsLimitForTier } from "@/lib/billing/plans"
import { getDb } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import { debugError } from "@/lib/utils/debug"
import { eq } from "drizzle-orm"
import { getActiveDatasetCount } from "./dataset-limits"

export const FREE_ANALYST_CREDITS = FREE_PLAN_LIMITS.monthlyCredits
export const TRIAL_DAYS = 14

export const ROW_LIMITS = {
  FREE: 5_000,
  PRO: 100_000,
  BUSINESS: 300_000,
  ADMIN: 500_000,
  SUPERADMIN: Infinity,
} as const

export type AnalystCreditUsage = {
  analysisCount: number | null
  total: number | null
  includedBalance: number | null
  purchasedBalance: number | null
  availableCredits: number | null
  reservedCredits: number | null
  usedCredits: number | null
  remainingCredits: number | null
  nextResetAt: string | null
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
  includedBalance: FREE_ANALYST_CREDITS,
  purchasedBalance: 0,
  availableCredits: FREE_ANALYST_CREDITS,
  reservedCredits: 0,
  usedCredits: 0,
  remainingCredits: FREE_ANALYST_CREDITS,
  nextResetAt: null,
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

function getUnlimitedLabel(tier: string, role?: string | null, userId?: string | null, email?: string | null) {
  if (isSuperadmin({ id: userId, role, email })) {
    return "Superadmin unlimited"
  }

  if (tier === "superadmin" || role === "superadmin") {
    return "Superadmin unlimited"
  }

  if (tier === "admin" || role === "admin") {
    return "Admin unlimited"
  }

  return "Unlimited"
}

function unlimitedUsage(
  userId: string | null | undefined,
  role: string | null | undefined,
  labelRole = role,
  datasetCount = 0,
  email?: string | null,
): AnalystCreditUsage {
  const subscriptionTier = labelRole === "admin" ? "admin" : "superadmin"
  return {
    analysisCount: null,
    total: null,
    includedBalance: null,
    purchasedBalance: null,
    availableCredits: null,
    reservedCredits: null,
    usedCredits: null,
    remainingCredits: null,
    nextResetAt: null,
    subscriptionTier,
    canAnalyze: true,
    limitReached: false,
    unlimited: true,
    unlimitedLabel: getUnlimitedLabel(subscriptionTier, labelRole, userId, email),
    trialActive: false,
    trialEndsAt: null,
    trialDaysRemaining: 0,
    datasetCount,
  }
}

export async function getAnalystCreditUsage(
  userId?: string | null,
  role?: string | null,
  email?: string | null
): Promise<AnalystCreditUsage> {
  if (userId && (isSuperadmin({ id: userId, role, email }) || isUnlimitedCreditRole(role))) {
    return unlimitedUsage(userId, role || "superadmin", role || "superadmin", 0, email)
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
          email: true,
          role: true,
          subscriptionTier: true,
        },
      })

      let profileTier = profile?.subscriptionTier || "free"
      let profileRole = profile?.role || null
      const profileEmail = profile?.email || null
      const hasUnlimitedAccess =
        isSuperadmin({ id: userId, role: profileRole, email: email || profileEmail }) ||
        isUnlimitedCreditRole(profileRole) ||
        isUnlimitedCreditRole(profileTier)
      let subscriptionTier = hasUnlimitedAccess
        ? profileRole === "admin" ? "admin" : "superadmin"
        : profileTier
      // Heal a missed Stripe downgrade before any credit allocation runs: a
      // paid tier whose stored Stripe period end has passed is reconciled
      // against authoritative Stripe state (downgrade or renewal) first.
      if (!hasUnlimitedAccess && (profileTier === "pro" || profileTier === "business")) {
        const { reconcileExpiredSubscriptionPeriod } = await import(
          "@/lib/billing/subscription-period-sync"
        )
        await reconcileExpiredSubscriptionPeriod(userId)
        // Reconciliation applies the authoritative Stripe tier (downgrade or
        // renewal) — re-read the profile so credits resolve against the live tier.
        const refreshedProfile = await db.query.profiles.findFirst({
          where: eq(profiles.userId, userId),
          columns: { subscriptionTier: true, role: true },
        })
        if (refreshedProfile) {
          profileTier = refreshedProfile.subscriptionTier || "free"
          if (!profileRole) profileRole = refreshedProfile.role || null
        }
        subscriptionTier = profileTier
      }
      const trial = getTrialStatus(profile?.createdAt, subscriptionTier)
      const unlimitedLabel = hasUnlimitedAccess ? getUnlimitedLabel(subscriptionTier, profileRole, userId, email || profileEmail) : null
      const datasetCount = await getActiveDatasetCount(userId)
      if (hasUnlimitedAccess) {
        return unlimitedUsage(userId, profileRole || subscriptionTier, subscriptionTier, datasetCount, email || profileEmail)
      }
      // initializeUserCredits reconciles plan drift against the authoritative
      // credit engine, including preserving purchased balances.
      const creditInfo = await initializeUserCredits(userId, subscriptionTier) || await getUserCreditInfo(userId)
      if (!creditInfo) {
        debugError(
          "[USAGE] Analyst credit account state unavailable - reporting plan-limit fallback until initialization succeeds",
          userId,
          subscriptionTier,
        )
      }
      const usageTotal = creditInfo?.totalCredits ?? getCreditsLimitForTier(subscriptionTier)
      const usedCredits = creditInfo?.usedCredits ?? 0
      const reservedCredits = creditInfo?.reservedCredits ?? 0
      const remainingCredits = creditInfo?.remainingCredits ?? Math.max(0, usageTotal - usedCredits)
      const availableCredits = Math.max(0, creditInfo?.availableCredits ?? remainingCredits - reservedCredits)

      return {
        analysisCount: usedCredits,
        total: usageTotal,
        includedBalance: creditInfo?.includedBalance ?? 0,
        purchasedBalance: creditInfo?.purchasedBalance ?? 0,
        availableCredits,
        reservedCredits,
        usedCredits,
        remainingCredits,
        nextResetAt: creditInfo?.creditsResetAt?.toISOString() ?? null,
        subscriptionTier,
        canAnalyze: availableCredits > 0,
        limitReached: availableCredits <= 0,
        unlimited: false,
        unlimitedLabel,
        datasetCount,
        ...trial,
      }
    } catch (error) {
      debugError("[USAGE] Failed to load analyst credits:", error)
      return defaultUsage
    }
}

export async function requireAnalystCredit(userId?: string | null, role?: string | null, email?: string | null): Promise<AnalystCreditUsage> {
  return getAnalystCreditUsage(userId, role, email)
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
