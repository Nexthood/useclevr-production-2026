/**
 * Behavioral regression tests for the Pro-refund downgrade lifecycle.
 * All Stripe and database behavior is mocked — no real payments, refunds,
 * or production balance changes.
 *
 * Covered:
 *   1. Subscription termination → existing processPlanChange("free") resets
 *      included credits and preserves purchased credits.
 *   2. Free accounts cannot reserve/consume preserved purchased credits.
 *   3. Free accounts can still use their included allowance.
 *   4. Paid plans consume purchased credits after the included allowance is
 *      exhausted (re-upgrade restores access to preserved purchased credits).
 *   5. Source contracts: the webhook downgrades terminated subscriptions to
 *      Free via processPlanChange, and the checkout gate blocks Free top-up
 *      purchases.
 *
 * Run: pnpm test:credit-lifecycle-downgrade
 */
import assert from "node:assert/strict"

process.env.USECLEVR_CREDITS_TOP_UP_100_USD_STRIPE_PRICE_ID = "price_topup_100_usd"

async function run() {
  const { processPlanChange } = await import("@/lib/billing/credit-engine")
  const { reserveCredits, finalizeCredits } = await import("@/lib/billing/credit-engine")
  const { resetAllMockState, userCreditRows, profileRows, subscriptionPlanRows, ledgerRows } = await import("./mocks/mock-db.mjs")
  const { resetAccountStore } = await import("./mocks/mock-credit-account.mjs")

  type TestModule = { name: string; run: () => Promise<void> }

  const FUTURE_RESET = new Date(Date.now() + 30 * 24 * 3600 * 1000)

  function seedAccount(overrides: Record<string, unknown> = {}) {
    resetAllMockState()
    resetAccountStore()
    const userId = "user_lifecycle"
    profileRows.push({ userId, subscriptionTier: "pro", role: "user", email: "lifecycle@example.com" })
    subscriptionPlanRows.push({ id: "free" }, { id: "pro_monthly" }, { id: "business_monthly" })
    userCreditRows.push({
      id: "uc_lifecycle",
      userId,
      planId: "pro_monthly",
      totalCredits: 500,
      includedBalance: 437,
      purchasedBalance: 100,
      remainingCredits: 537,
      usedCredits: 63,
      reservedCredits: 0,
      totalPaidCents: 1000,
      lifetimeCreditsEarned: 800,
      lifetimeCreditsUsed: 63,
      creditsResetAt: FUTURE_RESET,
      lastResetAt: new Date(Date.now() - 10 * 24 * 3600 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    })
    return { userId, account: userCreditRows[0] }
  }

  const tests: TestModule[] = [
    {
      name: "full subscription refund → termination → downgrade to Free resets included credits and preserves purchased credits",
      async run() {
        seedAccount()
        // The Stripe webhook maps customer.subscription.deleted (or a terminal
        // subscription status) to the Free tier and calls processPlanChange.
        const changed = await processPlanChange("user_lifecycle", "free")
        assert.equal(changed, true)

        const account = userCreditRows[0]
        assert.equal(account.planId, "free")
        assert.equal(account.includedBalance, 0, "Pro included credits must be removed on downgrade")
        assert.equal(account.purchasedBalance, 100, "purchased credits must never be deleted by a downgrade")
        assert.equal(account.remainingCredits, 100, "only the preserved purchased credits remain spendable")
        assert.equal(account.totalCredits, 2)

        const resetEntry = ledgerRows.find((row) => row.transactionType === "PLAN_RESET")
        assert.ok(resetEntry, "plan change writes a PLAN_RESET ledger entry")
        assert.equal(resetEntry.includedBalanceAfter, 0)
        assert.equal(resetEntry.purchasedBalanceAfter, 100)
      },
    },
    {
      name: "Free accounts cannot reserve or consume preserved purchased credits",
      async run() {
        seedAccount()
        await processPlanChange("user_lifecycle", "free")
        // The Stripe webhook's profile update accompanies the credit lifecycle.
        profileRows[0].subscriptionTier = "free"

        const reservation = await reserveCredits({
          userId: "user_lifecycle",
          feature: "dataset_upload",
          estimatedCredits: 1,
        })
        assert.equal(reservation.success, false, "a Free account with zero included credits cannot reserve usage")

        const account = userCreditRows[0]
        assert.equal(account.purchasedBalance, 100, "purchased credits must stay untouched on Free")
        assert.equal(account.reservedCredits, 0)
      },
    },
    {
      name: "Free accounts can still use their included allowance without touching purchased credits",
      async run() {
        seedAccount({ planId: "free", totalCredits: 2, includedBalance: 2, remainingCredits: 102, usedCredits: 63 })
        profileRows[0].subscriptionTier = "free"

        const reservation = await reserveCredits({
          userId: "user_lifecycle",
          feature: "dataset_upload",
          estimatedCredits: 2,
        })
        assert.equal(reservation.success, true)

        const finalized = await finalizeCredits({
          operationId: reservation.operationId,
          actualCredits: 5, // actual usage exceeds the included allowance on purpose
        })
        assert.equal(finalized.success, true)
        assert.equal(finalized.creditsDeducted, 2, "the debit is capped to the included allowance on Free")

        const account = userCreditRows[0]
        assert.equal(account.includedBalance, 0)
        assert.equal(account.purchasedBalance, 100, "purchased credits must not be consumed on Free")
        assert.equal(account.remainingCredits, 100)
      },
    },
    {
      name: "re-upgrade to Pro restores access to the preserved purchased credits",
      async run() {
        seedAccount()
        await processPlanChange("user_lifecycle", "free")
        await processPlanChange("user_lifecycle", "pro")
        // The Stripe webhook's profile update accompanies the credit lifecycle.
        profileRows[0].subscriptionTier = "pro"

        const account = userCreditRows[0]
        assert.equal(account.planId, "pro_monthly")
        assert.equal(account.purchasedBalance, 100, "re-upgrade must not delete preserved purchased credits")

        const reservation = await reserveCredits({
          userId: "user_lifecycle",
          feature: "dataset_upload",
          estimatedCredits: 450, // exceeds the included allowance: draws on purchased credits
        })
        assert.equal(reservation.success, true, "paid plans can reserve against purchased credits again")

        const finalized = await finalizeCredits({
          operationId: reservation.operationId,
          actualCredits: 450,
        })
        assert.equal(finalized.success, true)
        assert.equal(finalized.creditsDeducted, 450)

        const afterUse = userCreditRows[0]
        assert.equal(afterUse.purchasedBalance, 50, "purchased credits are consumed again on Pro")
        assert.equal(afterUse.includedBalance, 0)
      },
    },
    {
      name: "paid plans still consume included credits before purchased credits",
      async run() {
        seedAccount() // pro, included 437, purchased 100
        const reservation = await reserveCredits({
          userId: "user_lifecycle",
          feature: "dataset_upload",
          estimatedCredits: 2,
        })
        assert.equal(reservation.success, true)

        const finalized = await finalizeCredits({
          operationId: reservation.operationId,
          actualCredits: 2,
        })
        assert.equal(finalized.success, true)

        const account = userCreditRows[0]
        assert.equal(account.includedBalance, 435)
        assert.equal(account.purchasedBalance, 100, "included credits are consumed first on paid plans")
      },
    },
    {
      name: "source contracts: terminated subscriptions downgrade to Free and the checkout gate blocks Free purchases",
      async run() {
        const { readFileSync } = await import("node:fs")
        const { resolve } = await import("node:path")
        const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8")

        const webhook = read("src/services/stripe/webhook.ts")
        assert.ok(webhook.includes('subscriptionTier = "free"'), "terminated subscriptions must resolve to Free")
        assert.ok(webhook.includes("processPlanChange"), "tier changes must run the credit lifecycle plan change")

        const checkout = read("src/app/api/checkout/credit-topup/route.ts")
        assert.ok(
          checkout.includes('accountTier !== "pro" && accountTier !== "business"'),
          "the checkout gate must block Free accounts from purchasing top-ups",
        )

        const engine = read("src/lib/billing/credit-engine.ts")
        assert.ok(
          engine.includes("paidPlanTier") && engine.includes("planTier"),
          "the credit engine must gate purchased-credit consumption on the plan tier",
        )
      },
    },
  ]

  let failures = 0
  for (const test of tests) {
    try {
      await test.run()
      console.log(`ok - ${test.name}`)
    } catch (error) {
      failures += 1
      console.error(`FAIL - ${test.name}`)
      console.error(error instanceof Error ? error.stack || error.message : error)
    }
  }

  console.log("")
  console.log(failures === 0 ? `All ${tests.length} credit lifecycle downgrade tests passed.` : `${failures} test(s) failed.`)
  if (failures > 0) process.exitCode = 1
}

void run()
