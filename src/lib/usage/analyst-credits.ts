import { debugError } from "@/lib/debug"
import { getDb } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

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
  if (!userId || userId === "demo-user-id") {
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
        subscriptionTier: true,
      },
    })

    const analysisCount = profile?.analysisCount || 0
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
  if (!userId || userId === "demo-user-id") {
    return defaultUsage
  }

  const db = getDb()
  if (!db) {
    return defaultUsage
  }

  const current = await getAnalystCreditUsage(userId)
  if (current.subscriptionTier === "pro") {
    return current
  }

  const nextCount = Math.min(current.analysisCount + 1, FREE_ANALYST_CREDITS)

  try {
    await db.update(profiles)
      .set({
        analysisCount: nextCount,
        updatedAt: new Date(),
      })
      .where(eq(profiles.userId, userId))

    return {
      ...current,
      analysisCount: nextCount,
      canAnalyze: nextCount < FREE_ANALYST_CREDITS,
      limitReached: nextCount >= FREE_ANALYST_CREDITS,
    }
  } catch (error) {
    debugError("[USAGE] Failed to consume analyst credit:", error)
    return current
  }
}
