import { getDb } from "@/lib/db"
import { userCredits, creditLedger, subscriptionPlans, profiles } from "@/lib/db/schema"
import { eq, and, gt, lt, lte, gte } from "drizzle-orm"
import { isSuperAdminUserId } from "@/lib/auth/builtin-users"
import {
  getBillingPlanByTier,
  getCreditsLimitForTier,
  getCreditResetDayForTier,
} from "./plans"
import { calculateTokenCost } from "./provider-pricing"

export interface CreditCheckResult {
  allowed: boolean
  remainingCredits: number
  requiredCredits: number
  currentPlan: string
  upgradeMessage?: string
  resetDate?: string
}

export interface CreditDeductionResult {
  success: boolean
  remainingCredits: number
  creditsDeducted: number
  newLedgerEntry?: string
  error?: string
}

export interface UserCreditInfo {
  userId: string
  planId: string
  totalCredits: number
  usedCredits: number
  remainingCredits: number
  creditsResetAt: Date
  lastResetAt: Date | null
  lifetimeCreditsEarned: number
  lifetimeCreditsUsed: number
}

export const CREDIT_COSTS: Record<string, number> = {
  dataset_analysis: 10,
  ai_chat: 2,
  dashboard_generation: 15,
  report_generation: 20,
  forecast_analysis: 25,
  multi_dataset_analysis: 30,
  data_insight: 5,
  file_upload: 0,
  mcp_tool_invocation: 1,
}

export const CREDITS_PER_EURO = 10

export function getActionCreditCost(actionType: string): number {
  return CREDIT_COSTS[actionType] || 5
}

export function eurosToCredits(euros: number): number {
  return Math.ceil(euros * CREDITS_PER_EURO)
}

export function creditsToEuros(credits: number): number {
  return credits / CREDITS_PER_EURO
}

async function hasUnlimitedCreditAccess(userId: string): Promise<boolean> {
  if (isSuperAdminUserId(userId)) return true

  const db = getDb()
  if (!db) return false

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
    columns: { role: true, subscriptionTier: true },
  })

  return (
    profile?.role === "admin" ||
    profile?.role === "superadmin" ||
    profile?.subscriptionTier === "admin" ||
    profile?.subscriptionTier === "superadmin"
  )
}

export async function initializeUserCredits(
  userId: string,
  tier: string
): Promise<UserCreditInfo | null> {
  const db = getDb()
  if (!db) return null

  if (isSuperAdminUserId(userId)) {
    return {
      userId,
      planId: "superadmin",
      totalCredits: 999999999,
      usedCredits: 0,
      remainingCredits: 999999999,
      creditsResetAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      lastResetAt: null,
      lifetimeCreditsEarned: 0,
      lifetimeCreditsUsed: 0,
    }
  }

  const plan = getBillingPlanByTier(tier)
  const monthlyCredits = getCreditsLimitForTier(tier)
  const resetDay = getCreditResetDayForTier(tier)

  const now = new Date()
  const resetDate = new Date(now.getFullYear(), now.getMonth(), resetDay, 0, 0, 0, 0)
  if (resetDate <= now) {
    resetDate.setMonth(resetDate.getMonth() + 1)
  }

  const existing = await db.query.userCredits.findFirst({
    where: eq(userCredits.userId, userId),
  })

  if (existing) {
    return {
      userId: existing.userId,
      planId: existing.planId,
      totalCredits: existing.totalCredits,
      usedCredits: existing.usedCredits,
      remainingCredits: existing.remainingCredits,
      creditsResetAt: existing.creditsResetAt,
      lastResetAt: existing.lastResetAt,
      lifetimeCreditsEarned: existing.lifetimeCreditsEarned,
      lifetimeCreditsUsed: existing.lifetimeCreditsUsed,
    }
  }

  const id = `uc_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`
  await db.insert(userCredits).values({
    id,
    userId,
    planId: plan.id,
    totalCredits: monthlyCredits,
    usedCredits: 0,
    remainingCredits: monthlyCredits,
    creditsResetAt: resetDate,
    lifetimeCreditsEarned: monthlyCredits,
  })

  await db.insert(creditLedger).values({
    id: `cl_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
    userId,
    type: "credit_grant",
    amount: monthlyCredits,
    balanceBefore: 0,
    balanceAfter: monthlyCredits,
    action: "initial_credits",
    description: `Initial credits for ${plan.name} plan`,
    relatedPlanId: plan.id,
  })

  return {
    userId,
    planId: plan.id,
    totalCredits: monthlyCredits,
    usedCredits: 0,
    remainingCredits: monthlyCredits,
    creditsResetAt: resetDate,
    lastResetAt: null,
    lifetimeCreditsEarned: monthlyCredits,
    lifetimeCreditsUsed: 0,
  }
}

export async function getUserCreditInfo(userId: string): Promise<UserCreditInfo | null> {
  const db = getDb()
  if (!db) return null

  if (isSuperAdminUserId(userId)) {
    return {
      userId,
      planId: "superadmin",
      totalCredits: 999999999,
      usedCredits: 0,
      remainingCredits: 999999999,
      creditsResetAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      lastResetAt: null,
      lifetimeCreditsEarned: 0,
      lifetimeCreditsUsed: 0,
    }
  }

  const creditInfo = await db.query.userCredits.findFirst({
    where: eq(userCredits.userId, userId),
  })

  if (!creditInfo) {
    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, userId),
    })
    const tier = profile?.subscriptionTier || "free"
    return initializeUserCredits(userId, tier)
  }

  await checkAndPerformMonthlyReset(userId)

  return {
    userId: creditInfo.userId,
    planId: creditInfo.planId,
    totalCredits: creditInfo.totalCredits,
    usedCredits: creditInfo.usedCredits,
    remainingCredits: creditInfo.remainingCredits,
    creditsResetAt: creditInfo.creditsResetAt,
    lastResetAt: creditInfo.lastResetAt,
    lifetimeCreditsEarned: creditInfo.lifetimeCreditsEarned,
    lifetimeCreditsUsed: creditInfo.lifetimeCreditsUsed,
  }
}

export async function checkCredits(
  userId: string,
  actionType: string
): Promise<CreditCheckResult> {
  if (await hasUnlimitedCreditAccess(userId)) {
    return {
      allowed: true,
      remainingCredits: 999999999,
      requiredCredits: getActionCreditCost(actionType),
      currentPlan: "unlimited",
    }
  }

  const creditInfo = await getUserCreditInfo(userId)
  if (!creditInfo) {
    return {
      allowed: false,
      remainingCredits: 0,
      requiredCredits: getActionCreditCost(actionType),
      currentPlan: "unknown",
      upgradeMessage: "Unable to verify credits. Please try again.",
    }
  }

  const requiredCredits = getActionCreditCost(actionType)
  const remainingCredits = creditInfo.remainingCredits
  const allowed = remainingCredits >= requiredCredits

  return {
    allowed,
    remainingCredits,
    requiredCredits,
    currentPlan: creditInfo.planId,
    upgradeMessage: allowed
      ? undefined
      : `Insufficient credits. You have ${remainingCredits} credits but this action requires ${requiredCredits} credits. Upgrade to a higher plan for more credits.`,
    resetDate: creditInfo.creditsResetAt.toISOString(),
  }
}

export async function deductCredits(
  userId: string,
  actionType: string,
  datasetId?: string,
  tokenCost?: { inputTokens: number; outputTokens: number; model: string }
): Promise<CreditDeductionResult> {
  const db = getDb()
  if (!db) {
    return { success: false, remainingCredits: 0, creditsDeducted: 0, error: "Database unavailable" }
  }

  if (await hasUnlimitedCreditAccess(userId)) {
    return { success: true, remainingCredits: 999999999, creditsDeducted: 0 }
  }

  const creditInfo = await getUserCreditInfo(userId)
  if (!creditInfo) {
    return { success: false, remainingCredits: 0, creditsDeducted: 0, error: "User credits not found" }
  }

  let creditsToDeduct = getActionCreditCost(actionType)

  if (tokenCost) {
    const eurCost = calculateTokenCost(
      tokenCost.model,
      tokenCost.inputTokens,
      tokenCost.outputTokens
    )
    const tokenCredits = eurosToCredits(eurCost)
    creditsToDeduct = Math.max(creditsToDeduct, tokenCredits)
  }

  if (creditInfo.remainingCredits < creditsToDeduct) {
    return {
      success: false,
      remainingCredits: creditInfo.remainingCredits,
      creditsDeducted: 0,
      error: `Insufficient credits. Need ${creditsToDeduct} but have ${creditInfo.remainingCredits}.`,
    }
  }

  const newRemaining = creditInfo.remainingCredits - creditsToDeduct
  const newUsed = creditInfo.usedCredits + creditsToDeduct

  await db
    .update(userCredits)
    .set({
      remainingCredits: newRemaining,
      usedCredits: newUsed,
      lifetimeCreditsUsed: creditInfo.lifetimeCreditsUsed + creditsToDeduct,
      updatedAt: new Date(),
    })
    .where(eq(userCredits.userId, userId))

  const ledgerId = `cl_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`
  await db.insert(creditLedger).values({
    id: ledgerId,
    userId,
    type: "credit_used",
    amount: -creditsToDeduct,
    balanceBefore: creditInfo.remainingCredits,
    balanceAfter: newRemaining,
    action: actionType,
    description: `${actionType} action`,
    relatedDatasetId: datasetId,
  })

  return {
    success: true,
    remainingCredits: newRemaining,
    creditsDeducted: creditsToDeduct,
    newLedgerEntry: ledgerId,
  }
}

export async function refundCredits(
  userId: string,
  amount: number,
  reason: string,
  datasetId?: string
): Promise<boolean> {
  const db = getDb()
  if (!db) return false

  if (await hasUnlimitedCreditAccess(userId)) {
    return true
  }

  const creditInfo = await getUserCreditInfo(userId)
  if (!creditInfo) return false

  const newRemaining = creditInfo.remainingCredits + amount
  const newUsed = Math.max(0, creditInfo.usedCredits - amount)

  await db
    .update(userCredits)
    .set({
      remainingCredits: newRemaining,
      usedCredits: newUsed,
      updatedAt: new Date(),
    })
    .where(eq(userCredits.userId, userId))

  await db.insert(creditLedger).values({
    id: `cl_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
    userId,
    type: "credit_refund",
    amount,
    balanceBefore: creditInfo.remainingCredits,
    balanceAfter: newRemaining,
    action: "refund",
    description: reason,
    relatedDatasetId: datasetId,
  })

  return true
}

export async function adjustCredits(
  userId: string,
  amount: number,
  reason: string,
  adminUserId: string
): Promise<boolean> {
  const db = getDb()
  if (!db) return false

  const creditInfo = await getUserCreditInfo(userId)
  if (!creditInfo && amount > 0) {
    await initializeUserCredits(userId, "free")
  }

  const currentInfo = await getUserCreditInfo(userId)
  if (!currentInfo) return false

  const newRemaining = Math.max(0, currentInfo.remainingCredits + amount)
  const newTotal = Math.max(0, currentInfo.totalCredits + amount)
  const newLifetime = amount > 0
    ? currentInfo.lifetimeCreditsEarned + amount
    : currentInfo.lifetimeCreditsEarned

  await db
    .update(userCredits)
    .set({
      remainingCredits: newRemaining,
      totalCredits: newTotal,
      lifetimeCreditsEarned: newLifetime,
      updatedAt: new Date(),
    })
    .where(eq(userCredits.userId, userId))

  await db.insert(creditLedger).values({
    id: `cl_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
    userId,
    type: "credit_adjustment",
    amount,
    balanceBefore: currentInfo.remainingCredits,
    balanceAfter: newRemaining,
    action: "admin_adjustment",
    description: reason,
    adminUserId,
  })

  return true
}

export async function checkAndPerformMonthlyReset(userId: string): Promise<boolean> {
  const db = getDb()
  if (!db) return false

  if (await hasUnlimitedCreditAccess(userId)) {
    return false
  }

  const creditInfo = await db.query.userCredits.findFirst({
    where: eq(userCredits.userId, userId),
  })

  if (!creditInfo) return false

  const now = new Date()
  if (creditInfo.creditsResetAt > now) return false

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
  })
  const tier = profile?.subscriptionTier || "free"
  const plan = getBillingPlanByTier(tier)
  const monthlyCredits = getCreditsLimitForTier(tier)
  const resetDay = getCreditResetDayForTier(tier)

  const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, resetDay, 0, 0, 0, 0)

  const previousRemaining = creditInfo.remainingCredits
  const newRemaining = previousRemaining + monthlyCredits

  await db
    .update(userCredits)
    .set({
      totalCredits: monthlyCredits,
      usedCredits: 0,
      remainingCredits: newRemaining,
      creditsResetAt: nextReset,
      lastResetAt: now,
      lifetimeCreditsEarned: creditInfo.lifetimeCreditsEarned + monthlyCredits,
      updatedAt: now,
    })
    .where(eq(userCredits.userId, userId))

  await db.insert(creditLedger).values({
    id: `cl_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
    userId,
    type: "monthly_reset",
    amount: monthlyCredits,
    balanceBefore: previousRemaining,
    balanceAfter: newRemaining,
    action: "monthly_credit_reset",
    description: `Monthly credit reset for ${plan.name} plan`,
    relatedPlanId: plan.id,
  })

  return true
}

export async function processPlanChange(
  userId: string,
  newTier: string
): Promise<boolean> {
  const db = getDb()
  if (!db) return false

  const plan = getBillingPlanByTier(newTier)
  const monthlyCredits = getCreditsLimitForTier(newTier)

  const creditInfo = await getUserCreditInfo(userId)
  if (!creditInfo) {
    await initializeUserCredits(userId, newTier)
    return true
  }

  const previousRemaining = creditInfo.remainingCredits
  const previousPlan = creditInfo.planId

  let type: "subscription_upgrade" | "subscription_downgrade" | "credit_grant"
  if (monthlyCredits > creditInfo.totalCredits) {
    type = "subscription_upgrade"
  } else if (monthlyCredits < creditInfo.totalCredits) {
    type = "subscription_downgrade"
  } else {
    type = "credit_grant"
  }

  const resetDay = getCreditResetDayForTier(newTier)
  const now = new Date()
  const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, resetDay, 0, 0, 0, 0)

  const creditDiff = monthlyCredits - creditInfo.totalCredits
  const newRemaining = Math.max(0, creditInfo.remainingCredits + creditDiff)

  await db
    .update(userCredits)
    .set({
      planId: plan.id,
      totalCredits: monthlyCredits,
      remainingCredits: newRemaining,
      creditsResetAt: nextReset,
      lifetimeCreditsEarned: creditInfo.lifetimeCreditsEarned + (creditDiff > 0 ? creditDiff : 0),
      updatedAt: now,
    })
    .where(eq(userCredits.userId, userId))

  await db.insert(creditLedger).values({
    id: `cl_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
    userId,
    type,
    amount: creditDiff,
    balanceBefore: previousRemaining,
    balanceAfter: newRemaining,
    action: `plan_change_${type}`,
    description: `Plan changed from ${previousPlan} to ${plan.id}`,
    relatedPlanId: plan.id,
  })

  return true
}

export async function getCreditLedger(
  userId: string,
  limit = 50,
  offset = 0
): Promise<Array<{
  id: string
  type: string
  amount: number
  balanceBefore: number
  balanceAfter: number
  action: string
  description: string | null
  createdAt: Date
}>> {
  const db = getDb()
  if (!db) return []

  const entries = await db
    .select()
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId))
    .orderBy(creditLedger.createdAt)
    .limit(limit)
    .offset(offset)

  return entries
}
