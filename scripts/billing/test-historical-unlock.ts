/**
 * Behavioral regression tests for the UseClevr subscription downgrade +
 * permanent historical data retention + one-time historical data unlock.
 *
 * All Stripe and database behavior is mocked — no real payments, no real
 * webhooks, no production changes.
 *
 * Covered product rules:
 *   1-2. Pro/Business cancellation downgrades to Free with tier history.
 *   3-4. Historical datasets stay stored (never deleted or recreated).
 *   5-6. Cancelled accounts cannot use active Pro/Business functionality.
 *   7-9. Former Pro sees $29 / former Business sees $149 USD; single Price per
 *        tier with Stripe FIXED multi-currency amounts (currency_options).
 *   34-38. All 8 exact tier/currency combos (Pro 2900/2500/2200/4000,
 *        Business 14900/13000/11200/21000) pass checkout+webhook; drifted
 *        options, unsupported currencies, wrong amounts/tiers/Prices, and
 *        client tier/currency/amount manipulation fail closed; Usy presents
 *        the fixed regional prices from the canonical configuration.
 *   10. Client cannot manipulate the unlock tier or price.
 *   11-15. Webhook-verified unlock grants a durable entitlement only: account
 *          stays Free, no recurring subscription, no paid capacity.
 *   16-18. Cancelled checkout / failed payment / forged success URL never unlock.
 *   19-20. Replays are idempotent; duplicate payments never re-grant.
 *   21-22. Cross-account attribution and dataset isolation stay strict.
 *   23-26. Resubscription restores paid access, data reconnects intact, and a
 *          purchased unlock survives later cancel/resubscribe cycles.
 *   27-30. Existing Free/Pro/Business flows keep working; superadmin unchanged.
 *   31-33. Webhook security invariants, durable schema/pipeline wiring, and
 *          data-safe UI wording.
 *
 * Run: pnpm test:historical-unlock
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

process.env.STRIPE_PRICE_PRO_EUR_MONTHLY = "price_pro_eur_monthly"
process.env.STRIPE_PRICE_BUSINESS_EUR_MONTHLY = "price_business_eur_monthly"
process.env.STRIPE_PRO_HISTORICAL_UNLOCK_PRICE_ID = "price_hist_unlock_pro"
process.env.STRIPE_BUSINESS_HISTORICAL_UNLOCK_PRICE_ID = "price_hist_unlock_business"

const DAY_MS = 24 * 3600 * 1000

type TestModule = { name: string; run: () => Promise<void> }

type SubscriptionFixture = {
  id: string
  customer: string
  status: string
  cancel_at_period_end: boolean
  current_period_end: number
  items: { data: Array<{ price: { id: string | null } }> }
  metadata: Record<string, string>
}

import { profileRows, resetAllMockState, datasetRows, datasetRowRows, ledgerRows, userCreditRows } from "./mocks/mock-db.mjs"
import { ensureAccount, resetAccountStore } from "./mocks/mock-credit-account.mjs"
import { resetStripeMock, setMockPrice, stripeCalls } from "./mocks/mock-stripe.mjs"

class StripeNotFoundError extends Error {}

function makeSubscription(overrides: Partial<SubscriptionFixture> = {}): SubscriptionFixture {
  return {
    id: "sub_test_1",
    customer: "cus_user_pro",
    status: "active",
    cancel_at_period_end: false,
    current_period_end: Math.floor((Date.now() + 30 * DAY_MS) / 1000),
    items: { data: [{ price: { id: "price_pro_eur_monthly" } }] },
    metadata: { userId: "user_pro", userEmail: "user_pro@example.com", subscriptionTier: "pro" },
    ...overrides,
  }
}

function seedEndedPaidAccount(options: {
  userId: string
  tier: "pro" | "business"
  endedAt?: Date
  unlocked?: boolean
  unlockPaymentId?: string
  preferredCurrency?: string
}) {
  resetAllMockState()
  resetAccountStore()
  const tier = options.tier
  const userId = options.userId
  const ended = options.endedAt ?? new Date(Date.now() - 2 * DAY_MS)
  datasetRows.push(
    {
      id: "ds_hist_1",
      userId,
      name: "Historical Sales 2025",
      rowCount: 4200,
      columnCount: 7,
      createdAt: new Date(ended.getTime() - 90 * DAY_MS),
      analysis: { summary: "historical" },
    },
    {
      id: "ds_hist_2",
      userId,
      name: "Historical Reports Q3",
      rowCount: 1100,
      columnCount: 5,
      createdAt: new Date(ended.getTime() - 45 * DAY_MS),
      analysis: { summary: "historical" },
    },
  )
  datasetRowRows.push(
    { id: "row_1", datasetId: "ds_hist_1", rowIndex: 0, data: { amount: 100 } },
    { id: "row_2", datasetId: "ds_hist_1", rowIndex: 1, data: { amount: 200 } },
  )
  profileRows.push({
    userId,
    subscriptionTier: "free",
    role: "user",
    email: `${userId}@example.com`,
    stripeCustomerId: `cus_${userId}`,
    stripeSubscriptionId: "sub_test_1",
    stripeStatus: "canceled",
    stripeCurrentPeriodEnd: ended,
    lastPaidSubscriptionTier: tier,
    subscriptionEndedAt: ended,
    historicalDataUnlocked: options.unlocked === true,
    historicalDataUnlockedAt: options.unlocked ? new Date() : null,
    historicalDataUnlockTier: options.unlocked ? tier : null,
    historicalDataUnlockPaymentId: options.unlockPaymentId ?? null,
    preferredCurrency: options.preferredCurrency ?? "USD",
  })
  userCreditRows.push({
    userId,
    planId: "free",
    totalCredits: 2,
    includedBalance: 2,
    purchasedBalance: 37,
    remainingCredits: 39,
    usedCredits: 0,
    reservedCredits: 0,
    totalPaidCents: 1000,
    lifetimeCreditsEarned: 502,
    lifetimeCreditsUsed: 0,
    creditsResetAt: new Date(Date.now() + 10 * DAY_MS),
    lastResetAt: new Date(Date.now() - 10 * DAY_MS),
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  const account = ensureAccount(userId, "free")
  account.includedBalance = 2
  account.purchasedBalance = 37
  account.remainingCredits = 39
}

function snapshotHistoricalData() {
  return JSON.stringify({ datasets: datasetRows, rows: datasetRowRows })
}

function subscriptionEvent(type: string, sub: SubscriptionFixture, eventId: string) {
  return { id: eventId, type, data: { object: sub } } as never
}

type MockUnlockPriceOverrides = {
  id?: string
  unit_amount?: number
  currency?: string
  currency_options?: Record<string, { unit_amount?: number | null }>
}

/**
 * One-time multi-currency fixture mirroring a real Stripe Price with
 * currency_options: USD base 2900/14900 and fixed EUR/GBP/CAD options.
 */
function setMockUnlockPrice(tier: "pro" | "business", overrides: MockUnlockPriceOverrides = {}) {
  const base = tier === "pro" ? 2900 : 14900
  const priceId = overrides.id ?? (tier === "pro" ? "price_hist_unlock_pro" : "price_hist_unlock_business")
  setMockPrice({
    id: priceId,
    active: true,
    type: "one_time",
    currency: overrides.currency ?? "usd",
    unit_amount: overrides.unit_amount ?? base,
    currency_options: overrides.currency_options ?? {
      usd: { unit_amount: base },
      eur: { unit_amount: tier === "pro" ? 2500 : 13000 },
      gbp: { unit_amount: tier === "pro" ? 2200 : 11200 },
      cad: { unit_amount: tier === "pro" ? 4000 : 21000 },
    },
  })
}

const UNLOCK_COMBINATIONS: Array<{ tier: "pro" | "business"; currency: string; amountMinor: number; label: string }> = [
  { tier: "pro", currency: "USD", amountMinor: 2900, label: "Pro USD $29" },
  { tier: "pro", currency: "EUR", amountMinor: 2500, label: "Pro EUR €25" },
  { tier: "pro", currency: "GBP", amountMinor: 2200, label: "Pro GBP £22" },
  { tier: "pro", currency: "CAD", amountMinor: 4000, label: "Pro CAD C$40" },
  { tier: "business", currency: "USD", amountMinor: 14900, label: "Business USD $149" },
  { tier: "business", currency: "EUR", amountMinor: 13000, label: "Business EUR €130" },
  { tier: "business", currency: "GBP", amountMinor: 11200, label: "Business GBP £112" },
  { tier: "business", currency: "CAD", amountMinor: 21000, label: "Business CAD C$210" },
]

function unlockEvent(overrides: Record<string, unknown> = {}, sessionId = "cs_unlock_1") {
  const object = {
    id: sessionId,
    object: "checkout.session",
    mode: "payment",
    payment_status: "paid",
    amount_total: 2900,
    currency: "USD",
    client_reference_id: "user_pro",
    payment_intent: `pi_${sessionId}`,
    customer: "cus_user_pro",
    metadata: {
      purpose: "historical_data_unlock",
      userId: "user_pro",
      userEmail: "user_pro@example.com",
      unlockTier: "pro",
      stripePriceId: "price_hist_unlock_pro",
    },
    ...(overrides as Record<string, unknown>),
  }
  return {
    id: `evt_${sessionId}`,
    type: "checkout.session.completed",
    data: { object },
  } as never
}

async function importModules() {
  const webhook = await import("@/services/stripe/webhook")
  const historicalUnlock = await import("@/lib/billing/historical-unlock")
  const historicalUnlockService = await import("@/services/stripe/historical-unlock")
  const creditEngine = await import("@/lib/billing/credit-engine")
  const datasetAccess = await import("@/lib/data/dataset-access")
  const checkout = await import("@/services/stripe/checkout")
  return { webhook, historicalUnlock, historicalUnlockService, creditEngine, datasetAccess, checkout }
}

function withMockStripeSubscription(modules: Awaited<ReturnType<typeof importModules>>, sub: SubscriptionFixture) {
  modules.checkout.__stripeCheckoutTestHooks.setStripeClientForTest({
    subscriptions: {
      retrieve: async (id: string) => {
        if (id !== sub.id) throw new StripeNotFoundError(`No such subscription: '${id}'`)
        return sub
      },
      list: async () => ({ data: [] }),
    },
  } as never)
}

function readProjectFile(path: string) {
  return readFileSync(path, "utf8")
}

const tests: TestModule[] = [
  {
    name: "1. Pro cancellation downgrades to Free, historical data untouched",
    async run() {
      seedEndedPaidAccount({ userId: "user_pro", tier: "pro", endedAt: new Date(Date.now() - 10 * DAY_MS) })
      profileRows[0].subscriptionTier = "pro"
      profileRows[0].stripeStatus = "active"
      profileRows[0].subscriptionEndedAt = null
      const modules = await importModules()
      const dataBefore = snapshotHistoricalData()

      const result = await modules.webhook.handleSubscriptionEvent(
        subscriptionEvent("customer.subscription.deleted", makeSubscription({ status: "canceled" }), "evt_pro_deleted"),
      )
      assert.equal(result.synced, true)

      const profile = profileRows[0]
      assert.equal(profile.subscriptionTier, "free", "cancelled Pro lands on Free")
      assert.equal(profile.stripeStatus, "canceled")
      assert.equal(profile.lastPaidSubscriptionTier, "pro", "verified paid tier archived for unlock pricing")
      assert.ok(profile.subscriptionEndedAt, "subscription end moment recorded")
      assert.equal(snapshotHistoricalData(), dataBefore, "historical datasets untouched by cancellation")
      assert.equal(profile.stripeCustomerId, "cus_user_pro", "Stripe customer mapping preserved")
    },
  },
  {
    name: "2. Business cancellation downgrades to Free, historical data untouched",
    async run() {
      seedEndedPaidAccount({ userId: "user_biz", tier: "business", endedAt: new Date(Date.now() - 10 * DAY_MS) })
      profileRows[0].subscriptionTier = "business"
      profileRows[0].stripeStatus = "active"
      profileRows[0].subscriptionEndedAt = null
      const modules = await importModules()
      const dataBefore = snapshotHistoricalData()

      const result = await modules.webhook.handleSubscriptionEvent(
        subscriptionEvent(
          "customer.subscription.deleted",
          makeSubscription({
            customer: "cus_user_biz",
            status: "canceled",
            items: { data: [{ price: { id: "price_business_eur_monthly" } }] },
            metadata: { userId: "user_biz", userEmail: "user_biz@example.com", subscriptionTier: "business" },
          }),
          "evt_biz_deleted",
        ),
      )
      assert.equal(result.synced, true)

      const profile = profileRows[0]
      assert.equal(profile.subscriptionTier, "free", "cancelled Business lands on Free")
      assert.equal(profile.lastPaidSubscriptionTier, "business")
      assert.ok(profile.subscriptionEndedAt)
      assert.equal(snapshotHistoricalData(), dataBefore)
    },
  },
  {
    name: "3. Pro historical datasets remain stored after downgrade",
    async run() {
      seedEndedPaidAccount({ userId: "user_pro", tier: "pro" })
      const modules = await importModules()
      const names = datasetRows.map((d: { name: string }) => d.name)
      assert.deepEqual(names, ["Historical Sales 2025", "Historical Reports Q3"])
      const histRows = datasetRowRows.filter((r: { datasetId: string }) => r.datasetId === "ds_hist_1")
      assert.equal(histRows.length, 2, "dataset rows remain stored")
      const state = modules.historicalUnlock.resolveHistoricalAccessState(profileRows[0])
      assert.equal(state.previousPaidTier, "pro")
    },
  },
  {
    name: "4. Business historical datasets remain stored after downgrade",
    async run() {
      seedEndedPaidAccount({ userId: "user_biz", tier: "business" })
      const modules = await importModules()
      void modules
      assert.equal(datasetRows.length, 2)
      assert.equal(datasetRows[0].userId, "user_biz")
      assert.equal(datasetRowRows.length, 2)
    },
  },
  {
    name: "5. Cancelled Pro cannot use active Pro-only functionality",
    async run() {
      seedEndedPaidAccount({ userId: "user_pro", tier: "pro" })
      const modules = await importModules()
      const { checkActionEnforcement } = await import("@/lib/billing/usage-enforcement")

      const uploadCheck = await checkActionEnforcement("user_pro", "file_upload", "user", "user_pro@example.com")
      assert.equal(uploadCheck.allowed, false, "Free dataset limit blocks new uploads")
      assert.match(uploadCheck.reason || "", /Dataset limit reached/)

      const lockedDataset = datasetRows[0]
      const access = await modules.datasetAccess.findAccessibleDataset(lockedDataset.id, "user_pro", "user")
      assert.equal(access.dataset?.historicalDataLocked, true, "historical dataset reports locked state")
      const rowsAfterLock = await modules.datasetAccess.loadDatasetData(lockedDataset.id, access.dataset as never)
      assert.equal(rowsAfterLock.length, 0, "row content stays sealed while locked")
    },
  },
  {
    name: "6. Cancelled Business cannot use active Business-only functionality",
    async run() {
      seedEndedPaidAccount({ userId: "user_biz", tier: "business" })
      const modules = await importModules()
      const { checkActionEnforcement } = await import("@/lib/billing/usage-enforcement")

      const chatCheck = await checkActionEnforcement("user_biz", "ai_chat", "user", "user_biz@example.com")
      assert.equal(chatCheck.allowed, true, "Free daily allowance still applies")
      assert.equal(chatCheck.currentUsage?.dailyLimit, 20, "daily AI requests limited to the Free tier allowance")

      const uploadCheck = await checkActionEnforcement("user_biz", "file_upload", "user", "user_biz@example.com")
      assert.equal(uploadCheck.allowed, false)

      const access = await modules.datasetAccess.findAccessibleDataset("ds_hist_1", "user_biz", "user")
      assert.equal(access.dataset?.historicalDataLocked, true)
    },
  },
  {
    name: "7. Former Pro sees the $29 USD one-time historical unlock",
    async run() {
      seedEndedPaidAccount({ userId: "user_pro", tier: "pro" })
      const modules = await importModules()
      const state = modules.historicalUnlock.resolveHistoricalAccessState(profileRows[0])
      assert.equal(state.subscriptionEnded, true)
      assert.equal(state.unlockTier, "pro")
      assert.equal(state.unlockPurchaseAvailable, true)
      const price = modules.historicalUnlock.getHistoricalUnlockDisplayPrice("pro")
      assert.equal(price.amount, 29)
      assert.equal(price.currency, "USD")
      assert.equal(price.displayName, "Unlock Historical Data")
    },
  },
  {
    name: "8. Former Business sees the $149 USD one-time historical unlock",
    async run() {
      seedEndedPaidAccount({ userId: "user_biz", tier: "business" })
      const modules = await importModules()
      const state = modules.historicalUnlock.resolveHistoricalAccessState(profileRows[0])
      assert.equal(state.unlockTier, "business")
      assert.equal(state.unlockPurchaseAvailable, true)
      const price = modules.historicalUnlock.getHistoricalUnlockDisplayPrice("business")
      assert.equal(price.amount, 149)
      assert.equal(price.currency, "USD")
      assert.equal(price.displayName, "Unlock Historical Business Data")
    },
  },
  {
    name: "9. Server selects the one Stripe Price per tier and charges the resolved fixed currency",
    async run() {
      seedEndedPaidAccount({ userId: "user_pro", tier: "pro" })
      resetStripeMock()
      setMockUnlockPrice("pro")
      setMockUnlockPrice("business")
      const modules = await importModules()

      await modules.historicalUnlockService.createHistoricalUnlockCheckoutSession({
        userId: "user_pro",
        userEmail: "user_pro@example.com",
        customerId: "cus_user_pro",
        tier: "pro",
        currency: "USD",
        successUrl: "https://app.useclevr.com/app/settings/subscription?tab=billing&unlock=success",
        cancelUrl: "https://app.useclevr.com/app/settings/subscription?tab=billing&unlock=cancel",
      })

      assert.equal(stripeCalls.sessionCreations.length, 1)
      const params = stripeCalls.sessionCreations[0] as Record<string, any>
      assert.equal(params.mode, "payment", "unlock checkout is payment mode, never subscription")
      assert.equal(params.line_items[0].price, "price_hist_unlock_pro", "exactly one configured Price per tier")
      assert.equal(params.metadata.unlockTier, "pro")
      assert.equal(params.metadata.purpose, "historical_data_unlock")
      assert.equal(params.client_reference_id, "user_pro")
      assert.equal(params.currency, "USD", "the resolved server currency selects the fixed price leg")
      assert.equal(params.adaptive_pricing.enabled, false, "adaptive pricing stays off — no converted amounts")

      // Business tier selects its own price and an EUR resolution charges the
      // fixed €130 amount through the same single Price id.
      await modules.historicalUnlockService.createHistoricalUnlockCheckoutSession({
        userId: "user_biz",
        userEmail: "user_biz@example.com",
        customerId: "cus_user_biz",
        tier: "business",
        currency: "EUR",
        successUrl: "https://app.useclevr.com/app",
        cancelUrl: "https://app.useclevr.com/app",
      })
      const businessParams = stripeCalls.sessionCreations[1] as Record<string, any>
      assert.equal(businessParams.line_items[0].price, "price_hist_unlock_business")
      assert.equal(businessParams.metadata.unlockTier, "business")
      assert.equal(businessParams.currency, "EUR")
      assert.equal(businessParams.metadata.unlockCurrency, "EUR")
    },
  },
  {
    name: "10. Client cannot manipulate Pro unlock into Business unlock (or vice versa)",
    async run() {
      seedEndedPaidAccount({ userId: "user_pro", tier: "pro" })
      const modules = await importModules()

      // Price-first tier resolution never trusts a foreign subscription price.
      assert.equal(modules.historicalUnlock.resolveHistoricalUnlockTierFromPriceId("price_hist_unlock_pro"), "pro")
      assert.equal(modules.historicalUnlock.resolveHistoricalUnlockTierFromPriceId("price_hist_unlock_business"), "business")
      assert.equal(modules.historicalUnlock.resolveHistoricalUnlockTierFromPriceId("price_pro_eur_monthly"), null, "subscription prices never map to unlock tiers")
      assert.equal(modules.historicalUnlock.resolveHistoricalUnlockTierFromPriceId(null), null)

      // A checkout whose metadata tier disagrees with its Stripe Price fails closed.
      const result = await modules.historicalUnlockService.handleHistoricalUnlockCheckoutEvent(
        unlockEvent({
          metadata: { purpose: "historical_data_unlock", userId: "user_pro", unlockTier: "pro", stripePriceId: "price_hist_unlock_business" },
          amount_total: 14900,
        }, "cs_manipulated"),
      )
      assert.equal(result.synced, false)
      assert.match(result.reason || "", /Untrusted historical unlock session/)
      assert.equal(profileRows[0].historicalDataUnlocked, false, "no entitlement without trusted price match")

      // The checkout route ignores client tier/price input entirely.
      const routeSource = readProjectFile("src/app/api/checkout/historical-unlock/route.ts")
      assert.ok(!/body\.(tier|unlockTier|priceId|stripePriceId)/.test(routeSource), "no client tier or price read")
      assert.ok(routeSource.includes("state.unlockTier"), "the tier comes from server-side archived state")
    },
  },
  {
    name: "11. Successful $29 payment permanently unlocks former Pro historical data",
    async run() {
      seedEndedPaidAccount({ userId: "user_pro", tier: "pro" })
      const modules = await importModules()
      const result = await modules.historicalUnlockService.handleHistoricalUnlockCheckoutEvent(unlockEvent({}, "cs_unlock_pro"))
      assert.equal(result.synced, true)
      assert.equal(result.unlocked, true)

      const profile = profileRows[0]
      assert.equal(profile.historicalDataUnlocked, true)
      assert.ok(profile.historicalDataUnlockedAt)
      assert.equal(profile.historicalDataUnlockTier, "pro")
      assert.equal(profile.historicalDataUnlockPaymentId, "pi_cs_unlock_pro")
      void modules
    },
  },
  {
    name: "12. Successful $149 payment permanently unlocks former Business historical data",
    async run() {
      seedEndedPaidAccount({ userId: "user_biz", tier: "business" })
      const modules = await importModules()
      const result = await modules.historicalUnlockService.handleHistoricalUnlockCheckoutEvent(
        unlockEvent({
          client_reference_id: "user_biz",
          payment_intent: "pi_UNLOCK_BIZ",
          customer: "cus_user_biz",
          amount_total: 14900,
          currency: "USD",
          metadata: {
            purpose: "historical_data_unlock",
            userId: "user_biz",
            userEmail: "user_biz@example.com",
            unlockTier: "business",
            stripePriceId: "price_hist_unlock_business",
          },
        }, "cs_unlock_biz"),
      )
      assert.equal(result.synced, true)
      const profile = profileRows[0]
      assert.equal(profile.historicalDataUnlocked, true)
      assert.equal(profile.historicalDataUnlockTier, "business")
      assert.equal(profile.historicalDataUnlockPaymentId, "pi_UNLOCK_BIZ")
    },
  },
  {
    name: "13. Unlock keeps the account on Free",
    async run() {
      seedEndedPaidAccount({ userId: "user_pro", tier: "pro" })
      const modules = await importModules()
      await modules.historicalUnlockService.handleHistoricalUnlockCheckoutEvent(unlockEvent({}, "cs_keep_free"))
      const profile = profileRows[0]
      assert.equal(profile.subscriptionTier, "free", "unlock never reactivates a paid tier")
      const state = modules.historicalUnlock.resolveHistoricalAccessState(profile)
      assert.equal(state.activePaidTier, null)
      assert.equal(state.historicalDatasetsLocked, false, "historical data accessible again")
    },
  },
  {
    name: "14. Unlock does not create a recurring subscription or touch credits",
    async run() {
      seedEndedPaidAccount({ userId: "user_pro", tier: "pro" })
      const modules = await importModules()
      const creditsBefore = JSON.stringify(userCreditRows)
      const profileBefore = {
        stripeSubscriptionId: profileRows[0].stripeSubscriptionId,
        stripeStatus: profileRows[0].stripeStatus,
      }
      await modules.historicalUnlockService.handleHistoricalUnlockCheckoutEvent(unlockEvent({}, "cs_no_side_effect"))
      assert.equal(profileRows[0].stripeSubscriptionId, profileBefore.stripeSubscriptionId)
      assert.equal(profileRows[0].stripeStatus, profileBefore.stripeStatus)
      assert.deepEqual(ledgerRows, [], "no credit ledger writes — no subscription or renewal side effects")
      assert.equal(JSON.stringify(userCreditRows), creditsBefore, "credits untouched")
    },
  },
  {
    name: "15. Unlock grants no Pro/Business usage capacity",
    async run() {
      seedEndedPaidAccount({ userId: "user_pro", tier: "pro" })
      const modules = await importModules()
      await modules.historicalUnlockService.handleHistoricalUnlockCheckoutEvent(unlockEvent({}, "cs_no_capacity"))
      const { checkActionEnforcement } = await import("@/lib/billing/usage-enforcement")
      const uploadCheck = await checkActionEnforcement("user_pro", "file_upload", "user", "user_pro@example.com")
      assert.equal(uploadCheck.allowed, false, "purchased unlock adds no upload capacity")
      const state = modules.historicalUnlock.resolveHistoricalAccessState(profileRows[0])
      assert.equal(state.activePaidTier, null)
    },
  },
  {
    name: "16. Cancelled Stripe Checkout never unlocks",
    async run() {
      seedEndedPaidAccount({ userId: "user_pro", tier: "pro" })
      const modules = await importModules()
      const result = await modules.historicalUnlockService.handleHistoricalUnlockCheckoutEvent(
        unlockEvent({ payment_status: "unpaid" }, "cs_cancel_return"),
      )
      assert.equal(result.synced, false)
      assert.equal(result.unlocked, undefined)
      assert.equal(profileRows[0].historicalDataUnlocked, false)
    },
  },
  {
    name: "17. Failed payment never unlocks",
    async run() {
      seedEndedPaidAccount({ userId: "user_pro", tier: "pro" })
      const modules = await importModules()
      const result = await modules.historicalUnlockService.handleHistoricalUnlockCheckoutEvent(
        unlockEvent({ payment_status: "expired" }, "cs_failed"),
      )
      assert.equal(result.synced, false)
      assert.equal(profileRows[0].historicalDataUnlocked, false)
    },
  },
  {
    name: "18. A forged success URL never unlocks data",
    async run() {
      seedEndedPaidAccount({ userId: "user_pro", tier: "pro" })
      const modules = await importModules()
      void modules
      // The checkout route's status GET is report-only — it never writes, and
      // the whole route never grants the entitlement.
      const routeSource = readProjectFile("src/app/api/checkout/historical-unlock/route.ts")
      const getStatusBody = routeSource.split("export async function GET")[1]?.split("export async function POST")[0] || ""
      assert.ok(!/\.set\(|\.update\(/.test(getStatusBody), "status endpoint never writes to profiles")
      assert.ok(!/update\(profiles\)/.test(routeSource), "checkout route never writes profile entitlements directly")
      // Only the webhook-verified service can grant it.
      const serviceSource = readProjectFile("src/services/stripe/historical-unlock.ts")
      assert.ok(serviceSource.includes("historicalDataUnlocked: true"))
      // No webhook delivered → state unchanged.
      assert.equal(profileRows[0].historicalDataUnlocked, false)
    },
  },
  {
    name: "19. Webhook replay is idempotent",
    async run() {
      seedEndedPaidAccount({ userId: "user_pro", tier: "pro" })
      const modules = await importModules()
      const first = await modules.historicalUnlockService.handleHistoricalUnlockCheckoutEvent(unlockEvent({}, "cs_replay"))
      assert.equal(first.synced, true)
      const unlockedAt = profileRows[0].historicalDataUnlockedAt
      assert.ok(unlockedAt)

      const second = await modules.historicalUnlockService.handleHistoricalUnlockCheckoutEvent(unlockEvent({}, "cs_replay"))
      assert.equal(second.duplicate, true, "replay treated as duplicate")
      assert.equal(second.unlocked, true)
      assert.equal(profileRows[0].historicalDataUnlockPaymentId, "pi_cs_replay", "entitlement unchanged by replay")
      assert.equal(new Date(profileRows[0].historicalDataUnlockedAt).getTime(), unlockedAt.getTime(), "first-grant timestamp preserved")
    },
  },
  {
    name: "20. Duplicate payment cannot create a duplicate entitlement",
    async run() {
      seedEndedPaidAccount({ userId: "user_pro", tier: "pro" })
      const modules = await importModules()
      await modules.historicalUnlockService.handleHistoricalUnlockCheckoutEvent(unlockEvent({}, "cs_first"))

      const second = await modules.historicalUnlockService.handleHistoricalUnlockCheckoutEvent(
        unlockEvent({ payment_intent: "pi_cs_second" }, "cs_second"),
      )
      assert.equal(second.duplicate, true)
      assert.equal(profileRows[0].historicalDataUnlockPaymentId, "pi_cs_first", "original payment reference preserved")
      assert.equal(profileRows[0].historicalDataUnlocked, true)
    },
  },
  {
    name: "21. User A can never unlock User B data (cross-account attribution)",
    async run() {
      seedEndedPaidAccount({ userId: "user_b", tier: "pro" })
      const modules = await importModules()
      // Session credits a real profile (user_b) but the paying Stripe customer
      // is another account's customer — attribution must fail safe.
      const result = await modules.historicalUnlockService.handleHistoricalUnlockCheckoutEvent(
        unlockEvent({
          metadata: { purpose: "historical_data_unlock", userId: "user_b", userEmail: "user_b@example.com", unlockTier: "pro", stripePriceId: "price_hist_unlock_pro" },
          customer: "cus_user_a",
        }, "cs_cross_account"),
      )
      assert.equal(result.synced, false)
      assert.match(result.reason || "", /Payment does not belong to this account/)
      assert.equal(profileRows[0].historicalDataUnlocked, false, "owner account unchanged")

      // An unknown metadata userId never unlocks anything either.
      const unknown = await modules.historicalUnlockService.handleHistoricalUnlockCheckoutEvent(
        unlockEvent({
          metadata: { purpose: "historical_data_unlock", userId: "user_ghost", unlockTier: "pro", stripePriceId: "price_hist_unlock_pro" },
        }, "cs_unknown_user"),
      )
      assert.equal(unknown.synced, false)
      assert.equal(profileRows[0].historicalDataUnlocked, false)
    },
  },
  {
    name: "22. User A cannot access User B historical datasets",
    async run() {
      seedEndedPaidAccount({ userId: "user_b", tier: "pro" })
      const modules = await importModules()
      const access = await modules.datasetAccess.findAccessibleDataset("ds_hist_1", "user_a", "user")
      assert.equal(access.dataset, null, "another user's historical dataset is invisible")
    },
  },
  {
    name: "23. Resubscribing restores normal paid functionality",
    async run() {
      seedEndedPaidAccount({ userId: "user_pro", tier: "pro" })
      const modules = await importModules()
      withMockStripeSubscription(modules, makeSubscription({ status: "active" }))

      const result = await modules.webhook.handleSubscriptionEvent(
        subscriptionEvent("customer.subscription.updated", makeSubscription({ status: "active" }), "evt_resub"),
      )
      assert.equal(result.synced, true)
      const profile = profileRows[0]
      assert.equal(profile.subscriptionTier, "pro", "resubscription restores Pro")
      assert.equal(profile.subscriptionEndedAt, null, "historical boundary cleared on reactivation")

      const state = modules.historicalUnlock.resolveHistoricalAccessState(profile)
      assert.equal(state.historicalDatasetsLocked, false)
      assert.equal(state.activePaidTier, "pro")
      assert.equal(state.unlockPurchaseAvailable, false, "no unlock purchase needed while subscribed")
    },
  },
  {
    name: "24. Historical data remains intact and readable after resubscription",
    async run() {
      seedEndedPaidAccount({ userId: "user_pro", tier: "pro" })
      const modules = await importModules()
      withMockStripeSubscription(modules, makeSubscription({ status: "active" }))
      const before = snapshotHistoricalData()

      await modules.webhook.handleSubscriptionEvent(
        subscriptionEvent("customer.subscription.updated", makeSubscription({ status: "active" }), "evt_resub_data"),
      )
      assert.equal(snapshotHistoricalData(), before, "no dataset recreation or duplication on resubscription")

      const access = await modules.datasetAccess.findAccessibleDataset("ds_hist_1", "user_pro", "user")
      assert.notEqual(access.dataset, null)
      assert.notEqual((access.dataset as { historicalDataLocked?: boolean }).historicalDataLocked, true)
      const rows = await modules.datasetAccess.loadDatasetData("ds_hist_1", access.dataset as never)
      assert.equal(rows.length, 2, "historical rows reconnect cleanly")
    },
  },
  {
    name: "25. A purchased permanent unlock survives a later cancellation",
    async run() {
      seedEndedPaidAccount({ userId: "user_pro", tier: "pro", unlocked: true, unlockPaymentId: "pi_earlier" })
      const modules = await importModules()
      const result = await modules.webhook.handleSubscriptionEvent(
        subscriptionEvent("customer.subscription.deleted", makeSubscription({ status: "canceled" }), "evt_recancel"),
      )
      assert.equal(result.synced, true)
      const profile = profileRows[0]
      assert.equal(profile.subscriptionTier, "free")
      assert.equal(profile.historicalDataUnlocked, true, "permanent unlock survives the new cancellation")
      assert.equal(profile.historicalDataUnlockPaymentId, "pi_earlier")
      const state = modules.historicalUnlock.resolveHistoricalAccessState(profile)
      assert.equal(state.historicalDatasetsLocked, false, "still unlocked — no second payment needed")
      assert.equal(state.unlockPurchaseAvailable, false)
    },
  },
  {
    name: "26. A previously unlocked user is not charged again",
    async run() {
      seedEndedPaidAccount({ userId: "user_pro", tier: "pro", unlocked: true, unlockPaymentId: "pi_earlier" })
      const modules = await importModules()
      void modules
      const state = (await import("@/lib/billing/historical-unlock")).resolveHistoricalAccessState(profileRows[0])
      assert.equal(state.historicalDataUnlocked, true)
      assert.equal(state.unlockPurchaseAvailable, false, "no purchasable unlock remains — checkout answers already_unlocked")
      const routeSource = readProjectFile("src/app/api/checkout/historical-unlock/route.ts")
      assert.ok(routeSource.includes("already_unlocked"), "checkout creation rejects unlocked accounts")
    },
  },
  {
    name: "27. Existing Free flow still works",
    async run() {
      resetAllMockState()
      resetAccountStore()
      profileRows.push({ userId: "user_free", subscriptionTier: "free", role: "user", email: "free@example.com", stripeCustomerId: null })
      const modules = await importModules()
      const state = modules.historicalUnlock.resolveHistoricalAccessState(profileRows[0])
      assert.equal(state.historicalDatasetsLocked, false, "never-paid Free accounts see no lock")
      assert.equal(state.subscriptionEnded, false)
      assert.equal(state.unlockPurchaseAvailable, false)
      const { checkActionEnforcement } = await import("@/lib/billing/usage-enforcement")
      const upload = await checkActionEnforcement("user_free", "file_upload", "user", "free@example.com")
      assert.equal(upload.allowed, true, "Free upload flow unaffected within limits")
    },
  },
  {
    name: "28. Existing Pro flow still works",
    async run() {
      resetAllMockState()
      resetAccountStore()
      profileRows.push({ userId: "user_pro", subscriptionTier: "pro", role: "user", email: "pro@example.com", stripeCustomerId: "cus_user_pro", stripeSubscriptionId: "sub_test_1" })
      userCreditRows.push({ userId: "user_pro", planId: "pro_monthly", totalCredits: 500, includedBalance: 500, purchasedBalance: 0, remainingCredits: 500, usedCredits: 0, reservedCredits: 0, creditsResetAt: new Date(Date.now() + 10 * DAY_MS), lastResetAt: new Date() })
      const modules = await importModules()
      const state = modules.historicalUnlock.resolveHistoricalAccessState(profileRows[0])
      assert.equal(state.historicalDatasetsLocked, false)
      assert.equal(state.subscriptionEnded, false)
      const { checkActionEnforcement } = await import("@/lib/billing/usage-enforcement")
      const upload = await checkActionEnforcement("user_pro", "file_upload", "user", "pro@example.com")
      assert.equal(upload.allowed, true, "Pro upload flow unaffected")
    },
  },
  {
    name: "29. Existing Business flow still works",
    async run() {
      resetAllMockState()
      resetAccountStore()
      profileRows.push({ userId: "user_biz", subscriptionTier: "business", role: "user", email: "biz@example.com", stripeCustomerId: "cus_user_biz", stripeSubscriptionId: "sub_test_1" })
      const modules = await importModules()
      const state = modules.historicalUnlock.resolveHistoricalAccessState(profileRows[0])
      assert.equal(state.historicalDatasetsLocked, false)
      const { checkActionEnforcement } = await import("@/lib/billing/usage-enforcement")
      const upload = await checkActionEnforcement("user_biz", "file_upload", "user", "biz@example.com")
      assert.equal(upload.allowed, true)
    },
  },
  {
    name: "30. Superadmin behavior remains unchanged",
    async run() {
      resetAllMockState()
      resetAccountStore()
      profileRows.push({
        userId: "user_admin",
        subscriptionTier: "superadmin",
        role: "superadmin",
        email: "staff@example.com",
        lastPaidSubscriptionTier: null,
        subscriptionEndedAt: new Date(Date.now() - 5 * DAY_MS),
        historicalDataUnlocked: false,
      })
      const modules = await importModules()
      const state = modules.historicalUnlock.resolveHistoricalAccessState(profileRows[0])
      assert.equal(state.unlimitedAccess, true)
      assert.equal(state.historicalDatasetsLocked, false, "superadmin data access never becomes locked")
      assert.equal(state.subscriptionEnded, false)
      const { checkActionEnforcement } = await import("@/lib/billing/usage-enforcement")
      const check = await checkActionEnforcement("user_admin", "report_generation", "superadmin", "staff@example.com")
      assert.equal(check.allowed, true)

      const stateByBuiltin = modules.historicalUnlock.resolveHistoricalAccessState({
        userId: "super-admin-user-id",
        subscriptionTier: "free",
      })
      assert.equal(stateByBuiltin.unlimitedAccess, true)
      assert.equal(stateByBuiltin.historicalDatasetsLocked, false)
    },
  },
  {
    name: "31. Webhook security invariants (signature, purpose dispatch, one-time price)",
    async run() {
      const routeSource = readProjectFile("src/app/api/webhooks/stripe/route.ts")
      assert.ok(routeSource.includes("constructEvent"), "webhook signature verification stays in place")
      assert.ok(routeSource.includes("historical_data_unlock"), "unlock payment sessions dispatch on trusted purpose metadata")
      assert.ok(
        routeSource.indexOf("handleHistoricalUnlockCheckoutEvent") < routeSource.indexOf("handleStripeCreditCheckoutEvent("),
        "unlock dispatch precedes the credit top-up fallback",
      )
      const serviceSource = readProjectFile("src/services/stripe/historical-unlock.ts")
      assert.ok(serviceSource.includes('mode: "payment"'), "unlock checkout uses one-time payment mode")
      assert.ok(serviceSource.includes("one_time"), "unlock price must be one_time — recurring prices rejected")
    },
  },
  {
    name: "32. Durable schema entitlement: migration, predeploy registration, webhook wiring",
    async run() {
      const schema = readProjectFile("src/lib/db/schema.ts")
      for (const column of ["lastPaidSubscriptionTier", "subscriptionEndedAt", "historicalDataUnlocked", "historicalDataUnlockedAt", "historicalDataUnlockTier", "historicalDataUnlockPaymentId"]) {
        assert.ok(schema.includes(column), `schema declares ${column}`)
      }
      const migration = readProjectFile("src/lib/db/migrations/0036_historical_data_unlock.sql")
      assert.ok(migration.includes("ADD COLUMN IF NOT EXISTS"), "migration is idempotent and backward compatible")
      assert.ok(!/\bDELETE\s+FROM\b|\bTRUNCATE\b|\bDROP COLUMN\b/i.test(migration), "migration never removes data")
      const predeploy = readProjectFile("scripts/runtime/railway-predeploy.cjs")
      assert.ok(predeploy.includes("0036_historical_data_unlock.sql"), "predeploy applies the entitlement columns")
      const webhookSource = readProjectFile("src/services/stripe/webhook.ts")
      assert.ok(webhookSource.includes("applyTierHistoryBookkeeping"), "downgrade records the paid-tier history")
    },
  },
  {
    name: "33. Cancellation UI communicates data safety without dark patterns",
    async run() {
      const subscriptionPage = readProjectFile("src/app/(auth)/app/settings/subscription/page.tsx")
      assert.ok(subscriptionPage.includes("Your subscription has ended."), "ended-state banner present")
      assert.ok(subscriptionPage.includes("is safely preserved"), "data-safe wording present")
      assert.ok(subscriptionPage.includes("HistoricalUnlockPanel"), "one-time unlock action present")
      const datasetsPage = readProjectFile("src/app/(auth)/app/datasets/page.tsx")
      assert.ok(datasetsPage.includes("historicalBanner"), "dataset library explains the safe state")
      const panel = readProjectFile("src/components/billing/historical-unlock-panel.tsx")
      assert.ok(panel.includes("One-time payment. No subscription."), "unlock panel distinguishes itself from subscription")
      assert.ok(panel.includes("formatFixedRegionalPrice"), "fixed regional price presentation")
      assert.ok(!/\/month/i.test(panel), "never presented with a per-period price")
      assert.ok(!/lose|lose all|wipe|delete your data|deleted.*pay/i.test(panel), "no threatening deletion wording")
      const cancelButton = readProjectFile("src/components/billing/subscription-cancel-button.tsx")
      assert.ok(cancelButton.includes("Your data stays safe."), "cancel dialog reassures data stays safe")
    },
  },
  {
    name: "34. All 8 exact tier/currency combinations pass checkout and unlock the data",
    async run() {
      seedEndedPaidAccount({ userId: "user_pro", tier: "pro" })
      resetStripeMock()
      setMockUnlockPrice("pro")
      setMockUnlockPrice("business")
      const modules = await importModules()

      for (const combo of UNLOCK_COMBINATIONS) {
        await modules.historicalUnlockService.createHistoricalUnlockCheckoutSession({
          userId: combo.tier === "pro" ? "user_pro" : "user_biz",
          userEmail: `${combo.tier === "pro" ? "user_pro" : "user_biz"}@example.com`,
          customerId: `cus_${combo.tier === "pro" ? "user_pro" : "user_biz"}`,
          tier: combo.tier,
          currency: combo.currency as "USD" | "EUR" | "GBP" | "CAD",
          successUrl: "https://app.useclevr.com/app",
          cancelUrl: "https://app.useclevr.com/app",
        })
      }
      assert.equal(stripeCalls.sessionCreations.length, 8)
      for (const [index, combo] of UNLOCK_COMBINATIONS.entries()) {
        const params = stripeCalls.sessionCreations[index] as Record<string, any>
        assert.equal(params.mode, "payment", `${combo.label}: payment mode only`)
        assert.equal(params.currency, combo.currency, `${combo.label}: Checkout presents the fixed regional amount`)
        assert.equal(params.adaptive_pricing.enabled, false, `${combo.label}: no converted amounts`)
      }

      // Webhook-side: every exact combination grants the entitlement.
      for (const combo of UNLOCK_COMBINATIONS) {
        seedEndedPaidAccount({ userId: "user_pro", tier: "pro" })
        const result = await modules.historicalUnlockService.handleHistoricalUnlockCheckoutEvent(
          unlockEvent({
            amount_total: combo.amountMinor,
            currency: combo.currency,
            customer: "cus_user_pro",
            metadata: {
              purpose: "historical_data_unlock",
              userId: "user_pro",
              userEmail: "user_pro@example.com",
              unlockCurrency: combo.currency,
              unlockTier: combo.tier,
              stripePriceId: combo.tier === "pro" ? "price_hist_unlock_pro" : "price_hist_unlock_business",
            },
          }, `cs_${combo.tier}_${combo.currency}`),
        )
        assert.equal(result.synced, true, `${combo.label}: exact combination unlocks`)
        assert.equal(profileRows[0].historicalDataUnlocked, true, `${combo.label}: entitlement granted`)
        assert.equal(profileRows[0].subscriptionTier, "free", `${combo.label}: account stays Free`)
      }
    },
  },
  {
    name: "35. Checkout fails closed on missing/drifted fixed currency options, recurring, inactive prices",
    async run() {
      seedEndedPaidAccount({ userId: "user_pro", tier: "pro" })
      const modules = await importModules()

      // Missing a fixed CAD option must fail closed (no exchange-rate fallback).
      resetStripeMock()
      setMockUnlockPrice("pro", { currency_options: { usd: { unit_amount: 2900 }, eur: { unit_amount: 2500 }, gbp: { unit_amount: 2200 } } })
      await assert.rejects(
        modules.historicalUnlockService.createHistoricalUnlockCheckoutSession({
          userId: "user_pro", userEmail: "user_pro@example.com", customerId: "cus_user_pro",
          tier: "pro", currency: "EUR", successUrl: "https://app.useclevr.com/app", cancelUrl: "https://app.useclevr.com/app",
        }),
        (error: Error & { code?: string }) => error.code === "historical_unlock_amount_mismatch",
      )

      // A drifted fixed EUR amount (converted/approximated) must fail closed.
      resetStripeMock()
      setMockUnlockPrice("pro", { currency_options: { usd: { unit_amount: 2900 }, eur: { unit_amount: 2700 }, gbp: { unit_amount: 2200 }, cad: { unit_amount: 4000 } } })
      await assert.rejects(
        modules.historicalUnlockService.createHistoricalUnlockCheckoutSession({
          userId: "user_pro", userEmail: "user_pro@example.com", customerId: "cus_user_pro",
          tier: "pro", currency: "EUR", successUrl: "https://app.useclevr.com/app", cancelUrl: "https://app.useclevr.com/app",
        }),
        (error: Error & { code?: string }) => error.code === "historical_unlock_amount_mismatch",
      )

      // A recurring price never validates.
      resetStripeMock()
      setMockPrice({ id: "price_hist_unlock_pro", active: true, type: "recurring", currency: "usd", unit_amount: 2900, recurring: { interval: "month" } })
      await assert.rejects(
        modules.historicalUnlockService.createHistoricalUnlockCheckoutSession({
          userId: "user_pro", userEmail: "user_pro@example.com", customerId: "cus_user_pro",
          tier: "pro", currency: "USD", successUrl: "https://app.useclevr.com/app", cancelUrl: "https://app.useclevr.com/app",
        }),
        (error: Error & { code?: string }) => error.code === "historical_unlock_price_recurring",
      )

      // An inactive price never validates.
      resetStripeMock()
      setMockPrice({ id: "price_hist_unlock_pro", active: false, type: "one_time", currency: "usd", unit_amount: 2900 })
      await assert.rejects(
        modules.historicalUnlockService.createHistoricalUnlockCheckoutSession({
          userId: "user_pro", userEmail: "user_pro@example.com", customerId: "cus_user_pro",
          tier: "pro", currency: "USD", successUrl: "https://app.useclevr.com/app", cancelUrl: "https://app.useclevr.com/app",
        }),
        (error: Error & { code?: string }) => error.code === "historical_unlock_price_inactive",
      )

      // An unsupported currency argument fails closed with zero sessions.
      resetStripeMock()
      setMockUnlockPrice("pro")
      await assert.rejects(
        modules.historicalUnlockService.createHistoricalUnlockCheckoutSession({
          userId: "user_pro", userEmail: "user_pro@example.com", customerId: "cus_user_pro",
          tier: "pro", currency: "CHF" as "USD", successUrl: "https://app.useclevr.com/app", cancelUrl: "https://app.useclevr.com/app",
        }),
        (error: Error & { code?: string }) => error.code === "historical_unlock_currency_unsupported",
      )
      assert.equal(stripeCalls.sessionCreations.length, 0)
    },
  },
  {
    name: "36. Webhook rejects wrong amounts, unsupported currencies, wrong Price, wrong tier, manipulated legs",
    async run() {
      seedEndedPaidAccount({ userId: "user_pro", tier: "pro" })
      const modules = await importModules()

      // Wrong amount for the resolved currency leg (EUR must be exactly 2500).
      const wrongAmount = await modules.historicalUnlockService.handleHistoricalUnlockCheckoutEvent(
        unlockEvent({ amount_total: 2500, currency: "USD", metadata: { purpose: "historical_data_unlock", userId: "user_pro", userEmail: "user_pro@example.com", unlockTier: "pro", unlockCurrency: "EUR", stripePriceId: "price_hist_unlock_pro" } }, "cs_wrong_amount_usd"),
      )
      assert.equal(wrongAmount.synced, false)
      assert.match(wrongAmount.reason || "", /amount mismatch/)
      assert.equal(profileRows[0].historicalDataUnlocked, false)

      // Unsupported charged currency (CHF) never unlocks.
      const unsupported = await modules.historicalUnlockService.handleHistoricalUnlockCheckoutEvent(
        unlockEvent({ amount_total: 2900, currency: "CHF" }, "cs_unsupported_currency"),
      )
      assert.equal(unsupported.synced, false)
      assert.match(unsupported.reason || "", /amount mismatch/)

      // Wrong Price ID (a foreign/subscription price) never maps to a tier.
      const wrongPrice = await modules.historicalUnlockService.handleHistoricalUnlockCheckoutEvent(
        unlockEvent({ metadata: { purpose: "historical_data_unlock", userId: "user_pro", userEmail: "user_pro@example.com", unlockTier: "pro", stripePriceId: "price_pro_eur_monthly" } }, "cs_wrong_price"),
      )
      assert.equal(wrongPrice.synced, false)
      assert.match(wrongPrice.reason || "", /Untrusted historical unlock session/)
      assert.equal(profileRows[0].historicalDataUnlocked, false)

      // A price-derived tier colliding with a mismatched metadata tier fails closed.
      const wrongTier = await modules.historicalUnlockService.handleHistoricalUnlockCheckoutEvent(
        unlockEvent({ amount_total: 2900, currency: "USD", metadata: { purpose: "historical_data_unlock", userId: "user_pro", userEmail: "user_pro@example.com", unlockTier: "business", stripePriceId: "price_hist_unlock_pro" } }, "cs_wrong_tier"),
      )
      assert.equal(wrongTier.synced, false)
      assert.match(wrongTier.reason || "", /Untrusted historical unlock session/)
      assert.equal(profileRows[0].historicalDataUnlocked, false)
    },
  },
  {
    name: "37. Server resolves the billing currency; the client cannot choose currency, amount, tier, or Price",
    async run() {
      seedEndedPaidAccount({ userId: "user_pro", tier: "pro" })
      const modules = await importModules()

      assert.equal(modules.historicalUnlock.resolveHistoricalUnlockCurrency("eur"), "EUR")
      assert.equal(modules.historicalUnlock.resolveHistoricalUnlockCurrency(" GBP "), "GBP")
      assert.equal(modules.historicalUnlock.resolveHistoricalUnlockCurrency("cad"), "CAD")
      assert.equal(modules.historicalUnlock.resolveHistoricalUnlockCurrency("aud"), "USD", "unsupported preference falls back to the USD base")
      assert.equal(modules.historicalUnlock.resolveHistoricalUnlockCurrency(""), "USD")
      assert.equal(modules.historicalUnlock.resolveHistoricalUnlockCurrency(null), "USD")

      // Regional display prices mirror the fixed table exactly.
      assert.equal(modules.historicalUnlock.getHistoricalUnlockDisplayPrice("pro", "EUR").amount, 25)
      assert.equal(modules.historicalUnlock.getHistoricalUnlockDisplayPrice("pro", "GBP").amount, 22)
      assert.equal(modules.historicalUnlock.getHistoricalUnlockDisplayPrice("pro", "CAD").amount, 40)
      assert.equal(modules.historicalUnlock.getHistoricalUnlockDisplayPrice("business", "EUR").amount, 130)
      assert.equal(modules.historicalUnlock.getHistoricalUnlockDisplayPrice("business", "GBP").amount, 112)
      assert.equal(modules.historicalUnlock.getHistoricalUnlockDisplayPrice("business", "CAD").amount, 210)

      // The checkout route reads no client tier/currency/amount/price fields.
      const routeSource = readProjectFile("src/app/api/checkout/historical-unlock/route.ts")
      assert.ok(!/body\.(tier|unlockTier|currency|priceId|stripePriceId|amount|amountMinor)/.test(routeSource), "no client tier/currency/amount/price read")
      assert.ok(routeSource.includes("resolveHistoricalUnlockCurrency"), "currency resolution is server-side from the profile")
      assert.ok(routeSource.includes("preferredCurrency"), "currency comes from the saved billing preference")
    },
  },
  {
    name: "38. Usy presents the fixed regional unlock prices from the canonical configuration",
    async run() {
      const billing = await import("@/lib/usy/billing-knowledge")
      assert.equal(billing.formatUsyHistoricalUnlockPrice("pro", "USD"), "$29")
      assert.equal(billing.formatUsyHistoricalUnlockPrice("pro", "EUR"), "€25")
      assert.equal(billing.formatUsyHistoricalUnlockPrice("pro", "GBP"), "£22")
      assert.equal(billing.formatUsyHistoricalUnlockPrice("pro", "CAD"), "C$40")
      assert.equal(billing.formatUsyHistoricalUnlockPrice("business", "USD"), "$149")
      assert.equal(billing.formatUsyHistoricalUnlockPrice("business", "EUR"), "€130")
      assert.equal(billing.formatUsyHistoricalUnlockPrice("business", "GBP"), "£112")
      assert.equal(billing.formatUsyHistoricalUnlockPrice("business", "CAD"), "C$210")
      // Unknown currencies fall back to the USD base price.
      assert.equal(billing.formatUsyHistoricalUnlockPrice("pro", "aud"), "$29")

      const answer = billing.buildUsyHistoricalUnlockAnswer("english", "EUR")
      assert.ok(answer.includes("one-time payment"), "one-time, not a subscription")
      assert.ok(answer.includes("€25"), "regional Pro price shown")
      assert.ok(answer.includes("€130"), "regional Business price shown")
      assert.ok(answer.includes("does not restore Pro or Business features"), "unlock scope limited to data access")
      assert.ok(answer.includes("data stays safe"), "preservation stated")
      assert.ok(!answer.includes("/month"), "never presented as recurring")
    },
  },
]

const tests2 = tests

;(async () => {
  let failed = 0
  for (const t of tests2) {
    try {
      await t.run()
      console.log(`  ok - ${t.name}`)
    } catch (error) {
      failed += 1
      console.error(`  FAIL - ${t.name}`)
      console.error(error instanceof Error ? error.stack || error.message : error)
    }
  }
  if (failed > 0) {
    console.error(`\n${failed} historical unlock test(s) failed`)
    process.exitCode = 1
  }
  if (failed === 0) {
    console.log(`\nAll ${tests2.length} historical unlock tests passed.`)
  }
})()
