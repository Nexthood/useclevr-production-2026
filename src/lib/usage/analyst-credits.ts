import { isBuiltinUserId, isSuperAdminUserId } from "@/lib/auth/builtin-users"
import { getDb } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import { debugError } from "@/lib/utils/debug"
import { eq } from "drizzle-orm"

export const FREE_ANALYST_CREDITS = 2
export const TRIAL_DAYS = 14

export type AnalystCreditUsage = {
  analysisCount: number
  total: number
  subscriptionTier: string
  canAnalyze: boolean
  limitReached: boolean
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

export async function getAnalystCreditUsage(userId?: string | null): Promise<AnalystCreditUsage> {
  if (isBuiltinUserId(userId)) {
    return {
      analysisCount: 0,
      total: 0,
      subscriptionTier: isSuperAdminUserId(userId) ? "superadmin" : "builtin",
      canAnalyze: true,
      limitReached: false,
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
        subscriptionTier: true,
      },
    })

    const analysisCount = Math.min(profile?.analysisCount || 0, FREE_ANALYST_CREDITS)
    const subscriptionTier = profile?.subscriptionTier || "free"
    const isPaid = subscriptionTier === "pro" || subscriptionTier === "business"
    const trial = getTrialStatus(profile?.createdAt, subscriptionTier)
    const hasUnlimitedAccess = isPaid || trial.trialActive

    return {
      analysisCount,
      total: FREE_ANALYST_CREDITS,
      subscriptionTier,
      canAnalyze: hasUnlimitedAccess || analysisCount < FREE_ANALYST_CREDITS,
      limitReached: !hasUnlimitedAccess && analysisCount >= FREE_ANALYST_CREDITS,
      ...trial,
    }
  } catch (error) {
    debugError("[USAGE] Failed to load analyst credits:", error)
    return defaultUsage
  }
}

export async function consumeAnalystCredit(userId?: string | null): Promise<AnalystCreditUsage> {
  if (!userId || isBuiltinUserId(userId)) {
    return getAnalystCreditUsage(userId)
  }

  const db = getDb()
  if (!db) {
    return defaultUsage
  }

  const usage = await getAnalystCreditUsage(userId)
  if (usage.trialActive || ["pro", "business", "superadmin"].includes(usage.subscriptionTier)) {
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
    }
  } catch (error) {
    debugError("[USAGE] Failed to consume analyst credit:", error)
    return usage
  }
}

export async function requireAnalystCredit(userId?: string | null): Promise<AnalystCreditUsage> {
  return getAnalystCreditUsage(userId)
}
