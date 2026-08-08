import { createHmac, timingSafeEqual } from "node:crypto"

import {
  getCreditTopUpPackageBySquareCatalogId,
  resolveCreditTopUpPackageByAmount,
} from "@/lib/billing/credit-packages"
import {
  processSquareTopUpPayment,
  isProviderPaymentProcessed,
} from "@/lib/billing/credit-topup-service"
import { debugError, debugLog } from "@/lib/utils/debug"

export interface SquareWebhookVerificationResult {
  valid: boolean
  error?: string
}

export interface SquareCreditTopUpResult {
  processed: boolean
  synced: boolean
  reason?: string
  creditsIssued?: number
  duplicate?: boolean
}

function getSquareWebhookSignatureKey(): string | null {
  return process.env.SQUARE_WEBHOOK_SIGNATURE_KEY?.trim() || null
}

export function getSquareCreditsNotificationUrl(): string | null {
  return process.env.SQUARE_CREDITS_WEBHOOK_NOTIFICATION_URL?.trim() ||
    process.env.SQUARE_WEBHOOK_NOTIFICATION_URL?.trim() ||
    null
}

export function verifySquareWebhookSignature(
  signature: string | null,
  notificationUrl: string,
  rawBody: string,
): SquareWebhookVerificationResult {
  if (!signature) {
    return { valid: false, error: "Missing x-square-hmacsha256-signature header." }
  }

  const signatureKey = getSquareWebhookSignatureKey()
  if (!signatureKey) {
    return { valid: false, error: "SQUARE_WEBHOOK_SIGNATURE_KEY is not configured." }
  }

  const expected = createHmac("sha256", signatureKey)
    .update(notificationUrl + rawBody)
    .digest("base64")

  const actualBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)

  if (actualBuffer.length !== expectedBuffer.length) {
    return { valid: false, error: "Square webhook signature length mismatch." }
  }

  if (!timingSafeEqual(actualBuffer, expectedBuffer)) {
    return { valid: false, error: "Square webhook signature verification failed." }
  }

  return { valid: true }
}

const SUPPORTED_SQUARE_EVENT_TYPES = new Set([
  "payment.created",
  "payment.updated",
])

function isCompletedSquarePaymentStatus(status: string): boolean {
  return status === "COMPLETED" || status === "APPROVED" || status === "PAID"
}

function isTerminalNonCompletedSquarePaymentStatus(status: string): boolean {
  return [
    "CANCELED",
    "CANCELLATION_PENDING",
    "FAILED",
    "DECLINED",
    "REFUNDED",
    "PARTIALLY_REFUNDED",
    "REFUND_PENDING",
  ].includes(status)
}

export async function handleSquareCreditPaymentEvent(
  parsedBody: unknown,
): Promise<SquareCreditTopUpResult> {
  const body = parsedBody as {
    type?: string
    event_id?: string
    id?: string
    data?: { object?: { payment?: unknown } }
  }
  const eventType: string = body?.type || ""
  const eventId: string = body?.event_id || body?.id || ""

  if (!SUPPORTED_SQUARE_EVENT_TYPES.has(eventType)) {
    return {
      processed: false,
      synced: false,
      reason: `Unsupported Square event type: ${eventType}`,
    }
  }

  const sqrPayment = body?.data?.object?.payment as {
    id?: string
    amount_money?: { amount?: number; currency?: string }
    status?: string
    reference_id?: string
    metadata?: Record<string, string>
    order_id?: string
  } | undefined
  if (!sqrPayment || !sqrPayment.id) {
    return {
      processed: false,
      synced: false,
      reason: "Square webhook payload missing payment data.",
    }
  }

  const providerPaymentId = sqrPayment.id
  const amountMinor = sqrPayment.amount_money?.amount
  const currency = (sqrPayment.amount_money?.currency || "").toUpperCase()
  const status = sqrPayment.status || ""
  const referenceId = sqrPayment.reference_id || null
  const metadata = sqrPayment.metadata || {}
  const providerEventId = eventId

  const isDuplicate = await isProviderPaymentProcessed("square", providerPaymentId)
  if (isDuplicate) {
    debugLog("[square-credit-topup] Duplicate payment detected, skipping.", { providerPaymentId })
    return {
      processed: true,
      synced: true,
      duplicate: true,
      reason: "Payment already processed.",
    }
  }

  if (isTerminalNonCompletedSquarePaymentStatus(status)) {
    debugLog("[square-credit-topup] Payment is in terminal non-completed state, skipping credit issuance.", {
      providerPaymentId,
      status,
    })
    return {
      processed: true,
      synced: false,
      reason: `Payment status is "${status}" — credits will not be issued.`,
    }
  }

  if (!isCompletedSquarePaymentStatus(status)) {
    return {
      processed: true,
      synced: false,
      reason: `Payment status "${status}" is not completed — credits will not be issued.`,
    }
  }

  if (!amountMinor || amountMinor <= 0) {
    return {
      processed: false,
      synced: false,
      reason: "Square payment has no valid amount.",
    }
  }

  const squareCatalogId = metadata.squareCatalogItemId || metadata.item_id || referenceId || null

  let creditPackage = squareCatalogId
    ? getCreditTopUpPackageBySquareCatalogId(squareCatalogId)
    : null

  if (!creditPackage) {
    creditPackage = resolveCreditTopUpPackageByAmount(currency as "EUR" | "GBP" | "USD" | "CAD", amountMinor, "square")
  }

  if (!creditPackage) {
    debugLog("[square-credit-topup] No matching credit package for this payment.", {
      squareCatalogId,
      amountMinor,
      currency,
    })
    return {
      processed: true,
      synced: false,
      reason: "Unsupported Square catalog item or amount — no matching credit package.",
    }
  }

  if (creditPackage.monetaryAmountCents !== amountMinor) {
    return {
      processed: false,
      synced: false,
      reason: `Amount mismatch: expected ${creditPackage.monetaryAmountCents}, got ${amountMinor}.`,
    }
  }

  if (creditPackage.currency !== currency) {
    return {
      processed: false,
      synced: false,
      reason: `Currency mismatch: expected ${creditPackage.currency}, got ${currency}.`,
    }
  }

  const topUpPayment = {
    provider: "square" as const,
    providerPaymentId,
    providerCheckoutId: sqrPayment.order_id || null,
    providerEventId,
    amountMinor,
    currency: creditPackage.currency,
    referenceId: referenceId || null,
    metadata: metadata,
  }

  const result = await processSquareTopUpPayment(topUpPayment, creditPackage)

  if (!result.success) {
    debugError("[square-credit-topup] Failed to process top-up payment.", {
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
