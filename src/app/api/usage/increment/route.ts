import { debugError } from "@/lib/debug"

/**
 * Usage Increment API Route
 * 
 * Increments the analysis count for the current user after a successful analysis
 */

import { auth } from "@/lib/auth"
import { consumeAnalystCredit } from "@/lib/usage/analyst-credits"

export async function POST() {
  try {
    const session = await auth()
    
    return Response.json({
      success: true,
      ...(await consumeAnalystCredit(session?.user?.id)),
    })
  } catch (error) {
    debugError("[USAGE INCREMENT] Error:", error)
    return Response.json({
      success: false,
      error: "Failed to increment usage",
    })
  }
}
