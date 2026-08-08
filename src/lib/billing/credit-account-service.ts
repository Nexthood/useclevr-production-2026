import { getDb } from "@/lib/db"
import { creditLedger, profiles, userCredits } from "@/lib/db/schema"
import { isSuperAdminUserId } from "@/lib/auth/builtin-users"
import { and, desc, eq, gte, lt, sql } from "drizzle-orm"
import {
  canPlanUseFeature,
  estimateFeatureCredits,
  normalizeCreditFeature,
  type CreditFeature,
  type FeatureCostInput,
} from "./feature-costs"
import {
  getBillingPlanByTier,
  getCreditsLimitForTier,
  getCreditResetDayForTier,
} from "./plans"

export interface CreditAccountInfo {
  userId: string
  planId: string
  includedBalance: number
  purchasedBalance: number
  totalAvailableBalance: number
  usedCredits: number
  reservedCredits: number
  remainingCredits: number
  creditsResetAt: Date
  lastResetAt: Date | null
  lifetimeCreditsEarned: number
  lifetimeCreditsUsed: number
  totalPaidCents: number
  currency: string
  tier: string
}

export interface PurchaseCreditInput {
  userId: string
  amount: number
  monetaryAmountCents: number
  currency: string
  paymentProvider: string
  providerTransactionId: string
  paymentStatus: string
  source?: string
  metadata?: Record<string, unknown>
  adminUserId?: string
}

export interface SpendingLimitInput {
  userId: string
  dailyLimit?: number | null
  weeklyLimit?: number | null
  monthlyPurchasedLimit?: number | null
  perOperationMax?: number | null
  lowBalanceWarningPercent?: number | null
  autoTopUpEnabled?: boolean
}

export interface SpendingLimits {
  userId: string
  dailyLimit: number | null
  weeklyLimit: number | null
  monthlyPurchasedLimit: number | null
  perOperationMax: number | null
  lowBalanceWarningPercent: number | null
  autoTopUpEnabled: boolean
}

export interface TransactionQueryOptions {
  limit?: number
  offset?: number
  transactionType?: string
  feature?: string
  source?: string
  fromDate?: Date
  toDate?: Date
  workspaceId?: string
}

export interface PurchaseTrace {
  purchaseId: string
  monetaryAmountCents: number
  currency: string
  creditsIssued: number
  createdAt: Date
  consumedBy: Array<{
    transactionId: string
    action: string
    feature: string
    credits: number
    monetaryEquivalentCents: number
    datasetId?: string | null
    reportId?: string | null
    createdAt: Date
  }>
  remainingCredits: number
  remainingMonetaryCents: number
}

export interface ReconciliationResult {
  userId: string
  expectedBalance: number
  actualBalance: number
  difference: number
  hasMismatch: boolean
  checkedAt: Date
}

export const CREDITS_PER_EURO = 10
export const CREDIT_CURRENCY = "EUR"

function accountId() {
  return `uc_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`
}

function toAccountInfo(row: typeof userCredits.$inferSelect & { tier?: string | null }): CreditAccountInfo {
  return {
    userId: row.userId,
    planId: row.planId,
    includedBalance: row.includedBalance ?? 0,
    purchasedBalance: row.purchasedBalance ?? 0,
    totalAvailableBalance: (row.includedBalance ?? 0) + (row.purchasedBalance ?? 0),
    usedCredits: row.usedCredits,
    reservedCredits: row.reservedCredits ?? 0,
    remainingCredits: row.remainingCredits,
    creditsResetAt: row.creditsResetAt,
    lastResetAt: row.lastResetAt ?? null,
    lifetimeCreditsEarned: row.lifetimeCreditsEarned,
    lifetimeCreditsUsed: row.lifetimeCreditsUsed,
    totalPaidCents: row.totalPaidCents ?? 0,
    currency: CREDIT_CURRENCY,
    tier: row.tier ?? "free",
  }
}

export async function getCreditAccount(userId: string): Promise<CreditAccountInfo | null> {
  const db = getDb()
  if (!db) return null

  const account = await db.query.userCredits.findFirst({
    where: eq(userCredits.userId, userId),
  })

  if (!account) {
    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, userId),
      columns: { subscriptionTier: true },
    })
    return initializeCreditAccount(userId, profile?.subscriptionTier || "free")
  }

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
    columns: { subscriptionTier: true },
  })

  return toAccountInfo({ ...account, tier: profile?.subscriptionTier ?? "free" })
}

export async function initializeCreditAccount(userId: string, tier: string): Promise<CreditAccountInfo | null> {
  const db = getDb()
  if (!db) return null

  if (await hasUnlimitedCreditAccess(userId)) return null

  const existing = await db.query.userCredits.findFirst({ where: eq(userCredits.userId, userId) })
  if (existing) return toAccountInfo(existing)

  const plan = getBillingPlanByTier(tier)
  const monthlyCredits = getCreditsLimitForTier(tier)
  const resetDate = nextResetDate(tier)
  const now = new Date()
  const idempotencyKey = `grant:initial:${userId}:${plan.id}`
  const id = accountId()

  await db.transaction(async (tx) => {
    await tx.insert(userCredits).values({
      id,
      userId,
      planId: plan.id,
      totalCredits: monthlyCredits,
      includedBalance: monthlyCredits,
      purchasedBalance: 0,
      totalPaidCents: 0,
      usedCredits: 0,
      reservedCredits: 0,
      remainingCredits: monthlyCredits,
      creditsResetAt: resetDate,
      lifetimeCreditsEarned: monthlyCredits,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing()

    await tx.insert(creditLedger).values({
      id: ledgerId(),
      workspaceId: userId,
      userId,
      type: "grant",
      transactionType: "PLAN_ALLOCATION",
      status: "finalized",
      operationId: idempotencyKey,
      idempotencyKey,
      amount: monthlyCredits,
      credits: monthlyCredits,
      balanceBefore: 0,
      balanceAfter: monthlyCredits,
      includedBalanceBefore: 0,
      includedBalanceAfter: monthlyCredits,
      purchasedBalanceBefore: 0,
      purchasedBalanceAfter: 0,
      source: "subscription",
      feature: "initial_allowance",
      action: "initial_credits",
      description: `Initial credits for ${plan.name} plan`,
      relatedPlanId: plan.id,
      currency: CREDIT_CURRENCY,
      metadata: { tier: plan.tier, includedBalance: monthlyCredits, purchasedBalance: 0 },
      createdAt: now,
      finalizedAt: now,
    }).onConflictDoNothing()
  })

  const created = await db.query.userCredits.findFirst({ where: eq(userCredits.userId, userId) })
  return created ? toAccountInfo(created) : null
}

export async function addPurchasedCredits(input: PurchaseCreditInput): Promise<CreditAccountInfo | null> {
  const db = getDb()
  if (!db) return null

  if (await hasUnlimitedCreditAccess(input.userId)) return null

  const account = await getCreditAccount(input.userId)
  if (!account) return null

  const now = new Date()
  const idempotencyKey = `purchase:${input.userId}:${input.providerTransactionId}`
  const existing = await db.query.creditLedger.findFirst({
    where: eq(creditLedger.idempotencyKey, idempotencyKey),
  })
  if (existing) {
    return getCreditAccount(input.userId)
  }

  const newPurchasedBalance = account.purchasedBalance + input.amount
  const newTotalAvailable = account.includedBalance + newPurchasedBalance
  const newTotalPaidCents = account.totalPaidCents + input.monetaryAmountCents
  const ledgerId = `cl_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`

  await db.transaction(async (tx) => {
    await tx.update(userCredits)
      .set({
        purchasedBalance: newPurchasedBalance,
        totalPaidCents: newTotalPaidCents,
        remainingCredits: newTotalAvailable,
        lifetimeCreditsEarned: account.lifetimeCreditsEarned + input.amount,
        updatedAt: now,
      })
      .where(eq(userCredits.userId, input.userId))

    await tx.insert(creditLedger).values({
      id: ledgerId,
      workspaceId: input.userId,
      userId: input.userId,
      type: "purchase",
      transactionType: "TOP_UP_PURCHASE",
      status: "finalized",
      operationId: idempotencyKey,
      idempotencyKey,
      amount: input.amount,
      credits: input.amount,
      balanceBefore: account.totalAvailableBalance,
      balanceAfter: newTotalAvailable,
      includedBalanceBefore: account.includedBalance,
      includedBalanceAfter: account.includedBalance,
      purchasedBalanceBefore: account.purchasedBalance,
      purchasedBalanceAfter: newPurchasedBalance,
      monetaryAmount: input.monetaryAmountCents,
      currency: input.currency,
      source: input.source || "payment_provider",
      action: "credit_top_up",
      description: `Purchased ${input.amount} credits for ${input.monetaryAmountCents / 100} ${input.currency}`,
      paymentProvider: input.paymentProvider,
      providerTransactionId: input.providerTransactionId,
      paymentStatus: input.paymentStatus,
      adminUserId: input.adminUserId || null,
      metadata: {
        ...input.metadata,
        monetaryAmountCents: input.monetaryAmountCents,
        purchaseId: ledgerId,
      },
      createdAt: now,
      finalizedAt: now,
    }).onConflictDoNothing()
  })

  return getCreditAccount(input.userId)
}

export async function refundPurchase(
  userId: string,
  purchaseLedgerId: string,
  refundAmountCents: number,
  reason: string,
  adminUserId?: string
): Promise<CreditAccountInfo | null> {
  const db = getDb()
  if (!db) return null

  const purchase = await db.query.creditLedger.findFirst({
    where: and(
      eq(creditLedger.id, purchaseLedgerId),
      eq(creditLedger.userId, userId),
      eq(creditLedger.transactionType, "TOP_UP_PURCHASE")
    ),
  })

  if (!purchase) return null

  const account = await getCreditAccount(userId)
  if (!account) return null

  const refundCredits = Math.min(
    account.purchasedBalance,
    Math.round((refundAmountCents / (purchase.monetaryAmount || 1)) * purchase.credits)
  )

  if (refundCredits <= 0) return account

  const now = new Date()
  const newPurchasedBalance = Math.max(0, account.purchasedBalance - refundCredits)
  const newTotalAvailable = account.includedBalance + newPurchasedBalance
  const idempotencyKey = `refund:${userId}:${purchaseLedgerId}:${Date.now()}`

  await db.transaction(async (tx) => {
    await tx.update(userCredits)
      .set({
        purchasedBalance: newPurchasedBalance,
        totalPaidCents: Math.max(0, account.totalPaidCents - refundAmountCents),
        remainingCredits: newTotalAvailable,
        updatedAt: now,
      })
      .where(eq(userCredits.userId, userId))

    await tx.insert(creditLedger).values({
      id: `cl_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`,
      workspaceId: userId,
      userId,
      type: "refund",
      transactionType: "REFUND",
      status: "finalized",
      operationId: idempotencyKey,
      idempotencyKey,
      amount: -refundCredits,
      credits: refundCredits,
      balanceBefore: account.totalAvailableBalance,
      balanceAfter: newTotalAvailable,
      includedBalanceBefore: account.includedBalance,
      includedBalanceAfter: account.includedBalance,
      purchasedBalanceBefore: account.purchasedBalance,
      purchasedBalanceAfter: newPurchasedBalance,
      monetaryAmount: -refundAmountCents,
      currency: purchase.currency || CREDIT_CURRENCY,
      source: "payment_provider",
      action: "purchase_refund",
      description: `Refund for purchase ${purchaseLedgerId}: ${reason}`,
      paymentProvider: purchase.paymentProvider,
      providerTransactionId: purchase.providerTransactionId,
      paymentStatus: "refunded",
      adminUserId: adminUserId || null,
      metadata: { reason, originalPurchaseId: purchaseLedgerId, refundAmountCents },
      createdAt: now,
      finalizedAt: now,
    }).onConflictDoNothing()
  })

  return getCreditAccount(userId)
}

export async function getPurchaseTraces(userId: string): Promise<PurchaseTrace[]> {
  const db = getDb()
  if (!db) return []

  const purchases = await db.query.creditLedger.findMany({
    where: and(
      eq(creditLedger.userId, userId),
      eq(creditLedger.transactionType, "TOP_UP_PURCHASE")
    ),
    orderBy: (ledger, { desc }) => [desc(ledger.createdAt)],
  })

  const traces: PurchaseTrace[] = []

  for (const purchase of purchases) {
    const consumed = await db.query.creditLedger.findMany({
      where: and(
        eq(creditLedger.userId, userId),
        eq(creditLedger.transactionType, "USAGE_DEBIT"),
        sql`${creditLedger.createdAt} >= ${purchase.createdAt}`
      ),
      orderBy: (ledger, { asc }) => [asc(ledger.createdAt)],
    })

    const totalConsumedCredits = consumed.reduce((sum, t) => sum + Math.abs(t.credits || t.amount || 0), 0)
    const remainingCredits = purchase.credits - totalConsumedCredits
    const monetaryEquivalentCents = purchase.monetaryAmount || 0
    const remainingMonetaryCents = Math.max(0, monetaryEquivalentCents - (totalConsumedCredits / purchase.credits) * monetaryEquivalentCents)

    traces.push({
      purchaseId: purchase.id,
      monetaryAmountCents: monetaryEquivalentCents,
      currency: purchase.currency || CREDIT_CURRENCY,
      creditsIssued: purchase.credits,
      createdAt: purchase.createdAt,
      consumedBy: consumed.map((t) => ({
        transactionId: t.id,
        action: t.action,
        feature: t.feature || "unknown",
        credits: Math.abs(t.credits || t.amount || 0),
        monetaryEquivalentCents: Math.round((monetaryEquivalentCents / purchase.credits) * Math.abs(t.credits || t.amount || 0)),
        datasetId: t.datasetId || null,
        reportId: t.reportId || null,
        createdAt: t.createdAt,
      })),
      remainingCredits: Math.max(0, remainingCredits),
      remainingMonetaryCents: Math.max(0, remainingMonetaryCents),
    })
  }

  return traces
}

export async function reconcileAccount(userId: string): Promise<ReconciliationResult> {
  const db = getDb()
  if (!db) {
    return {
      userId,
      expectedBalance: 0,
      actualBalance: 0,
      difference: 0,
      hasMismatch: false,
      checkedAt: new Date(),
    }
  }

  const account = await getCreditAccount(userId)
  if (!account) {
    return {
      userId,
      expectedBalance: 0,
      actualBalance: 0,
      difference: 0,
      hasMismatch: false,
      checkedAt: new Date(),
    }
  }

  const ledgerResult = await db
    .select({
      total: sql<number>`COALESCE(SUM(${creditLedger.amount}), 0)`,
    })
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId))

  const ledgerCalculatedBalance = Number(ledgerResult[0]?.total || 0)
  const actualBalance = account.totalAvailableBalance
  const expectedBalance = Math.max(0, ledgerCalculatedBalance)

  return {
    userId,
    expectedBalance,
    actualBalance,
    difference: actualBalance - expectedBalance,
    hasMismatch: Math.abs(actualBalance - expectedBalance) > 0,
    checkedAt: new Date(),
  }
}

export async function exportUsageCsv(userId: string, options: TransactionQueryOptions = {}): Promise<string> {
  const db = getDb()
  if (!db) return ""

  const conditions = [eq(creditLedger.userId, userId)]
  if (options.transactionType) conditions.push(eq(creditLedger.transactionType, options.transactionType as any))
  if (options.feature) conditions.push(eq(creditLedger.feature, options.feature))
  if (options.source) conditions.push(eq(creditLedger.source, options.source))
  if (options.fromDate) conditions.push(gte(creditLedger.createdAt, options.fromDate))
  if (options.toDate) conditions.push(lt(creditLedger.createdAt, options.toDate))
  if (options.workspaceId) conditions.push(eq(creditLedger.workspaceId, options.workspaceId))

  const transactions = await db
    .select({
      id: creditLedger.id,
      createdAt: creditLedger.createdAt,
      transactionType: creditLedger.transactionType,
      action: creditLedger.action,
      feature: creditLedger.feature,
      datasetId: creditLedger.datasetId,
      reportId: creditLedger.reportId,
      analysisId: creditLedger.analysisId,
      requestId: creditLedger.requestId,
      amount: creditLedger.amount,
      credits: creditLedger.credits,
      balanceBefore: creditLedger.balanceBefore,
      balanceAfter: creditLedger.balanceAfter,
      includedBalanceBefore: creditLedger.includedBalanceBefore,
      includedBalanceAfter: creditLedger.includedBalanceAfter,
      purchasedBalanceBefore: creditLedger.purchasedBalanceBefore,
      purchasedBalanceAfter: creditLedger.purchasedBalanceAfter,
      monetaryAmount: creditLedger.monetaryAmount,
      currency: creditLedger.currency,
      source: creditLedger.source,
      status: creditLedger.status,
      description: creditLedger.description,
    })
    .from(creditLedger)
    .where(and(...conditions))
    .orderBy(desc(creditLedger.createdAt))
    .limit(options.limit || 1000)
    .offset(options.offset || 0)

  const headers = [
    "timestamp",
    "transaction_id",
    "action",
    "module",
    "dataset",
    "report",
    "analysis",
    "request_id",
    "credits_delta",
    "balance_before",
    "balance_after",
    "included_before",
    "included_after",
    "purchased_before",
    "purchased_after",
    "monetary_equivalent",
    "currency",
    "source",
    "status",
    "details",
  ]

  const rows = transactions.map((t) => {
    const timestamp = t.createdAt ? new Date(t.createdAt).toISOString() : ""
    const creditsDelta = t.credits || t.amount || 0
    const monetaryEquivalent = t.monetaryAmount ? `${(t.monetaryAmount / 100).toFixed(2)}` : "0.00"
    const details = (t.description || "").replace(/"/g, '""')

    return [
      timestamp,
      t.id,
      t.action,
      t.feature || "",
      t.datasetId || "",
      t.reportId || "",
      t.analysisId || "",
      t.requestId || "",
      String(creditsDelta),
      String(t.balanceBefore),
      String(t.balanceAfter),
      String(t.includedBalanceBefore ?? t.balanceBefore),
      String(t.includedBalanceAfter ?? t.balanceAfter),
      String(t.purchasedBalanceBefore ?? 0),
      String(t.purchasedBalanceAfter ?? 0),
      monetaryEquivalent,
      t.currency || CREDIT_CURRENCY,
      t.source || "",
      t.status || "",
      details,
    ]
      .map((v) => `"${v}"`)
      .join(",")
  })

  return [headers.join(","), ...rows].join("\n")
}

export async function getTransactionLedger(
  userId: string,
  options: TransactionQueryOptions = {}
): Promise<Array<typeof creditLedger.$inferSelect>> {
  const db = getDb()
  if (!db) return []

  const conditions = [eq(creditLedger.userId, userId)]
  if (options.transactionType) conditions.push(eq(creditLedger.transactionType, options.transactionType as any))
  if (options.feature) conditions.push(eq(creditLedger.feature, options.feature))
  if (options.source) conditions.push(eq(creditLedger.source, options.source))
  if (options.fromDate) conditions.push(gte(creditLedger.createdAt, options.fromDate))
  if (options.toDate) conditions.push(lt(creditLedger.createdAt, options.toDate))
  if (options.workspaceId) conditions.push(eq(creditLedger.workspaceId, options.workspaceId))

  return db
    .select()
    .from(creditLedger)
    .where(and(...conditions))
    .orderBy(desc(creditLedger.createdAt))
    .limit(options.limit || 50)
    .offset(options.offset || 0)
}

export async function checkSpendingLimits(userId: string): Promise<{
  blocked: boolean
  reason?: string
  limits: SpendingLimits | null
}> {
  const db = getDb()
  if (!db) return { blocked: false, limits: null }

  const limits = await getSpendingLimits(userId)
  if (!limits) return { blocked: false, limits: null }

  const account = await getCreditAccount(userId)
  if (!account) return { blocked: false, limits }

  if (limits.monthlyPurchasedLimit !== null && limits.monthlyPurchasedLimit > 0) {
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const monthUsageResult = await db
      .select({
        total: sql<number>`COALESCE(SUM(${creditLedger.amount}), 0)`,
      })
      .from(creditLedger)
      .where(
        and(
          eq(creditLedger.userId, userId),
          eq(creditLedger.transactionType, "USAGE_DEBIT"),
          gte(creditLedger.createdAt, monthStart)
        )
      )

    const monthUsed = Math.abs(Number(monthUsageResult[0]?.total || 0))
    if (monthUsed >= limits.monthlyPurchasedLimit) {
      return {
        blocked: true,
        reason: `Monthly purchased credit limit reached (${monthUsed}/${limits.monthlyPurchasedLimit} credits used this month).`,
        limits,
      }
    }
  }

  if (limits.lowBalanceWarningPercent !== null && limits.lowBalanceWarningPercent > 0) {
    const threshold = Math.ceil((limits.lowBalanceWarningPercent / 100) * account.totalAvailableBalance)
    if (account.purchasedBalance > 0 && account.purchasedBalance <= threshold) {
      return {
        blocked: false,
        reason: `Low purchased credit balance: ${account.purchasedBalance} credits remaining (${limits.lowBalanceWarningPercent}% threshold).`,
        limits,
      }
    }
  }

  return { blocked: false, limits }
}

export async function getSpendingLimits(userId: string): Promise<SpendingLimits | null> {
  const db = getDb()
  if (!db) return null

  const existing = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
    columns: {
      id: true,
      billingSettings: true,
    },
  })

  if (!existing) return null

  const settings = (existing.billingSettings as Record<string, unknown> | null) || {}
  return {
    userId,
    dailyLimit: typeof settings.dailyLimit === "number" ? settings.dailyLimit : null,
    weeklyLimit: typeof settings.weeklyLimit === "number" ? settings.weeklyLimit : null,
    monthlyPurchasedLimit: typeof settings.monthlyPurchasedLimit === "number" ? settings.monthlyPurchasedLimit : null,
    perOperationMax: typeof settings.perOperationMax === "number" ? settings.perOperationMax : null,
    lowBalanceWarningPercent: typeof settings.lowBalanceWarningPercent === "number" ? settings.lowBalanceWarningPercent : 20,
    autoTopUpEnabled: Boolean(settings.autoTopUpEnabled),
  }
}

export async function setSpendingLimits(userId: string, input: SpendingLimitInput): Promise<SpendingLimits | null> {
  const db = getDb()
  if (!db) return null

  const existing = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
  })

  if (!existing) return null

  const current = ((existing.billingSettings as Record<string, unknown> | null) || {}) as Record<string, unknown>
  const next = {
    ...current,
    dailyLimit: input.dailyLimit ?? current.dailyLimit ?? null,
    weeklyLimit: input.weeklyLimit ?? current.weeklyLimit ?? null,
    monthlyPurchasedLimit: input.monthlyPurchasedLimit ?? current.monthlyPurchasedLimit ?? null,
    perOperationMax: input.perOperationMax ?? current.perOperationMax ?? null,
    lowBalanceWarningPercent: input.lowBalanceWarningPercent ?? current.lowBalanceWarningPercent ?? 20,
    autoTopUpEnabled: input.autoTopUpEnabled ?? current.autoTopUpEnabled ?? false,
    updatedAt: new Date().toISOString(),
  } as Record<string, unknown>

  await db.update(profiles).set({ billingSettings: next }).where(eq(profiles.id, existing.id))

  return getSpendingLimits(userId)
}

async function hasUnlimitedCreditAccess(userId: string, role?: string | null): Promise<boolean> {
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

function nextResetDate(tier: string) {
  const resetDay = getCreditResetDayForTier(tier)
  const now = new Date()
  const resetDate = new Date(now.getFullYear(), now.getMonth(), resetDay, 0, 0, 0, 0)
  if (resetDate <= now) resetDate.setMonth(resetDate.getMonth() + 1)
  return resetDate
}

function ledgerId() {
  return `cl_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`
}

export async function getCreditPricingPreview(feature: string, input: FeatureCostInput = {}): Promise<{
  actionType: string
  creditCost: number
  estimatedMonetaryEquivalent: number
  currency: string
  pricingVersion: string
  explanation: string
} | null> {
  const normalizedFeature = normalizeCreditFeature(feature)
  const rule = canPlanUseFeature("free", normalizedFeature)

  const creditCost = estimateFeatureCredits(normalizedFeature, input)
  const monetaryEquivalent = creditCost / CREDITS_PER_EURO

  return {
    actionType: normalizedFeature,
    creditCost,
    estimatedMonetaryEquivalent: monetaryEquivalent,
    currency: CREDIT_CURRENCY,
    pricingVersion: new Date().toISOString().slice(0, 10),
    explanation: `${creditCost} credits at ${CREDITS_PER_EURO} credits per ${CREDIT_CURRENCY}`,
  }
}
