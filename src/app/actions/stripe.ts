"use server"

import { PRODUCTS, type ProductId } from "@/lib/business/products"
import { auth } from "@/lib/auth"
import { createStripeCheckoutSession } from "@/services/stripe/checkout"

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

  const priceId = process.env.STRIPE_PRICE_PRO_MONTHLY || process.env.STRIPE_PRICE_PRO_ANNUAL
  if (!priceId) {
    throw new Error("Stripe price ID not configured. Set STRIPE_PRICE_PRO_MONTHLY or STRIPE_PRICE_PRO_ANNUAL.")
  }

  const successUrl = returnUrl || `${process.env.NEXTAUTH_URL || process.env.AUTH_URL || process.env.VERCEL_URL || "http://localhost:3000"}/checkout/success`
  const cancelUrl = `${process.env.NEXTAUTH_URL || process.env.AUTH_URL || process.env.VERCEL_URL || "http://localhost:3000"}/app/settings/checkout`

  return createStripeCheckoutSession({
    userId: session.user.id,
    userEmail: session.user.email,
    priceId,
    successUrl,
    cancelUrl,
  })
}

export async function getCheckoutSession(_sessionId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return null
  }

  return null
}
