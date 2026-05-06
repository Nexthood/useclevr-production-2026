import { debugError } from "@/lib/debug"
import { getDb } from "@/lib/db"
import { datasets, profiles } from "@/lib/db/schema"
import { count, eq } from "drizzle-orm"
import { isBuiltinUserId, isSuperAdminUserId } from "@/lib/auth/builtin-users"

export const FREE_ANALYST_CREDITS = 2

export type AnalystCreditUsage = {
  analysisCount: number
  total: number
  subscriptionTier: string
  canAnalyze: boolean
  limitReached: boolean
}

const defaultUsage: AnalystCreditUsage = {
  analysisCount: 0,
  total: FREE_ANALYST_CREDITS,
  subscriptionTier: "free",
  canAnalyze: true,
  limitReached: false,
}

export async function getAnalystCreditUsage(userId?: string | null): Promise<AnalystCreditUsage> {
  if (isSuperAdminUserId(userId)) {
    return {
      analysisCount: 0,
      total: 0,
      subscriptionTier: "superadmin",
      canAnalyze: true,
      limitReached: false,
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
    const [profile, datasetCountResult] = await Promise.all([
      db.query.profiles.findFirst({
        where: eq(profiles.userId, userId),
        columns: {
          subscriptionTier: true,
        },
      }),
      db
        .select({ value: count() })
        .from(datasets)
        .where(eq(datasets.userId, userId)),
    ])

    const datasetCount = datasetCountResult[0]?.value || 0
    const analysisCount = Math.min(datasetCount, FREE_ANALYST_CREDITS)
    const subscriptionTier = profile?.subscriptionTier || "free"
    const isPro = subscriptionTier === "pro"

    return {
      analysisCount,
      total: FREE_ANALYST_CREDITS,
      subscriptionTier,
      canAnalyze: isPro || analysisCount < FREE_ANALYST_CREDITS,
      limitReached: !isPro && analysisCount >= FREE_ANALYST_CREDITS,
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

  try {
    await db.update(profiles)
      .set({
        analysisCount: usage.analysisCount,
        updatedAt: new Date(),
      })
      .where(eq(profiles.userId, userId))

    return usage
  } catch (error) {
    debugError("[USAGE] Failed to consume analyst credit:", error)
    return usage
  }
}

export async function requireAnalystCredit(userId?: string | null): Promise<AnalystCreditUsage> {
  const usage = await getAnalystCreditUsage(userId)
  return usage
}
