/**
 * Usage Increment API Route
 * 
 * Increments the analysis count for the current user after a successful analysis
 */

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function POST() {
  try {
    const session = await auth()
    
    // For demo mode, just return success without incrementing
    if (!session?.user?.id || session.user.id === "demo-user-id") {
      return Response.json({
        success: true,
        analysisCount: 0,
      })
    }

    // Get user profile
    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, session.user.id),
    })

    if (!profile) {
      return Response.json({
        success: false,
        error: "Profile not found",
      })
    }

    // Check if user is pro
    const isPro = profile.subscriptionTier === "pro"
    
    // Only increment for free users
    if (!isPro) {
      const newCount = (profile.analysisCount || 0) + 1
      
      await db.update(profiles)
        .set({ analysisCount: newCount })
        .where(eq(profiles.userId, session.user.id))

      return Response.json({
        success: true,
        analysisCount: newCount,
        canAnalyze: newCount < 2,
      })
    }

    return Response.json({
      success: true,
      analysisCount: profile.analysisCount || 0,
      canAnalyze: true,
    })
  } catch (error) {
    console.error("[USAGE INCREMENT] Error:", error)
    return Response.json({
      success: false,
      error: "Failed to increment usage",
    })
  }
}
