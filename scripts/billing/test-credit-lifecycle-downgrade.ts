/**
 * Behavioral regression tests for the plan lifecycle and purchased-credit
 * rules. All Stripe and database behavior is mocked — no real payments,
 * refunds, or production balance changes.
 *
 * Authoritative business rules covered:
 *   1. Subscription termination → processPlanChange("free") resets included
 *      credits and preserves purchased credits.
 *   2. Free accounts CAN consume preserved purchased credits after a
 *      downgrade — there is no hidden Free-tier block in the credit engine.
 *   3. Included credits are consumed before purchased credits on every tier.
 *   4. Re-upgrade restores top-up purchasing and preserves the purchased
 *      balance.
 *   5. Monthly reset on Free preserves purchased credits.
 *   6. Production regression: Free + included 0 + purchased 100 → a standard
 *      dataset upload reservation succeeds against the shared authoritative
 *      reservation layer, and consumption deducts from the purchased balance.
 *   7. Production regression: Free + included 0 + purchased 0 → normal
 *      insufficient-credit rejection plus the Free Upgrade to Pro/Business UX.
 *   8. Source contracts: the webhook downgrades terminated subscriptions to
 *      Free via processPlanChange, the checkout gate blocks Free top-up
 *      purchases server-side, and the engine contains no tier-based
 *      consumption gating.
 *
 * Run: pnpm test:credit-lifecycle-downgrade
 */
import assert from "node:assert/strict"

process.env.USECLEVR_CREDITS_TOP_UP_100_USD_STRIPE_PRICE_ID = "price_topup_100_usd"

async function run() {
  const { processPlanChange, checkAndPerformMonthlyReset } = await import("@/lib/billing/credit-engine")
  const { reserveCredits, finalizeCredits } = await import("@/lib/billing/credit-engine")
  const { buildCreditExhaustionState } = await import("@/lib/billing/credit-exhaustion")
  const { resetAllMockState, userCreditRows, profileRows, subscriptionPlanRows, ledgerRows } = await import("./mocks/mock-db.mjs")
  const { resetAccountStore, ensureAccount } = await import("./mocks/mock-credit-account.mjs")

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
      name: "subscription termination → downgrade to Free resets included credits and preserves purchased credits",
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
      name: "Free accounts can consume preserved purchased credits after a downgrade",
      async run() {
        seedAccount()
        await processPlanChange("user_lifecycle", "free")
        // The Stripe webhook's profile update accompanies the credit lifecycle.
        profileRows[0].subscriptionTier = "free"

        const reservation = await reserveCredits({
          userId: "user_lifecycle",
          feature: "dataset_upload",
          estimatedCredits: 60,
        })
        assert.equal(
          reservation.success,
          true,
          "a Free account must be able to spend its preserved purchased credits",
        )

        const finalized = await finalizeCredits({
          operationId: reservation.operationId,
          actualCredits: 60,
        })
        assert.equal(finalized.success, true)
        assert.equal(finalized.creditsDeducted, 60)

        const account = userCreditRows[0]
        assert.equal(account.includedBalance, 0)
        assert.equal(account.purchasedBalance, 40, "purchased credits are consumed on Free until exhausted")
        assert.equal(account.remainingCredits, 40)
      },
    },
    {
      name: "Free consumption draws on included credits before preserved purchased credits",
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
          actualCredits: 5,
        })
        assert.equal(finalized.success, true)
        assert.equal(finalized.creditsDeducted, 5)

        const account = userCreditRows[0]
        assert.equal(account.includedBalance, 0, "included credits are consumed first on Free")
        assert.equal(account.purchasedBalance, 97, "only the overflow beyond included draws on purchased credits")
        assert.equal(account.remainingCredits, 97)
      },
    },
  {
    name: "paid plans consume included credits before purchased credits",
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
    name: "production regression: Free + included 0 + purchased 100 → standard upload succeeds and the purchased balance decreases",
    async run() {
      // Exact production state: the Pro subscription ended, the account is Free,
      // and 100 legitimate purchased credits are preserved.
      seedAccount({
        planId: "free",
        totalCredits: 2,
        includedBalance: 0,
        purchasedBalance: 100,
        remainingCredits: 100,
      })
      profileRows[0].subscriptionTier = "free"

      // Exactly the reservation call /api/upload/simple performs for a
      // standard upload — the shared authoritative reservation layer must see
      // the preserved purchased credits as usable.
      const reservation = await reserveCredits({
        userId: "user_lifecycle",
        estimatedCredits: 1,
        feature: "dataset_upload",
        source: "upload",
        metadata: {
          datasetId: null,
          fileName: "store.csv",
          rowCount: 12,
          datasetType: "standard",
          businessModel: "retail",
        },
      })
      assert.equal(
        reservation.success,
        true,
        "a Free account with preserved purchased credits must be able to reserve credits for a standard upload",
      )
      assert.equal(reservation.reservedCredits, 1)

      const finalized = await finalizeCredits({
        operationId: reservation.operationId,
        actualCredits: 1,
      })
      assert.equal(finalized.success, true, "the standard upload must finalize its reserved credit")
      assert.equal(finalized.creditsDeducted, 1)

      const account = userCreditRows[0]
      assert.equal(account.includedBalance, 0, "the exhausted included allowance stays at zero")
      assert.equal(
        account.purchasedBalance,
        99,
        "consumption must deduct from the preserved purchased balance when the included balance is exhausted",
      )
      assert.equal(account.remainingCredits, 99)

      const debit = ledgerRows.find((row) => row.transactionType === "USAGE_DEBIT")
      assert.ok(debit, "the upload writes a USAGE_DEBIT ledger entry")
      assert.equal(debit.credits, 1)
    },
  },
  {
    name: "production regression: when the preserved purchased balance reaches 0, uploads are rejected with the Free upgrade UX",
    async run() {
      seedAccount({
        planId: "free",
        totalCredits: 2,
        includedBalance: 0,
        purchasedBalance: 1,
        remainingCredits: 1,
      })
      profileRows[0].subscriptionTier = "free"

      // The last preserved purchased credit funds exactly one more upload.
      const draining = await reserveCredits({
        userId: "user_lifecycle",
        estimatedCredits: 1,
        feature: "dataset_upload",
        source: "upload",
      })
      assert.equal(draining.success, true)
      const drained = await finalizeCredits({ operationId: draining.operationId, actualCredits: 1 })
      assert.equal(drained.success, true)
      assert.equal(userCreditRows[0].purchasedBalance, 0)

      // The next upload must hit the normal insufficient-credit result.
      const rejected = await reserveCredits({
        userId: "user_lifecycle",
        estimatedCredits: 1,
        feature: "dataset_upload",
        source: "upload",
      })
      assert.equal(rejected.success, false)
      assert.match(rejected.error || "", /Insufficient credits/)

      // The 402 payload must trigger the Free Upgrade to Pro/Business UX.
      const accountStore = ensureAccount("user_lifecycle", "free")
      accountStore.includedBalance = userCreditRows[0].includedBalance
      accountStore.purchasedBalance = userCreditRows[0].purchasedBalance
      accountStore.remainingCredits = userCreditRows[0].remainingCredits
      const creditState = await buildCreditExhaustionState({
        userId: "user_lifecycle",
        tier: "free",
        requiredCredits: 1,
      })
      assert.ok(creditState, "the exhaustion payload must be derivable")
      assert.equal(creditState.tier, "free")
      assert.equal(creditState.reason, "zero_credits")
      assert.equal(creditState.usableCredits, 0)
      assert.equal(creditState.cta.action, "upgrade")
      assert.equal(creditState.cta.href, "/app/settings/checkout?plan=pro_monthly&discount=auto")
      assert.match(creditState.message, /cannot purchase top-ups/i)
    },
  },
  {
    name: "Business plan reservation and consumption behavior is unchanged",
    async run() {
      seedAccount({
        planId: "business_monthly",
        totalCredits: 400,
        includedBalance: 400,
        purchasedBalance: 100,
        remainingCredits: 500,
      })
      profileRows[0].subscriptionTier = "business"

      const reservation = await reserveCredits({
        userId: "user_lifecycle",
        estimatedCredits: 1,
        feature: "dataset_upload",
        source: "upload",
      })
      assert.equal(reservation.success, true)

      const finalized = await finalizeCredits({
        operationId: reservation.operationId,
        actualCredits: 1,
      })
      assert.equal(finalized.success, true)
      assert.equal(finalized.creditsDeducted, 1)

      const account = userCreditRows[0]
      assert.equal(account.includedBalance, 399)
      assert.equal(account.purchasedBalance, 100, "business included credits are consumed first")
      assert.equal(account.remainingCredits, 499)
    },
  },
    {
      name: "re-upgrade to Pro preserves the purchased balance and restores consumption",
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
      name: "monthly reset on Free preserves purchased credits",
      async run() {
        seedAccount()
        await processPlanChange("user_lifecycle", "free")
        profileRows[0].subscriptionTier = "free"
        // Force the reset date into the past so the monthly reset runs.
        userCreditRows[0].creditsResetAt = new Date(Date.now() - 24 * 3600 * 1000)

        const reset = await checkAndPerformMonthlyReset("user_lifecycle")
        assert.equal(reset, true)

        const account = userCreditRows[0]
        assert.equal(account.includedBalance, 2, "Free allowance is granted again on reset")
        assert.equal(account.purchasedBalance, 100, "monthly reset must never delete purchased credits")
        assert.equal(account.remainingCredits, 102)
      },
    },
    {
      name: "source contracts: terminated subscriptions downgrade to Free, the checkout gate blocks Free purchases, and the engine has no Free consumption block",
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
          !engine.includes("paidPlanTier") && !engine.includes("purchasedConsumable") && !engine.includes("planTier"),
          "the credit engine must not gate purchased-credit consumption on the plan tier",
        )
        assert.ok(
          engine.includes('WHEN "includedBalance" >= ${actualCredits} THEN "purchasedBalance"'),
          "finalizeCredits must consume included credits before purchased credits on every tier",
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
