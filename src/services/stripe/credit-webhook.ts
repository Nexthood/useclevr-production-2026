import type Stripe from "stripe"

import {
  getCreditTopUpPackageById,
  getCreditTopUpPackageByStripePriceId,
  creditTopUpPackages,
  type CreditPackageConfig,
} from "@/lib/billing/credit-packages"
import {
  processStripeTopUpPayment,
  isProviderPaymentProcessed,
} from "@/lib/billing/credit-topup-service"
import { sendCreditPurchaseEmail } from "@/lib/email/subscription-emails"
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

/**
 * Legacy fallback: resolve a credit package from Stripe line items when
 * the Checkout Session predates the creditPackageId metadata field.
 *
 * Resolution order (strict, no guessing):
 *   1. stripePriceId from line items matching an active package provider mapping
 *   2. Amount + currency matching an active package
 *   3. Fail safely — requires admin recovery
 */
async function resolveCreditPackageFromLineItems(
  lineItems: unknown,
  amountTotal: number,
  currency: string,
): Promise<{ package: CreditPackageConfig | null; resolutionMethod: string }> {
  // Await if line items are wrapped in a promise or structured differently
  const items = await Promise.resolve(lineItems)
  
  // Handle Stripe APIList structure: { data: [...], has_more: false }
  const dataArray = Array.isArray(items) 
    ? items 
    : items && typeof items === "object" && "data" in items && Array.isArray((items as { data?: unknown[] }).data)
      ? (items as { data: unknown[] }).data
      : []

  // Tier 1: Resolve by Stripe Price ID from line items
  for (const item of dataArray) {
    if (item && typeof item === "object" && "price" in item) {
      const priceObj = (item as { price?: { id?: string } }).price
      const priceId = priceObj && typeof priceObj === "object" && "id" in priceObj
        ? String((priceObj as { id: string }).id)
        : null
      if (priceId) {
        const pkg = getCreditTopUpPackageByStripePriceId(priceId)
        if (pkg && pkg.active) {
          return { package: pkg, resolutionMethod: "lineItem_priceId_legacy" }
        }
      }
    }
  }

  // Tier 2: Resolve by exact amount + currency match
  const normalizedCurrency = normalizeCurrency(currency)
  for (const pkg of creditTopUpPackages) {
    if (
      pkg.active &&
      normalizeCurrency(pkg.currency) === normalizedCurrency &&
      pkg.monetaryAmountCents === amountTotal
    ) {
      return { package: pkg, resolutionMethod: "lineItem_amount_currency_legacy" }
    }
  }

  // Tier 3: No match found
  return { package: null, resolutionMethod: "none" }
}

/**
 * Deterministic package resolution — NEVER guesses by amount or currency alone.
 * Resolution order (strict, no fallback guessing):
 *   1. creditPackageId from server-generated Stripe Checkout metadata
 *   2. stripePriceId from metadata / line items
 *   3. Legacy fallback: line items lookup (for sessions that predate creditPackageId metadata)
 *   4. Fail safely — no credits granted, requires admin recovery
 */
async function resolveCreditPackageDeterministically(
  metadata: Record<string, string>,
  stripePriceId: string | null,
  session: Stripe.Checkout.Session,
): Promise<{ package: CreditPackageConfig | null; resolvedCurrency: string; resolutionMethod: string }> {
  // Tier 1: Resolve by server-generated creditPackageId from checkout metadata
  const creditPackageId = normalizePriceId(metadata.creditPackageId ?? null)
  if (creditPackageId) {
    const pkg = getCreditTopUpPackageById(creditPackageId)
    if (pkg && pkg.active) {
      return { package: pkg, resolvedCurrency: pkg.currency, resolutionMethod: "creditPackageId" }
    }
    debugLog("[stripe-credit-topup] creditPackageId found but package inactive or missing.", { creditPackageId })
  }

  // Tier 2: Resolve by Stripe Price ID from metadata or line items
  const priceId = stripePriceId || normalizePriceId(metadata.price_id ?? null)
  if (priceId) {
    const pkg = getCreditTopUpPackageByStripePriceId(priceId)
    if (pkg && pkg.active) {
      return { package: pkg, resolvedCurrency: pkg.currency, resolutionMethod: "stripePriceId" }
    }
    debugLog("[stripe-credit-topup] stripePriceId found but package inactive or not configured.", { priceId })
  }

  // Tier 3: Legacy fallback — resolve from Stripe line items
  try {
    const legacyResolution = await resolveCreditPackageFromLineItems(
      session.line_items ?? [],
      session.amount_total ?? 0,
      session.currency ?? "",
    )
    if (legacyResolution.package) {
      debugLog("[stripe-credit-topup] Resolved via legacy line-item lookup.", {
        packageId: legacyResolution.package.id,
        method: legacyResolution.resolutionMethod,
      })
      return {
        package: legacyResolution.package,
        resolvedCurrency: legacyResolution.package.currency,
        resolutionMethod: legacyResolution.resolutionMethod,
      }
    }
  } catch (err) {
    debugLog("[stripe-credit-topup] Legacy line-item resolution failed.", { error: err instanceof Error ? err.message : String(err) })
  }

  // Tier 4: No trusted identifiers — fail safely
  debugLog("[stripe-credit-topup] No trusted package identifier found in metadata.", {
    hasPackageId: Boolean(creditPackageId),
    hasPriceId: Boolean(stripePriceId),
    lineItemCount: Array.isArray(session.line_items) ? session.line_items.length : 0,
  })
  return { package: null, resolvedCurrency: "", resolutionMethod: "none" }
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

  // Deterministic resolution — NO amount/currency guessing without trusted identifiers
  const resolution = await resolveCreditPackageDeterministically(metadata, stripePriceId, session)
  const creditPackage = resolution.package

  if (!creditPackage) {
    debugLog("[stripe-credit-topup] No matching credit package — safe failure.", {
      resolutionMethod: resolution.resolutionMethod,
      stripePriceId,
      creditPackageId: metadata.creditPackageId,
      amountTotal,
      currency,
    })
    return {
      processed: true,
      synced: false,
      reason: "No trusted package identifier found — requires admin recovery.",
    }
  }

  const payment = {
    provider: "stripe" as const,
    providerPaymentId,
    providerCheckoutId,
    providerEventId,
    amountMinor: amountTotal,
    currency: resolution.resolvedCurrency || currency,
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

  // Send confirmation email (idempotent — only on first successful processing)
  if (!result.duplicate && result.creditsIssued > 0) {
    try {
      const userEmail = metadata.userId || clientReferenceId || null
      if (userEmail) {
        const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.useclevr.com/app"
        await sendCreditPurchaseEmail({
          to: userEmail,
          creditsGranted: creditPackage.creditsGranted,
          amount: creditPackage.monetaryAmountCents / 100,
          currency: creditPackage.currency,
          purchasedAt: new Date().toISOString(),
          providerPaymentId,
          dashboardUrl: `${dashboardUrl}/app/settings/subscription`,
        }).catch((err) => {
          debugError("[stripe-credit-topup] Credit purchase email failed:", err)
        })
      }
    } catch (err) {
      debugError("[stripe-credit-topup] Credit purchase email exception:", err)
    }
  }

  return {
    processed: true,
    synced: true,
    creditsIssued: result.creditsIssued,
    duplicate: result.duplicate,
  }
}
