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

function getSafeAppBaseUrl(origin?: string) {
  // Priority order for base URL
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.AUTH_URL,
    process.env.NEXTAUTH_URL,
    origin,
  ].filter(Boolean) as string[]

  // Helper to detect unsafe hostnames/ports
  const isUnsafe = (url: string) => {
    try {
      const { hostname, port } = new URL(url)
      if (hostname === '0.0.0.0' || hostname === 'localhost' || hostname === '127.0.0.1') return true
      if (port && (port === '8080' || port === '3000')) return true
      return false
    } catch {
      return true // malformed URL is unsafe
    }
  }

  for (const candidate of candidates) {
    const withProtocol = candidate.startsWith('http') ? candidate : `https://${candidate}`
    if (!isUnsafe(withProtocol)) {
      return withProtocol.replace(/\/+$/, '')
    }
  }

  // Fallback for production if no safe candidate found
  return 'https://test.useclevr.com'
}

function getBaseUrl() {
  // In server actions we have access to request origin via headers if needed.
  // Here we simply call the safe helper without origin.
  return getSafeAppBaseUrl()
}
