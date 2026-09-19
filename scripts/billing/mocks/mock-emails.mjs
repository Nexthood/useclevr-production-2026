/**
 * In-memory replacement for `@/lib/email/subscription-emails` — records
 * sent credit purchase emails instead of delivering anything.
 */

export const sentEmails = []

export async function sendCreditPurchaseEmail(params) {
  sentEmails.push({ ...params })
  return { delivered: true }
}

export function resetEmails() {
  sentEmails.length = 0
}
