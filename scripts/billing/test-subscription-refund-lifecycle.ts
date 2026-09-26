/**
 * Behavioral regression tests for the refunded-subscription / included-credit
 * lifecycle. All Stripe and database behavior is mocked — no real payments,
 * refunds, or production balance changes.
 *
 * Authoritative rules covered:
 *   1. Active Pro + normal subscription activation → Pro entitlement, 500
 *      included credits, purchased credits untouched.
 *   2. Active Pro + subscription-invoice refund ONLY → the refund is
 *      accounting-only: entitlement and credits stay intact because Stripe
 *      still reports an active subscription.
 *   3. Pro + cancel_at_period_end → user retains Pro until the actual period
 *      end; the status update never re-grants included credits.
 *   4. Pro period expiration → deterministic Free downgrade through the
 *      Stripe-authoritative period reconciliation (missed webhook healing).
 *   5. Renewal after the stored period end → reconciliation applies the live
 *      Stripe period instead of downgrading.
 *   6. Full refund + explicit cancellation (subscription deleted) → downgrade
 *      to Free, included credits removed, purchased credits preserved.
 *   7. Refund webhook before/after the subscription webhook plus repeated
 *      deliveries are safe and stable.
 *   8. A stale activation event replayed after termination cannot resurrect
 *      Pro (out-of-order webhook protection).
 *   9. Included-credit reset around the period boundary never re-grants a
 *      paid allowance once the entitlement ended; the Free reset preserves
 *      purchased credits.
 *  10. Repeated top-up refund webhooks are idempotent per Stripe refund ID.
 *  11. Purchased credits survive downgrade/refund and stay spendable on Free.
 *  12. Free accounts cannot start new credit top-up purchases (server gate).
 *
 * Run: pnpm test:billing-refund-lifecycle
 */
import assert from "node:assert/strict"

process.env.STRIPE_PRICE_PRO_EUR_MONTHLY = "price_pro_eur_monthly"
process.env.STRIPE_PRICE_BUSINESS_EUR_MONTHLY = "price_business_eur_monthly"

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

import {
  ledgerRows,
  profileRows,
  resetAllMockState,
  subscriptionPlanRows,
  topupRows,
  userCreditRows,
} from "./mocks/mock-db.mjs"
import { ensureAccount, resetAccountStore } from "./mocks/mock-credit-account.mjs"

const subscriptionCatalog = new Map<string, SubscriptionFixture>()
const customerSubscriptions = new Map<string, SubscriptionFixture[]>()
const stripeCallLog = { retrieve: 0, list: 0 }

class StripeNotFoundError extends Error {}

function makeSubscription(overrides: Partial<SubscriptionFixture> = {}): SubscriptionFixture {
  return {
    id: "sub_test_1",
    customer: "cus_test",
    status: "active",
    cancel_at_period_end: false,
    current_period_end: Math.floor((Date.now() + 30 * DAY_MS) / 1000),
    items: { data: [{ price: { id: "price_pro_eur_monthly" } }] },
    metadata: { userId: "user_refund", userEmail: "refund@example.com", subscriptionTier: "pro" },
    ...overrides,
  }
}

function mockStripeClient() {
  return {
    subscriptions: {
      retrieve: async (id: string) => {
        stripeCallLog.retrieve += 1
        const sub = subscriptionCatalog.get(id)
        if (!sub) {
          throw new StripeNotFoundError(`No such subscription: '${id}'`)
        }
        return sub
      },
      list: async ({ customer }: { customer: string }) => {
        stripeCallLog.list += 1
        return { data: customerSubscriptions.get(customer) ?? [] }
      },
    },
  }
}

function setSubscriptionCatalog(entries: SubscriptionFixture[]) {
  subscriptionCatalog.clear()
  customerSubscriptions.clear()
  for (const sub of entries) {
    subscriptionCatalog.set(sub.id, sub)
    const list = customerSubscriptions.get(sub.customer) ?? []
    list.push(sub)
    customerSubscriptions.set(sub.customer, list)
  }
}

const FUTURE_RESET = new Date(Date.now() + 20 * DAY_MS)

function seedAccount(options: {
  tier?: string
  periodEnd?: Date
  included?: number
  purchased?: number
  resetAt?: Date
} = {}) {
  resetAllMockState()
  resetAccountStore()
  const tier = options.tier ?? "pro"
  const included = options.included ?? (tier === "pro" ? 500 : 2)
  const purchased = options.purchased ?? 0
  subscriptionPlanRows.push({ id: "free" }, { id: "pro_monthly" }, { id: "business_monthly" })
  profileRows.push({
    userId: "user_refund",
    subscriptionTier: tier,
    role: "user",
    email: "refund@example.com",
    stripeCustomerId: "cus_test",
    stripeSubscriptionId: "sub_test_1",
    stripeStatus: "active",
    stripeCurrentPeriodEnd: options.periodEnd ?? new Date(Date.now() + 18 * DAY_MS),
  })
  userCreditRows.push({
    id: "uc_refund",
    userId: "user_refund",
    planId: tier === "pro" ? "pro_monthly" : "free",
    totalCredits: included,
    includedBalance: included,
    purchasedBalance: purchased,
    remainingCredits: included + purchased,
    usedCredits: 0,
    reservedCredits: 0,
    totalPaidCents: 0,
    lifetimeCreditsEarned: included,
    lifetimeCreditsUsed: 0,
    creditsResetAt: options.resetAt ?? FUTURE_RESET,
    lastResetAt: new Date(Date.now() - 10 * DAY_MS),
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  const account = ensureAccount("user_refund", tier)
  account.includedBalance = included
  account.purchasedBalance = purchased
  account.remainingCredits = included + purchased
  return account
}

function subscriptionEvent(type: string, sub: SubscriptionFixture, eventId: string) {
  return { id: eventId, type, data: { object: sub } } as never
}

function subscriptionInvoiceRefundEvent(eventId: string) {
  return {
    id: eventId,
    type: "charge.refunded",
    data: {
      object: { id: "ch_sub_invoice", payment_intent: "pi_sub_invoice", refunds: { data: [] } },
    },
  } as never
}

async function importModules() {
  const webhook = await import("@/services/stripe/webhook")
  const creditWebhook = await import("@/services/stripe/credit-webhook")
  const checkout = await import("@/services/stripe/checkout")
  const creditEngine = await import("@/lib/billing/credit-engine")
  const periodSync = await import("@/lib/billing/subscription-period-sync")
  const analystCredits = await import("@/lib/usage/analyst-credits")
  return { webhook, creditWebhook, checkout, creditEngine, periodSync, analystCredits }
}

function withMockStripe(modules: Awaited<ReturnType<typeof importModules>>) {
  modules.checkout.__stripeCheckoutTestHooks.setStripeClientForTest({
    subscriptions: {
      retrieve: async (id: string) => {
        stripeCallLog.retrieve += 1
        const sub = subscriptionCatalog.get(id)
        if (!sub) {
          throw new StripeNotFoundError(`No such subscription: '${id}'`)
        }
        return sub
      },
      list: async ({ customer }: { customer: string }) => {
        stripeCallLog.list += 1
        return { data: customerSubscriptions.get(customer) ?? [] }
      },
    },
  } as never)
}

const tests: TestModule[] = [
  {
    name: "active Pro + normal subscription activation → Pro with 500 included credits",
    async run() {
      seedAccount({ tier: "free", included: 2 })
      setSubscriptionCatalog([makeSubscription()])
      const modules = await importModules()
      withMockStripe(modules)

      // Activation arrives while the profile is Free — the stale-activation
      // guard verifies the event against authoritative Stripe state first.
      const result = await modules.webhook.handleSubscriptionEvent(
        {
          id: "evt_activation",
          type: "customer.subscription.created",
          data: { object: makeSubscription() },
        } as never,
      )
      assert.equal(result.synced, true)
      assert.ok(stripeCallLog.retrieve >= 1, "activation is verified against Stripe state")

      const profile = profileRows[0]
      assert.equal(profile.subscriptionTier, "pro")
      assert.equal(profile.stripeStatus, "active")

      const account = userCreditRows[0]
      assert.equal(account.planId, "pro_monthly")
      assert.equal(account.includedBalance, 500)
      assert.equal(account.purchasedBalance, 0, "no purchased credits are invented by activation")

      const planReset = ledgerRows.find((row) => row.transactionType === "PLAN_RESET")
      assert.ok(planReset, "activation writes a PLAN_RESET ledger entry")
      assert.equal(planReset.includedBalanceAfter, 500)
    },
  },
  {
    name: "active Pro + subscription invoice refund only → entitlement and credits unchanged",
    async run() {
      seedAccount({ tier: "pro", included: 500, purchased: 100 })
      setSubscriptionCatalog([makeSubscription()])
      const modules = await importModules()
      withMockStripe(modules)

      const refundResult = await modules.creditWebhook.handleStripeRefundEvent(
        subscriptionInvoiceRefundEvent("evt_refund_sub"),
      )
      assert.equal(refundResult.processed, false)
      assert.match(refundResult.reason || "", /not belong to a credit top-up/)

      const profile = profileRows[0]
      assert.equal(profile.subscriptionTier, "pro", "a refund alone must not cancel the subscription")
      const account = userCreditRows[0]
      assert.equal(account.includedBalance, 500)
      assert.equal(account.purchasedBalance, 100)
      assert.equal(profile.stripeStatus, "active")
    },
  },
  {
    name: "Pro + cancel_at_period_end → retains Pro until period end, no duplicate credit grant",
    async run() {
      seedAccount({ tier: "pro", included: 437 })
      const scheduled = makeSubscription({
        status: "active",
        cancel_at_period_end: true,
        current_period_end: Math.floor((Date.now() + 18 * DAY_MS) / 1000),
      })
      setSubscriptionCatalog([scheduled])
      const modules = await importModules()
      withMockStripe(modules)

      const result = await modules.webhook.handleSubscriptionEvent(
        {
          id: "evt_cancel_scheduled",
          type: "customer.subscription.updated",
          data: { object: scheduled },
        } as never,
      )
      assert.equal(result.synced, true)

      const profile = profileRows[0]
      assert.equal(profile.subscriptionTier, "pro", "cancellation at period end keeps the paid plan")
      assert.equal(profile.stripeStatus, "active")

      const account = userCreditRows[0]
      assert.equal(
        account.includedBalance,
        437,
        "a same-tier status update never re-grants included credits",
      )
      const planResets = ledgerRows.filter((row) => row.transactionType === "PLAN_RESET")
      assert.equal(planResets.length, 0, "no plan-change ledger entry without a tier change")
    },
  },
  {
    name: "Pro period expiration → deterministic Free downgrade via Stripe reconciliation",
    async run() {
      seedAccount({ tier: "pro", included: 500, purchased: 50, periodEnd: new Date(Date.now() - DAY_MS) })
      setSubscriptionCatalog([])
      const modules = await importModules()
      withMockStripe(modules)

      await modules.periodSync.reconcileExpiredSubscriptionPeriod("user_refund")

      const profile = profileRows[0]
      assert.equal(profile.subscriptionTier, "free", "expired paid period downgrades to Free")
      const account = userCreditRows[0]
      assert.equal(account.planId, "free")
      assert.equal(account.includedBalance, 0, "paid included credits are removed")
      assert.equal(account.purchasedBalance, 50, "purchased credits are preserved")
      assert.equal(
        account.remainingCredits,
        52,
        "the Free 2-credit allowance plus the preserved purchased balance remain spendable",
      )
    },
  },
  {
    name: "renewal after the stored period end → reconciliation applies the live Stripe period",
    async run() {
      seedAccount({ tier: "pro", included: 500, periodEnd: new Date(Date.now() - DAY_MS) })
      const renewed = makeSubscription({
        status: "active",
        current_period_end: Math.floor((Date.now() + 30 * DAY_MS) / 1000),
      })
      setSubscriptionCatalog([renewed])
      const modules = await importModules()
      withMockStripe(modules)

      await modules.periodSync.reconcileExpiredSubscriptionPeriod("user_refund")

      const profile = profileRows[0]
      assert.equal(profile.subscriptionTier, "pro", "an active Stripe subscription keeps Pro")
      assert.equal(
        (profile.stripeCurrentPeriodEnd as Date).getTime(),
        renewed.current_period_end * 1000,
        "the stored period end is refreshed from Stripe",
      )
      assert.equal(userCreditRows[0].includedBalance, 500)
    },
  },
  {
    name: "full refund + explicit cancellation → Free downgrade, purchased credits preserved",
    async run() {
      seedAccount({ tier: "pro", included: 500, purchased: 100 })
      const deleted = makeSubscription({ status: "canceled" })
      setSubscriptionCatalog([deleted])
      const modules = await importModules()
      withMockStripe(modules)

      await modules.creditWebhook.handleStripeRefundEvent(
        subscriptionInvoiceRefundEvent("evt_refund_full"),
      )
      const result = await modules.webhook.handleSubscriptionEvent(
        {
          id: "evt_subscription_deleted",
          type: "customer.subscription.deleted",
          data: { object: deleted },
        } as never,
      )
      assert.equal(result.synced, true)

      const profile = profileRows[0]
      assert.equal(profile.subscriptionTier, "free")
      assert.equal(profile.stripeStatus, "canceled")
      const account = userCreditRows[0]
      assert.equal(account.planId, "free")
      assert.equal(account.includedBalance, 0, "paid included credits are removed")
      assert.equal(account.purchasedBalance, 100, "purchased credits are never deleted")
      assert.equal(account.remainingCredits, 102)
    },
  },
  {
    name: "refund webhook before/after subscription webhook and repeated deliveries are safe",
    async run() {
      seedAccount({ tier: "pro", included: 500, purchased: 100 })
      setSubscriptionCatalog([])
      const modules = await importModules()
      withMockStripe(modules)

      // Refund BEFORE termination: accounting only.
      await modules.creditWebhook.handleStripeRefundEvent(
        subscriptionInvoiceRefundEvent("evt_refund_before"),
      )
      assert.equal(profileRows[0].subscriptionTier, "pro")

      // Termination after the refund.
      await modules.webhook.handleSubscriptionEvent(
        {
          id: "evt_deleted_after_refund",
          type: "customer.subscription.deleted",
          data: { object: makeSubscription({ status: "canceled" }) },
        } as never,
      )
      assert.equal(profileRows[0].subscriptionTier, "free")

      // Repeated refund + repeated deleted event: still Free, balances stable.
      await modules.creditWebhook.handleStripeRefundEvent(
        subscriptionInvoiceRefundEvent("evt_refund_replay"),
      )
      await modules.webhook.handleSubscriptionEvent(
        {
          id: "evt_deleted_replay",
          type: "customer.subscription.deleted",
          data: { object: makeSubscription({ status: "canceled" }) },
        } as never,
      )
      assert.equal(profileRows[0].subscriptionTier, "free")
      const account = userCreditRows[0]
      assert.equal(account.includedBalance, 0)
      assert.equal(account.purchasedBalance, 100, "replays never delete purchased credits")
    },
  },
  {
    name: "stale activation event replayed after termination cannot resurrect Pro",
    async run() {
      seedAccount({ tier: "pro", included: 500, purchased: 100 })
      setSubscriptionCatalog([])
      const modules = await importModules()
      withMockStripe(modules)

      // Terminate first.
      await modules.webhook.handleSubscriptionEvent(
        {
          id: "evt_deleted_first",
          type: "customer.subscription.deleted",
          data: { object: makeSubscription({ status: "canceled" }) },
        } as never,
      )
      assert.equal(profileRows[0].subscriptionTier, "free")

      // A delayed/replayed activation event arrives after termination.
      const result = await modules.webhook.handleSubscriptionEvent(
        {
          id: "evt_stale_created",
          type: "customer.subscription.created",
          data: { object: makeSubscription({ status: "active" }) },
        } as never,
      )
      assert.equal(result.synced, false, "the stale activation is dropped")
      assert.equal(profileRows[0].subscriptionTier, "free", "the account stays Free")

      const account = userCreditRows[0]
      assert.equal(account.includedBalance, 0, "no paid credits are re-granted")
      assert.equal(account.purchasedBalance, 100, "purchased credits are untouched")
    },
  },
  {
    name: "included-credit reset around the period boundary never re-grants a paid allowance",
    async run() {
      seedAccount({
        tier: "pro",
        included: 500,
        purchased: 100,
        periodEnd: new Date(Date.now() - 2 * DAY_MS),
        resetAt: new Date(Date.now() - DAY_MS),
      })
      setSubscriptionCatalog([])
      const modules = await importModules()
      withMockStripe(modules)

      // The usage read heals the missed downgrade before any credit allocation.
      const usage = await modules.analystCredits.getAnalystCreditUsage(
        "user_refund",
        "user",
        "refund@example.com",
      )
      assert.equal(usage.subscriptionTier, "free")
      assert.equal(profileRows[0].subscriptionTier, "free")

      // The next reset runs on Free: 2 included credits, purchased preserved.
      const account = userCreditRows[0]
      account.creditsResetAt = new Date(Date.now() - 12 * 3600 * 1000)
      const reset = await modules.creditEngine.checkAndPerformMonthlyReset("user_refund")
      assert.equal(reset, true)
      assert.equal(account.includedBalance, 2, "Free allowance is granted, not the Pro 500")
      assert.equal(account.purchasedBalance, 100, "reset never deletes purchased credits")
      assert.equal(account.remainingCredits, 102)
    },
  },
  {
    name: "repeated top-up refund webhook is idempotent per Stripe refund ID",
    async run() {
      seedAccount({ tier: "pro", included: 400, purchased: 100 })
      const modules = await importModules()

      ledgerRows.push({
        id: "cl_topup_1",
        userId: "user_refund",
        workspaceId: "user_refund",
        type: "grant",
        transactionType: "TOP_UP_PURCHASE",
        status: "finalized",
        amount: 100,
        credits: 100,
      })
      topupRows.push({
        id: "ct_1",
        userId: "user_refund",
        workspaceId: "user_refund",
        provider: "stripe",
        providerPaymentId: "pi_topup_1",
        providerCheckoutId: "cs_topup_1",
        status: "completed",
        amountMinor: 1500,
        currency: "EUR",
        creditsGranted: 100,
        ledgerEntryId: "cl_topup_1",
        metadata: {},
        createdAt: new Date(),
      })

      const charge = {
        id: "ch_topup_1",
        payment_intent: "pi_topup_1",
        refunds: { data: [{ id: "re_1", amount: 1500, status: "succeeded" }] },
      }

      const first = await modules.creditWebhook.handleStripeRefundEvent({
        id: "evt_topup_refund_1",
        type: "charge.refunded",
        data: { object: charge },
      } as never)
      assert.equal(first.processed, true)
      assert.equal(first.creditsIssued, 100, "the full refund reverses the granted credits")

      const second = await modules.creditWebhook.handleStripeRefundEvent({
        id: "evt_topup_refund_2",
        type: "charge.refunded",
        data: { object: charge },
      } as never)
      assert.equal(second.creditsIssued, 0, "the redelivered refund is a no-op")

      const account = ensureAccount("user_refund", "pro")
      assert.equal(account.purchasedBalance, 0, "purchased balance reversed exactly once")
      assert.equal(account.remainingCredits, 400)
      assert.ok(account.purchasedBalance >= 0, "no negative balances")
      assert.equal(account.remainingCredits >= 0, true, "no negative remaining credits")
    },
  },
  {
    name: "purchased credits survive downgrade/refund and remain spendable on Free",
    async run() {
      seedAccount({ tier: "pro", included: 500, purchased: 100 })
      setSubscriptionCatalog([makeSubscription({ status: "canceled" })])
      const modules = await importModules()
      withMockStripe(modules)

      await modules.webhook.handleSubscriptionEvent(
        {
          id: "evt_downgrade",
          type: "customer.subscription.deleted",
          data: { object: makeSubscription({ status: "canceled" }) },
        } as never,
      )
      assert.equal(profileRows[0].subscriptionTier, "free")

      const reservation = await modules.creditEngine.reserveCredits({
        userId: "user_refund",
        feature: "dataset_upload",
        estimatedCredits: 60,
      })
      assert.equal(reservation.success, true, "preserved purchased credits are spendable on Free")
      const finalized = await modules.creditEngine.finalizeCredits({
        operationId: reservation.operationId,
        actualCredits: 60,
      })
      assert.equal(finalized.success, true)
      assert.equal(userCreditRows[0].purchasedBalance, 40)
      assert.equal(userCreditRows[0].includedBalance, 0)
    },
  },
  {
    name: "Free accounts cannot start new credit top-up purchases (server gate)",
    async run() {
      const { readFileSync } = await import("node:fs")
      const checkoutGate = readFileSync("src/app/api/checkout/credit-topup/route.ts", "utf8")
      assert.ok(
        checkoutGate.includes('accountTier !== "pro" && accountTier !== "business"'),
        "the checkout gate blocks Free accounts from purchasing top-ups",
      )
    },
  },
]

void (async () => {
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
  console.log(
    failures === 0
      ? `All ${tests.length} subscription refund lifecycle tests passed.`
      : `${failures} test(s) failed.`,
  )
  if (failures > 0) process.exitCode = 1
})()
