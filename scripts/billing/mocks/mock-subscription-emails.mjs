/**
 * In-memory replacement for `@/lib/email/subscription-emails` covering the
 * full subscription lifecycle email set used by the Stripe webhook handler.
 */

export const sentSubscriptionEmails = []

export async function sendSubscriptionActivationEmail(params) {
  sentSubscriptionEmails.push({ type: "activation", ...params })
  return { success: true }
}

export async function sendSubscriptionCancellationEmail(params) {
  sentSubscriptionEmails.push({ type: "cancellation", ...params })
  return { success: true }
}

export async function sendSubscriptionCancellationScheduledEmail(params) {
  sentSubscriptionEmails.push({ type: "cancellation_scheduled", ...params })
  return { success: true }
}

export async function sendCreditPurchaseEmail(params) {
  sentSubscriptionEmails.push({ type: "credit_purchase", ...params })
  return { delivered: true }
}

export function resetSubscriptionEmails() {
  sentSubscriptionEmails.length = 0
}
