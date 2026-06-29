import { auth } from "@/lib/auth/auth"
import { getDb } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
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

  const sessionRole: string = session.user.role ?? "user"

  if (sessionRole === "superadmin") {
    return { success: true as const, session, subscriptionTier: "admin" }
  }

  const db = getDb()
  const profile = db
    ? await db.query.profiles.findFirst({
        where: eq(profiles.userId, session.user.id),
        columns: { subscriptionTier: true, role: true },
      })
    : null

  const subscriptionTier = profile?.subscriptionTier || "free"
  const profileRole = profile?.role || sessionRole
  const isAdmin = profileRole === "superadmin" || profileRole === "admin"
  const hasLite = isAdmin || subscriptionTier === "pro" || subscriptionTier === "business"
  const hasMega = isAdmin || subscriptionTier === "business"
  const allowed = tier === "mega" ? hasMega : hasLite

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

  return { success: true as const, session, subscriptionTier }
}
