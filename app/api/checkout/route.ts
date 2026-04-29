import { debugLog, debugError, debugWarn } from "@/lib/debug"
import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { getStripe } from "@/lib/stripe"
import { CREDIT_PACKAGES } from "@/lib/products"
import { auth } from "@/lib/auth"

const PRICE_IDS: Record<string, string | undefined> = {
  pro_monthly: process.env.STRIPE_PRICE_ID_PRO_MONTHLY,
  pro_yearly: process.env.STRIPE_PRICE_ID_PRO_YEARLY,
}

export async function POST(request: NextRequest) {
  try {
    const stripe = getStripe()

    if (!stripe) {
      return NextResponse.json(
        { error: "Stripe not configured" },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { productId } = body

    // Get authenticated user
    const session = await auth()
    const userEmail = session?.user?.email

    // Determine price ID and mode
    let priceId = PRICE_IDS[productId]
    let mode: Stripe.Checkout.SessionCreateParams.Mode = "subscription"
    let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = []

    // Handle credit packages (one-time payments)
    if (productId in CREDIT_PACKAGES) {
      const creditPackage = CREDIT_PACKAGES[productId as keyof typeof CREDIT_PACKAGES]
      mode = "payment"
      
      lineItems = [{
        price_data: {
          currency: creditPackage.currency,
          product_data: {
            name: creditPackage.name,
            description: `${creditPackage.credits} credits for AI queries and analysis`,
          },
          unit_amount: creditPackage.priceInCents,
        },
        quantity: 1,
      }]
    } else {
      // Subscription products
      if (priceId) {
        lineItems = [{
          price: priceId,
          quantity: 1,
        }]
      }
    }

    if (lineItems.length === 0) {
      return NextResponse.json(
        { error: "Invalid product ID" },
        { status: 400 }
      )
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || request.nextUrl.origin

    // Create checkout session
    const sessionData = await stripe.checkout.sessions.create({
      mode,
      line_items: lineItems,
      customer_email: userEmail || undefined,
      success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pricing`,
      metadata: {
        productId,
        userId: session?.user?.id || "",
      },
      allow_promotion_codes: true,
    })

    if (!sessionData.url) {
      throw new Error("Failed to create checkout session")
    }

    return NextResponse.json({ url: sessionData.url })
  } catch (error) {
    debugError("Checkout error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
