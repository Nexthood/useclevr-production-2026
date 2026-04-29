import { debugLog, debugError, debugWarn } from "@/lib/debug"

/**
 * Usage API Route
 * 
 * Returns current user's usage counts and subscription status
 */

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

// This route is dynamic (uses auth/db); prevent static optimization
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth()
    
    // For demo mode, return default values
    if (!session?.user?.id || session.user.id === "demo-user-id") {
      return Response.json({
        analysisCount: 0,
        subscriptionTier: "free",
        canAnalyze: true,
      })
    }

    // Get user profile
    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, session.user.id),
    })

    if (!profile) {
      return Response.json({
        analysisCount: 0,
        subscriptionTier: "free",
        canAnalyze: true,
      })
    }

    const isPro = profile.subscriptionTier === "pro"
    const canAnalyze = isPro || (profile.analysisCount || 0) < 2

    return Response.json({
      analysisCount: profile.analysisCount || 0,
      subscriptionTier: profile.subscriptionTier || "free",
      canAnalyze,
    })
  } catch (error) {
    debugError("[USAGE] Error fetching usage:", error)
    return Response.json({
      analysisCount: 0,
      subscriptionTier: "free",
      canAnalyze: true,
    })
  }
}
