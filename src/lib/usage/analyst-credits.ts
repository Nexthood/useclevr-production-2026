import { isBuiltinUserId, isSuperAdminUserId } from "@/lib/auth/builtin-users"
import { getDb } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import { debugError } from "@/lib/utils/debug"
import { eq } from "drizzle-orm"

export const FREE_ANALYST_CREDITS = 2
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
  return value === "superadmin" || value === "admin"
}

function getUnlimitedLabel(tier: string, role?: string | null, userId?: string | null) {
  if (isSuperAdminUserId(userId) || tier === "superadmin" || role === "superadmin") {
    return "Superadmin unlimited"
  }

  if (tier === "admin" || role === "admin") {
    return "Admin unlimited"
  }

  if (tier === "pro" || tier === "business" || tier === "builtin") {
    return "Unlimited"
  }

  return null
}

export async function getAnalystCreditUsage(userId?: string | null, role?: string | null): Promise<AnalystCreditUsage> {
  if (isBuiltinUserId(userId)) {
    const subscriptionTier = isSuperAdminUserId(userId) ? "superadmin" : "builtin"
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
    }
  }

  if (!userId || isBuiltinUserId(userId)) {
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

    const analysisCount = Math.min(profile?.analysisCount || 0, FREE_ANALYST_CREDITS)
    const profileRole = role || profile?.role || null
    const storedTier = profile?.subscriptionTier || "free"
    const adminAccess = isAdminAccess(storedTier) || isAdminAccess(profileRole)
    const subscriptionTier = adminAccess && storedTier === "free" ? profileRole || storedTier : storedTier
    const isPaid = subscriptionTier === "pro" || subscriptionTier === "business"
    const trial = getTrialStatus(profile?.createdAt, subscriptionTier)
    const hasUnlimitedAccess = isPaid || adminAccess
    const unlimitedLabel = hasUnlimitedAccess ? getUnlimitedLabel(subscriptionTier, profileRole, userId) : null

    return {
      analysisCount,
      total: hasUnlimitedAccess ? 0 : FREE_ANALYST_CREDITS,
      subscriptionTier,
      canAnalyze: hasUnlimitedAccess || analysisCount < FREE_ANALYST_CREDITS,
      limitReached: !hasUnlimitedAccess && analysisCount >= FREE_ANALYST_CREDITS,
      unlimited: hasUnlimitedAccess,
      unlimitedLabel,
      ...trial,
    }
  } catch (error) {
    debugError("[USAGE] Failed to load analyst credits:", error)
    return defaultUsage
  }
}

export async function consumeAnalystCredit(userId?: string | null, role?: string | null): Promise<AnalystCreditUsage> {
  if (!userId || isBuiltinUserId(userId)) {
    return getAnalystCreditUsage(userId, role)
  }

  const db = getDb()
  if (!db) {
    return defaultUsage
  }

  const usage = await getAnalystCreditUsage(userId, role)
  if (usage.unlimited || ["pro", "business", "superadmin", "admin", "builtin"].includes(usage.subscriptionTier)) {
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
  if (isBuiltinUserId(userId)) {
    return isSuperAdminUserId(userId) ? ROW_LIMITS.SUPERADMIN : ROW_LIMITS.ADMIN
  }

  if (userId && (role === "superadmin" || role === "admin")) {
    return role === "superadmin" ? ROW_LIMITS.SUPERADMIN : ROW_LIMITS.ADMIN
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
    const isAdmin = profileRole === "superadmin" || profileRole === "admin"

    if (isAdmin || tier === "superadmin") return ROW_LIMITS.SUPERADMIN
    if (tier === "admin" || profileRole === "admin") return ROW_LIMITS.ADMIN
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
