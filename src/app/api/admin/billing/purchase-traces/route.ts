import { auth } from "@/lib/auth/auth"
import { isSuperAdminUserId } from "@/lib/auth/builtin-users"
import { getPurchaseTraces } from "@/lib/billing/credit-account-service"
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
    const traces = await getPurchaseTraces(targetUserId)
    return NextResponse.json({ traces })
  } catch (error) {
    console.error("[ADMIN_PURCHASE_TRACES] Error:", error)
    return NextResponse.json({ error: "Failed to fetch purchase traces" }, { status: 500 })
  }
}
