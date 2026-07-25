import { auth } from "@/lib/auth/auth"
import { getHybridAiFeatureAccess } from "@/lib/hybrid-ai/feature-gate"
import { NextResponse } from "next/server"

export type HybridAiTier = "lite" | "mega"

export async function requireHybridAiDownloadAccess(tier: HybridAiTier = "lite") {
  const session = await auth()
  if (!session?.user?.id) {
    return {
      success: false as const,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  const access = await getHybridAiFeatureAccess(session.user.id, session.user.role, session.user.email)
  const allowed = tier === "mega" ? access.canUseMega : access.canUseLite

  if (!allowed) {
    return {
      success: false as const,
      error: NextResponse.json(
        {
          error: "Upgrade required",
          message: tier === "mega" ? "Hybrid AI MEGA requires Business access." : "Hybrid AI Lite requires Pro or Business access.",
        },
        { status: 403 },
      ),
    }
  }

  return { success: true as const, session, subscriptionTier: access.subscriptionTier }
}
