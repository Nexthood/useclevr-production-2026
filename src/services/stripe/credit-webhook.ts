import type Stripe from "stripe"

import {
  getCreditTopUpPackageByStripePriceId,
  resolveCreditTopUpPackageByAmount,
} from "@/lib/billing/credit-packages"
import {
  processStripeTopUpPayment,
  isProviderPaymentProcessed,
} from "@/lib/billing/credit-topup-service"
import { debugError, debugLog } from "@/lib/utils/debug"

export interface StripeCreditTopUpResult {
  processed: boolean
  synced: boolean
  reason?: string
  creditsIssued?: number
  duplicate?: boolean
}

function normalizeCurrency(currency: string | undefined | null): string {
  return (currency || "").trim().toUpperCase()
}

function normalizePriceId(price: string | undefined | null): string | null {
  return price && price.length > 0 ? price : null
}

export async function handleStripeCreditCheckoutEvent(
  event: Stripe.Event,
): Promise<StripeCreditTopUpResult> {
  if (event.type !== "checkout.session.completed") {
    return { processed: false, synced: false, reason: `Not a checkout.session.completed event: ${event.type}` }
  }

  const session = event.data.object as Stripe.Checkout.Session

  if (session.mode !== "payment") {
    return {
      processed: false,
      synced: false,
      reason: `Checkout session is not in payment mode (mode: ${session.mode || "unknown"}).`,
    }
  }

  const paymentStatus = session.payment_status
  if (paymentStatus !== "paid" && paymentStatus !== "no_payment_required") {
    debugLog("[stripe-credit-topup] Payment not completed, skipping credit issuance.", {
      sessionId: session.id,
      paymentStatus,
    })
    return {
      processed: true,
      synced: false,
      reason: `Payment status is "${paymentStatus}" — credits will not be issued.`,
    }
  }

  const paymentIntent = session.payment_intent
  const paymentIntentId =
    typeof paymentIntent === "string"
      ? paymentIntent
      : paymentIntent && typeof paymentIntent === "object" && "id" in paymentIntent
        ? String(paymentIntent.id)
        : null

  if (!paymentIntentId) {
    return {
      processed: false,
      synced: false,
      reason: "Checkout session has no payment_intent.",
    }
  }

  const providerPaymentId = paymentIntentId
  const providerCheckoutId = session.id
  const providerEventId = event.id

  const isDuplicate = await isProviderPaymentProcessed("stripe", providerPaymentId)
  if (isDuplicate) {
    debugLog("[stripe-credit-topup] Duplicate payment detected, skipping.", { providerPaymentId })
    return {
      processed: true,
      synced: true,
      duplicate: true,
      reason: "Payment already processed.",
    }
  }

  const metadata = session.metadata || {}

  const stripePriceId =
    normalizePriceId(session.metadata?.stripePriceId ?? null) ||
    normalizePriceId(session.metadata?.price_id ?? null) ||
    null

  const amountTotal = session.amount_total
  const currency = normalizeCurrency(session.currency)
  const clientReferenceId = session.client_reference_id

  if (!amountTotal || amountTotal <= 0) {
    return {
      processed: false,
      synced: false,
      reason: "Checkout session has no valid amount_total.",
    }
  }

  let creditPackage = stripePriceId
    ? getCreditTopUpPackageByStripePriceId(stripePriceId)
    : null

  if (!creditPackage) {
    creditPackage = resolveCreditTopUpPackageByAmount(currency as "EUR" | "GBP" | "USD" | "CAD", amountTotal, "stripe")
  }

  if (!creditPackage) {
    debugLog("[stripe-credit-topup] No matching credit package for this checkout.", {
      stripePriceId,
      amountTotal,
      currency,
    })
    return {
      processed: true,
      synced: false,
      reason: "Unsupported Stripe price ID or amount — no matching credit package.",
    }
  }

  if (creditPackage.monetaryAmountCents !== amountTotal) {
    return {
      processed: false,
      synced: false,
      reason: `Amount mismatch: expected ${creditPackage.monetaryAmountCents}, got ${amountTotal}.`,
    }
  }

  if (creditPackage.currency !== currency) {
    return {
      processed: false,
      synced: false,
      reason: `Currency mismatch: expected ${creditPackage.currency}, got ${currency}.`,
    }
  }

  const payment = {
    provider: "stripe" as const,
    providerPaymentId,
    providerCheckoutId,
    providerEventId,
    amountMinor: amountTotal,
    currency: creditPackage.currency,
    stripePriceId,
    clientReferenceId: clientReferenceId || null,
    metadata: metadata as Record<string, string>,
  }

  const result = await processStripeTopUpPayment(payment, creditPackage)

  if (!result.success) {
    debugError("[stripe-credit-topup] Failed to process top-up payment.", {
      providerPaymentId,
      error: result.error,
    })
    return {
      processed: true,
      synced: false,
      reason: result.error || "Failed to process credit top-up payment.",
    }
  }

  return {
    processed: true,
    synced: true,
    creditsIssued: result.creditsIssued,
    duplicate: result.duplicate,
  }
}
