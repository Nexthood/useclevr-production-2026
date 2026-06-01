import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth/auth"
import { getDb } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import { createStripeBillingPortalSession } from "@/services/stripe/checkout"
import { eq } from "drizzle-orm"

export async function POST(request: NextRequest) {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) {
    return NextResponse.json({ error: "Please sign in again before opening billing." }, { status: 401 })
  }

  const db = getDb()
  if (!db) {
    return NextResponse.json({ error: "Database connection is unavailable." }, { status: 503 })
  }

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
    columns: { stripeCustomerId: true },
  })

  if (!profile?.stripeCustomerId) {
    return NextResponse.json(
      {
        error: "No Stripe customer is linked to this account yet.",
        url: new URL("/app/settings/checkout", request.nextUrl.origin).toString(),
        status: "checkout_required",
      },
      { status: 404 },
    )
  }

  try {
    const portalSession = await createStripeBillingPortalSession({
      customerId: profile.stripeCustomerId,
      returnUrl: new URL("/app/settings/billing", request.nextUrl.origin).toString(),
    })

    return NextResponse.json({ url: portalSession.url, status: "ready" })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Billing portal could not be opened." },
      { status: 500 },
    )
  }
}
