import { debugError } from "@/lib/debug"

/**
 * Usage API Route
 * 
 * Returns current user's usage counts and subscription status
 */

import { auth } from "@/lib/auth"
import { getAnalystCreditUsage } from "@/lib/usage/analyst-credits"

// This route is dynamic (uses auth/db); prevent static optimization
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth()
    
    return Response.json(await getAnalystCreditUsage(session?.user?.id))
  } catch (error) {
    debugError("[USAGE] Error fetching usage:", error)
    return Response.json({
      analysisCount: 0,
      total: 2,
      subscriptionTier: "free",
      canAnalyze: true,
      limitReached: false,
    })
  }
}
