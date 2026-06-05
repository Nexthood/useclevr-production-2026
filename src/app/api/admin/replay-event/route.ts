import { auth } from "@/lib/auth/auth"
import { debugError } from "@/lib/utils/debug"
import { handleSubscriptionEvent } from "@/services/stripe/webhook"
import { NextResponse } from "next/server"
import Stripe from "stripe"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const session = await auth()
  if (session?.user?.role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { eventId } = await request.json().catch(() => ({}))
  if (!eventId || typeof eventId !== "string") {
    return NextResponse.json({ error: "eventId is required" }, { status: 400 })
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  if (!stripeSecretKey) {
    return NextResponse.json({ error: "STRIPE_SECRET_KEY is not configured" }, { status: 500 })
  }

  try {
    const stripe = new Stripe(stripeSecretKey, {})
    const event = await stripe.events.retrieve(eventId)

    const result = await handleSubscriptionEvent(event)

    return NextResponse.json({
      replayed: true,
      type: event.type,
      synced: result.synced,
      ...(result.reason ? { reason: result.reason } : {}),
    })
  } catch (err) {
    debugError("[admin/replay] Error replaying event:", err)
    const message = err instanceof Error ? err.message : "Failed to replay event"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
