import { NextResponse } from "next/server"
import { auth } from "@/lib/auth/auth"
import { isSuperAdminUserId, isOfficialSuperAdminEmail } from "@/lib/auth/builtin-users"
import { adjustCredits, getUserCreditInfo, getCreditLedger, initializeUserCredits } from "@/lib/billing/credit-engine"
import { getUserCostAnalytics } from "@/lib/billing/usage-enforcement"
import { getDb } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

function checkSuperAdmin(sessionUserId?: string | null, sessionEmail?: string | null): boolean {
  const hasSuperAdminRole = sessionUserId && isSuperAdminUserId(sessionUserId)
  const isOfficialSuperAdmin = isOfficialSuperAdminEmail(sessionEmail ?? undefined)
  return hasSuperAdminRole || isOfficialSuperAdmin
}

export async function GET(request: Request) {
  const session = await auth()
  const userId = session?.user?.id
  const userEmail = session?.user?.email

  if (!userId || !checkSuperAdmin(userId, userEmail)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const targetUserId = searchParams.get("userId")
  const action = searchParams.get("action")

  if (action === "ledger" && targetUserId) {
    const ledger = await getCreditLedger(targetUserId, 50, 0)
    return NextResponse.json({ ledger })
  }

  if (action === "analytics" && targetUserId) {
    const analytics = await getUserCostAnalytics(targetUserId)
    return NextResponse.json({ analytics })
  }

  if (targetUserId) {
    const creditInfo = await getUserCreditInfo(targetUserId)
    const db = getDb()
    let profile = null
    if (db) {
      profile = await db.query.profiles.findFirst({
        where: eq(profiles.userId, targetUserId),
      })
    }
    return NextResponse.json({ creditInfo, profile })
  }

  return NextResponse.json({ error: "Missing userId parameter" }, { status: 400 })
}

export async function POST(request: Request) {
  const session = await auth()
  const adminUserId = session?.user?.id
  const adminEmail = session?.user?.email

  if (!adminUserId || !checkSuperAdmin(adminUserId, adminEmail)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { userId, action, amount, reason } = body

    if (!userId || !action) {
      return NextResponse.json({ error: "Missing required fields: userId, action" }, { status: 400 })
    }

    if (action === "adjust") {
      if (!amount || !reason) {
        return NextResponse.json({ error: "Missing required fields: amount, reason" }, { status: 400 })
      }

      const success = await adjustCredits(userId, amount, reason, adminUserId)
      if (!success) {
        return NextResponse.json({ error: "Failed to adjust credits" }, { status: 500 })
      }

      const creditInfo = await getUserCreditInfo(userId)
      return NextResponse.json({ success: true, creditInfo })
    }

    if (action === "initialize") {
      const db = getDb()
      if (!db) {
        return NextResponse.json({ error: "Database unavailable" }, { status: 503 })
      }

      const profile = await db.query.profiles.findFirst({
        where: eq(profiles.userId, userId),
      })
      const tier = profile?.subscriptionTier || "free"

      const creditInfo = await initializeUserCredits(userId, tier)
      return NextResponse.json({ success: true, creditInfo })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("[ADMIN_CREDITS] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
