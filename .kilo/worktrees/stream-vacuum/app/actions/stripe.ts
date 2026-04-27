"use server"

import { getStripe, isStripeConfigured } from "@/lib/stripe"
import { PRODUCTS, type ProductId } from "@/lib/products"
import { headers } from "next/headers"
import stripe from "stripe" // Declare the stripe variable

export async function createCheckoutSession(productId: ProductId) {
  if (!isStripeConfigured()) {
    throw new Error("STRIPE_NOT_CONFIGURED")
  }

  const stripeInstance = getStripe()
  
  const product = PRODUCTS[productId]
  if (!product) {
    throw new Error(`Product with id "${productId}" not found`)
  }

  const headersList = await headers()
  const origin = headersList.get("origin") || "http://localhost:3000"

  const session = await stripeInstance.checkout.sessions.create({
    ui_mode: "embedded",
    line_items: [
      {
        price_data: {
          currency: product.currency,
          product_data: {
            name: product.name,
            description: product.description,
          },
          unit_amount: product.priceInCents,
          recurring: {
            interval: product.interval,
          },
        },
        quantity: 1,
      },
    ],
    mode: "subscription",
    return_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
  })

  return session.client_secret
}

export async function getCheckoutSession(sessionId: string) {
  if (!isStripeConfigured()) {
    throw new Error("STRIPE_NOT_CONFIGURED")
  }
  
  const stripe = getStripe()
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription", "customer"],
  })
  return session
}
