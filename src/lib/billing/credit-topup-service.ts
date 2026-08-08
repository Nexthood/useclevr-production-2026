import { getDb } from "@/lib/db"
import { and, eq, sql } from "drizzle-orm"
import {
  type PaymentProvider,
  creditLedger,
  creditTopUps,
} from "@/lib/db/schema"
import { getCreditAccount, initializeCreditAccount } from "@/lib/billing/credit-account-service"
import { type CreditPackageConfig } from "@/lib/billing/credit-packages"
import { debugError, debugLog } from "@/lib/utils/debug"

export interface StripeTopUpPayment {
  provider: "stripe"
  providerPaymentId: string
  providerCheckoutId: string | null
  providerEventId: string | null
  amountMinor: number
  currency: string
  stripePriceId: string | null
  clientReferenceId: string | null
  metadata: Record<string, string>
}

export interface SquareTopUpPayment {
  provider: "square"
  providerPaymentId: string
  providerCheckoutId: string | null
  providerEventId: string | null
  amountMinor: number
  currency: string
  referenceId: string | null
  metadata: Record<string, string>
}

export type TopUpPayment = StripeTopUpPayment | SquareTopUpPayment

export interface TopUpResult {
  success: boolean
  creditsIssued: number
  topUpId: string | null
  ledgerEntryId: string | null
  duplicate: boolean
  error?: string
}

function topUpId(): string {
  return `tu_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`
}

export async function isProviderPaymentProcessed(
  provider: PaymentProvider,
  providerPaymentId: string,
): Promise<boolean> {
  const db = getDb()
  if (!db) return false

  const existing = await db.query.creditTopUps.findFirst({
    where: and(
      eq(creditTopUps.provider, provider),
      eq(creditTopUps.providerPaymentId, providerPaymentId),
    ),
  })

  return Boolean(existing)
}

export async function getCreditTopUpByProviderPaymentId(
  provider: PaymentProvider,
  providerPaymentId: string,
): Promise<typeof creditTopUps.$inferSelect | null> {
  const db = getDb()
  if (!db) return null

  const result = await db.query.creditTopUps.findFirst({
    where: and(
      eq(creditTopUps.provider, provider),
      eq(creditTopUps.providerPaymentId, providerPaymentId),
    ),
  })

  return result ?? null
}

function resolveUserIdFromMetadata(
  metadata: Record<string, string>,
  fallbackReference: string | null,
): string | null {
  const metadataUserId = metadata.userId || metadata.user_id || metadata.userid
  if (metadataUserId) {
    return metadataUserId
  }
  if (fallbackReference) {
    return fallbackReference
  }
  return null
}

function resolveWorkspaceId(metadata: Record<string, string>, userId: string): string {
  return metadata.workspaceId || metadata.workspace_id || userId
}

export async function processStripeTopUpPayment(
  payment: StripeTopUpPayment,
  creditPackage: CreditPackageConfig,
): Promise<TopUpResult> {
  return processTopUpPayment(payment, creditPackage, "stripe")
}

export async function processSquareTopUpPayment(
  payment: SquareTopUpPayment,
  creditPackage: CreditPackageConfig,
): Promise<TopUpResult> {
  return processTopUpPayment(payment, creditPackage, "square")
}

async function processTopUpPayment<T extends TopUpPayment>(
  payment: T,
  creditPackage: CreditPackageConfig,
  provider: PaymentProvider,
): Promise<TopUpResult> {
  const db = getDb()
  if (!db) {
    return {
      success: false,
      creditsIssued: 0,
      topUpId: null,
      ledgerEntryId: null,
      duplicate: false,
      error: "Database unavailable",
    }
  }

  const { providerPaymentId, amountMinor, currency, metadata } = payment

  if (payment.provider !== provider) {
    return {
      success: false,
      creditsIssued: 0,
      topUpId: null,
      ledgerEntryId: null,
      duplicate: false,
      error: `Provider mismatch: expected ${provider}, got ${payment.provider}`,
    }
  }

  if (creditPackage.currency !== currency) {
    return {
      success: false,
      creditsIssued: 0,
      topUpId: null,
      ledgerEntryId: null,
      duplicate: false,
      error: `Currency mismatch: expected ${creditPackage.currency}, got ${currency}`,
    }
  }

  if (creditPackage.monetaryAmountCents !== amountMinor) {
    return {
      success: false,
      creditsIssued: 0,
      topUpId: null,
      ledgerEntryId: null,
      duplicate: false,
      error: `Amount mismatch: expected ${creditPackage.monetaryAmountCents}, got ${amountMinor}`,
    }
  }

  const userId = resolveUserIdFromMetadata(
    metadata,
    payment.provider === "stripe" ? payment.clientReferenceId : payment.referenceId,
  )
  if (!userId) {
    return {
      success: false,
      creditsIssued: 0,
      topUpId: null,
      ledgerEntryId: null,
      duplicate: false,
      error: "Unable to resolve userId from trusted metadata",
    }
  }

  const workspaceId = resolveWorkspaceId(metadata, userId)

  const existingTopUp = await getCreditTopUpByProviderPaymentId(provider, providerPaymentId)
  if (existingTopUp) {
    debugLog(
      `[credit-topup] Provider payment ${providerPaymentId} already processed. Skipping.`,
      { topUpId: existingTopUp.id, status: existingTopUp.status },
    )
    return {
      success: existingTopUp.status === "completed" || existingTopUp.status === "duplicate",
      creditsIssued: existingTopUp.creditsGranted,
      topUpId: existingTopUp.id,
      ledgerEntryId: existingTopUp.ledgerEntryId,
      duplicate: true,
    }
  }

  const topUpRecordId = topUpId()

  try {
    await db.transaction(async (tx) => {
      await tx.insert(creditTopUps).values({
        id: topUpRecordId,
        userId,
        workspaceId,
        provider,
        providerPaymentId,
        providerCheckoutId: payment.providerCheckoutId ?? null,
        providerEventId: payment.providerEventId ?? null,
        currency: creditPackage.currency,
        amountMinor: creditPackage.monetaryAmountCents,
        creditsGranted: creditPackage.creditsGranted,
        creditPackageId: creditPackage.id,
        pricingVersion: creditPackage.pricingVersion,
        status: "pending",
        metadata: {
          stripePriceId: payment.provider === "stripe" ? payment.stripePriceId ?? null : null,
          squareReferenceId: payment.provider === "square" ? payment.referenceId ?? null : null,
          webhookReceivedAt: new Date().toISOString(),
        },
      })

      await initializeCreditAccount(userId, "free")

      const idempotencyKey = `topup:${provider}:${providerPaymentId}`
      const idempotencyCheck = await tx.query.creditLedger.findFirst({
        where: eq(creditLedger.idempotencyKey, idempotencyKey),
      })

      if (idempotencyCheck) {
        await tx
          .update(creditTopUps)
          .set({
            status: "duplicate" as const,
            ledgerEntryId: idempotencyCheck.id,
          })
          .where(eq(creditTopUps.id, topUpRecordId))

        throw new Error("idempotency_already_processed")
      }

      const account = await getCreditAccount(userId)
      if (!account) {
        throw new Error("Unable to load credit account for user")
      }

  const newPurchasedBalance = account.purchasedBalance + creditPackage.creditsGranted
  const newTotalAvailable = account.includedBalance + newPurchasedBalance
  const now = new Date()

      await tx.execute(sql`
        UPDATE "UserCredit"
        SET
          "purchasedBalance" = "purchasedBalance" + ${creditPackage.creditsGranted},
          "totalPaidCents" = "totalPaidCents" + ${creditPackage.monetaryAmountCents},
          "lifetimeCreditsEarned" = "lifetimeCreditsEarned" + ${creditPackage.creditsGranted},
          "updatedAt" = ${now}
        WHERE "userId" = ${userId}
      `)

      const ledgerEntry = await tx.insert(creditLedger).values({
        id: `cl_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`,
        workspaceId,
        userId,
        type: "purchase" as const,
        transactionType: "TOP_UP_PURCHASE" as const,
        status: "finalized" as const,
        operationId: idempotencyKey,
        idempotencyKey,
        amount: creditPackage.creditsGranted,
        credits: creditPackage.creditsGranted,
        balanceBefore: account.totalAvailableBalance,
        balanceAfter: newTotalAvailable,
        includedBalanceBefore: account.includedBalance,
        includedBalanceAfter: account.includedBalance,
        purchasedBalanceBefore: account.purchasedBalance,
        purchasedBalanceAfter: newPurchasedBalance,
        monetaryAmount: creditPackage.monetaryAmountCents,
        currency: creditPackage.currency,
        source: "payment_provider",
        action: "credit_top_up",
        description: `Purchased ${creditPackage.creditsGranted} credits for ${creditPackage.monetaryAmountCents / 100} ${creditPackage.currency} via ${provider}`,
        paymentProvider: provider,
        providerTransactionId: providerPaymentId,
        paymentStatus: "finalized",
        metadata: {
          creditPackageId: creditPackage.id,
          provider,
          providerPaymentId,
          providerCheckoutId: payment.providerCheckoutId ?? null,
          pricingVersion: creditPackage.pricingVersion,
        },
        createdAt: now,
        finalizedAt: now,
      }).returning()

      if (!ledgerEntry[0]) {
        throw new Error("Failed to create ledger entry for top-up")
      }

      await tx
        .update(creditTopUps)
        .set({
          status: "completed" as const,
          ledgerEntryId: ledgerEntry[0].id,
        })
        .where(eq(creditTopUps.id, topUpRecordId))
    })

    const updated = await getCreditTopUpByProviderPaymentId(provider, providerPaymentId)

    return {
      success: true,
      creditsIssued: creditPackage.creditsGranted,
      topUpId: topUpRecordId,
      ledgerEntryId: updated?.ledgerEntryId ?? null,
      duplicate: false,
    }
  } catch (error) {
    const isDuplicate =
      error instanceof Error && error.message.includes("idempotency_already_processed")

    if (!isDuplicate) {
      debugError(
        `[credit-topup] Failed to process ${provider} payment ${providerPaymentId}:`,
        error,
      )
      await db
        .update(creditTopUps)
        .set({ status: "failed" })
        .where(eq(creditTopUps.id, topUpRecordId))
    }

    return {
      success: isDuplicate,
      creditsIssued: isDuplicate ? (await getCreditTopUpByProviderPaymentId(provider, providerPaymentId))?.creditsGranted ?? 0 : 0,
      topUpId: isDuplicate ? (await getCreditTopUpByProviderPaymentId(provider, providerPaymentId))?.id ?? null : topUpRecordId,
      ledgerEntryId: isDuplicate
        ? (await getCreditTopUpByProviderPaymentId(provider, providerPaymentId))?.ledgerEntryId ?? null
        : null,
      duplicate: isDuplicate,
    }
  }
}

export async function refundTopUpCredits(
  provider: PaymentProvider,
  providerPaymentId: string,
  refundAmountCents: number,
  reason: string,
): Promise<{ success: boolean; creditsRefunded: number; flaggedForReview: boolean; error?: string }> {
  const db = getDb()
  if (!db) {
    return { success: false, creditsRefunded: 0, flaggedForReview: false, error: "Database unavailable" }
  }

  const topUp = await getCreditTopUpByProviderPaymentId(provider, providerPaymentId)
  if (!topUp) {
    return { success: false, creditsRefunded: 0, flaggedForReview: false, error: "No credit top-up found for this provider payment" }
  }

  if (topUp.status !== "completed") {
    return { success: false, creditsRefunded: 0, flaggedForReview: false, error: `Top-up is not in completed state (status: ${topUp.status})` }
  }

  if (!topUp.ledgerEntryId) {
    return { success: false, creditsRefunded: 0, flaggedForReview: false, error: "Top-up has no ledger entry" }
  }

  const ledgerEntry = await db.query.creditLedger.findFirst({
    where: eq(creditLedger.id, topUp.ledgerEntryId),
  })

  if (!ledgerEntry || ledgerEntry.transactionType !== "TOP_UP_PURCHASE") {
    return { success: false, creditsRefunded: 0, flaggedForReview: false, error: "Ledger entry is not a TOP_UP_PURCHASE" }
  }

  const refundCredits = Math.min(
    topUp.creditsGranted,
    Math.round(
      (refundAmountCents / Math.max(topUp.amountMinor, 1)) * topUp.creditsGranted,
    ),
  )

  if (refundCredits <= 0) {
    return { success: false, creditsRefunded: 0, flaggedForReview: false, error: "Refund amount is zero or negative" }
  }

  const account = await getCreditAccount(topUp.userId)
  if (!account) {
    return { success: false, creditsRefunded: 0, flaggedForReview: false, error: "Credit account not found" }
  }

  if (account.purchasedBalance < refundCredits) {
    await db
      .update(creditTopUps)
        .set({
          status: "refunded" as const,
          metadata: sql`jsonb_set("metadata", '{reviewFlagged}', 'true', true)`,
        })
      .where(eq(creditTopUps.id, topUp.id))

    debugLog(
      `[credit-topup] Partial refund not possible — insufficient purchased credits for full refund`,
      {
        userId: topUp.userId,
        provider,
        providerPaymentId,
        purchasedBalance: account.purchasedBalance,
        refundCredits,
        refundAmountCents,
      },
    )

    return {
      success: false,
      creditsRefunded: 0,
      flaggedForReview: true,
      error: `Insufficient purchased credits for full refund (${account.purchasedBalance} < ${refundCredits}). Account flagged for billing review.`,
    }
  }

  const newPurchasedBalance = account.purchasedBalance - refundCredits
  const newTotalAvailable = account.includedBalance + newPurchasedBalance
  const now = new Date()
  const idempotencyKey = `refund:${provider}:${providerPaymentId}:${Date.now()}`

  await db.transaction(async (tx) => {
    await tx.execute(sql`
      UPDATE "UserCredit"
      SET
        "purchasedBalance" = "purchasedBalance" - ${refundCredits},
        "totalPaidCents" = "totalPaidCents" - ${refundAmountCents},
        "updatedAt" = ${now}
      WHERE "userId" = ${topUp.userId}
    `)

    await tx
      .update(creditLedger)
      .set({ status: "refunded" })
      .where(topUp.ledgerEntryId ? eq(creditLedger.id, topUp.ledgerEntryId) : sql`1=1`)

    await tx.insert(creditLedger).values({
      id: `cl_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`,
      workspaceId: topUp.workspaceId || topUp.userId,
      userId: topUp.userId,
      type: "refund" as const,
      transactionType: "REFUND" as const,
      status: "finalized" as const,
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
      currency: topUp.currency,
      source: "payment_provider",
      action: "purchase_refund",
      description: `Refund for ${provider} payment ${providerPaymentId}: ${reason}`,
      paymentProvider: provider,
      providerTransactionId: providerPaymentId,
      paymentStatus: "refunded",
      metadata: {
        reason,
        originalPurchaseId: topUp.id,
        refundAmountCents,
        refundCredits,
        provider,
        providerPaymentId,
      },
      createdAt: now,
      finalizedAt: now,
    }).onConflictDoNothing()

    await tx
      .update(creditTopUps)
      .set({ status: "refunded" as const })
      .where(eq(creditTopUps.id, topUp.id))
  })

  return { success: true, creditsRefunded: refundCredits, flaggedForReview: false }
}

export interface ReconciliationIssue {
  type:
    | "payment_without_ledger"
    | "ledger_without_payment"
    | "duplicate_payment_mapping"
    | "amount_mismatch"
    | "currency_mismatch"
    | "package_mismatch"
    | "refund_mismatch"
  description: string
  record: Record<string, unknown>
}

export interface ReconciliationReport {
  checkedAt: Date
  issues: ReconciliationIssue[]
  paymentsChecked: number
  ledgerEntriesChecked: number
}

export async function reconcileCreditTopUps(): Promise<ReconciliationReport> {
  const db = getDb()
  if (!db) {
    return {
      checkedAt: new Date(),
      issues: [],
      paymentsChecked: 0,
      ledgerEntriesChecked: 0,
    }
  }

  const issues: ReconciliationIssue[] = []

  const topUps = await db.select().from(creditTopUps).where(eq(creditTopUps.status, "completed"))

  const ledgerEntries = await db
    .select()
    .from(creditLedger)
    .where(
      and(
        eq(creditLedger.transactionType, "TOP_UP_PURCHASE"),
        eq(creditLedger.status, "finalized"),
      ),
    )

  const ledgerByPaymentId: Map<string, typeof creditLedger.$inferSelect> = new Map()
  const paymentById: Map<string, typeof creditTopUps.$inferSelect> = new Map()

  for (const entry of ledgerEntries) {
    if (!entry.providerTransactionId || !entry.paymentProvider) continue

    const key = `${entry.paymentProvider}:${entry.providerTransactionId}`

    if (ledgerByPaymentId.has(key)) {
      issues.push({
        type: "duplicate_payment_mapping",
        description: `Multiple ledger entries reference the same provider payment: ${key}`,
        record: {
          ledgerId1: ledgerByPaymentId.get(key)?.id,
          ledgerId2: entry.id,
          paymentProvider: entry.paymentProvider,
          providerTransactionId: entry.providerTransactionId,
        },
      })
    } else {
      ledgerByPaymentId.set(key, entry)
    }
  }

  for (const topUp of topUps) {
    paymentById.set(`${topUp.provider}:${topUp.providerPaymentId}`, topUp)

    if (!topUp.ledgerEntryId) {
      issues.push({
        type: "payment_without_ledger",
        description: `Credit top-up ${topUp.id} has no linked ledger entry`,
        record: {
          creditTopUpId: topUp.id,
          provider: topUp.provider,
          providerPaymentId: topUp.providerPaymentId,
        },
      })
      continue
    }

    const ledger = await db.query.creditLedger.findFirst({
      where: eq(creditLedger.id, topUp.ledgerEntryId),
    })

    if (!ledger) {
      issues.push({
        type: "payment_without_ledger",
        description: `Credit top-up ${topUp.id} references missing ledger entry ${topUp.ledgerEntryId}`,
        record: {
          creditTopUpId: topUp.id,
          ledgerEntryId: topUp.ledgerEntryId,
        },
      })
      continue
    }

    if (ledger.amount !== topUp.creditsGranted) {
      issues.push({
        type: "amount_mismatch",
        description: `Credit mismatch for top-up ${topUp.id}: top-up=${topUp.creditsGranted}, ledger=${ledger.amount}`,
        record: {
          creditTopUpId: topUp.id,
          ledgerEntryId: ledger.id,
          topUpCredits: topUp.creditsGranted,
          ledgerCredits: ledger.amount,
        },
      })
    }

    if (ledger.currency !== topUp.currency) {
      issues.push({
        type: "currency_mismatch",
        description: `Currency mismatch for top-up ${topUp.id}: top-up=${topUp.currency}, ledger=${ledger.currency}`,
        record: {
          creditTopUpId: topUp.id,
          topUpCurrency: topUp.currency,
          ledgerCurrency: ledger.currency,
        },
      })
    }

    if (ledger.monetaryAmount !== topUp.amountMinor) {
      issues.push({
        type: "amount_mismatch",
        description: `Monetary amount mismatch for top-up ${topUp.id}: top-up=${topUp.amountMinor}, ledger=${ledger.monetaryAmount}`,
        record: {
          creditTopUpId: topUp.id,
          topUpAmountMinor: topUp.amountMinor,
          ledgerMonetaryAmount: ledger.monetaryAmount,
        },
      })
    }
  }

  for (const entry of ledgerEntries) {
    if (!entry.providerTransactionId || !entry.paymentProvider) continue

    const key = `${entry.paymentProvider}:${entry.providerTransactionId}`

    if (!paymentById.has(key)) {
      issues.push({
        type: "ledger_without_payment",
        description: `Ledger entry ${entry.id} has no matching CreditTopUp record`,
        record: {
          ledgerEntryId: entry.id,
          paymentProvider: entry.paymentProvider,
          providerTransactionId: entry.providerTransactionId,
        },
      })
    }
  }

  return {
    checkedAt: new Date(),
    issues,
    paymentsChecked: topUps.length,
    ledgerEntriesChecked: ledgerEntries.length,
  }
}

export async function getCreditTopUpHistory(userId: string, limit = 50) {
  const db = getDb()
  if (!db) return []

  return db
    .select()
    .from(creditTopUps)
    .where(eq(creditTopUps.userId, userId))
    .orderBy(creditTopUps.createdAt)
    .limit(limit)
}
