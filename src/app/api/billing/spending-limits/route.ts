import { auth } from "@/lib/auth/auth"
import { getSpendingLimits, setSpendingLimits, type SpendingLimitInput } from "@/lib/billing/credit-account-service"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const limits = await getSpendingLimits(userId)
    return NextResponse.json({ limits })
  } catch (error) {
    console.error("[SPENDING_LIMITS] Error:", error)
    return NextResponse.json({ error: "Failed to fetch spending limits" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = (await request.json()) as SpendingLimitInput
    const limits = await setSpendingLimits(userId, {
      userId,
      dailyLimit: body.dailyLimit ?? undefined,
      weeklyLimit: body.weeklyLimit ?? undefined,
      monthlyPurchasedLimit: body.monthlyPurchasedLimit ?? undefined,
      perOperationMax: body.perOperationMax ?? undefined,
      lowBalanceWarningPercent: body.lowBalanceWarningPercent ?? undefined,
      autoTopUpEnabled: body.autoTopUpEnabled ?? undefined,
    })

    return NextResponse.json({ limits })
  } catch (error) {
    console.error("[SPENDING_LIMITS] Error:", error)
    return NextResponse.json({ error: "Failed to update spending limits" }, { status: 500 })
  }
}
