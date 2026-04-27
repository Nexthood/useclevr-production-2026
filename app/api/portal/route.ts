import { NextRequest, NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe"
import { auth } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const stripe = getStripe()

    if (!stripe) {
      return NextResponse.json(
        { error: "Stripe not configured" },
        { status: 500 }
      )
    }

    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // For now, create portal session without customer ID check
    // In production, you'd want to store the Stripe customer ID in the profile
    const customerId = session.user.id // This should be replaced with actual Stripe customer ID

    // Create portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/app/settings`,
    })

    if (!portalSession.url) {
      throw new Error("Failed to create portal session")
    }

    return NextResponse.json({ url: portalSession.url })
  } catch (error) {
    console.error("Portal error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
