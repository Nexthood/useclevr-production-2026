/**
 * In-memory replacement for `@/lib/billing/credit-account-service`.
 * Shared by the credit-topup behavioral tests and the module loader hooks.
 */

export const accountsStore = new Map()

const FREE_INCLUDED_CREDITS = 50

function makeAccount(userId, tier) {
  return {
    userId,
    tier,
    includedBalance: FREE_INCLUDED_CREDITS,
    purchasedBalance: 0,
    remainingCredits: FREE_INCLUDED_CREDITS,
    totalPaidCents: 0,
    lifetimeCreditsEarned: FREE_INCLUDED_CREDITS,
    updatedAt: new Date(),
  }
}

export function ensureAccount(userId, tier = "free") {
  let account = accountsStore.get(userId)
  if (!account) {
    account = makeAccount(userId, tier)
    accountsStore.set(userId, account)
  }
  return account
}

export async function getCreditAccount(userId) {
  const account = accountsStore.get(userId)
  if (!account) return null
  return {
    ...account,
    totalAvailableBalance: account.includedBalance + account.purchasedBalance,
  }
}

export async function initializeCreditAccount(userId, tier = "free") {
  ensureAccount(userId, tier)
  return getCreditAccount(userId)
}

export function applyUserCreditGrant(userId, credits, paidCents, updatedAt = new Date()) {
  const account = accountsStore.get(userId)
  if (!account) throw new Error(`mock-credit-account: no account for ${userId}`)
  account.purchasedBalance += credits
  account.remainingCredits += credits
  account.totalPaidCents += paidCents
  account.lifetimeCreditsEarned += credits
  account.updatedAt = updatedAt
}

export function applyUserCreditRefund(userId, credits, paidCents, updatedAt = new Date()) {
  const account = accountsStore.get(userId)
  if (!account) throw new Error(`mock-credit-account: no account for ${userId}`)
  account.purchasedBalance -= credits
  account.remainingCredits = Math.max(0, account.remainingCredits - credits)
  account.totalPaidCents = Math.max(0, account.totalPaidCents - paidCents)
  account.updatedAt = updatedAt
}

export function resetAccountStore() {
  accountsStore.clear()
}
