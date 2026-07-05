import { NextResponse } from "next/server"
import { auth } from "@/lib/auth/auth"
import { isSuperAdminUserId } from "@/lib/auth/builtin-users"
import { getAiCostOptimizerSnapshot } from "@/lib/billing/ai-cost-optimizer"

export async function GET(request: Request) {
  const session = await auth()
  const adminUserId = session?.user?.id

  if (!adminUserId || !isSuperAdminUserId(adminUserId)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const fromDate = searchParams.get("fromDate")
  const toDate = searchParams.get("toDate")

  const snapshot = await getAiCostOptimizerSnapshot({ fromDate, toDate })
  return NextResponse.json(snapshot)
}
