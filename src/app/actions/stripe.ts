"use server"

import { PRODUCTS, type ProductId } from "@/lib/business/products"
import { auth } from "@/lib/auth/auth"
import { getDb } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import { issueCheckoutToken, redeemCheckoutToken } from "@/lib/stripe/checkout-token"
import { createStripeCheckoutSession, retrieveStripeCheckoutSession } from "@/services/stripe/checkout"
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

  const priceId =
    productId === "pro_yearly"
      ? process.env.STRIPE_PRICE_PRO_ANNUAL || process.env.STRIPE_PRICE_PRO_MONTHLY
      : process.env.STRIPE_PRICE_PRO_MONTHLY || process.env.STRIPE_PRICE_PRO_ANNUAL
  if (!priceId) {
    throw new Error("Stripe price ID not configured. Set STRIPE_PRICE_PRO_MONTHLY or STRIPE_PRICE_PRO_ANNUAL.")
  }

  const baseUrl = getBaseUrl()
  const checkoutToken = issueCheckoutToken("pending", session.user.id)
  const successUrl = returnUrl || `${baseUrl}/checkout/success?t=${checkoutToken}&s={CHECKOUT_SESSION_ID}`
  const cancelUrl = `${baseUrl}/app/settings/checkout?plan=${productId === "pro_yearly" ? "pro_annual" : productId}`
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

function getBaseUrl() {
  const configured = process.env.NEXTAUTH_URL || process.env.AUTH_URL
  if (configured) return configured
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return "http://localhost:3000"
}
