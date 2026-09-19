import { auth } from "@/lib/auth/auth"
import { getDb } from "@/lib/db"
import { creditTopUps } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * Report-only credit top-up confirmation status.
 *
 * Used by the post-checkout poller so the Billing page can detect completed
 * top-ups within seconds. This endpoint NEVER grants credits and NEVER talks
 * to payment providers: authoritative credit grants happen exclusively in the
 * verified Stripe webhook path. Success-URL visits always grant zero credits.
 *
 * Queries are scoped to the authenticated user — another customer's (or
 * Superadmin's) top-up is reported as "pending" without any detail.
 */
export async function GET(request: NextRequest) {
  const session = await auth()
  const user = session?.user

  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const sessionId = request.nextUrl.searchParams.get("sessionId")?.trim() ?? ""
  if (!sessionId.startsWith("cs_")) {
    return NextResponse.json({ error: "Provide a Stripe checkout session ID (cs_...)" }, { status: 400 })
  }

  const db = getDb()
  if (!db) {
    return NextResponse.json({ status: "pending" }, { headers: { "Cache-Control": "no-store" } })
  }

  const topUp = await db.query.creditTopUps.findFirst({
    where: and(
      eq(creditTopUps.provider, "stripe"),
      eq(creditTopUps.providerCheckoutId, sessionId),
      eq(creditTopUps.userId, user.id),
    ),
    columns: {
      status: true,
      creditsGranted: true,
      currency: true,
      amountMinor: true,
    },
  })

  if (!topUp) {
    // No top-up for THIS user with this session yet — webhook has not
    // completed processing. Report pending without leaking any detail.
    return NextResponse.json({ status: "pending" }, { headers: { "Cache-Control": "no-store" } })
  }

  if (topUp.status === "completed") {
    return NextResponse.json(
      {
        status: "completed",
        creditsGranted: topUp.creditsGranted,
        amount: topUp.amountMinor / 100,
        currency: topUp.currency,
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  }

  if (topUp.status === "refunded") {
    return NextResponse.json(
      { status: "refunded" },
      { headers: { "Cache-Control": "no-store" } },
    )
  }

  return NextResponse.json({ status: "pending" }, { headers: { "Cache-Control": "no-store" } })
}
