"use server"

import { PRODUCTS, type ProductId } from "@/lib/business/products"
import { auth } from "@/lib/auth/auth"
import { buildCheckoutCancelUrl, resolveCheckoutSuccessUrl } from "@/lib/billing/checkout-redirect"
import { getConfiguredBillingPlan } from "@/lib/billing/settings-store"
import { getDb } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import { issueCheckoutToken, redeemCheckoutToken } from "@/lib/stripe/checkout-token"
import { createStripeCheckoutSession, retrieveStripeCheckoutSession } from "@/services/stripe/checkout"
import { syncCheckoutSessionActivation } from "@/services/stripe/webhook"
import { eq } from "drizzle-orm"

export async function createCheckoutSession(productId: ProductId, returnUrl?: string) {
  const session = await auth()
  if (!session?.user?.id || !session?.user?.email) {
    throw new Error("Unauthorized")
  }

  const product = PRODUCTS[productId]
  if (!product) {
    throw new Error(`Product with id "${productId}" not found`)
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  if (!stripeSecretKey) {
    throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.")
  }

  const plan = await getConfiguredBillingPlan(productId)
  const priceId = plan.stripePriceId
  if (!priceId) {
    throw new Error(`Stripe price ID not configured for ${plan.name}.`)
  }

  const checkoutToken = issueCheckoutToken("pending", session.user.id)
  const successUrl = resolveCheckoutSuccessUrl(checkoutToken, returnUrl)
  const cancelUrl = buildCheckoutCancelUrl(`/app/settings/checkout?plan=${productId}`)
  const db = getDb()
  const profile = db
    ? await db.query.profiles.findFirst({
        where: eq(profiles.userId, session.user.id),
        columns: { stripeCustomerId: true },
      })
    : null

  return createStripeCheckoutSession({
    userId: session.user.id,
    userEmail: session.user.email,
    customerId: profile?.stripeCustomerId ?? null,
    priceId,
    plan: productId,
    successUrl,
    cancelUrl,
  })
}

export async function getCheckoutSession(sessionId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return null
  }

  const checkoutSession = await retrieveStripeCheckoutSession(sessionId)
  const checkoutUserId = checkoutSession.client_reference_id || checkoutSession.metadata?.userId

  if (checkoutUserId !== session.user.id) {
    return null
  }

  return checkoutSession
}

export async function syncVerifiedCheckoutSession(sessionId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return null
  }

  const checkoutSession = await retrieveStripeCheckoutSession(sessionId)
  const checkoutUserId = checkoutSession.client_reference_id || checkoutSession.metadata?.userId

  if (checkoutUserId !== session.user.id) {
    return null
  }

  return syncCheckoutSessionActivation(checkoutSession)
}

export async function verifyCheckoutToken(token: string, stripeSessionId: string) {
  const session = await auth()
  if (!session?.user?.id) return null

  const data = redeemCheckoutToken(token)
  if (!data) return null
  if (data.userId !== session.user.id) return null

  const checkoutSession = await retrieveStripeCheckoutSession(stripeSessionId)
  const checkoutUserId = checkoutSession.client_reference_id || checkoutSession.metadata?.userId
  if (checkoutUserId !== session.user.id) return null

  return checkoutSession
}
