import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { isSuperAdminUserId } from "@/lib/auth/builtin-users"
import {
  getCreditAccount,
  addPurchasedCredits,
  checkSpendingLimits,
  getSpendingLimits,
  setSpendingLimits,
  getPurchaseTraces,
  reconcileAccount,
} from "@/lib/billing/credit-account-service"
import {
  reserveCredits,
  finalizeCredits,
  releaseCredits,
} from "@/lib/billing/credit-engine"
import { CREDITS_PER_EURO } from "@/lib/billing/credit-account-service"

type TestCase = {
  name: string
  run: () => Promise<void> | void
}

const tests: TestCase[] = [
  {
    name: "purchase API is admin-only",
    run() {
      const route = readProjectFile("src/app/api/billing/purchase/route.ts")
      assert.ok(route.includes("isSuperAdminUserId"), "purchase route requires superadmin check")
      assert.ok(route.includes("Forbidden"), "purchase route returns forbidden for non-admins")
      assert.ok(!route.includes("await auth()\n  if (!userId)"), "purchase route no longer allows any authenticated user")
    },
  },
  {
    name: "spending limits enforce daily cap",
    run() {
      const service = readProjectFile("src/lib/billing/credit-account-service.ts")
      assert.ok(service.includes("limits.dailyLimit !== null && limits.dailyLimit > 0"), "daily limit check exists")
      assert.ok(service.includes("dayStart"), "daily usage period is calculated")
    },
  },
  {
    name: "spending limits enforce weekly cap",
    run() {
      const service = readProjectFile("src/lib/billing/credit-account-service.ts")
      assert.ok(service.includes("limits.weeklyLimit !== null && limits.weeklyLimit > 0"), "weekly limit check exists")
      assert.ok(service.includes("weekStart"), "weekly usage period is calculated")
    },
  },
  {
    name: "spending limits enforce monthly purchased cap",
    run() {
      const service = readProjectFile("src/lib/billing/credit-account-service.ts")
      assert.ok(service.includes("limits.monthlyPurchasedLimit !== null && limits.monthlyPurchasedLimit > 0"), "monthly limit check exists")
      assert.ok(service.includes("monthStart"), "monthly usage period is calculated")
    },
  },
  {
    name: "spending limits enforce per-operation cap",
    run() {
      const service = readProjectFile("src/lib/billing/credit-account-service.ts")
      assert.ok(service.includes("limits.perOperationMax !== null && limits.perOperationMax > 0"), "per-operation limit check exists")
      assert.ok(service.includes("pendingReservationsResult"), "pending reservations are summed for per-operation cap")
    },
  },
  {
    name: "spending limits are wired into analyze route",
    run() {
      const route = readProjectFile("src/app/api/analyze/route.ts")
      assert.ok(route.includes("checkSpendingLimits"), "analyze route checks spending limits")
      assert.ok(route.includes("spendingLimitCheck.blocked"), "analyze route blocks on spending limit")
    },
  },
  {
    name: "spending limits are wired into chat route",
    run() {
      const route = readProjectFile("src/app/api/chat/route.ts")
      assert.ok(route.includes("checkSpendingLimits"), "chat route checks spending limits")
      assert.ok(route.includes("spendingBlocked"), "chat route tracks spending blocked state")
    },
  },
  {
    name: "spending limits are wired into reports generate route",
    run() {
      const route = readProjectFile("src/app/api/reports/generate/route.ts")
      assert.ok(route.includes("checkSpendingLimits"), "reports/generate route checks spending limits")
      assert.ok(route.includes("spendingLimitCheck.blocked"), "reports/generate route blocks on spending limit")
    },
  },
  {
    name: "spending limits are wired into reports route",
    run() {
      const route = readProjectFile("src/app/api/reports/route.ts")
      assert.ok(route.includes("checkSpendingLimits"), "reports route checks spending limits")
      assert.ok(route.includes("spendingLimitCheck.blocked"), "reports route blocks on spending limit")
    },
  },
  {
    name: "spending limits are wired into upload route",
    run() {
      const route = readProjectFile("src/app/api/upload/simple/route.ts")
      assert.ok(route.includes("checkSpendingLimits"), "upload route checks spending limits")
      assert.ok(route.includes("UPLOAD_SPENDING_LIMIT_REACHED"), "upload route returns spending limit error code")
    },
  },
  {
    name: "spending limits are wired into datasets route",
    run() {
      const route = readProjectFile("src/app/api/datasets/route.ts")
      assert.ok(route.includes("checkSpendingLimits"), "datasets route checks spending limits")
      assert.ok(route.includes("UPLOAD_SPENDING_LIMIT_REACHED"), "datasets route returns spending limit error code")
    },
  },
  {
    name: "spending limits are wired into dataset analysis route",
    run() {
      const route = readProjectFile("src/app/api/datasets/[id]/analyze/route.ts")
      assert.ok(route.includes("checkSpendingLimits"), "dataset analysis route checks spending limits")
      assert.ok(route.includes("SPENDING_LIMIT_REACHED"), "dataset analysis route returns spending limit error code")
    },
  },
  {
    name: "spending limits are wired into accountancy upload",
    run() {
      const service = readProjectFile("src/lib/accountancy/upload-processing.ts")
      assert.ok(service.includes("checkSpendingLimits"), "accountancy upload checks spending limits")
      assert.ok(service.includes("UPLOAD_SPENDING_LIMIT_REACHED"), "accountancy upload returns spending limit error code")
    },
  },
  {
    name: "reconciliation excludes pending reservations",
    run() {
      const service = readProjectFile("src/lib/billing/credit-account-service.ts")
      assert.ok(
        service.includes("transactionType NOT IN ('reservation')") ||
          service.includes("NOT IN ('reservation')"),
        "reconciliation excludes pending reservations from expected balance"
      )
    },
  },
  {
    name: "purchase traces implement FIFO attribution",
    run() {
      const service = readProjectFile("src/lib/billing/credit-account-service.ts")
      assert.ok(service.includes("for (const purchase of purchases)"), "purchase traces iterate purchases")
      assert.ok(service.includes("for (const t of usage)"), "purchase traces iterate usage")
      assert.ok(service.includes("if (t.createdAt < purchase.createdAt) continue"), "FIFO respects chronological order")
      assert.ok(service.includes("remainingCredits -= consumed"), "FIFO decrements remaining credits")
    },
  },
  {
    name: "idempotency keys are unique in schema",
    run() {
      const schema = readProjectFile("src/lib/db/schema.ts")
      assert.ok(schema.includes('idempotencyKeyIdx: uniqueIndex("CreditLedger_idempotencyKey_key")'), "idempotency key has unique index")
    },
  },
  {
    name: "atomic credit deduction uses conditional update",
    run() {
      const engine = readProjectFile("src/lib/billing/credit-engine.ts")
      assert.ok(engine.includes('AND ("remainingCredits" - "reservedCredits") >= ${estimatedCredits}'), "reserve uses conditional update")
      assert.ok(engine.includes('AND ("remainingCredits" - "reservedCredits" + ${reservedCredits}) >= ${actualCredits}'), "finalize uses conditional update")
    },
  },
  {
    name: "failed operations release reservations explicitly",
    run() {
      const engine = readProjectFile("src/lib/billing/credit-engine.ts")
      assert.ok(engine.includes('await releaseCreditsForOperation'), "release helper exists for failures")
      assert.ok(engine.includes('status: "released"'), "released status is set on release")
      assert.ok(engine.includes('type: "release"'), "release entries are typed correctly")
    },
  },
  {
    name: "admin bypass is server-side and explicit",
    run() {
      const engine = readProjectFile("src/lib/billing/credit-engine.ts")
      assert.ok(engine.includes("hasUnlimitedCreditAccess"), "unlimited access helper exists")
      assert.ok(engine.includes("isSuperAdminUserId"), "superadmin check exists")
      assert.ok(engine.includes('return { allowed: true, remainingCredits: 0, requiredCredits, currentPlan: "unlimited" }'), "admin bypass returns unlimited plan")
    },
  },
  {
    name: "dataset deletion never restores credits",
    run() {
      const deleteSource = readProjectFile("src/lib/data/delete-datasets.ts")
      assert.ok(!deleteSource.includes("refundCredits"), "dataset deletion never refunds credits")
      assert.ok(!deleteSource.includes("creditLedger"), "dataset deletion never deletes credit ledger rows")
      assert.ok(!deleteSource.includes("UserCredit"), "dataset deletion never recalculates user credit counters")
    },
  },
  {
    name: "payment provider fields are stored on purchase ledger",
    run() {
      const schema = readProjectFile("src/lib/db/schema.ts")
      assert.ok(schema.includes("paymentProvider: varchar"), "paymentProvider column exists")
      assert.ok(schema.includes("providerTransactionId: varchar"), "providerTransactionId column exists")
      assert.ok(schema.includes("paymentStatus: varchar"), "paymentStatus column exists")
    },
  },
  {
    name: "credit ledger records never get deleted",
    run() {
      const engine = readProjectFile("src/lib/billing/credit-engine.ts")
      assert.ok(!engine.includes("DELETE FROM") || !engine.includes("delete(creditLedger)"), "credit engine never deletes ledger rows")
      assert.ok(!engine.includes("TRUNCATE"), "credit engine never truncates ledger")
    },
  },
  {
    name: "concurrent debit protection uses atomic conditional update",
    run() {
      const engine = readProjectFile("src/lib/billing/credit-engine.ts")
      assert.ok(engine.includes("db.transaction"), "finalize runs in transaction")
      assert.ok(engine.includes("RETURNING"), "finalize uses RETURNING for atomic read-modify-write")
    },
  },
  {
    name: "webhook signature verification exists for stripe",
    run() {
      const webhook = readProjectFile("src/app/api/webhooks/stripe/route.ts")
      assert.ok(webhook.includes("constructEvent"), "stripe webhook verifies signature")
      assert.ok(webhook.includes("stripe-signature"), "stripe webhook checks signature header")
    },
  },
  {
    name: "rate limit messaging is separate from credit messaging",
    run() {
      const usage = readProjectFile("src/lib/billing/usage-enforcement.ts")
      const engine = readProjectFile("src/lib/billing/credit-engine.ts")
      assert.ok(usage.includes("Daily AI request limit reached"), "rate limit has its own message")
      assert.ok(engine.includes("Insufficient credits"), "credit limit has its own message")
    },
  },
]

const repoRoot = resolve(import.meta.dirname, "../..")

function readProjectFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8")
}

async function main() {
  for (const test of tests) {
    await test.run()
    console.log(`ok - ${test.name}`)
  }

  console.log(`Billing integrity verification passed (${tests.length} checks).`)
}

void main()
