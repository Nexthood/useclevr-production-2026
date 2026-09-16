import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { and, eq } from "drizzle-orm"

import { finalizeCredits, initializeUserCredits, reserveCredits } from "@/lib/billing/credit-engine"
import { PRO_PLAN_LIMITS } from "@/lib/billing/plans"
import { getDb } from "@/lib/db"
import { creditLedger, profiles, userCredits, users } from "@/lib/db/schema"

const PRO_CREDITS = PRO_PLAN_LIMITS.monthlyCredits

function readProjectFile(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8")
}

type TestCase = {
  name: string
  run: () => Promise<void> | void
}

const testUserId = `usr_credit_selfheal_${randomUUID().slice(0, 12)}`
const testUserEmail = `credit-selfheal-${randomUUID().slice(0, 12)}@test.useclevr.invalid`

async function cleanupTestUser() {
  const db = getDb()
  if (!db) return
  await db.delete(users).where(eq(users.id, testUserId))
}

async function fetchUserCredit() {
  const db = getDb()
  if (!db) throw new Error("Database unavailable")
  const row = await db.query.userCredits.findFirst({ where: eq(userCredits.userId, testUserId) })
  if (!row) throw new Error("UserCredit row missing")
  return row
}

async function countPlanAllocationGrants() {
  const db = getDb()
  if (!db) throw new Error("Database unavailable")
  const grants = await db.query.creditLedger.findMany({
    where: and(
      eq(creditLedger.userId, testUserId),
      eq(creditLedger.transactionType, "PLAN_ALLOCATION"),
    ),
    columns: { id: true },
  })
  return grants.length
}

async function setupProProfile() {
  const db = getDb()
  if (!db) throw new Error("DATABASE_URL required for the self-heal regression test")
  await cleanupTestUser()
  await db.insert(users).values({
    id: testUserId,
    email: testUserEmail,
    name: "Credit self-heal test",
    createdAt: new Date(),
  })
  await db.insert(profiles).values({
    id: `prof_${randomUUID().slice(0, 12)}`,
    userId: testUserId,
    email: testUserEmail,
    role: "user",
    subscriptionTier: "pro",
  })
}

async function reserveOne(operationId: string) {
  return reserveCredits({
    userId: testUserId,
    operationId,
    idempotencyKey: `selfheal:${operationId}`,
    estimatedCredits: 1,
    feature: "dataset_upload",
    source: "selfheal-test",
  })
}

function assertProAccount(expectedUsed: number) {
  return (async () => {
    const row = await fetchUserCredit()
    assert.equal(row.planId, "pro_monthly", "pro profile must hold the pro_monthly plan account")
    assert.equal(row.totalCredits, PRO_CREDITS, "totalCredits must be 500")
    assert.equal(
      row.includedBalance,
      PRO_CREDITS - expectedUsed,
      "includedBalance must equal the grant minus settled usage",
    )
    assert.equal(row.usedCredits, expectedUsed, "usedCredits must stay accurate")
    assert.equal(row.reservedCredits, 0, "reservedCredits must settle back to 0")
    assert.equal(
      row.remainingCredits,
      PRO_CREDITS - expectedUsed,
      "remainingCredits must equal included minus used",
    )
  })()
}

const tests: TestCase[] = [
  {
    name: "missing UserCredit for Profile=pro initializes to exactly 500 included credits",
    async run() {
      await setupProProfile()
      const info = await initializeUserCredits(testUserId, "pro")
      assert.ok(info, "initializeUserCredits must return account info")
      assert.equal(info.includedBalance, PRO_CREDITS)
      assert.equal(info.totalCredits, PRO_CREDITS)
      assert.equal(info.remainingCredits, PRO_CREDITS)
      await assertProAccount(0)
      assert.equal(await countPlanAllocationGrants(), 1, "exactly one initial grant ledger row")
    },
  },
  {
    name: "reservation of 1 succeeds and settles remaining/reserved balances correctly",
    async run() {
      const reservation = await reserveOne(`selfheal-reserve-${randomUUID().slice(0, 8)}`)
      assert.ok(reservation.success, `reservation must succeed: ${reservation.error ?? ""}`)
      assert.equal(reservation.reservedCredits, 1)
      assert.equal(reservation.remainingCredits, PRO_CREDITS)
      assert.equal(reservation.availableCredits, PRO_CREDITS - 1)

      const row = await fetchUserCredit()
      assert.equal(row.reservedCredits, 1, "reservedCredits must hold the reservation")
      assert.equal(row.remainingCredits, PRO_CREDITS, "reservation must not spend credits")

      const finalized = await finalizeCredits({
        operationId: reservation.operationId,
        actualCredits: 1,
      })
      assert.ok(finalized.success, `finalize must succeed: ${finalized.error ?? ""}`)
      await assertProAccount(1)
    },
  },
  {
    name: "replaying initialization after usage grants no additional credits",
    async run() {
      const before = await fetchUserCredit()
      const info = await initializeUserCredits(testUserId, "pro")
      assert.ok(info)
      const after = await fetchUserCredit()
      assert.equal(after.totalCredits, before.totalCredits)
      assert.equal(after.includedBalance, before.includedBalance)
      assert.equal(after.remainingCredits, before.remainingCredits)
      assert.equal(after.lifetimeCreditsEarned, before.lifetimeCreditsEarned)
      assert.equal(await countPlanAllocationGrants(), 1, "replay must not add a grant ledger row")
    },
  },
  {
    name: "zeroed pro UserCredit self-heals to exactly 500 without double granting",
    async run() {
      const db = getDb()
      assert.ok(db)
      await db
        .update(userCredits)
        .set({
          totalCredits: 0,
          includedBalance: 0,
          purchasedBalance: 0,
          usedCredits: 0,
          reservedCredits: 0,
          remainingCredits: 0,
          creditsResetAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(),
        })
        .where(eq(userCredits.userId, testUserId))

      const info = await initializeUserCredits(testUserId, "pro")
      assert.ok(info, "initialization must reconcile the zeroed account")
      assert.equal(info.includedBalance, PRO_CREDITS)
      await assertProAccount(0)

      const reservation = await reserveOne(`selfheal-zero-${randomUUID().slice(0, 8)}`)
      assert.ok(reservation.success, `reservation after repair must succeed: ${reservation.error ?? ""}`)
      const finalized = await finalizeCredits({ operationId: reservation.operationId, actualCredits: 1 })
      assert.ok(finalized.success)
      await assertProAccount(1)
      assert.equal(await countPlanAllocationGrants(), 1, "repair replay must not double grant")
    },
  },
  {
    name: "broken pro account with 500 total but zero included/remaining self-heals to 500",
    async run() {
      const db = getDb()
      assert.ok(db)
      await db
        .update(userCredits)
        .set({
          totalCredits: PRO_CREDITS,
          includedBalance: 0,
          remainingCredits: 0,
          usedCredits: 0,
          reservedCredits: 0,
          purchasedBalance: 0,
          updatedAt: new Date(),
        })
        .where(eq(userCredits.userId, testUserId))

      const info = await initializeUserCredits(testUserId, "pro")
      assert.ok(info)
      assert.equal(info.includedBalance, PRO_CREDITS)
      await assertProAccount(0)
    },
  },
  {
    name: "never-used free-plan UserCredit reconciles to the pro grant of 500",
    async run() {
      const db = getDb()
      assert.ok(db)
      await db
        .update(userCredits)
        .set({
          planId: "free",
          totalCredits: 2,
          includedBalance: 2,
          purchasedBalance: 0,
          usedCredits: 0,
          reservedCredits: 0,
          remainingCredits: 2,
          creditsResetAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(),
        })
        .where(eq(userCredits.userId, testUserId))

      const info = await initializeUserCredits(testUserId, "pro")
      assert.ok(info, "plan mismatch must reconcile to the profile plan")
      assert.equal(info.planId, "pro_monthly")
      await assertProAccount(0)

      const replay = await initializeUserCredits(testUserId, "pro")
      assert.ok(replay)
      await assertProAccount(0)
    },
  },
  {
    name: "partial free-plan usage reconciles to pro without inflating the grant",
    async run() {
      const db = getDb()
      assert.ok(db)
      await db
        .update(userCredits)
        .set({
          planId: "free",
          totalCredits: 2,
          includedBalance: 0,
          purchasedBalance: 0,
          usedCredits: 2,
          reservedCredits: 0,
          remainingCredits: 0,
          lifetimeCreditsUsed: 2,
          creditsResetAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(),
        })
        .where(eq(userCredits.userId, testUserId))

      const info = await initializeUserCredits(testUserId, "pro")
      assert.ok(info)
      assert.equal(info.planId, "pro_monthly")
      const row = await fetchUserCredit()
      assert.equal(row.totalCredits, PRO_CREDITS)
      assert.equal(row.usedCredits, 2, "legit usage history must be preserved")
      assert.equal(
        row.remainingCredits,
        PRO_CREDITS - 2,
        "upgraded remaining balance must reflect prior usage",
      )
    },
  },
  {
    name: "production predeploy registers the plan seed and the widened ledger constraint",
    run() {
      const predeploy = readProjectFile("scripts/runtime/railway-predeploy.cjs")
      assert.ok(
        predeploy.includes('readMigrationStatement("src/lib/db/migrations/0012_credit_engine.sql")'),
        "predeploy must run the SubscriptionPlan seed migration",
      )
      for (const migration of [
        "0030_subscription_email_idempotency.sql",
        "0031_fix_credit_ledger_missing_columns.sql",
        "0032_widen_credit_ledger_transaction_type.sql",
      ]) {
        assert.ok(
          predeploy.includes(`readMigrationStatement("src/lib/db/migrations/${migration}")`),
          `predeploy must run ${migration}`,
        )
      }
      assert.ok(
        predeploy.indexOf("0012_credit_engine.sql") <
          predeploy.indexOf("0031_fix_credit_ledger_missing_columns.sql") &&
          predeploy.indexOf("0031_fix_credit_ledger_missing_columns.sql") <
            predeploy.indexOf("0032_widen_credit_ledger_transaction_type.sql"),
        "credit migrations must run in ascending order after the plan seed",
      )
    },
  },
  {
    name: "widened CreditLedger constraint accepts every transactionType the billing sources write",
    async run() {
      const migration32 = readProjectFile(
        "src/lib/db/migrations/0032_widen_credit_ledger_transaction_type.sql",
      )
      assert.ok(migration32.includes("NOT VALID"), "widening must not validate legacy rows")
      const billingSources = [
        "src/lib/billing/credit-engine.ts",
        "src/lib/billing/credit-account-service.ts",
        "src/lib/billing/credit-topup-service.ts",
      ].map(readProjectFile)
      const writtenTypes = new Set<string>()
      for (const source of billingSources) {
        for (const match of source.matchAll(/transactionType:\s*"([A-Za-z_]+)"/g)) {
          writtenTypes.add(match[1])
        }
      }
      assert.ok(writtenTypes.size >= 8, "expected the billing sources to write ledger transaction types")
      for (const transactionType of writtenTypes) {
        assert.ok(
          migration32.includes(`'${transactionType}'`),
          `widened constraint must accept transactionType ${transactionType}`,
        )
      }
      for (const transactionType of ["PLAN_ALLOCATION", "PLAN_RESET", "USAGE_DEBIT", "TOP_UP_PURCHASE"]) {
        assert.ok(
          migration32.includes(`'${transactionType}'`),
          `constraint must accept ${transactionType}`,
        )
      }
    },
  },
  {
    name: "credit engine reconciles stuck accounts and reports failed plan-catalog seeding",
    run() {
      const engine = readProjectFile("src/lib/billing/credit-engine.ts")
      assert.ok(
        engine.includes("reconcileExistingUserCredit") &&
          engine.includes("repairNeverUsedCreditAccount"),
        "initializeUserCredits must reconcile existing plan-mismatch or zeroed accounts",
      )
      assert.ok(
        engine.includes("subscription plan catalog still missing after seed"),
        "plan catalog seeding must verify the plan row exists",
      )
      assert.ok(
        engine.includes("credit account plan reconciliation failed"),
        "failed plan reconciliation must be logged",
      )
    },
  },
]

async function main() {
  const db = getDb()
  if (!db) {
    console.error("SKIP pro credit self-heal regression test: DATABASE_URL not configured")
    process.exit(0)
  }

  try {
    await setupProProfile()
    let passed = 0
    let failed = 0
    for (const test of tests) {
      try {
        await test.run()
        passed++
        console.log(`PASS ${test.name}`)
      } catch (error) {
        failed++
        console.error(`FAIL ${test.name}`)
        console.error(error instanceof Error ? error.message : String(error))
      }
    }
    console.log(`\n${passed} passed, ${failed} failed`)
    if (failed > 0) process.exitCode = 1
  } finally {
    await cleanupTestUser()
  }
}

void main()
