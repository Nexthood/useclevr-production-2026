import { auth } from "@/lib/auth/auth"
import { getAnalystCreditUsage } from "@/lib/usage/analyst-credits"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    )
  }

  try {
    const usage = await getAnalystCreditUsage(
      userId,
      session.user.role,
      session.user.email ?? null,
    )

    return NextResponse.json(
      {
        ...usage,
        plan: usage.subscriptionTier,
        credits: {
          total: usage.total,
          used: usage.usedCredits,
          reserved: usage.reservedCredits,
          remaining: usage.remainingCredits,
          available: usage.availableCredits,
          resetAt: usage.nextResetAt,
          unlimited: usage.unlimited,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    console.error("[USAGE_CREDITS] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch usage" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    )
  }
}
