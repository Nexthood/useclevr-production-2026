import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import Stripe from "stripe"
import { getStripe } from "@/lib/stripe"
import { db } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function POST(request: NextRequest) {
  const body = await request.text()
  const stripe = getStripe()

  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 500 }
    )
  }

  const headersList = await headers()
  const signature = headersList.get("stripe-signature")

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    )
  }

  let event: Stripe.Event

  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET not configured")
    }

    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error("Webhook signature verification failed:", err)
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    )
  }

  // Handle the event
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutComplete(session, stripe)
        break
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdate(subscription)
        break
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionCanceled(subscription)
        break
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoicePaid(invoice)
        break
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoiceFailed(invoice)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Webhook handler error:", error)
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    )
  }
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session, stripe: Stripe) {
  const userId = session.metadata?.user_id || session.client_reference_id
  const productId = session.metadata?.productId

  if (!userId) {
    console.log("No user ID in session metadata")
    return
  }

  // Update user credits or subscription based on product type
  if (productId?.startsWith("credits_")) {
    // Add credits to user account
    const creditPackages = await import("@/lib/products").then(m => m.CREDIT_PACKAGES)
    const pkg = creditPackages[productId as keyof typeof creditPackages]
    
    if (pkg) {
      // Update user credits in database
      await db.update(profiles).set({
        credits: (await db.query.profiles.findFirst({
          where: eq(profiles.userId, userId),
          columns: { credits: true },
        }))?.credits || 0 + pkg.credits,
      }).where(eq(profiles.userId, userId))
    }
  } else {
    // Update user subscription status
    const customerId = session.subscription as string
    
    await db.update(profiles).set({
      subscriptionTier: "pro",
    }).where(eq(profiles.userId, userId))
  }
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string

  // Find user by Stripe customer ID and update
  // Note: This is a simplified implementation - you may need to adjust based on your schema
  console.log(`Subscription updated for customer ${customerId}: ${subscription.status}`)
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string

  console.log(`Subscription canceled for customer ${customerId}`)
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string
  
  // Log successful payment
  console.log(`Invoice paid for customer ${customerId}`)
}

async function handleInvoiceFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string
  
  // Could send email notification here
  console.log(`Invoice payment failed for customer ${customerId}`)
}
