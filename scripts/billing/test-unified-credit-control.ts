/**
 * Behavioral regression tests for the unified credit-control system.
 * All database behavior is mocked — no real balances are touched.
 *
 * Covered scenarios (master credit-control contract):
 *   A. Free + included 0 + purchased 100 → 10-credit standard upload analysis
 *      succeeds and purchased becomes 90.
 *   B. Free + available 9 → 10-credit standard analysis is rejected before any
 *      provider work and the balance stays 9.
 *   C. Pro + included 15 + purchased 100 → standard analysis consumes included
 *      credits only (included 5, purchased stays 100).
 *   D. Pro + included 5 + purchased 100 → 10-credit analysis consumes
 *      5 included + 5 purchased (purchased 95).
 *   E. AI Analyst message → exactly 1 credit.
 *   F. Report generation → exactly 3 credits.
 *   G. Existing report download → 0 credits.
 *   H. Failed/retried operations never double-charge.
 *   I. Concurrent reservations cannot overspend or go negative.
 *   J. UI credit displays all derive from the authoritative credit account.
 *   K. Free accounts consume purchased credits but cannot buy top-ups.
 *
 * Run: pnpm test:credit-unified
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

process.env.USECLEVR_CREDITS_TOP_UP_100_USD_STRIPE_PRICE_ID = "price_topup_100_usd"

async function run() {
  const { reserveCredits, finalizeCredits, releaseCredits } = await import("@/lib/billing/credit-engine")
  const { estimateFeatureCredits, canPlanUseFeature, FEATURE_CREDIT_COSTS } = await import("@/lib/billing/feature-costs")
  const { resetAllMockState, userCreditRows, profileRows, subscriptionPlanRows, ledgerRows } = await import("./mocks/mock-db.mjs")
  const { resetAccountStore } = await import("./mocks/mock-credit-account.mjs")

  type TestModule = { name: string; run: () => Promise<void> }

  const FUTURE_RESET = new Date(Date.now() + 30 * 24 * 3600 * 1000)

  function seedAccount(
    tier: "free" | "pro",
    balances: { included: number; purchased: number; remaining?: number },
    overrides: Record<string, unknown> = {},
  ) {
    resetAllMockState()
    resetAccountStore()
    const userId = "user_unified"
    profileRows.push({ userId, subscriptionTier: tier, role: "user", email: "unified@example.com" })
    subscriptionPlanRows.push({ id: "free" }, { id: "pro_monthly" }, { id: "business_monthly" })
    userCreditRows.push({
      id: "uc_unified",
      userId,
      planId: tier === "pro" ? "pro_monthly" : "free",
      totalCredits: tier === "pro" ? 500 : 2,
      includedBalance: balances.included,
      purchasedBalance: balances.purchased,
      remainingCredits: balances.remaining ?? balances.included + balances.purchased,
      usedCredits: 0,
      reservedCredits: 0,
      totalPaidCents: balances.purchased > 0 ? 1000 : 0,
      lifetimeCreditsEarned: 500,
      lifetimeCreditsUsed: 0,
      creditsResetAt: FUTURE_RESET,
      lastResetAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    })
    return userId
  }

  function account() {
    return userCreditRows[0]
  }

  async function invariant(userId: string) {
    const row = userCreditRows.find((r) => r.userId === userId)
    assert.ok(row, "credit account exists")
    assert.ok(
      (row.remainingCredits ?? 0) >= 0 && (row.purchasedBalance ?? 0) >= 0 && (row.includedBalance ?? 0) >= 0,
      "no negative balances",
    )
    return row
  }

  const tests: TestModule[] = [
    {
      name: "A: Free + included 0 + purchased 100 succeeds a 10-credit standard analysis and purchased becomes 90",
      async run() {
        const userId = seedAccount("free", { included: 0, purchased: 100 })
        const reservation = await reserveCredits({ userId, feature: "standard_upload_analysis", source: "upload" })
        assert.equal(reservation.success, true, "purchased credits are usable on Free")
        assert.equal(reservation.reservedCredits, FEATURE_CREDIT_COSTS.STANDARD_UPLOAD_ANALYSIS)

        const finalized = await finalizeCredits({ operationId: reservation.operationId })
        assert.equal(finalized.success, true)
        assert.equal(finalized.creditsDeducted, 10)

        const row = await invariant(userId)
        assert.equal(row.purchasedBalance, 90)
        assert.equal(row.includedBalance, 0)
        assert.equal(row.remainingCredits, 90)
        assert.equal(row.usedCredits, 10)
      },
    },
    {
      name: "B: Free + available 9 rejects a 10-credit standard analysis before expensive processing",
      async run() {
        const userId = seedAccount("free", { included: 0, purchased: 9 })
        let providerCalled = false
        const callProvider = async () => {
          providerCalled = true
        }

        const reservation = await reserveCredits({ userId, feature: "standard_upload_analysis", source: "upload" })
        assert.equal(reservation.success, false)
        if (reservation.success) await callProvider()

        assert.equal(providerCalled, false, "rejection must happen before provider execution")
        const row = await invariant(userId)
        assert.equal(row.remainingCredits, 9)
        assert.equal(row.purchasedBalance, 9)
        assert.equal(row.usedCredits, 0)
      },
    },
    {
      name: "C: Pro + included 15 + purchased 100 consumes included credits first (included 5, purchased 100)",
      async run() {
        const userId = seedAccount("pro", { included: 15, purchased: 100 })
        const reservation = await reserveCredits({ userId, feature: "standard_upload_analysis", source: "upload" })
        assert.equal(reservation.success, true)

        const finalized = await finalizeCredits({ operationId: reservation.operationId })
        assert.equal(finalized.success, true)
        assert.equal(finalized.creditsDeducted, 10)

        const row = await invariant(userId)
        assert.equal(row.includedBalance, 5)
        assert.equal(row.purchasedBalance, 100)
      },
    },
    {
      name: "D: Pro + included 5 + purchased 100 consumes 5 included + 5 purchased (purchased 95)",
      async run() {
        const userId = seedAccount("pro", { included: 5, purchased: 100 })
        const reservation = await reserveCredits({ userId, feature: "standard_upload_analysis", source: "upload" })
        assert.equal(reservation.success, true)

        const finalized = await finalizeCredits({ operationId: reservation.operationId })
        assert.equal(finalized.success, true)
        assert.equal(finalized.creditsDeducted, 10)

        const row = await invariant(userId)
        assert.equal(row.includedBalance, 0)
        assert.equal(row.purchasedBalance, 95)
      },
    },
    {
      name: "E: an AI Analyst message debits exactly 1 credit",
      async run() {
        const userId = seedAccount("pro", { included: 10, purchased: 0 }, { usedCredits: 1, lifetimeCreditsUsed: 1 })
        const reservation = await reserveCredits({ userId, feature: "ai_question", source: "api" })
        assert.equal(reservation.success, true)
        assert.equal(reservation.reservedCredits, 1)

        const finalized = await finalizeCredits({ operationId: reservation.operationId })
        assert.equal(finalized.creditsDeducted, 1)

        const row = await invariant(userId)
        assert.equal(row.usedCredits, 2)
        assert.equal(row.remainingCredits, 9)
      },
    },
    {
      name: "F: successful report generation debits exactly 3 credits",
      async run() {
        const userId = seedAccount("pro", { included: 10, purchased: 0 }, { usedCredits: 1, lifetimeCreditsUsed: 1 })
        const reservation = await reserveCredits({ userId, feature: "report_generation", source: "dashboard" })
        assert.equal(reservation.success, true)
        assert.equal(reservation.reservedCredits, 3)

        const finalized = await finalizeCredits({ operationId: reservation.operationId })
        assert.equal(finalized.creditsDeducted, 3)

        const row = await invariant(userId)
        assert.equal(row.usedCredits, 4)
      },
    },
    {
      name: "G: an existing report download costs 0 credits",
      async run() {
        assert.equal(FEATURE_CREDIT_COSTS.EXISTING_REPORT_DOWNLOAD, 0)
        assert.equal(estimateFeatureCredits("existing_report_download"), 0)
        assert.equal(estimateFeatureCredits("report_download"), 0)
        assert.equal(canPlanUseFeature("free", "existing_report_download"), true)
        const downloadRoute = readProjectFile("src/app/api/reports/download/route.ts")
        assert.ok(!downloadRoute.includes("reserveCredits"), "report downloads never reserve credits")
        assert.ok(!downloadRoute.includes("finalizeCredits"), "report downloads never finalize credits")
      },
    },
    {
      name: "H: failed then retried operations never double-charge",
      async run() {
        const userId = seedAccount("pro", { included: 10, purchased: 0 }, { usedCredits: 1, lifetimeCreditsUsed: 1 })

        const failed = await reserveCredits({ userId, feature: "report_generation", source: "dashboard" })
        assert.equal(failed.success, true)
        await releaseCredits(failed.operationId, "report_generation_failed")

        const retry = await reserveCredits({ userId, feature: "report_generation", source: "dashboard" })
        assert.equal(retry.success, true, "released reservation frees the balance for the retry")
        const finalized = await finalizeCredits({ operationId: retry.operationId })
        assert.equal(finalized.creditsDeducted, 3)

        // Finalizing the already-finalized operation again must not debit again.
        const replay = await finalizeCredits({ operationId: retry.operationId })
        assert.equal(replay.success, true)
        assert.equal(replay.creditsDeducted, 3, "replay returns the original charge instead of debiting twice")

        const row = await invariant(userId)
        assert.equal(row.usedCredits, 4)
        assert.equal(row.remainingCredits, 7)
      },
    },
    {
      name: "I: concurrent reservations cannot overspend or create a negative balance",
      async run() {
        const userId = seedAccount("pro", { included: 15, purchased: 0 }, { usedCredits: 1, lifetimeCreditsUsed: 1 })
        const results = await Promise.all([
          reserveCredits({ userId, feature: "standard_upload_analysis", source: "concurrent" }),
          reserveCredits({ userId, feature: "standard_upload_analysis", source: "concurrent" }),
          reserveCredits({ userId, feature: "standard_upload_analysis", source: "concurrent" }),
        ])

        const succeeded = results.filter((r) => r.success)
        assert.equal(succeeded.length, 1, "only one 10-credit reservation fits a 15-credit balance")

        const finalized = await finalizeCredits({ operationId: succeeded[0].operationId })
        assert.equal(finalized.success, true)
        assert.equal(finalized.creditsDeducted, 10)

        const row = await invariant(userId)
        assert.equal(row.remainingCredits, 5)
        assert.ok(row.remainingCredits >= 0 && row.purchasedBalance >= 0)
      },
    },
    {
      name: "J: sidebar, top indicator and Reports & Downloads derive from the authoritative credit balance",
      async run() {
        const usageApi = readProjectFile("src/app/api/usage/route.ts")
        const creditsApi = readProjectFile("src/app/api/usage/credits/route.ts")
        assert.ok(usageApi.includes("getCreditAccount") && creditsApi.includes("getCreditAccount"),
          "both usage APIs read the same authoritative credit account")

        const usageMonitor = readProjectFile("src/components/ui/usage-monitor.tsx")
        assert.ok(usageMonitor.includes('fetch("/api/usage"'), "sidebar credit card reads the authoritative usage API")
        assert.ok(usageMonitor.includes("data.availableCredits ?? 0"), "sidebar derives its primary number from the server available balance")
        assert.ok(!usageMonitor.includes("data.total ?? availableCredits"), "sidebar no longer treats included+purchased as the available balance")

        const sidebar = readProjectFile("src/components/layout/app-sidebar.tsx")
        assert.ok(sidebar.includes("useUsage()"), "sidebar reuses the shared authoritative usage hook")

        const topbar = readProjectFile("src/components/ui/topbar.tsx")
        assert.ok(topbar.includes("getAnalystCreditUsage"), "top indicator reads the credit engine")
        assert.ok(topbar.includes("usage.availableCredits ?? 0"), "top indicator shows the authoritative available balance")

        const downloads = readProjectFile("src/app/(auth)/app/downloads/page.tsx")
        assert.ok(downloads.includes("usageData.availableCredits"), "Reports & Downloads shows the authoritative available balance")
        assert.ok(!downloads.includes("analyses used this month"), "legacy monthly analysis quota copy is removed")
        assert.ok(!downloads.includes("usageData.total"), "Reports & Downloads no longer presents the legacy quota total")
      },
    },
    {
      name: "K: Free accounts consume purchased credits but cannot buy additional top-ups",
      async run() {
        const userId = seedAccount("free", { included: 0, purchased: 100 })
        const reservation = await reserveCredits({ userId, feature: "ai_question", source: "api" })
        assert.equal(reservation.success, true)
        const finalized = await finalizeCredits({ operationId: reservation.operationId })
        assert.equal(finalized.creditsDeducted, 1)
        const row = await invariant(userId)
        assert.equal(row.purchasedBalance, 99)

        const checkoutRoute = readProjectFile("src/app/api/checkout/credit-topup/route.ts")
        assert.ok(checkoutRoute.includes('accountTier !== "pro" && accountTier !== "business"'),
          "checkout gate blocks Free top-up purchases server-side")
        assert.ok(checkoutRoute.includes("status: 403"), "Free top-up purchase attempts are rejected")
      },
    },
    {
      name: "upload flows reserve one unified 10-credit standard upload analysis",
      async run() {
        const uploadAction = readProjectFile("src/app/actions/upload.ts")
        assert.ok(uploadAction.includes('feature: "standard_upload_analysis"'), "upload action reserves the unified feature")
        assert.ok(!uploadAction.includes("estimatedCredits: 1"), "upload action no longer reserves a 1-credit upload stub")
        assert.ok(uploadAction.includes("actualCredits: uploadReservedCredits"), "upload action finalizes exactly the reserved amount")

        const analyzeRoute = readProjectFile("src/app/api/datasets/[id]/analyze/route.ts")
        assert.ok(analyzeRoute.includes('feature: "standard_upload_analysis"'), "dataset re-analysis uses the unified feature")
        assert.ok(!analyzeRoute.includes("actualCredits: 1"), "dataset re-analysis finalizes the reserved amount, not a 1-credit stub")

        const chatRoute = readProjectFile("src/app/api/chat/route.ts")
        assert.ok(
          chatRoute.indexOf("reserveCredits") < chatRoute.indexOf("handleAnalyticalQuery(datasetId"),
          "chat route reserves credits before the analytical branch executes",
        )
        assert.ok(chatRoute.includes("analytical_chat_failed"), "analytical chat failures release the reservation")

        const questionRoute = readProjectFile("src/app/api/analyze/route.ts")
        assert.ok(questionRoute.includes('feature: "ai_question"'), "AI analyst questions debit the 1-credit message feature")
      },
    },
  ]

  const repoRoot = resolve(import.meta.dirname, "../..")

  function readProjectFile(relativePath: string) {
    return readFileSync(resolve(repoRoot, relativePath), "utf8")
  }

  for (const test of tests) {
    await test.run()
    console.log(`ok - ${test.name}`)
  }

  console.log(`Unified credit control verification passed (${tests.length} checks).`)
}

void run()
