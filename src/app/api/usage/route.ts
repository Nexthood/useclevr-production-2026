import { debugError } from "@/lib/utils/debug";

/**
 * Usage API Route
 * 
 * Returns current user's usage counts and subscription status
 */

import { auth } from "@/lib/auth/auth";
import { getAnalystCreditUsage } from "@/lib/usage/analyst-credits";

// This route is dynamic (uses auth/db); prevent static optimization
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    return Response.json(await getAnalystCreditUsage(session.user.id))
  } catch (error) {
    debugError("[USAGE] Error fetching usage:", error)
    return Response.json({ error: "Failed to fetch usage" }, { status: 500 })
  }
}
