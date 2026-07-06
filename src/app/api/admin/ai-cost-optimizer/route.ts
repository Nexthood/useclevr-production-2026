import { NextResponse } from "next/server"
import { auth } from "@/lib/auth/auth"
import { isSuperAdminUserId, isOfficialSuperAdminEmail } from "@/lib/auth/builtin-users"
import { getAiCostOptimizerSnapshot, getProviderConfigurationStatus } from "@/lib/billing/ai-cost-optimizer"

export async function GET(request: Request) {
  const session = await auth()
  const adminUserId = session?.user?.id
  const adminEmail = session?.user?.email

  const hasSuperAdminRole = adminUserId && isSuperAdminUserId(adminUserId)
  const isOfficialSuperAdmin = isOfficialSuperAdminEmail(adminEmail)

  if (!adminUserId || (!hasSuperAdminRole && !isOfficialSuperAdmin)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const fromDate = searchParams.get("fromDate")
    const toDate = searchParams.get("toDate")

    const providerStatus = await getProviderConfigurationStatus()
    const snapshot = await getAiCostOptimizerSnapshot({ fromDate, toDate })

    return NextResponse.json({
      ...snapshot,
      providerStatus,
    })
  } catch (error) {
    console.error("[AI_COST_OPTIMIZER] Error:", error)
    return NextResponse.json({
      error: "Failed to load optimizer data",
      message: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 })
  }
}
