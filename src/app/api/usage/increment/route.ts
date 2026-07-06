import { debugError } from "@/lib/utils/debug"

/**
 * Usage Increment API Route
 * 
 * Increments the analysis count for the current user after a successful analysis
 */

import { auth } from "@/lib/auth/auth"
import { consumeAnalystCredit } from "@/lib/usage/analyst-credits"

export async function POST() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    return Response.json({
      success: true,
      ...(await consumeAnalystCredit(session.user.id, session.user.role, session.user.email ?? null)),
    })
  } catch (error) {
    debugError("[USAGE INCREMENT] Error:", error)
    return Response.json({
      success: false,
      error: "Failed to increment usage",
    }, { status: 500 })
  }
}
