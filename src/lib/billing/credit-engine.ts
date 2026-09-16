import { getDb } from "@/lib/db"
import { creditLedger, profiles, subscriptionPlans, userCredits } from "@/lib/db/schema"
import { isSuperAdminUserId } from "@/lib/auth/builtin-users"
import { and, desc, eq, lt, sql } from "drizzle-orm"
import {
  canPlanUseFeature,
  estimateFeatureCredits,
  normalizeCreditFeature,
  type CreditFeature,
  type FeatureCostInput,
} from "./feature-costs"
import {
  billingPlans,
  getBillingPlanByTier,
  getCreditsLimitForTier,
  getCreditResetDayForTier,
} from "./plans"
import { calculateTokenCost } from "./provider-pricing"
import type { ProviderUsage } from "./provider-usage"

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
  includedBalance: number
  purchasedBalance: number
  totalPaidCents: number
  usedCredits: number
  reservedCredits: number
  remainingCredits: number
  availableCredits: number
  creditsResetAt: Date
  lastResetAt: Date | null
  lifetimeCreditsEarned: number
  lifetimeCreditsUsed: number
}

export type CreditReservationResult = {
  success: boolean
  operationId: string
  idempotencyKey: string
  reservedCredits: number
  remainingCredits: number
  availableCredits: number
  unlimited: boolean
  ledgerEntryId?: string
  error?: string
}

export type FinalizeCreditsInput = {
  operationId: string
  actualCredits?: number
  actualUsage?: ProviderUsage
  metadata?: Record<string, unknown>
}

export const CREDITS_PER_EURO = 10

export const CREDIT_COSTS: Record<string, number> = {
  dataset_analysis: estimateFeatureCredits("standard_analysis"),
  ai_chat: estimateFeatureCredits("ai_question"),
  dashboard_generation: estimateFeatureCredits("standard_analysis"),
  report_generation: estimateFeatureCredits("report_generation"),
  forecast_analysis: estimateFeatureCredits("profitability_analysis"),
  multi_dataset_analysis: estimateFeatureCredits("standard_analysis"),
  data_insight: estimateFeatureCredits("standard_analysis"),
  dataset_upload: estimateFeatureCredits("dataset_upload"),
  file_upload: estimateFeatureCredits("dataset_upload"),
  mcp_tool_invocation: estimateFeatureCredits("hybrid_retrieval"),
}

function ledgerId() {
  return `cl_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`
}

function creditId() {
  return `uc_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`
}

function availableFrom(info: Pick<UserCreditInfo, "remainingCredits" | "reservedCredits">) {
  return Math.max(0, info.remainingCredits - info.reservedCredits)
}

function rowsFromResult<T = Record<string, unknown>>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  if (result && typeof result === "object" && Array.isArray((result as { rows?: unknown[] }).rows)) {
    return (result as { rows: T[] }).rows
  }
  return []
}

export function isUnlimitedCreditRole(role?: string | null): boolean {
  return role === "superadmin" || role === "admin"
}

async function hasUnlimitedCreditAccess(userId: string, role?: string | null): Promise<boolean> {
  if (isSuperAdminUserId(userId) || isUnlimitedCreditRole(role)) return true

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

export function getActionCreditCost(actionType: string, input: FeatureCostInput = {}): number {
  return estimateFeatureCredits(actionType, input)
}

export function eurosToCredits(euros: number): number {
  return Math.ceil(euros * CREDITS_PER_EURO)
}

export function creditsToEuros(credits: number): number {
  return credits / CREDITS_PER_EURO
}

function nextResetDate(tier: string) {
  const resetDay = getCreditResetDayForTier(tier)
  const now = new Date()
  const resetDate = new Date(now.getFullYear(), now.getMonth(), resetDay, 0, 0, 0, 0)
  if (resetDate <= now) resetDate.setMonth(resetDate.getMonth() + 1)
  return resetDate
}

function toCreditInfo(row: typeof userCredits.$inferSelect): UserCreditInfo {
  const reservedCredits = row.reservedCredits ?? 0
  return {
    userId: row.userId,
    planId: row.planId,
    totalCredits: row.totalCredits,
    includedBalance: row.includedBalance ?? 0,
    purchasedBalance: row.purchasedBalance ?? 0,
    totalPaidCents: row.totalPaidCents ?? 0,
    usedCredits: row.usedCredits,
    reservedCredits,
    remainingCredits: row.remainingCredits,
    availableCredits: availableFrom({ remainingCredits: row.remainingCredits, reservedCredits }),
    creditsResetAt: row.creditsResetAt,
    lastResetAt: row.lastResetAt ?? null,
    lifetimeCreditsEarned: row.lifetimeCreditsEarned,
    lifetimeCreditsUsed: row.lifetimeCreditsUsed,
  }
}

async function ensureSubscriptionPlanSeeded(planId: string): Promise<boolean> {
  const db = getDb()
  if (!db) return false

  try {
    const existing = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.id, planId),
      columns: { id: true },
    })
    if (existing) return false

    await db.insert(subscriptionPlans).values(
      billingPlans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        tier: plan.tier,
        monthlyCredits: plan.limits.monthlyCredits,
        maxDatasets: plan.limits.maxDatasets,
        maxFileSizeMb: plan.limits.maxFileSizeMb,
        maxRowsPerDataset: plan.limits.maxRowsPerDataset,
        maxTeamMembers: plan.limits.maxTeamMembers,
        maxAiRequestsPerDay: plan.limits.maxAiRequestsPerDay,
        maxConcurrentAnalyses: plan.limits.maxConcurrentAnalyses,
        creditResetDay: plan.limits.creditResetDay,
        priceEur: plan.price,
        stripePriceId: plan.stripePriceId,
        isActive: true,
      })),
    ).onConflictDoNothing()
    console.warn("[CREDIT_ENGINE] subscription plan catalog restored", { planId })
    return true
  } catch (error) {
    console.error("[CREDIT_ENGINE] subscription plan seed failed", {
      planId,
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

export async function initializeUserCredits(userId: string, tier: string): Promise<UserCreditInfo | null> {
  const db = getDb()
  if (!db) return null

  if (await hasUnlimitedCreditAccess(userId)) return null

  const existing = await db.query.userCredits.findFirst({ where: eq(userCredits.userId, userId) })
  if (existing) return toCreditInfo(existing)

  const plan = getBillingPlanByTier(tier)
  const monthlyCredits = getCreditsLimitForTier(tier)
  const resetDate = nextResetDate(tier)
  const now = new Date()
  const idempotencyKey = `grant:initial:${userId}:${plan.id}`
  const id = creditId()

  const insertInitialCredits = async () => {
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
        currency: "EUR",
        metadata: { tier: plan.tier, includedBalance: monthlyCredits, purchasedBalance: 0 },
        finalizedAt: now,
      }).onConflictDoNothing()
    })
  }

  try {
    try {
      await insertInitialCredits()
    } catch (firstError) {
      // A missing SubscriptionPlan row makes the UserCredit insert violate the
      // planId foreign key on every attempt. Restore the plan catalog and retry once.
      await ensureSubscriptionPlanSeeded(plan.id)
      await insertInitialCredits()
      console.warn("[CREDIT_ENGINE] initializeUserCredits retried after plan catalog repair", {
        userId,
        planId: plan.id,
        firstError: firstError instanceof Error ? firstError.message : String(firstError),
      })
    }
  } catch (error) {
    console.error("[CREDIT_ENGINE] initializeUserCredits transaction failed", {
      userId,
      tier,
      planId: plan.id,
      monthlyCredits,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }

  const created = await db.query.userCredits.findFirst({ where: eq(userCredits.userId, userId) })
  return created ? toCreditInfo(created) : null
}

export async function getUserCreditInfo(userId: string): Promise<UserCreditInfo | null> {
  const db = getDb()
  if (!db) return null

  if (await hasUnlimitedCreditAccess(userId)) return null

  const creditInfo = await db.query.userCredits.findFirst({ where: eq(userCredits.userId, userId) })
  if (!creditInfo) {
    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, userId),
      columns: { subscriptionTier: true },
    })
    return initializeUserCredits(userId, profile?.subscriptionTier || "free")
  }

  await checkAndPerformMonthlyReset(userId)
  const refreshed = await db.query.userCredits.findFirst({ where: eq(userCredits.userId, userId) })
  return refreshed ? toCreditInfo(refreshed) : toCreditInfo(creditInfo)
}

export async function checkCredits(userId: string, actionType: string): Promise<CreditCheckResult> {
  const requiredCredits = getActionCreditCost(actionType)
  if (await hasUnlimitedCreditAccess(userId)) {
    return { allowed: true, remainingCredits: 0, requiredCredits, currentPlan: "unlimited" }
  }

  const creditInfo = await getUserCreditInfo(userId)
  if (!creditInfo) {
    return {
      allowed: false,
      remainingCredits: 0,
      requiredCredits,
      currentPlan: "unknown",
      upgradeMessage: "Unable to verify credits. Please try again.",
    }
  }

  const allowed = creditInfo.availableCredits >= requiredCredits
  return {
    allowed,
    remainingCredits: creditInfo.availableCredits,
    requiredCredits,
    currentPlan: creditInfo.planId,
    upgradeMessage: allowed
      ? undefined
      : `Insufficient credits. You have ${creditInfo.availableCredits} available credits but this action reserves ${requiredCredits} credits.`,
    resetDate: creditInfo.creditsResetAt.toISOString(),
  }
}

export async function reserveCredits(input: {
  workspaceId?: string
  userId: string
  operationId?: string
  idempotencyKey?: string
  estimatedCredits?: number
  feature: CreditFeature | string
  source?: string
  metadata?: Record<string, unknown>
  role?: string | null
  email?: string | null
}): Promise<CreditReservationResult> {
  const db = getDb()
  if (!db) {
    return {
      success: false,
      operationId: input.operationId || "",
      idempotencyKey: input.idempotencyKey || "",
      reservedCredits: 0,
      remainingCredits: 0,
      availableCredits: 0,
      unlimited: false,
      error: "Database unavailable",
    }
  }

  const workspaceId = input.workspaceId || input.userId
  const feature = normalizeCreditFeature(input.feature)
  const estimatedCredits = Math.max(0, Math.ceil(input.estimatedCredits ?? estimateFeatureCredits(feature)))
  const operationId = input.operationId || `op_${crypto.randomUUID()}`
  let idempotencyKey = input.idempotencyKey || `reserve:${workspaceId}:${operationId}:${feature}`
  const unlimited = await hasUnlimitedCreditAccess(input.userId, input.role)

  const existing = await db.query.creditLedger.findFirst({
    where: eq(creditLedger.idempotencyKey, idempotencyKey),
  })
  if (existing) {
    // Reuse only the still-pending reservation of the exact same operation. A
    // reused finalized/released entry leaves callers holding an operationId the
    // finalize step can never match, deletes their result, and strands the
    // pending reservation. Fresh attempts mint a keyed ledger row instead.
    const isReusablePending =
      existing.status === "pending" &&
      existing.transactionType === "reservation" &&
      existing.operationId === operationId

    if (isReusablePending) {
      const info = await getUserCreditInfo(input.userId)
      return {
        success: true,
        operationId: existing.operationId || operationId,
        idempotencyKey,
        reservedCredits: unlimited ? 0 : existing.credits || Math.abs(existing.amount),
        remainingCredits: unlimited ? 0 : info?.remainingCredits ?? existing.balanceAfter,
        availableCredits: unlimited ? 0 : info?.availableCredits ?? existing.balanceAfter,
        unlimited,
        ledgerEntryId: existing.id,
      }
    }

    if (existing.status === "failed") {
      const info = await getUserCreditInfo(input.userId)
      return {
        success: false,
        operationId: existing.operationId || operationId,
        idempotencyKey,
        reservedCredits: existing.credits || Math.abs(existing.amount),
        remainingCredits: info?.remainingCredits ?? existing.balanceAfter,
        availableCredits: info?.availableCredits ?? existing.balanceAfter,
        unlimited,
        ledgerEntryId: existing.id,
        error: existing.description || "Reservation failed",
      }
    }

    idempotencyKey = `${idempotencyKey}::${operationId}`
    const previousAttempt = await db.query.creditLedger.findFirst({
      where: eq(creditLedger.idempotencyKey, idempotencyKey),
    })
    if (previousAttempt) {
      if (
        previousAttempt.status === "pending" &&
        previousAttempt.transactionType === "reservation" &&
        previousAttempt.operationId === operationId
      ) {
        const info = await getUserCreditInfo(input.userId)
        return {
          success: true,
          operationId,
          idempotencyKey,
          reservedCredits: unlimited ? 0 : previousAttempt.credits || Math.abs(previousAttempt.amount),
          remainingCredits: unlimited ? 0 : info?.remainingCredits ?? previousAttempt.balanceAfter,
          availableCredits: unlimited ? 0 : info?.availableCredits ?? previousAttempt.balanceAfter,
          unlimited,
          ledgerEntryId: previousAttempt.id,
        }
      }
      idempotencyKey = `${idempotencyKey}#${Date.now()}`
    }
  }

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, input.userId),
    columns: { subscriptionTier: true, role: true },
  })
  const tier = profile?.subscriptionTier || "free"
  if (!unlimited && !canPlanUseFeature(profile?.role === "admin" ? "admin" : tier, feature)) {
    return {
      success: false,
      operationId,
      idempotencyKey,
      reservedCredits: estimatedCredits,
      remainingCredits: 0,
      availableCredits: 0,
      unlimited: false,
      error: "Your plan does not include this feature.",
    }
  }

  const now = new Date()
  const ledgerEntryId = ledgerId()

  if (unlimited) {
    await db.insert(creditLedger).values({
      id: ledgerEntryId,
      workspaceId,
      userId: input.userId,
      type: "reservation",
      transactionType: "reservation",
      status: "pending",
      operationId,
      idempotencyKey,
      amount: 0,
      credits: 0,
      balanceBefore: 0,
      balanceAfter: 0,
      source: input.source || "application",
      feature,
      action: feature,
      description: "Unlimited account reservation records internal usage without blocking.",
      currency: "EUR",
      metadata: { ...(input.metadata ?? {}), unlimited: true },
    })
    return {
      success: true,
      operationId,
      idempotencyKey,
      reservedCredits: 0,
      remainingCredits: 0,
      availableCredits: 0,
      unlimited: true,
      ledgerEntryId,
    }
  }

  await initializeUserCredits(input.userId, tier)

  const attemptReservation = () => db.transaction(async (tx) => {
    const updated = await tx.execute(sql`
      UPDATE "UserCredit"
      SET
        "reservedCredits" = "reservedCredits" + ${estimatedCredits},
        "updatedAt" = ${now}
      WHERE "userId" = ${input.userId}
        AND ("remainingCredits" - "reservedCredits") >= ${estimatedCredits}
      RETURNING "remainingCredits", "reservedCredits"
    `)
    const rows = rowsFromResult<{ remainingCredits: number; reservedCredits: number }>(updated)
    const row = rows[0]
    if (!row) return null

    await tx.insert(creditLedger).values({
      id: ledgerEntryId,
      workspaceId,
      userId: input.userId,
      type: "reservation",
      transactionType: "reservation",
      status: "pending",
      operationId,
      idempotencyKey,
      amount: -estimatedCredits,
      credits: estimatedCredits,
      balanceBefore: row.remainingCredits,
      balanceAfter: row.remainingCredits,
      source: input.source || "application",
      feature,
      action: feature,
      description: `Reserved ${estimatedCredits} credits for ${feature}.`,
      currency: "EUR",
      metadata: input.metadata ?? {},
      createdAt: now,
    })

    return row
  })

  let result = await attemptReservation()

  if (!result) {
    // The reservation UPDATE matched no rows. Pending reservations leaked from
    // crashed or abandoned operations can consume the whole balance until the
    // monthly reset; reclaim stale ones for this user and retry once.
    const reclaimed = await releaseStalePendingReservations(input.userId, 60)
    if (reclaimed > 0) {
      result = await attemptReservation()
    }
  }

  if (!result) {
    const info = await getUserCreditInfo(input.userId)
    console.warn("[CREDIT_RESERVATION] reservation_rejected", {
      userId: input.userId,
      subscriptionTier: tier,
      userCreditPlanId: info?.planId ?? null,
      includedBalance: info?.includedBalance ?? null,
      purchasedBalance: info?.purchasedBalance ?? null,
      remainingCredits: info?.remainingCredits ?? null,
      reservedCredits: info?.reservedCredits ?? null,
      availableCredits: info?.availableCredits ?? null,
      estimatedCredits,
      idempotencyKey,
      reservationUpdateMatched: false,
      reason: info ? "insufficient_available_credits" : "user_credit_row_missing",
    })
    return {
      success: false,
      operationId,
      idempotencyKey,
      reservedCredits: estimatedCredits,
      remainingCredits: info?.remainingCredits ?? 0,
      availableCredits: info?.availableCredits ?? 0,
      unlimited: false,
      error: `Insufficient credits. This action reserves ${estimatedCredits} credits.`,
    }
  }

  return {
    success: true,
    operationId,
    idempotencyKey,
    reservedCredits: estimatedCredits,
    remainingCredits: result.remainingCredits,
    availableCredits: Math.max(0, result.remainingCredits - result.reservedCredits),
    unlimited: false,
    ledgerEntryId,
  }
}

async function releaseStalePendingReservations(userId: string, olderThanMinutes = 60): Promise<number> {
  const db = getDb()
  if (!db) return 0

  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000)
  try {
    const pending = await db.query.creditLedger.findMany({
      where: and(
        eq(creditLedger.userId, userId),
        eq(creditLedger.transactionType, "reservation"),
        eq(creditLedger.status, "pending"),
        lt(creditLedger.createdAt, cutoff),
      ),
      columns: { operationId: true },
      limit: 200,
    })

    let reclaimed = 0
    for (const entry of pending) {
      if (!entry.operationId) continue
      const released = await releaseCreditsForOperation(entry.operationId, "stale_reservation_reclaimed")
      if (released) reclaimed++
    }

    if (reclaimed > 0) {
      console.warn("[CREDIT_RESERVATION] stale_reservations_reclaimed", { userId, reclaimed })
    }
    return reclaimed
  } catch (error) {
    console.error("[CREDIT_RESERVATION] stale reservation reclaim failed", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    })
    return 0
  }
}

export async function finalizeCredits(input: FinalizeCreditsInput): Promise<CreditDeductionResult> {
  const db = getDb()
  if (!db) return { success: false, remainingCredits: 0, creditsDeducted: 0, error: "Database unavailable" }

  const reservation = await db.query.creditLedger.findFirst({
    where: and(
      eq(creditLedger.operationId, input.operationId),
      eq(creditLedger.transactionType, "reservation"),
      eq(creditLedger.status, "pending"),
    ),
  })

  if (!reservation) {
    const charge = await db.query.creditLedger.findFirst({
      where: and(eq(creditLedger.operationId, input.operationId), eq(creditLedger.transactionType, "charge")),
    })
    if (charge) {
      return {
        success: true,
        remainingCredits: charge.balanceAfter,
        creditsDeducted: charge.credits || Math.abs(charge.amount),
        newLedgerEntry: charge.id,
      }
    }
    return { success: false, remainingCredits: 0, creditsDeducted: 0, error: "Reservation not found" }
  }

  const actualCredits = Math.max(0, Math.ceil(input.actualCredits ?? reservation.credits ?? Math.abs(reservation.amount)))
  const reservedCredits = reservation.credits || Math.abs(reservation.amount)
  const usage = input.actualUsage
  const now = new Date()
  const chargeId = ledgerId()
  const releaseCredits = Math.max(0, reservedCredits - actualCredits)
  const unlimited = Boolean((reservation.metadata as Record<string, unknown> | null)?.unlimited) ||
    await hasUnlimitedCreditAccess(reservation.userId)

  if (unlimited) {
    await db.transaction(async (tx) => {
      await tx.update(creditLedger)
        .set({ status: "finalized", finalizedAt: now })
        .where(eq(creditLedger.id, reservation.id))
      await tx.insert(creditLedger).values({
        id: chargeId,
        workspaceId: reservation.workspaceId || reservation.userId,
        userId: reservation.userId,
        type: "charge",
        transactionType: "charge",
        status: "finalized",
        operationId: reservation.operationId,
        idempotencyKey: `charge:${reservation.operationId}`,
        amount: 0,
        credits: actualCredits,
        balanceBefore: reservation.balanceAfter,
        balanceAfter: reservation.balanceAfter,
        source: reservation.source || "application",
        feature: reservation.feature,
        provider: usage?.provider,
        model: usage?.model,
        inputTokens: usage?.inputTokens ?? 0,
        outputTokens: usage?.outputTokens ?? 0,
        thinkingTokens: usage?.thinkingTokens ?? 0,
        cachedTokens: usage?.cachedTokens ?? 0,
        embeddingTokens: usage?.embeddingTokens ?? 0,
        estimatedProviderCost: usage?.estimatedCostMinor ?? 0,
        currency: usage?.currency ?? "EUR",
        pricingVersion: usage?.pricingVersion,
        metadata: { ...(input.metadata ?? {}), unlimited: true, rawUsageReference: usage?.rawUsageReference },
        action: reservation.action,
        description: "Unlimited account usage recorded without customer credit debit.",
        relatedDatasetId: reservation.relatedDatasetId,
        relatedPlanId: reservation.relatedPlanId,
        finalizedAt: now,
      }).onConflictDoNothing()
    })
    return { success: true, remainingCredits: reservation.balanceAfter, creditsDeducted: 0, newLedgerEntry: chargeId }
  }

  const finalized = await db.transaction(async (tx) => {
    const updated = await tx.execute(sql`
      UPDATE "UserCredit"
      SET
        "reservedCredits" = GREATEST(0, "reservedCredits" - ${reservedCredits}),
        "remainingCredits" = "remainingCredits" - ${actualCredits},
        "usedCredits" = "usedCredits" + ${actualCredits},
        "lifetimeCreditsUsed" = "lifetimeCreditsUsed" + ${actualCredits},
        "includedBalance" = GREATEST(0, "includedBalance" - ${actualCredits}),
        "purchasedBalance" = CASE
          WHEN "includedBalance" >= ${actualCredits} THEN "purchasedBalance"
          ELSE "purchasedBalance" - GREATEST(0, ${actualCredits} - "includedBalance")
        END,
        "updatedAt" = ${now}
      WHERE "userId" = ${reservation.userId}
        AND ("remainingCredits" - "reservedCredits" + ${reservedCredits}) >= ${actualCredits}
      RETURNING "remainingCredits", "usedCredits", "includedBalance", "purchasedBalance"
    `)
    const row = rowsFromResult<{ remainingCredits: number; usedCredits: number; includedBalance: number; purchasedBalance: number }>(updated)[0]
    if (!row) return null

    await tx.update(creditLedger)
      .set({
        status: releaseCredits > 0 ? "released" : "finalized",
        finalizedAt: now,
        metadata: { ...(reservation.metadata as Record<string, unknown> | null ?? {}), releasedUnusedCredits: releaseCredits },
      })
      .where(eq(creditLedger.id, reservation.id))

    await tx.insert(creditLedger).values({
      id: chargeId,
      workspaceId: reservation.workspaceId || reservation.userId,
      userId: reservation.userId,
      type: "charge",
      transactionType: "USAGE_DEBIT",
      status: "finalized",
      operationId: reservation.operationId,
      idempotencyKey: `charge:${reservation.operationId}`,
      amount: -actualCredits,
      credits: actualCredits,
      balanceBefore: reservation.balanceAfter,
      balanceAfter: row.remainingCredits,
      source: reservation.source || "application",
      feature: reservation.feature,
      provider: usage?.provider,
      model: usage?.model,
      inputTokens: usage?.inputTokens ?? 0,
      outputTokens: usage?.outputTokens ?? 0,
      thinkingTokens: usage?.thinkingTokens ?? 0,
      cachedTokens: usage?.cachedTokens ?? 0,
      embeddingTokens: usage?.embeddingTokens ?? 0,
      estimatedProviderCost: usage?.estimatedCostMinor ?? 0,
      currency: usage?.currency ?? "EUR",
      pricingVersion: usage?.pricingVersion,
      metadata: { ...(input.metadata ?? {}), rawUsageReference: usage?.rawUsageReference },
      action: reservation.action,
      description: `Finalized ${actualCredits} credits for ${reservation.feature || reservation.action}.`,
      relatedDatasetId: reservation.relatedDatasetId,
      relatedPlanId: reservation.relatedPlanId,
      finalizedAt: now,
    }).onConflictDoNothing()

    if (releaseCredits > 0) {
      await tx.insert(creditLedger).values({
        id: ledgerId(),
        workspaceId: reservation.workspaceId || reservation.userId,
        userId: reservation.userId,
        type: "release",
        transactionType: "RELEASE",
        status: "released",
        operationId: reservation.operationId,
        idempotencyKey: `release:${reservation.operationId}:unused`,
        amount: releaseCredits,
        credits: releaseCredits,
        balanceBefore: row.remainingCredits,
        balanceAfter: row.remainingCredits,
        includedBalanceBefore: row.includedBalance,
        includedBalanceAfter: row.includedBalance,
        purchasedBalanceBefore: row.purchasedBalance,
        purchasedBalanceAfter: row.purchasedBalance,
        source: reservation.source || "application",
        feature: reservation.feature,
        action: reservation.action,
        description: "Released unused reserved credits.",
        currency: "EUR",
        metadata: { reason: "actual_usage_below_estimate" },
        finalizedAt: now,
      }).onConflictDoNothing()
    }

    return row
  })

  if (!finalized) {
    await releaseCreditsForOperation(input.operationId, "finalization_failed")
    return { success: false, remainingCredits: 0, creditsDeducted: 0, error: "Insufficient credits to finalize actual usage." }
  }

  return {
    success: true,
    remainingCredits: finalized.remainingCredits,
    creditsDeducted: actualCredits,
    newLedgerEntry: chargeId,
  }
}

export async function releaseCreditsForOperation(operationId: string, reason = "operation_failed"): Promise<boolean> {
  const db = getDb()
  if (!db) return false

  const reservation = await db.query.creditLedger.findFirst({
    where: and(
      eq(creditLedger.operationId, operationId),
      eq(creditLedger.transactionType, "reservation"),
      eq(creditLedger.status, "pending"),
    ),
  })
  if (!reservation) return true

  const reservedCredits = reservation.credits || Math.abs(reservation.amount)
  const now = new Date()
  const unlimited = Boolean((reservation.metadata as Record<string, unknown> | null)?.unlimited) ||
    await hasUnlimitedCreditAccess(reservation.userId)

  await db.transaction(async (tx) => {
    if (!unlimited) {
      await tx.execute(sql`
        UPDATE "UserCredit"
        SET
          "reservedCredits" = GREATEST(0, "reservedCredits" - ${reservedCredits}),
          "updatedAt" = ${now}
        WHERE "userId" = ${reservation.userId}
      `)
    }

    await tx.update(creditLedger)
      .set({ status: "released", finalizedAt: now })
      .where(eq(creditLedger.id, reservation.id))

    await tx.insert(creditLedger).values({
      id: ledgerId(),
      workspaceId: reservation.workspaceId || reservation.userId,
      userId: reservation.userId,
      type: "release",
      transactionType: "release",
      status: "released",
      operationId,
      idempotencyKey: `release:${operationId}:${reason}`,
      amount: reservedCredits,
      credits: reservedCredits,
      balanceBefore: reservation.balanceAfter,
      balanceAfter: reservation.balanceAfter,
      source: reservation.source || "application",
      feature: reservation.feature,
      action: reservation.action,
      description: reason,
      currency: "EUR",
      metadata: { reason },
      finalizedAt: now,
    }).onConflictDoNothing()
  })

  return true
}

export { releaseCreditsForOperation as releaseCredits }

export async function deductCredits(
  userId: string,
  actionType: string,
  datasetId?: string,
  tokenCost?: { inputTokens: number; outputTokens: number; model: string }
): Promise<CreditDeductionResult> {
  let creditsToDeduct = getActionCreditCost(actionType)
  if (tokenCost) {
    creditsToDeduct = Math.max(creditsToDeduct, eurosToCredits(calculateTokenCost(tokenCost.model, tokenCost.inputTokens, tokenCost.outputTokens)))
  }
  const operationId = `legacy-deduct:${crypto.randomUUID()}`
  const reservation = await reserveCredits({
    userId,
    operationId,
    idempotencyKey: `deduct:${userId}:${operationId}`,
    estimatedCredits: creditsToDeduct,
    feature: normalizeCreditFeature(actionType),
    metadata: datasetId ? { datasetId } : {},
    source: "legacy_api",
  })
  if (!reservation.success) {
    return {
      success: false,
      remainingCredits: reservation.remainingCredits,
      creditsDeducted: 0,
      error: reservation.error,
    }
  }
  return finalizeCredits({ operationId, actualCredits: creditsToDeduct })
}

export async function refundCredits(
  userId: string,
  amountOrOperationId: number | string,
  reasonOrCredits: string | number,
  datasetIdOrReason?: string
): Promise<boolean> {
  const db = getDb()
  if (!db) return false

  const amount = typeof amountOrOperationId === "number" ? amountOrOperationId : Number(reasonOrCredits)
  const reason = typeof amountOrOperationId === "number" ? String(reasonOrCredits) : datasetIdOrReason || "refund"
  const operationId = typeof amountOrOperationId === "string" ? amountOrOperationId : `refund:${crypto.randomUUID()}`
  const creditInfo = await getUserCreditInfo(userId)
  if (!creditInfo) return false

  const newRemaining = creditInfo.remainingCredits + Math.max(0, amount)
  const newUsed = Math.max(0, creditInfo.usedCredits - Math.max(0, amount))
  const newIncluded = Math.min(creditInfo.includedBalance + Math.max(0, amount), creditInfo.totalCredits)
  const now = new Date()

  await db.transaction(async (tx) => {
    if (!(await hasUnlimitedCreditAccess(userId))) {
      await tx.update(userCredits)
        .set({
          remainingCredits: newRemaining,
          usedCredits: newUsed,
          includedBalance: Math.min(creditInfo.includedBalance + Math.max(0, amount), creditInfo.totalCredits),
          updatedAt: now,
        })
        .where(eq(userCredits.userId, userId))
    }
    await tx.insert(creditLedger).values({
      id: ledgerId(),
      workspaceId: userId,
      userId,
      type: "refund",
      transactionType: "REFUND",
      status: "refunded",
      operationId,
      idempotencyKey: `refund:${userId}:${operationId}:${amount}`,
      amount,
      credits: amount,
      balanceBefore: creditInfo.remainingCredits,
      balanceAfter: newRemaining,
      includedBalanceBefore: creditInfo.includedBalance,
      includedBalanceAfter: Math.min(creditInfo.includedBalance + Math.max(0, amount), creditInfo.totalCredits),
      purchasedBalanceBefore: creditInfo.purchasedBalance,
      purchasedBalanceAfter: creditInfo.purchasedBalance,
      source: "application",
      feature: "refund",
      action: "refund",
      description: reason,
      relatedDatasetId: typeof amountOrOperationId === "number" ? datasetIdOrReason : undefined,
      currency: "EUR",
      metadata: { reason },
      finalizedAt: now,
    }).onConflictDoNothing()
  })

  return true
}

export async function adjustCredits(userId: string, amount: number, reason: string, adminUserId: string): Promise<boolean> {
  const db = getDb()
  if (!db || !reason.trim()) return false

  const creditInfo = await getUserCreditInfo(userId) || await initializeUserCredits(userId, "free")
  if (!creditInfo) return false

  const normalizedAmount = Math.round(amount)
  const newRemaining = Math.max(0, creditInfo.remainingCredits + normalizedAmount)
  const newTotal = Math.max(0, creditInfo.totalCredits + normalizedAmount)
  const newLifetime = normalizedAmount > 0 ? creditInfo.lifetimeCreditsEarned + normalizedAmount : creditInfo.lifetimeCreditsEarned
  const now = new Date()

  await db.transaction(async (tx) => {
    await tx.update(userCredits)
      .set({
        remainingCredits: newRemaining,
        totalCredits: newTotal,
        lifetimeCreditsEarned: newLifetime,
        updatedAt: now,
      })
      .where(eq(userCredits.userId, userId))

    await tx.insert(creditLedger).values({
      id: ledgerId(),
      workspaceId: userId,
      userId,
      type: "adjustment",
      transactionType: "adjustment",
      status: "finalized",
      operationId: `admin-adjustment:${crypto.randomUUID()}`,
      idempotencyKey: `admin-adjustment:${adminUserId}:${userId}:${crypto.randomUUID()}`,
      amount: normalizedAmount,
      credits: Math.abs(normalizedAmount),
      balanceBefore: creditInfo.remainingCredits,
      balanceAfter: newRemaining,
      source: "superadmin",
      feature: "manual_adjustment",
      action: "admin_adjustment",
      description: reason,
      adminUserId,
      currency: "EUR",
      metadata: { reason, adminUserId },
      finalizedAt: now,
    })
  })

  return true
}

export async function checkAndPerformMonthlyReset(userId: string): Promise<boolean> {
  const db = getDb()
  if (!db || await hasUnlimitedCreditAccess(userId)) return false

  const creditInfo = await db.query.userCredits.findFirst({ where: eq(userCredits.userId, userId) })
  if (!creditInfo || creditInfo.creditsResetAt > new Date()) return false

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
    columns: { subscriptionTier: true },
  })
  const tier = profile?.subscriptionTier || "free"
  const plan = getBillingPlanByTier(tier)
  const monthlyCredits = getCreditsLimitForTier(tier)
  const now = new Date()
  const nextReset = nextResetDate(tier)
  const idempotencyKey = `subscription-reset:${userId}:${plan.id}:${creditInfo.creditsResetAt.toISOString().slice(0, 10)}`
  await db.transaction(async (tx) => {
    await tx.update(userCredits)
      .set({
        totalCredits: monthlyCredits,
        includedBalance: monthlyCredits,
        usedCredits: 0,
        reservedCredits: 0,
        remainingCredits: monthlyCredits,
        creditsResetAt: nextReset,
        lastResetAt: now,
        lifetimeCreditsEarned: creditInfo.lifetimeCreditsEarned + monthlyCredits,
        updatedAt: now,
      })
      .where(eq(userCredits.userId, userId))

    await tx.insert(creditLedger).values({
      id: ledgerId(),
      workspaceId: userId,
      userId,
      type: "subscription_reset",
      transactionType: "PLAN_RESET",
      status: "finalized",
      operationId: idempotencyKey,
      idempotencyKey,
      amount: monthlyCredits,
      credits: monthlyCredits,
      balanceBefore: creditInfo.remainingCredits,
      balanceAfter: monthlyCredits,
      includedBalanceBefore: creditInfo.includedBalance ?? creditInfo.remainingCredits,
      includedBalanceAfter: monthlyCredits,
      purchasedBalanceBefore: creditInfo.purchasedBalance ?? 0,
      purchasedBalanceAfter: creditInfo.purchasedBalance ?? 0,
      source: "subscription",
      feature: "monthly_allowance",
      action: "monthly_credit_reset",
      description: `Monthly credit reset for ${plan.name} plan`,
      relatedPlanId: plan.id,
      currency: "EUR",
      metadata: { tier: plan.tier, rollover: false, previousReservedCredits: creditInfo.reservedCredits ?? 0 },
      finalizedAt: now,
    }).onConflictDoNothing()
  })

  return true
}

export async function processPlanChange(userId: string, newTier: string): Promise<boolean> {
  const db = getDb()
  if (!db) {
    console.error("[CREDIT_ENGINE] processPlanChange failed: database unavailable", { userId, newTier });
    return false;
  }

  const plan = getBillingPlanByTier(newTier);
  const monthlyCredits = getCreditsLimitForTier(newTier);
  
  let creditInfo: UserCreditInfo | null = null;
  try {
    creditInfo = await getUserCreditInfo(userId);
    if (!creditInfo) {
      creditInfo = await initializeUserCredits(userId, newTier);
    }
  } catch (error) {
    console.error("[CREDIT_ENGINE] processPlanChange failed: error getting/initializing user credits", {
      userId,
      newTier,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
  
  if (!creditInfo) {
    console.error("[CREDIT_ENGINE] processPlanChange failed: could not get or initialize credit info", { userId, newTier });
    return false;
  }

  const creditDiff = monthlyCredits - creditInfo.totalCredits
  const newIncludedBalance = Math.max(0, monthlyCredits - creditInfo.purchasedBalance)
  const newRemaining = Math.max(0, creditInfo.includedBalance + creditDiff)
  const now = new Date()
  const nextReset = nextResetDate(newTier)
  const operationId = `plan-change:${userId}:${plan.id}:${now.toISOString().slice(0, 10)}`

  try {
    await db.transaction(async (tx) => {
      await tx.update(userCredits)
        .set({
          planId: plan.id,
          totalCredits: monthlyCredits,
          includedBalance: Math.max(0, newIncludedBalance),
          remainingCredits: Math.max(0, creditInfo.includedBalance + creditDiff),
          creditsResetAt: nextReset,
          lifetimeCreditsEarned: creditInfo.lifetimeCreditsEarned + (creditDiff > 0 ? creditDiff : 0),
          updatedAt: now,
        })
        .where(eq(userCredits.userId, userId))

      await tx.insert(creditLedger).values({
        id: ledgerId(),
        workspaceId: userId,
        userId,
        type: "subscription_reset",
        transactionType: "PLAN_RESET",
        status: "finalized",
        operationId,
        idempotencyKey: operationId,
        amount: creditDiff,
        credits: Math.abs(creditDiff),
        balanceBefore: creditInfo.remainingCredits,
        balanceAfter: Math.max(0, creditInfo.remainingCredits + creditDiff),
        includedBalanceBefore: creditInfo.includedBalance,
        includedBalanceAfter: Math.max(0, newIncludedBalance),
        purchasedBalanceBefore: creditInfo.purchasedBalance,
        purchasedBalanceAfter: creditInfo.purchasedBalance,
        source: "subscription",
      feature: "plan_change",
      action: "plan_change",
      description: `Plan changed from ${creditInfo.planId} to ${plan.id}`,
      relatedPlanId: plan.id,
      currency: "EUR",
      metadata: { previousPlan: creditInfo.planId, newPlan: plan.id },
      finalizedAt: now,
    }).onConflictDoNothing()
    })
  } catch (error) {
    console.error("[CREDIT_ENGINE] processPlanChange transaction failed", {
      userId,
      newTier,
      planId: plan.id,
      monthlyCredits,
      creditDiff,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return false;
  }

  return true
}

export async function expireStaleReservations(olderThanMinutes = 60): Promise<number> {
  const db = getDb()
  if (!db) return 0

  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000)
  const stale = await db.query.creditLedger.findMany({
    where: and(
      eq(creditLedger.transactionType, "reservation"),
      eq(creditLedger.status, "pending"),
      lt(creditLedger.createdAt, cutoff),
    ),
  })

  for (const entry of stale) {
    await releaseCreditsForOperation(entry.operationId || entry.id, "expired_reservation")
    await db.update(creditLedger)
      .set({ type: "expiry", transactionType: "expiry", status: "released" })
      .where(eq(creditLedger.id, entry.id))
  }

  return stale.length
}

export async function getCreditLedger(userId: string, limit = 50, offset = 0): Promise<Array<typeof creditLedger.$inferSelect>> {
  const db = getDb()
  if (!db) return []

  return db
    .select()
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId))
    .orderBy(desc(creditLedger.createdAt))
    .limit(limit)
    .offset(offset)
}
