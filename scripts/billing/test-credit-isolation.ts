/**
 * Superadmin / customer ownership isolation regression test.
 *
 * Proves the full top-up and credit flow is strictly scoped to the
 * authenticated owner with three fixture users:
 *   A = synthetic Superadmin-role account with 28 datasets
 *   B = normal Pro customer
 *   C = another normal customer (free tier)
 *
 * Run: pnpm test:credit-isolation
 * Uses only synthetic fixture users (unique suffix) and deletes them in
 * finally. Never reads or modifies the official Superadmin account's data.
 */
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { db } from "@/lib/db"
import { datasets, profiles, users } from "@/lib/db/schema"
import { inArray, eq } from "drizzle-orm"

import {
  getActiveDatasetCount,
  getDatasetLimitInfo,
  getDatasetLimitError,
} from "@/lib/usage/dataset-limits"
import {
  initializeCreditAccount,
  getCreditAccount,
} from "@/lib/billing/credit-account-service"
import { initializeUserCredits } from "@/lib/billing/credit-engine"
import {
  processStripeTopUpPayment,
  getCreditTopUpHistory,
  type StripeTopUpPayment,
} from "@/lib/billing/credit-topup-service"
import type { CreditPackageConfig } from "@/lib/billing/credit-packages"
import { getAnalystCreditUsage } from "@/lib/usage/analyst-credits"
import { getDb } from "@/lib/db"
import { creditLedger } from "@/lib/db/schema"

const suffix = randomUUID().replaceAll("-", "").slice(0, 12)
const userA = `iso_test_superadmin_${suffix}`
const userB = `iso_test_pro_${suffix}`
const userC = `iso_test_free_${suffix}`
const emailA = `${userA}@example.test`
const emailB = `${userB}@example.test`
const emailC = `${userC}@example.test`

const now = new Date()

async function insertUser(id: string, email: string, name: string, role: string, tier: string) {
  await db.insert(users).values({ id, email, name, createdAt: now })
  await db.insert(profiles).values({
    id: `profile_${id}`,
    userId: id,
    email,
    role,
    subscriptionTier: tier,
    createdAt: now,
    updatedAt: now,
  })
}

async function insertDatasets(ownerId: string, count: number, tag: string) {
  await db.insert(datasets).values(
    Array.from({ length: count }, (_, i) => ({
      id: `iso_ds_${tag}_${suffix}_${i}`,
      userId: ownerId,
      name: `${tag} dataset ${i}`,
      fileName: `${tag}-${i}.csv`,
      rowCount: 1,
      columnCount: 1,
      columns: ["value"],
      data: [],
      datasetType: "standard",
      status: "ready",
      createdAt: now,
      updatedAt: now,
    })),
  )
}

function topUpPayment(providerPaymentId: string, userId: string): StripeTopUpPayment {
  return {
    provider: "stripe",
    providerPaymentId,
    providerCheckoutId: `cs_test_${providerPaymentId}`,
    providerEventId: `evt_${providerPaymentId}`,
    amountMinor: 1000,
    currency: "EUR",
    stripePriceId: null,
    clientReferenceId: userId,
    metadata: { userId, workspaceId: userId },
  }
}

const hundredCreditPackage: CreditPackageConfig = {
  id: "test_topup_100_eur",
  name: "100 credits",
  description: "Isolation test package",
  creditsGranted: 100,
  monetaryAmountCents: 1000,
  currency: "EUR",
  providers: {},
  active: true,
  pricingVersion: "test",
}

const fiftyCreditPackage: CreditPackageConfig = {
  ...hundredCreditPackage,
  id: "test_topup_50_eur",
  creditsGranted: 50,
}

async function purchasedBalance(userId: string): Promise<number> {
  const account = await getCreditAccount(userId)
  return account?.purchasedBalance ?? 0
}

async function main() {
  if (!db || !getDb()) {
    console.log("SKIP: database unavailable — credit isolation regression requires DATABASE_URL")
    return
  }

  // -------------------------------------------------------------
  // Fixtures: A = Superadmin role, B = Pro customer, C = free customer
  // -------------------------------------------------------------
  await insertUser(userA, emailA, "Isolation Superadmin", "superadmin", "superadmin")
  await insertUser(userB, emailB, "Isolation Pro", "user", "pro")
  await insertUser(userC, emailC, "Isolation Free", "user", "free")

  await insertDatasets(userA, 28, "superadmin")
  await insertDatasets(userB, 2, "pro")
  await insertDatasets(userC, 1, "free")

  try {
    // 1. User A's 28 datasets remain owned only by User A.
    const countA = await getActiveDatasetCount(userA)
    assert.equal(countA, 28, "Superadmin owns exactly 28 active datasets")

    // 2. User B's dataset count excludes all 28 Superadmin datasets.
    const countB = await getActiveDatasetCount(userB)
    assert.equal(countB, 2, "Pro customer counts only own datasets")

    // 3. User C's dataset count excludes User A and User B.
    const countC = await getActiveDatasetCount(userC)
    assert.equal(countC, 1, "Free customer counts only own datasets")

    // Dataset limit enforcement stays isolated: B (25 max on Pro) can still
    // create datasets even though A has 28.
    const limitInfoB = await getDatasetLimitInfo(userB)
    assert.ok(limitInfoB.canCreate, "Pro customer can still create datasets with Superadmin at 28")
    assert.equal(getDatasetLimitError(limitInfoB), null)

    // 14. Superadmin special entitlement behavior remains unchanged.
    const usageA = await getAnalystCreditUsage(userA, "superadmin", emailA)
    assert.equal(usageA.unlimited, true, "Superadmin keeps unlimited entitlement")
    assert.equal(await initializeCreditAccount(userA, "superadmin"), null, "Superadmin gets no UserCredit row")

    // -------------------------------------------------------------
    // 4. User B buys 100 credits through the webhook top-up chain.
    // -------------------------------------------------------------
    const providerPaymentId = `pi_iso_${suffix}`
    const result = await processStripeTopUpPayment(
      topUpPayment(providerPaymentId, userB),
      hundredCreditPackage,
    )
    assert.equal(result.success, true, `top-up for B succeeds (${result.error ?? ""})`)
    assert.equal(result.creditsIssued, 100)

    // 5. Exactly User B receives +100 purchased credits.
    assert.equal(await purchasedBalance(userB), 100, "B purchased balance is exactly +100")

    // 6. User A receives 0 credits from User B's payment.
    const accountA = await getCreditAccount(userA)
    assert.equal(accountA, null, "Superadmin has no credit account")
    const ledgerA = await db.query.creditLedger.findMany({ where: eq(creditLedger.userId, userA) })
    assert.equal(ledgerA.length, 0, "Superadmin ledger has zero entries from B's purchase")

    // 7. User C receives 0 credits from User B's payment.
    assert.equal(await purchasedBalance(userC), 0, "C purchased balance unchanged")

    // 8. User B's purchase history contains the purchase.
    const historyB = await getCreditTopUpHistory(userB, 50)
    assert.ok(
      historyB.some((t) => t.providerPaymentId === providerPaymentId && t.status === "completed"),
      "B history contains the completed purchase",
    )

    // 9. User A and User C cannot see User B's purchase.
    const historyA = await getCreditTopUpHistory(userA, 50)
    const historyC = await getCreditTopUpHistory(userC, 50)
    assert.ok(!historyA.some((t) => t.providerPaymentId === providerPaymentId), "A cannot see B's purchase")
    assert.ok(!historyC.some((t) => t.providerPaymentId === providerPaymentId), "C cannot see B's purchase")

    // 10. CreditLedger entry belongs only to User B.
    const purchaseEntries = await db
      .select()
      .from(creditLedger)
      .where(eq(creditLedger.providerTransactionId, providerPaymentId))
    assert.equal(purchaseEntries.length, 1, "exactly one ledger entry for the payment")
    assert.equal(purchaseEntries[0]?.userId, userB, "ledger purchase belongs to B")
    assert.equal(purchaseEntries[0]?.transactionType, "TOP_UP_PURCHASE")

    // 11. Duplicate webhook still grants User B nothing additional.
    const duplicate = await processStripeTopUpPayment(
      topUpPayment(providerPaymentId, userB),
      hundredCreditPackage,
    )
    assert.equal(duplicate.duplicate, true, "duplicate webhook is detected")
    assert.equal(await purchasedBalance(userB), 100, "B balance unchanged after duplicate webhook")

    // 13. Sidebar/API-equivalent per-user balance reads stay isolated.
    const accountB = await getCreditAccount(userB)
    const accountC = await getCreditAccount(userC)
    assert.equal(accountB?.totalAvailableBalance, 500 + 100, "B total balance = included 500 + purchased 100")
    assert.equal(accountC?.totalAvailableBalance, 2, "C total balance = included 2 only")
    assert.equal(accountB?.purchasedBalance, 100, "B purchased balance reads back through the account API")
    assert.equal(accountC?.purchasedBalance, 0)

    // -------------------------------------------------------------
    // 16a. Concurrent top-ups for different users never cross-write.
    // -------------------------------------------------------------
    const paymentB2 = `pi_iso_${suffix}_b2`
    const paymentC2 = `pi_iso_${suffix}_c2`
    const [concB, concC] = await Promise.all([
      processStripeTopUpPayment(topUpPayment(paymentB2, userB), fiftyCreditPackage),
      processStripeTopUpPayment(topUpPayment(paymentC2, userC), fiftyCreditPackage),
    ])
    assert.equal(concB.success, true, "concurrent B top-up succeeds")
    assert.equal(concC.success, true, "concurrent C top-up succeeds")
    assert.equal(await purchasedBalance(userB), 150, "B gets exactly its own +50")
    assert.equal(await purchasedBalance(userC), 50, "C gets exactly its own +50, none of B's")

    // 16b. Concurrent reservations from different users stay user-scoped.
    const [resB, resC] = await Promise.all([
      import("@/lib/billing/credit-engine").then(({ reserveCredits }) =>
        reserveCredits({
          userId: userB,
          estimatedCredits: 1,
          feature: "ai_question",
          source: "isolation_test",
        }),
      ),
      import("@/lib/billing/credit-engine").then(({ reserveCredits }) =>
        reserveCredits({
          userId: userC,
          estimatedCredits: 1,
          feature: "ai_question",
          source: "isolation_test",
        }),
      ),
    ])
    assert.equal(resB.success, true, "B reservation succeeds")
    assert.equal(resC.success, true, "C reservation succeeds")
    const reservedB = await getCreditAccount(userB)
    const reservedC = await getCreditAccount(userC)
    assert.equal(reservedB?.reservedCredits, 1, "B reserved exactly 1")
    assert.equal(reservedC?.reservedCredits, 1, "C reserved exactly 1")
    assert.equal(reservedC?.totalAvailableBalance, 52, "C available balance untouched by B's reservation")
    const { releaseCredits } = await import("@/lib/billing/credit-engine")
    await releaseCredits(resB.operationId, "isolation_test_release")
    await releaseCredits(resC.operationId, "isolation_test_release")
    const releasedB = await getCreditAccount(userB)
    const releasedC = await getCreditAccount(userC)
    assert.equal(releasedB?.reservedCredits, 0, "B reservation released")
    assert.equal(releasedC?.reservedCredits, 0, "C reservation released")

    // Fail-closed: a payment whose metadata points at the Superadmin must
    // grant zero credits to anyone and never write purchased credits to A.
    const superadminDirected = await processStripeTopUpPayment(
      topUpPayment(`pi_iso_${suffix}_admin`, userA),
      hundredCreditPackage,
    )
    assert.equal(superadminDirected.success, false, "Superadmin-directed top-up fails closed")
    assert.equal(await getCreditAccount(userA), null, "Superadmin still has no credit account")
    const ledgerAAgain = await db.query.creditLedger.findMany({ where: eq(creditLedger.userId, userA) })
    assert.equal(ledgerAAgain.length, 0, "No ledger entries written for Superadmin")
    assert.equal(await purchasedBalance(userB), 150, "B balance untouched by the failed top-up")
    assert.equal(await purchasedBalance(userC), 50, "C balance untouched by the failed top-up")

    // 15. Dataset/credit isolation persists after purchases (counts unchanged).
    assert.equal(await getActiveDatasetCount(userA), 28)
    assert.equal(await getActiveDatasetCount(userB), 2)
    assert.equal(await getActiveDatasetCount(userC), 1)

    // 12. Direct ?topup=success grants nobody credits (display-only flag).
    const page = readProjectFile("src/app/(auth)/app/settings/subscription/page.tsx")
    assert.ok(page.includes('params?.topup === "success"'), "topup=success is a display flag only")
    assert.ok(
      !page.includes("processStripeTopUpPayment") &&
        !page.includes("addPurchasedCredits") &&
        !page.includes("initializeCreditAccount"),
      "subscription page never grants credits from a query parameter",
    )

    console.log("Credit ownership isolation regression passed (Superadmin A / Pro B / Free C).")
  } finally {
    // All fixture tables cascade on user deletion. Synthetic IDs only —
    // the official Superadmin account is never touched.
    await db.delete(users).where(inArray(users.id, [userA, userB, userC])).catch(() => {})
    await db.delete(users).where(inArray(users.email, [emailA, emailB, emailC])).catch(() => {})
  }
}

const repoRoot = resolve(import.meta.dirname, "../..")

function readProjectFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8")
}

void main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Credit ownership isolation regression FAILED:", error)
    process.exit(1)
  })
