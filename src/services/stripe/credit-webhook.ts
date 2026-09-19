import type Stripe from "stripe"

import {
  getCreditTopUpPackageById,
  getCreditTopUpPackageByStripePriceId,
  type CreditPackageConfig,
} from "@/lib/billing/credit-packages"
import {
  processStripeTopUpPayment,
  isProviderPaymentProcessed,
  getCreditTopUpByProviderPaymentId,
  refundTopUpCredits,
  markTopUpRefundedWithoutGrant,
} from "@/lib/billing/credit-topup-service"
import { getCreditAccount } from "@/lib/billing/credit-account-service"
import { sendCreditPurchaseEmail } from "@/lib/email/subscription-emails"
import { getStripe } from "@/services/stripe/credit-checkout"
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
 * A credit package is identified ONLY by a Stripe Price ID that maps to an
 * active package provider configuration. Amount and currency never resolve
 * a package, and an unknown or untrusted Price ID fails closed so no credits
 * are granted without a trusted identifier.
 */
async function resolveCreditPackageFromLineItems(
  lineItems: unknown,
): Promise<{ package: CreditPackageConfig | null; priceId: string | null; resolutionMethod: string }> {
  // Await if line items are wrapped in a promise or structured differently
  const items = await Promise.resolve(lineItems)

  // Handle Stripe APIList structure: { data: [...], has_more: false }
  const dataArray = Array.isArray(items)
    ? items
    : items && typeof items === "object" && "data" in items && Array.isArray((items as { data?: unknown[] }).data)
      ? (items as { data: unknown[] }).data
      : []

  // Resolve by Stripe Price ID from line items
  for (const item of dataArray) {
    if (item && typeof item === "object" && "price" in item) {
      const priceObj = (item as { price?: { id?: string } }).price
      const priceId = priceObj && typeof priceObj === "object" && "id" in priceObj
        ? String((priceObj as { id: string }).id)
        : null
      if (priceId) {
        const pkg = getCreditTopUpPackageByStripePriceId(priceId)
        if (pkg && pkg.active) {
          return { package: pkg, priceId, resolutionMethod: "lineItem_priceId_legacy" }
        }
      }
    }
  }

  // No trusted Price ID match — fail closed
  return { package: null, priceId: null, resolutionMethod: "none" }
}

/**
 * Deterministic package resolution — NEVER guesses by amount or currency alone.
 * Resolution order (strict, no fallback guessing):
 *   1. creditPackageId from server-generated Stripe Checkout metadata
 *   2. stripePriceId from metadata / line items
 *   3. Legacy fallback: line items lookup (for sessions that predate creditPackageId metadata)
 *   4. Fail safely — no credits granted, requires admin recovery
 *
 * `resolvedPriceId` carries the trusted Stripe Price that identified the
 * package (the package's own configured Price, the metadata Price ID, or the
 * matched line-item Price ID) so localized Adaptive Pricing charges can be
 * verified against the package's own Stripe Price even for legacy sessions.
 */
async function resolveCreditPackageDeterministically(
  metadata: Record<string, string>,
  stripePriceId: string | null,
  session: Stripe.Checkout.Session,
): Promise<{ package: CreditPackageConfig | null; resolvedCurrency: string; resolutionMethod: string; resolvedPriceId: string | null }> {
  // Tier 1: Resolve by server-generated creditPackageId from checkout metadata
  const creditPackageId = normalizePriceId(metadata.creditPackageId ?? null)
  if (creditPackageId) {
    const pkg = getCreditTopUpPackageById(creditPackageId)
    if (pkg && pkg.active) {
      return { package: pkg, resolvedCurrency: pkg.currency, resolutionMethod: "creditPackageId", resolvedPriceId: pkg.providers.stripe ?? null }
    }
    debugLog("[stripe-credit-topup] creditPackageId found but package inactive or missing.", { creditPackageId })
  }

  // Tier 2: Resolve by Stripe Price ID from metadata or line items
  const priceId = stripePriceId || normalizePriceId(metadata.price_id ?? null)
  if (priceId) {
    const pkg = getCreditTopUpPackageByStripePriceId(priceId)
    if (pkg && pkg.active) {
      return { package: pkg, resolvedCurrency: pkg.currency, resolutionMethod: "stripePriceId", resolvedPriceId: priceId }
    }
    debugLog("[stripe-credit-topup] stripePriceId found but package inactive or not configured.", { priceId })
  }

  // Tier 3: Legacy fallback — resolve from Stripe line items by trusted Price ID
  try {
    const legacyResolution = await resolveCreditPackageFromLineItems(session.line_items ?? [])
    if (legacyResolution.package) {
      debugLog("[stripe-credit-topup] Resolved via legacy line-item lookup.", {
        packageId: legacyResolution.package.id,
        method: legacyResolution.resolutionMethod,
      })
      return {
        package: legacyResolution.package,
        resolvedCurrency: legacyResolution.package.currency,
        resolutionMethod: legacyResolution.resolutionMethod,
        resolvedPriceId: legacyResolution.priceId,
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
  return { package: null, resolvedCurrency: "", resolutionMethod: "none", resolvedPriceId: null }
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

  // Currency verification with Stripe Adaptive Pricing support.
  //
  // Stripe may charge the package's own Stripe Price in the customer's local
  // currency (e.g. a USD price presented as EUR). That localized charge is
  // only accepted when the checkout session was created for exactly this
  // package's Stripe Price — identified by the server-stamped metadata Price
  // ID or the matching line-item Price ID — AND the authoritative Stripe
  // Price still matches the package configuration. Any other currency
  // mismatch fails closed.
  const trustedPriceId = stripePriceId || resolution.resolvedPriceId
  let chargeCurrency = currency
  if (currency !== creditPackage.currency) {
    const packagePriceId = creditPackage.providers.stripe ?? null
    if (!packagePriceId || !trustedPriceId || trustedPriceId !== packagePriceId) {
      debugLog("[stripe-credit-topup] Currency mismatch without trusted package price — safe failure.", {
        sessionId: session.id,
        chargeCurrency: currency,
        packageCurrency: creditPackage.currency,
        stripePriceId: trustedPriceId,
      })
      return {
        processed: true,
        synced: false,
        reason: `Payment currency ${currency} does not match package currency ${creditPackage.currency} without a trusted Stripe Price — requires admin recovery.`,
      }
    }

    try {
      const price = await getStripe().prices.retrieve(trustedPriceId)
      if (
        !price.active ||
        price.type !== "one_time" ||
        price.currency.toUpperCase() !== creditPackage.currency ||
        price.unit_amount !== creditPackage.monetaryAmountCents
      ) {
        return {
          processed: true,
          synced: false,
          reason: "Stripe Price no longer matches the credit package configuration — requires admin recovery.",
        }
      }
    } catch (err) {
      debugError("[stripe-credit-topup] Failed to verify Stripe price for localized charge.", { stripePriceId: trustedPriceId, error: err instanceof Error ? err.message : String(err) })
      return {
        processed: true,
        synced: false,
        reason: "Could not verify the Stripe Price for a localized payment — requires admin recovery.",
      }
    }

    debugLog("[stripe-credit-topup] Stripe Adaptive Pricing charge accepted for package price.", {
      sessionId: session.id,
      packageCurrency: creditPackage.currency,
      chargeCurrency: currency,
      stripePriceId: trustedPriceId,
    })
    chargeCurrency = currency
  }

  const payment = {
    provider: "stripe" as const,
    providerPaymentId,
    providerCheckoutId,
    providerEventId,
    amountMinor: amountTotal,
    currency: resolution.resolvedCurrency || currency,
    chargeCurrency,
    stripePriceId: trustedPriceId,
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

  // Send confirmation email (idempotent — only on first successful processing).
  // The recipient is the trusted server-side userEmail stored in checkout
  // metadata at session creation. Never derive it from metadata.userId or
  // clientReferenceId: those are UseClevr user IDs, not email addresses.
  // Email runs AFTER the financial grant is committed and must never roll it
  // back — every failure here is logged, never thrown.
  if (!result.duplicate && result.creditsIssued > 0) {
    try {
      const userEmail = normalizePriceId(metadata.userEmail)
      const topUpUserId = metadata.userId || clientReferenceId || null
      if (userEmail && userEmail.includes("@")) {
        const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.useclevr.com/app"
        const [receiptUrl, invoiceUrl, account] = await Promise.all([
          retrieveStripeReceiptUrl(providerPaymentId).catch((err) => {
            debugError("[stripe-credit-topup] Receipt URL lookup failed:", err)
            return null
          }),
          retrieveStripeInvoiceUrl(session).catch((err) => {
            debugError("[stripe-credit-topup] Invoice URL lookup failed:", err)
            return null
          }),
          topUpUserId
            ? getCreditAccount(topUpUserId).catch((err) => {
                debugError("[stripe-credit-topup] Post-grant balance lookup failed:", err)
                return null
              })
            : Promise.resolve(null),
        ])
        await sendCreditPurchaseEmail({
          to: userEmail,
          creditsGranted: creditPackage.creditsGranted,
          amount: amountTotal / 100,
          currency: chargeCurrency || creditPackage.currency,
          purchasedAt: new Date().toISOString(),
          providerPaymentId,
          dashboardUrl: `${dashboardUrl}/app/settings/subscription`,
          receiptUrl: receiptUrl ?? undefined,
          invoicePdfUrl: invoiceUrl?.pdfUrl ?? undefined,
          invoiceUrl: invoiceUrl?.hostedUrl,
          newPurchasedBalance: account?.purchasedBalance,
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

/**
 * Best-effort Stripe receipt URL (authoritative hosted receipt for the charge).
 */
async function retrieveStripeReceiptUrl(paymentIntentId: string): Promise<string | null> {
  const stripe = getStripe()
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
  const chargeId = typeof paymentIntent.latest_charge === "string" ? paymentIntent.latest_charge : paymentIntent.latest_charge?.id
  if (!chargeId) return null
  const charge = await stripe.charges.retrieve(chargeId)
  return charge.receipt_url ?? null
}

/**
 * Best-effort Stripe invoice URLs (hosted invoice page + invoice PDF) for
 * one-time Checkout payments created with invoice_creation enabled.
 */
async function retrieveStripeInvoiceUrl(
  session: Stripe.Checkout.Session,
): Promise<{ hostedUrl: string; pdfUrl: string | null } | null> {
  const invoiceId = typeof session.invoice === "string" ? session.invoice : session.invoice?.id
  if (!invoiceId) return null
  const invoice = await getStripe().invoices.retrieve(invoiceId)
  if (!invoice.hosted_invoice_url) return null
  return { hostedUrl: invoice.hosted_invoice_url, pdfUrl: invoice.invoice_pdf ?? null }
}

/**
 * Authoritative refund handling for credit top-up payments.
 *
 * A refunded payment must never become a permanent credit grant:
 *   - Top-up never completed (credits never granted): mark the top-up
 *     refunded for audit. Zero balance changes.
 *   - Top-up completed: reverse the refunded credits from the ORIGINAL
 *     purchaser only, idempotently per Stripe refund ID, inside the
 *     established refund rules (no negative balances, no ledger deletion).
 *
 * Refunds for payments that are not credit top-ups (e.g. subscription
 * invoices) are ignored here.
 */
export async function handleStripeRefundEvent(
  event: Stripe.Event,
): Promise<StripeCreditTopUpResult> {
  if (event.type !== "charge.refunded") {
    return { processed: false, synced: false, reason: `Not a charge.refunded event: ${event.type}` }
  }

  const charge = event.data.object as Stripe.Charge
  const paymentIntent =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent && typeof charge.payment_intent === "object"
        ? charge.payment_intent.id
        : null

  if (!paymentIntent) {
    return { processed: false, synced: false, reason: "Refunded charge has no payment_intent." }
  }

  const topUp = await getCreditTopUpByProviderPaymentId("stripe", paymentIntent)
  if (!topUp) {
    return { processed: false, synced: false, reason: "Refund does not belong to a credit top-up payment." }
  }

  if (topUp.status !== "completed") {
    const marked = await markTopUpRefundedWithoutGrant(
      "stripe",
      paymentIntent,
      `Stripe refund ${charge.id} before credits were granted`,
    )
    debugLog("[stripe-credit-topup] Refund processed for never-granted top-up.", {
      topUpId: topUp.id,
      paymentIntent,
      marked: marked.updated,
    })
    return {
      processed: true,
      synced: true,
      reason: "Payment was refunded before credits were granted — no credits were issued.",
    }
  }

  // Credits were granted — reverse them per applied refund, idempotently.
  const refunds = charge.refunds?.data?.length
    ? charge.refunds.data
    : (await getStripe().charges.retrieve(charge.id, { expand: ["refunds"] })).refunds?.data ?? []

  let creditsReversed = 0
  let flaggedForReview = false
  for (const refund of refunds) {
    if (refund.status !== "succeeded") {
      debugLog("[stripe-credit-topup] Skipping non-succeeded refund.", { refundId: refund.id, status: refund.status })
      continue
    }
    const refundResult = await refundTopUpCredits(
      "stripe",
      paymentIntent,
      refund.amount,
      `Stripe refund ${refund.id}`,
      refund.id,
    )
    if (refundResult.success) {
      creditsReversed += refundResult.creditsRefunded
    }
    if (refundResult.flaggedForReview) {
      flaggedForReview = true
    }
  }

  return {
    processed: true,
    synced: true,
    creditsIssued: creditsReversed,
    reason: flaggedForReview
      ? "Refund recorded but consumed purchased credits require billing review."
      : undefined,
  }
}
