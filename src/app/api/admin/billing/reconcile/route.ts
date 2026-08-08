import { auth } from "@/lib/auth/auth"
import { isSuperAdminUserId } from "@/lib/auth/builtin-users"
import { getCreditAccount, reconcileAccount } from "@/lib/billing/credit-account-service"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId || !isSuperAdminUserId(userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const targetUserId = searchParams.get("userId")

  if (!targetUserId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 })
  }

  try {
    const account = await getCreditAccount(targetUserId)
    const reconciliation = await reconcileAccount(targetUserId)

    return NextResponse.json({
      account,
      reconciliation,
    })
  } catch (error) {
    console.error("[ADMIN_RECONCILE] Error:", error)
    return NextResponse.json({ error: "Failed to reconcile account" }, { status: 500 })
  }
}
