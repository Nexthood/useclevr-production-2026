import "server-only"

import Stripe from "stripe"

const stripeSecretKey = process.env.STRIPE_SECRET_KEY

export const stripe = stripeSecretKey 
  ? new Stripe(stripeSecretKey)
  : null

export function getStripe() {
  if (!stripe) {
    throw new Error("STRIPE_NOT_CONFIGURED")
  }
  return stripe
}

export function isStripeConfigured(): boolean {
  return !!stripeSecretKey
}
