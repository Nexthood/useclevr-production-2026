import Stripe from "stripe"

import { debugError } from "@/lib/utils/debug"

let _stripe: Stripe | null = null

function getStripe(): Stripe {
  if (_stripe) return _stripe
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured.")
  }
  _stripe = new Stripe(key, {})
  return _stripe
}

export class StripeCreditCheckoutConfigurationError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "StripeCreditCheckoutConfigurationError"
    this.code = code
  }
}

export interface CreateCreditTopUpCheckoutOptions {
  userId: string
  userEmail: string
  customerId?: string | null
  stripePriceId: string
  expectedCurrency?: string
  successUrl: string
  cancelUrl: string
  metadata?: Record<string, string>
}

export async function createCreditTopUpCheckoutSession({
  userId,
  userEmail,
  customerId,
  stripePriceId,
  expectedCurrency,
  successUrl,
  cancelUrl,
  metadata,
}: CreateCreditTopUpCheckoutOptions): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe()
  await validateCreditTopUpPrice(stripe, stripePriceId, expectedCurrency)

  const mergedMetadata: Record<string, string> = {
    userId,
    userEmail,
    ...(metadata ?? {}),
  }

  const session = await stripe.checkout.sessions.create({
    ...(customerId ? { customer: customerId } : { customer_email: userEmail }),
    client_reference_id: userId,
    metadata: mergedMetadata,
    line_items: [{ price: stripePriceId, quantity: 1 }],
    mode: "payment",
    success_url: successUrl,
    cancel_url: cancelUrl,
    payment_method_types: ["card"],
  })

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL for the credit top-up.")
  }

  return session
}

export async function retrieveCreditTopUpSession(
  sessionId: string,
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe()
  return stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent"],
  })
}

async function validateCreditTopUpPrice(
  stripe: Stripe,
  priceId: string,
  expectedCurrency?: string,
): Promise<void> {
  const price = await stripe.prices.retrieve(priceId)

  if (!price.active) {
    throw new StripeCreditCheckoutConfigurationError(
      "credit_price_inactive",
      "The selected credit top-up price is inactive.",
    )
  }

  if (price.type !== "one_time") {
    throw new StripeCreditCheckoutConfigurationError(
      "credit_price_not_one_time",
      "The selected credit top-up price must be a one-time payment price, not a subscription.",
    )
  }

  const expectedCurrencyLower = expectedCurrency?.trim().toLowerCase()
  if (expectedCurrencyLower && price.currency.toLowerCase() !== expectedCurrencyLower) {
    throw new StripeCreditCheckoutConfigurationError(
      "credit_currency_mismatch",
      `The selected credit top-up price currency (${price.currency}) does not match the expected currency (${expectedCurrencyLower}).`,
    )
  }
}

export function verifyStripeWebhookSignature(
  rawBody: Buffer | Uint8Array,
  signature: string,
): { valid: boolean; event?: Stripe.Event; error?: string } {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    return { valid: false, error: "STRIPE_WEBHOOK_SECRET is not configured." }
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  if (!stripeSecretKey) {
    return { valid: false, error: "STRIPE_SECRET_KEY is not configured." }
  }

  const stripe = new Stripe(stripeSecretKey, {})

  try {
    const event = stripe.webhooks.constructEvent(Buffer.from(rawBody), signature, webhookSecret)
    return { valid: true, event }
  } catch (err) {
    debugError("[stripe-credit-topup] Webhook signature verification failed:", err)
    return {
      valid: false,
      error: err instanceof Error ? err.message : "Webhook signature verification failed.",
    }
  }
}
