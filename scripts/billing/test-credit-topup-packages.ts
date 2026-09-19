/**
 * Behavioral regression tests for the 100-credit ($10 USD), 500-credit
 * ($45 USD), and 1,000-credit ($85 USD) top-up packages. All Stripe and
 * database behavior is mocked — no real Checkout sessions, no real payments,
 * no production balances.
 *
 * Run: pnpm test:credit-topup-packages
 */
import assert from "node:assert/strict"
import type Stripe from "stripe"

// Package mapping is computed at module load from these env vars — set them
// before importing anything that transitively loads credit-packages.ts.
process.env.USECLEVR_CREDITS_TOP_UP_100_USD_STRIPE_PRICE_ID = "price_topup_100_usd"
process.env.USECLEVR_CREDITS_TOP_UP_500_USD_STRIPE_PRICE_ID = "price_topup_500_usd"
process.env.USECLEVR_CREDITS_TOP_UP_1000_USD_STRIPE_PRICE_ID = "price_topup_1000_usd"

async function run() {
  const { getCreditTopUpPackageByStripePriceId, getCreditTopUpPackageById, getActiveCreditTopUpPackages, resolveCreditTopUpPackageByAmount } = await import("@/lib/billing/credit-packages")
  const { handleStripeCreditCheckoutEvent, handleStripeRefundEvent } = await import("@/services/stripe/credit-webhook")
  const { processStripeTopUpPayment, getCreditTopUpHistory } = await import("@/lib/billing/credit-topup-service")
  const dbMock = (await import("./mocks/mock-db.mjs")) as {
    resetMockDb: () => void
    ledgerRows: Array<Record<string, any>>
    topupRows: Array<Record<string, any>>
  }
  const { resetMockDb, ledgerRows, topupRows } = dbMock
  const accountMock = (await import("./mocks/mock-credit-account.mjs")) as {
    accountsStore: Map<string, Record<string, any>>
    getCreditAccount: (userId: string) => Promise<Record<string, any> | null>
    resetAccountStore: () => void
  }
  const { getCreditAccount, resetAccountStore } = accountMock
  const stripeMock = (await import("./mocks/mock-stripe.mjs")) as {
    resetStripeMock: () => void
    setMockPrice: (price: { id: string; active: boolean; type: string; currency: string; unit_amount: number }) => void
    setMockPaymentRefundState: (state: {
      paymentIntentId: string
      chargeId?: string
      amount: number
      amountRefunded?: number
      refunds?: Array<{ id: string; amount: number; status: string }>
    }) => void
    stripeCalls: { priceRetrievals: string[]; paymentIntentRetrievals: string[]; chargeRetrievals: string[] }
  }
  const { resetStripeMock, setMockPrice, setMockPaymentRefundState, stripeCalls } = stripeMock
  const emailMock = (await import("./mocks/mock-emails.mjs")) as {
    sentEmails: Array<Record<string, any>>
    resetEmails: () => void
  }
  const { sentEmails, resetEmails } = emailMock

  type TestModule = { name: string; run: () => Promise<void> }

  const PRICE_100 = "price_topup_100_usd"
  const PRICE_500 = "price_topup_500_usd"
  const PRICE_1000 = "price_topup_1000_usd"

  function seedPackagePrices() {
    setMockPrice({ id: PRICE_100, active: true, type: "one_time", currency: "usd", unit_amount: 1000 })
    setMockPrice({ id: PRICE_500, active: true, type: "one_time", currency: "usd", unit_amount: 4500 })
    setMockPrice({ id: PRICE_1000, active: true, type: "one_time", currency: "usd", unit_amount: 8500 })
  }

  interface CheckoutEventOptions {
    paymentIntentId: string
    sessionId: string
    eventId: string
    amountTotal: number
    currency: string
    metadata: Record<string, string>
    mode?: string
    paymentStatus?: string
    lineItems?: Array<{ price: { id: string } }>
  }

  function checkoutCompletedEvent(options: CheckoutEventOptions): Stripe.Event {
    return {
      id: options.eventId,
      object: "event",
      type: "checkout.session.completed",
      data: {
        object: {
          id: options.sessionId,
          object: "checkout.session",
          mode: options.mode ?? "payment",
          payment_status: options.paymentStatus ?? "paid",
          payment_intent: options.paymentIntentId,
          amount_total: options.amountTotal,
          currency: options.currency,
          client_reference_id: options.metadata.userId,
          metadata: options.metadata,
          line_items: options.lineItems
            ? { object: "list", data: options.lineItems, has_more: false }
            : undefined,
        },
      },
    } as unknown as Stripe.Event
  }

  function chargeRefundedEvent(options: {
    chargeId: string
    paymentIntentId: string
    eventId: string
    amount: number
    amountRefunded: number
    refunds: Array<{ id: string; amount: number; status: string }>
  }): Stripe.Event {
    return {
      id: options.eventId,
      object: "event",
      type: "charge.refunded",
      data: {
        object: {
          id: options.chargeId,
          object: "charge",
          payment_intent: options.paymentIntentId,
          amount: options.amount,
          amount_refunded: options.amountRefunded,
          refunds: {
            object: "list",
            data: options.refunds,
            has_more: false,
          },
        },
      },
    } as unknown as Stripe.Event
  }

  function hundredMetadata(userId: string, overrides: Record<string, string> = {}) {
    return {
      userId,
      workspaceId: userId,
      creditPackageId: "topup_100_usd",
      pricingVersion: "v1",
      creditsGranted: "100",
      monetaryAmountCents: "1000",
      currency: "USD",
      userEmail: "buyer100@example.com",
      stripePriceId: PRICE_100,
      ...overrides,
    }
  }

function fiveHundredMetadata(userId: string, overrides: Record<string, string> = {}) {
  return {
    userId,
    workspaceId: userId,
    creditPackageId: "topup_500_usd",
    pricingVersion: "v1",
    creditsGranted: "500",
    monetaryAmountCents: "4500",
    currency: "USD",
    userEmail: "buyer500@example.com",
    stripePriceId: PRICE_500,
    ...overrides,
  }
}

function thousandMetadata(userId: string, overrides: Record<string, string> = {}) {
  return {
    userId,
    workspaceId: userId,
    creditPackageId: "topup_1000_usd",
    pricingVersion: "v1",
    creditsGranted: "1000",
    monetaryAmountCents: "8500",
    currency: "USD",
    userEmail: "buyer1000@example.com",
    stripePriceId: PRICE_1000,
    ...overrides,
  }
}

function resetTestState() {
  resetMockDb()
  resetAccountStore()
  resetStripeMock()
  resetEmails()
  seedPackagePrices()
}

async function assertCreditInvariant(userId: string) {
  const account = await getCreditAccount(userId)
  assert.ok(account, "credit account exists")
  assert.equal(
    account!.remainingCredits,
    account!.includedBalance + account!.purchasedBalance,
    "remainingCredits must equal includedBalance + purchasedBalance",
  )
  return account!
}

const tests: TestModule[] = [
  {
    name: "100 USD package maps to the $10 Stripe price with an exact 100-credit grant config",
    async run() {
      const pkg = getCreditTopUpPackageByStripePriceId(PRICE_100)
      assert.ok(pkg, "100 USD package resolves from its Stripe Price ID")
      assert.equal(pkg!.id, "topup_100_usd")
      assert.equal(pkg!.creditsGranted, 100)
      assert.equal(pkg!.monetaryAmountCents, 1000)
      assert.equal(pkg!.currency, "USD")
      assert.equal(pkg!.active, true)
      assert.equal(pkg!.providers.stripe, PRICE_100)
      assert.equal(getCreditTopUpPackageById("topup_100_usd")?.id, "topup_100_usd")
      assert.equal(resolveCreditTopUpPackageByAmount("USD", 1000, "stripe")?.id, "topup_100_usd")
      assert.equal(resolveCreditTopUpPackageByAmount("USD", 900, "stripe"), null)
    },
  },
  {
    name: "500 USD package maps to the $45 Stripe price with an exact 500-credit grant config",
    async run() {
      const pkg = getCreditTopUpPackageByStripePriceId(PRICE_500)
      assert.ok(pkg, "500 USD package resolves from its Stripe Price ID")
      assert.equal(pkg!.id, "topup_500_usd")
      assert.equal(pkg!.creditsGranted, 500)
      assert.equal(pkg!.monetaryAmountCents, 4500)
      assert.equal(pkg!.currency, "USD")
      assert.equal(pkg!.active, true)
      assert.equal(pkg!.providers.stripe, PRICE_500)
      assert.equal(getCreditTopUpPackageById("topup_500_usd")?.id, "topup_500_usd")

      const byAmount = resolveCreditTopUpPackageByAmount("USD", 4500, "stripe")
      assert.equal(byAmount?.id, "topup_500_usd")
      assert.equal(resolveCreditTopUpPackageByAmount("USD", 4400, "stripe"), null)
    },
  },
  {
    name: "1,000 USD package maps to the $85 Stripe price with an exact 1,000-credit grant config",
    async run() {
      const pkg = getCreditTopUpPackageByStripePriceId(PRICE_1000)
      assert.ok(pkg, "1,000 USD package resolves from its Stripe Price ID")
      assert.equal(pkg!.id, "topup_1000_usd")
      assert.equal(pkg!.creditsGranted, 1000)
      assert.equal(pkg!.monetaryAmountCents, 8500)
      assert.equal(pkg!.currency, "USD")
      assert.equal(pkg!.active, true)
      assert.equal(pkg!.providers.stripe, PRICE_1000)
      assert.equal(getCreditTopUpPackageById("topup_1000_usd")?.id, "topup_1000_usd")
      assert.equal(resolveCreditTopUpPackageByAmount("USD", 8500, "stripe")?.id, "topup_1000_usd")
    },
  },
  {
    name: "package mapping never cross-assigns prices and keeps unconfigured currencies inactive",
    async run() {
      assert.equal(getCreditTopUpPackageByStripePriceId(PRICE_100)!.creditsGranted, 100)
      assert.equal(getCreditTopUpPackageByStripePriceId(PRICE_500)!.creditsGranted, 500)
      assert.equal(getCreditTopUpPackageByStripePriceId(PRICE_1000)!.creditsGranted, 1000)
      assert.equal(getCreditTopUpPackageByStripePriceId("price_not_configured"), null)
      // Only the three USD prices are configured in this test run — EUR/GBP/CAD stay inactive.
      const active = getActiveCreditTopUpPackages().map((p) => p.id).sort()
      assert.deepEqual(active, ["topup_1000_usd", "topup_100_usd", "topup_500_usd"])
      assert.equal(getCreditTopUpPackageById("topup_500_eur")?.active, false)
      assert.equal(getCreditTopUpPackageByStripePriceId("price_topup_500_usd")!.currency, "USD")
    },
  },
  {
    name: "webhook grants exactly +500 purchased credits for a $45 USD payment",
    async run() {
      resetTestState()
      const userId = "user_webhook_500"
      const before = await getCreditAccount(userId)
      assert.equal(before, null, "fresh user starts without a credit account")

      const result = await handleStripeCreditCheckoutEvent(
        checkoutCompletedEvent({
          paymentIntentId: "pi_topup_500_usd",
          sessionId: "cs_topup_500_usd",
          eventId: "evt_topup_500_usd",
          amountTotal: 4500,
          currency: "usd",
          metadata: fiveHundredMetadata(userId),
        }),
      )

      assert.equal(result.processed, true)
      assert.equal(result.synced, true)
      assert.equal(result.creditsIssued, 500)
      assert.notEqual(result.duplicate, true)

      const account = await getCreditAccount(userId)
      assert.equal(account!.includedBalance, 50, "included credits must remain unchanged")
      assert.equal(account!.purchasedBalance, 500, "purchased credits must increase by exactly 500")
      assert.equal(account!.remainingCredits, 550)
      await assertCreditInvariant(userId)
      assert.equal(account!.totalPaidCents, 4500)
      assert.equal(account!.lifetimeCreditsEarned, 550)

      assert.equal(topupRows.length, 1, "exactly one CreditTopUp history entry")
      const topUp = topupRows[0]
      assert.equal(topUp.userId, userId)
      assert.equal(topUp.provider, "stripe")
      assert.equal(topUp.providerPaymentId, "pi_topup_500_usd")
      assert.equal(topUp.status, "completed")
      assert.equal(topUp.creditsGranted, 500)
      assert.equal(topUp.currency, "USD")
      assert.equal(topUp.amountMinor, 4500)
      assert.equal(topUp.creditPackageId, "topup_500_usd")
      assert.equal(topUp.pricingVersion, "v1")
      assert.ok(topUp.ledgerEntryId)

      const ledger = ledgerRows.filter((row) => row.id === topUp.ledgerEntryId)
      assert.equal(ledger.length, 1)
      const entry = ledger[0]
      assert.equal(entry.transactionType, "TOP_UP_PURCHASE")
      assert.equal(entry.type, "purchase")
      assert.equal(entry.status, "finalized")
      assert.equal(entry.amount, 500)
      assert.equal(entry.credits, 500)
      assert.equal(entry.monetaryAmount, 4500)
      assert.equal(entry.currency, "USD")
      assert.equal(entry.idempotencyKey, "topup:stripe:pi_topup_500_usd")
      assert.equal(entry.paymentProvider, "stripe")
      assert.equal(entry.providerTransactionId, "pi_topup_500_usd")
      assert.equal(entry.includedBalanceBefore, 50)
      assert.equal(entry.includedBalanceAfter, 50)
      assert.equal(entry.purchasedBalanceBefore, 0)
      assert.equal(entry.purchasedBalanceAfter, 500)
      assert.equal(entry.balanceBefore, 50)
      assert.equal(entry.balanceAfter, 550)
      assert.equal(entry.metadata.creditPackageId, "topup_500_usd")
      assert.equal(entry.metadata.adaptivePricing, false)

      const history = await getCreditTopUpHistory(userId)
      assert.equal(history.length, 1)
      assert.equal(history[0].id, topUp.id)
      assert.equal(history[0].creditsGranted, 500)
      assert.equal(history[0].status, "completed")

      assert.equal(sentEmails.length, 1, "one confirmation email on first success")
      assert.equal(sentEmails[0].to, "buyer500@example.com")
      assert.equal(sentEmails[0].creditsGranted, 500)
      assert.equal(sentEmails[0].amount, 45)
      assert.equal(sentEmails[0].currency, "USD")
      assert.equal(sentEmails[0].newPurchasedBalance, 500)
    },
  },
  {
    name: "replaying the same 500-credit webhook event never grants credits twice",
    async run() {
      resetTestState()
      const userId = "user_replay_500"
      const event = checkoutCompletedEvent({
        paymentIntentId: "pi_replay_500",
        sessionId: "cs_replay_500",
        eventId: "evt_replay_500",
        amountTotal: 4500,
        currency: "usd",
        metadata: fiveHundredMetadata(userId),
      })

      const first = await handleStripeCreditCheckoutEvent(event)
      assert.equal(first.creditsIssued, 500)
      const accountAfterFirst = await getCreditAccount(userId)
      assert.equal(accountAfterFirst!.purchasedBalance, 500)

      // Same event replayed verbatim (Stripe redelivery).
      const replay = await handleStripeCreditCheckoutEvent(event)
      assert.equal(replay.processed, true)
      assert.equal(replay.duplicate, true)
      assert.equal(replay.creditsIssued, undefined)

      // Redelivery with a different event ID but the same payment intent.
      const replayNewEvent = await handleStripeCreditCheckoutEvent({
        ...event,
        id: "evt_replay_500_second_delivery",
      } as unknown as Stripe.Event)
      assert.equal(replayNewEvent.duplicate, true)

      // Service-level replay (e.g. admin replay path) with a fresh event.
      const pkg = getCreditTopUpPackageById("topup_500_usd")!
      const serviceReplay = await processStripeTopUpPayment(
        {
          provider: "stripe",
          providerPaymentId: "pi_replay_500",
          providerCheckoutId: "cs_replay_500",
          providerEventId: "evt_replay_500_third_delivery",
          amountMinor: 4500,
          currency: "USD",
          stripePriceId: PRICE_500,
          clientReferenceId: userId,
          metadata: fiveHundredMetadata(userId),
        },
        pkg,
      )
      assert.equal(serviceReplay.duplicate, true)
      assert.equal(serviceReplay.success, true)
      assert.equal(serviceReplay.creditsIssued, 500)

      const accountAfterReplays = await getCreditAccount(userId)
      assert.equal(accountAfterReplays!.purchasedBalance, 500, "purchased balance unchanged after replays")
      assert.equal(accountAfterReplays!.remainingCredits, 550)
      await assertCreditInvariant(userId)
      assert.equal(topupRows.length, 1, "no additional CreditTopUp rows")
      assert.equal(ledgerRows.length, 1, "no additional ledger entries")
      assert.equal(sentEmails.length, 1, "no duplicate confirmation emails")
    },
  },
  {
    name: "refund after grant reverses purchased credits exactly once without touching included credits",
    async run() {
      resetTestState()
      const userId = "user_refund_after_grant"
      const paymentIntentId = "pi_refund_after_grant"
      const chargeId = "ch_refund_after_grant"
      setMockPaymentRefundState({
        paymentIntentId,
        chargeId,
        amount: 4500,
        amountRefunded: 0,
      })

      const checkout = await handleStripeCreditCheckoutEvent(
        checkoutCompletedEvent({
          paymentIntentId,
          sessionId: "cs_refund_after_grant",
          eventId: "evt_refund_after_grant_checkout",
          amountTotal: 4500,
          currency: "usd",
          metadata: fiveHundredMetadata(userId),
        }),
      )
      assert.equal(checkout.creditsIssued, 500)

      const accountAfterGrant = await getCreditAccount(userId)
      assert.equal(accountAfterGrant!.includedBalance, 50)
      assert.equal(accountAfterGrant!.purchasedBalance, 500)
      assert.equal(accountAfterGrant!.remainingCredits, 550)

      const refundEvent = chargeRefundedEvent({
        chargeId,
        paymentIntentId,
        eventId: "evt_refund_after_grant",
        amount: 4500,
        amountRefunded: 4500,
        refunds: [{ id: "re_refund_after_grant", amount: 4500, status: "succeeded" }],
      })

      const refund = await handleStripeRefundEvent(refundEvent)
      assert.equal(refund.processed, true)
      assert.equal(refund.synced, true)
      assert.equal(refund.creditsIssued, 500)

      const accountAfterRefund = await getCreditAccount(userId)
      assert.equal(accountAfterRefund!.includedBalance, 50, "included credits must never be reduced by a top-up refund")
      assert.equal(accountAfterRefund!.purchasedBalance, 0, "purchased balance returns to zero")
      assert.equal(accountAfterRefund!.remainingCredits, 50)
      await assertCreditInvariant(userId)

      const topUp = topupRows[0]
      assert.equal(topUp.status, "refunded")
      assert.equal(topUp.creditsGranted, 500)
      assert.equal(topUp.metadata.refundedCredits, 500)
      assert.equal(ledgerRows.filter((row) => row.transactionType === "REFUND").length, 1)

      const duplicateRefund = await handleStripeRefundEvent({
        ...refundEvent,
        id: "evt_refund_after_grant_duplicate",
      } as unknown as Stripe.Event)
      assert.equal(duplicateRefund.synced, true)
      assert.equal(duplicateRefund.creditsIssued, 0, "duplicate refund event does not deduct twice")
      const accountAfterDuplicate = await getCreditAccount(userId)
      assert.equal(accountAfterDuplicate!.includedBalance, 50)
      assert.equal(accountAfterDuplicate!.purchasedBalance, 0, "purchased balance never becomes negative")
      assert.equal(accountAfterDuplicate!.remainingCredits, 50)
      assert.equal(ledgerRows.filter((row) => row.transactionType === "REFUND").length, 1)
    },
  },
  {
    name: "refund before grant followed by checkout replay records zero credits and stays idempotent",
    async run() {
      resetTestState()
      const userId = "user_refund_before_grant"
      const paymentIntentId = "pi_refund_before_grant"
      const chargeId = "ch_refund_before_grant"
      setMockPaymentRefundState({
        paymentIntentId,
        chargeId,
        amount: 4500,
        amountRefunded: 4500,
        refunds: [{ id: "re_refund_before_grant", amount: 4500, status: "succeeded" }],
      })

      const event = checkoutCompletedEvent({
        paymentIntentId,
        sessionId: "cs_refund_before_grant",
        eventId: "evt_refund_before_grant_checkout",
        amountTotal: 4500,
        currency: "usd",
        metadata: fiveHundredMetadata(userId),
      })

      const checkoutAfterRefund = await handleStripeCreditCheckoutEvent(event)
      assert.equal(checkoutAfterRefund.processed, true)
      assert.equal(checkoutAfterRefund.synced, true)
      assert.equal(checkoutAfterRefund.creditsIssued, 0)
      assert.match(checkoutAfterRefund.reason ?? "", /fully refunded before credits were granted/)

      assert.equal(await getCreditAccount(userId), null, "zero-credit refunded history does not initialize or mutate balances")
      assert.equal(topupRows.length, 1)
      assert.equal(topupRows[0].status, "refunded")
      assert.equal(topupRows[0].creditsGranted, 0)
      assert.equal(topupRows[0].providerPaymentId, paymentIntentId)
      assert.equal(topupRows[0].metadata.refundedBeforeGrant, true)
      assert.equal(topupRows[0].metadata.packageCreditsGranted, 500)
      assert.equal(ledgerRows.length, 0, "no ledger grant or refund entry is created when credits were never issued")
      assert.equal(sentEmails.length, 0)

      const replay = await handleStripeCreditCheckoutEvent({
        ...event,
        id: "evt_refund_before_grant_checkout_replay",
      } as unknown as Stripe.Event)
      assert.equal(replay.processed, true)
      assert.equal(replay.synced, true)
      assert.equal(replay.duplicate, true)
      assert.equal(replay.creditsIssued, 0)
      assert.equal(await getCreditAccount(userId), null)
      assert.equal(topupRows.length, 1)
      assert.equal(ledgerRows.length, 0)
      assert.equal(sentEmails.length, 0)
    },
  },
  {
    name: "partial refund preserves normal grant flow and reverses only the proportional purchased credits",
    async run() {
      resetTestState()
      const userId = "user_partial_refund"
      const paymentIntentId = "pi_partial_refund"
      const chargeId = "ch_partial_refund"
      setMockPaymentRefundState({
        paymentIntentId,
        chargeId,
        amount: 4500,
        amountRefunded: 2250,
        refunds: [{ id: "re_partial_refund", amount: 2250, status: "succeeded" }],
      })

      const checkout = await handleStripeCreditCheckoutEvent(
        checkoutCompletedEvent({
          paymentIntentId,
          sessionId: "cs_partial_refund",
          eventId: "evt_partial_refund_checkout",
          amountTotal: 4500,
          currency: "usd",
          metadata: fiveHundredMetadata(userId),
        }),
      )
      assert.equal(checkout.processed, true)
      assert.equal(checkout.synced, true)
      assert.equal(checkout.creditsIssued, 500, "partial refund state does not block the normal grant")

      const accountAfterGrant = await getCreditAccount(userId)
      assert.equal(accountAfterGrant!.includedBalance, 50)
      assert.equal(accountAfterGrant!.purchasedBalance, 500)

      const refund = await handleStripeRefundEvent(
        chargeRefundedEvent({
          chargeId,
          paymentIntentId,
          eventId: "evt_partial_refund",
          amount: 4500,
          amountRefunded: 2250,
          refunds: [{ id: "re_partial_refund", amount: 2250, status: "succeeded" }],
        }),
      )
      assert.equal(refund.synced, true)
      assert.equal(refund.creditsIssued, 250)

      const accountAfterRefund = await getCreditAccount(userId)
      assert.equal(accountAfterRefund!.includedBalance, 50)
      assert.equal(accountAfterRefund!.purchasedBalance, 250)
      assert.equal(accountAfterRefund!.remainingCredits, 300)
      await assertCreditInvariant(userId)

      assert.equal(topupRows[0].status, "completed")
      assert.equal(topupRows[0].metadata.partiallyRefunded, true)
      assert.equal(topupRows[0].metadata.refundedCredits, 250)
      assert.equal(ledgerRows.filter((row) => row.transactionType === "REFUND").length, 1)
    },
  },
  {
    name: "webhook grants exactly +1,000 purchased credits for an $85 USD payment",
    async run() {
      resetTestState()
      const userId = "user_webhook_1000"

      const result = await handleStripeCreditCheckoutEvent(
        checkoutCompletedEvent({
          paymentIntentId: "pi_topup_1000_usd",
          sessionId: "cs_topup_1000_usd",
          eventId: "evt_topup_1000_usd",
          amountTotal: 8500,
          currency: "usd",
          metadata: thousandMetadata(userId),
        }),
      )

      assert.equal(result.processed, true)
      assert.equal(result.synced, true)
      assert.equal(result.creditsIssued, 1000)
      assert.notEqual(result.duplicate, true)

      const account = await getCreditAccount(userId)
      assert.equal(account!.includedBalance, 50, "included credits must remain unchanged")
      assert.equal(account!.purchasedBalance, 1000, "purchased credits must increase by exactly 1,000")
      assert.equal(account!.remainingCredits, 1050)
      await assertCreditInvariant(userId)
      assert.equal(account!.totalPaidCents, 8500)

      assert.equal(topupRows.length, 1)
      const topUp = topupRows[0]
      assert.equal(topUp.creditsGranted, 1000)
      assert.equal(topUp.currency, "USD")
      assert.equal(topUp.amountMinor, 8500)
      assert.equal(topUp.creditPackageId, "topup_1000_usd")
      assert.equal(topUp.status, "completed")

      const entry = ledgerRows.find((row) => row.id === topUp.ledgerEntryId)
      assert.ok(entry, "ledger entry linked to the top-up")
      assert.equal(entry!.transactionType, "TOP_UP_PURCHASE")
      assert.equal(entry!.amount, 1000)
      assert.equal(entry!.monetaryAmount, 8500)
      assert.equal(entry!.currency, "USD")
      assert.equal(entry!.idempotencyKey, "topup:stripe:pi_topup_1000_usd")
      assert.equal(entry!.purchasedBalanceAfter, 1000)

      const history = await getCreditTopUpHistory(userId)
      assert.equal(history.length, 1)
      assert.equal(history[0].creditsGranted, 1000)
      assert.equal(history[0].amountMinor, 8500)

      assert.equal(sentEmails[0]?.creditsGranted, 1000)
      assert.equal(sentEmails[0]?.amount, 85)
    },
  },
  {
    name: "replaying the same 1,000-credit webhook event never grants credits twice",
    async run() {
      resetTestState()
      const userId = "user_replay_1000"
      const event = checkoutCompletedEvent({
        paymentIntentId: "pi_replay_1000",
        sessionId: "cs_replay_1000",
        eventId: "evt_replay_1000",
        amountTotal: 8500,
        currency: "usd",
        metadata: thousandMetadata(userId),
      })

      const first = await handleStripeCreditCheckoutEvent(event)
      assert.equal(first.creditsIssued, 1000)

      const replay = await handleStripeCreditCheckoutEvent(event)
      assert.equal(replay.duplicate, true)
      assert.equal(replay.creditsIssued, undefined)

      const account = await getCreditAccount(userId)
      assert.equal(account!.purchasedBalance, 1000, "no double grant after replay")
      assert.equal(account!.remainingCredits, 1050)
      await assertCreditInvariant(userId)
      assert.equal(topupRows.length, 1)
      assert.equal(ledgerRows.length, 1)
    },
  },
  {
    name: "webhook grants exactly +100 purchased credits for a $10 USD payment and stays idempotent on replay",
    async run() {
      resetTestState()
      const userId = "user_webhook_100"
      const event = checkoutCompletedEvent({
        paymentIntentId: "pi_topup_100_usd",
        sessionId: "cs_topup_100_usd",
        eventId: "evt_topup_100_usd",
        amountTotal: 1000,
        currency: "usd",
        metadata: hundredMetadata(userId),
      })

      const first = await handleStripeCreditCheckoutEvent(event)
      assert.equal(first.processed, true)
      assert.equal(first.synced, true)
      assert.equal(first.creditsIssued, 100)
      assert.notEqual(first.duplicate, true)

      const account = await getCreditAccount(userId)
      assert.equal(account!.includedBalance, 50, "included credits must remain unchanged")
      assert.equal(account!.purchasedBalance, 100, "purchased credits must increase by exactly 100")
      assert.equal(account!.remainingCredits, 150)
      await assertCreditInvariant(userId)
      assert.equal(account!.totalPaidCents, 1000)

      assert.equal(topupRows.length, 1)
      assert.equal(topupRows[0].creditsGranted, 100)
      assert.equal(topupRows[0].currency, "USD")
      assert.equal(topupRows[0].amountMinor, 1000)
      assert.equal(topupRows[0].creditPackageId, "topup_100_usd")
      assert.equal(topupRows[0].status, "completed")

      const entry = ledgerRows.find((row) => row.id === topupRows[0].ledgerEntryId)
      assert.ok(entry, "ledger entry linked to the top-up")
      assert.equal(entry!.transactionType, "TOP_UP_PURCHASE")
      assert.equal(entry!.amount, 100)
      assert.equal(entry!.monetaryAmount, 1000)
      assert.equal(entry!.idempotencyKey, "topup:stripe:pi_topup_100_usd")
      assert.equal(entry!.purchasedBalanceAfter, 100)

      const replay = await handleStripeCreditCheckoutEvent(event)
      assert.equal(replay.duplicate, true)
      assert.equal(replay.creditsIssued, undefined)
      const accountAfterReplay = await getCreditAccount(userId)
      assert.equal(accountAfterReplay!.purchasedBalance, 100, "no double grant after replay")
      assert.equal(topupRows.length, 1)
      assert.equal(ledgerRows.length, 1)
      assert.equal(sentEmails.length, 1)
      await assertCreditInvariant(userId)
    },
  },
  {
    name: "ledger idempotency key blocks a second grant when the payment is replayed after a partial failure",
    async run() {
      resetTestState()
      const userId = "user_crash_500"
      const idempotencyKey = "topup:stripe:pi_crash_500"
      // Simulate a crash after the ledger entry was committed but before the
      // CreditTopUp record reached "completed" — the classic double-grant trap.
      ledgerRows.push({
        id: "cl_seed_crash",
        userId,
        workspaceId: userId,
        transactionType: "TOP_UP_PURCHASE",
        status: "finalized",
        idempotencyKey,
        amount: 500,
        credits: 500,
        monetaryAmount: 4500,
        currency: "USD",
        action: "credit_top_up",
        metadata: {},
      })

      const pkg = getCreditTopUpPackageById("topup_500_usd")!
      const result = await processStripeTopUpPayment(
        {
          provider: "stripe",
          providerPaymentId: "pi_crash_500",
          providerCheckoutId: "cs_crash_500",
          providerEventId: "evt_crash_500",
          amountMinor: 4500,
          currency: "USD",
          stripePriceId: PRICE_500,
          clientReferenceId: userId,
          metadata: fiveHundredMetadata(userId),
        },
        pkg,
      )

      assert.equal(result.success, true)
      assert.equal(result.duplicate, true)
      assert.equal(result.creditsIssued, 0, "no credits issued on top of the existing ledger grant")

      const account = await getCreditAccount(userId)
      assert.equal(account?.purchasedBalance ?? 0, 0, "purchased balance untouched by the replayed payment")
      assert.equal(ledgerRows.length, 1, "still exactly one ledger entry for the payment")
      assert.equal(topupRows.length, 0, "the rolled-back pending top-up row is not persisted")
      if (account) await assertCreditInvariant(userId)
    },
  },
  {
    name: "wrong payment amount fails closed for both packages",
    async run() {
      resetTestState()
      for (const [packageId, metadata, expectedCents] of [
        ["topup_500_usd", fiveHundredMetadata("user_amount_500"), 4500],
        ["topup_1000_usd", thousandMetadata("user_amount_1000"), 8500],
      ] as const) {
        const result = await handleStripeCreditCheckoutEvent(
          checkoutCompletedEvent({
            paymentIntentId: `pi_wrong_amount_${packageId}`,
            sessionId: `cs_wrong_amount_${packageId}`,
            eventId: `evt_wrong_amount_${packageId}`,
            amountTotal: expectedCents - 100,
            currency: "usd",
            metadata,
          }),
        )
        assert.equal(result.processed, true)
        assert.equal(result.synced, false)
        assert.match(result.reason ?? "", /Amount mismatch/)
        assert.equal(result.creditsIssued, undefined)
      }
      assert.equal(topupRows.length, 0, "no top-up rows for rejected payments")
      assert.equal(ledgerRows.length, 0, "no ledger entries for rejected payments")
      assert.equal(sentEmails.length, 0, "no confirmation emails for rejected payments")
      for (const userId of ["user_amount_500", "user_amount_1000"]) {
        const account = await getCreditAccount(userId)
        assert.equal(account?.purchasedBalance ?? 0, 0)
      }
    },
  },
  {
    name: "Adaptive Pricing localized charge is accepted only with the package's own verified Stripe Price",
    async run() {
      resetTestState()
      const userId = "user_adaptive_500"
      const result = await handleStripeCreditCheckoutEvent(
        checkoutCompletedEvent({
          paymentIntentId: "pi_adaptive_500",
          sessionId: "cs_adaptive_500",
          eventId: "evt_adaptive_500",
          amountTotal: 4280, // Stripe-converted EUR amount for the USD price
          currency: "eur",
          metadata: fiveHundredMetadata(userId),
        }),
      )

      assert.equal(result.processed, true)
      assert.equal(result.synced, true)
      assert.equal(result.creditsIssued, 500, "localized charge still grants the exact package credits")
      assert.ok(stripeCalls.priceRetrievals.includes(PRICE_500), "the authoritative Stripe Price is verified")

      const account = await getCreditAccount(userId)
      assert.equal(account!.includedBalance, 50, "included credits unchanged")
      assert.equal(account!.purchasedBalance, 500)
      assert.equal(account!.remainingCredits, 550)
      await assertCreditInvariant(userId)

      const topUp = topupRows[0]
      assert.equal(topUp.creditsGranted, 500)
      assert.equal(topUp.currency, "EUR", "charge currency is recorded on the top-up")
      assert.equal(topUp.amountMinor, 4280)
      assert.equal(topUp.metadata.adaptivePricing, true)
      assert.equal(topUp.metadata.priceCurrency, "USD")

      const entry = ledgerRows.find((row) => row.id === topUp.ledgerEntryId)
      assert.equal(entry!.amount, 500, "ledger credit amount stays exact")
      assert.equal(entry!.currency, "EUR")
      assert.equal(entry!.monetaryAmount, 4280)
      assert.equal(entry!.metadata.adaptivePricing, true)

      const email = sentEmails[0]
      assert.equal(email?.creditsGranted, 500)
      assert.equal(email?.currency, "EUR")
      assert.equal(email?.amount, 42.8)
    },
  },
  {
    name: "Adaptive Pricing fails closed on an untrusted price or a drifted Stripe Price",
    async run() {
      resetTestState()
      // Unrelated price ID on a localized charge.
      const rejected = await handleStripeCreditCheckoutEvent(
        checkoutCompletedEvent({
          paymentIntentId: "pi_adaptive_bad_price",
          sessionId: "cs_adaptive_bad_price",
          eventId: "evt_adaptive_bad_price",
          amountTotal: 4280,
          currency: "eur",
          metadata: fiveHundredMetadata("user_adaptive_bad", { stripePriceId: "price_unrelated" }),
        }),
      )
      assert.equal(rejected.processed, true)
      assert.equal(rejected.synced, false)
      assert.match(rejected.reason ?? "", /does not match package currency.*requires admin recovery/)
      assert.equal(await getCreditAccount("user_adaptive_bad"), null)
      assert.equal(topupRows.length, 0)

      // Package price drifted in Stripe (currency changed on the price).
      setMockPrice({ id: PRICE_500, active: true, type: "one_time", currency: "eur", unit_amount: 4500 })
      const drifted = await handleStripeCreditCheckoutEvent(
        checkoutCompletedEvent({
          paymentIntentId: "pi_adaptive_drift",
          sessionId: "cs_adaptive_drift",
          eventId: "evt_adaptive_drift",
          amountTotal: 4280,
          currency: "eur",
          metadata: fiveHundredMetadata("user_adaptive_drift"),
        }),
      )
      assert.equal(drifted.synced, false)
      assert.match(drifted.reason ?? "", /Stripe Price no longer matches/)
      assert.equal(await getCreditAccount("user_adaptive_drift"), null)

      // Service-level guard: localized charge without the package's own price.
      const pkg = getCreditTopUpPackageById("topup_500_usd")!
      const serviceLevel = await processStripeTopUpPayment(
        {
          provider: "stripe",
          providerPaymentId: "pi_adaptive_service",
          providerCheckoutId: "cs_adaptive_service",
          providerEventId: "evt_adaptive_service",
          amountMinor: 4280,
          currency: "EUR",
          chargeCurrency: "EUR",
          stripePriceId: "price_unrelated",
          clientReferenceId: "user_adaptive_service",
          metadata: fiveHundredMetadata("user_adaptive_service"),
        },
        pkg,
      )
      assert.equal(serviceLevel.success, false)
      assert.match(serviceLevel.error ?? "", /without a trusted matching Stripe Price/)
      assert.equal(topupRows.length, 0)
      assert.equal(ledgerRows.length, 0)
      assert.equal(sentEmails.length, 0)
    },
  },
  {
    name: "legacy sessions resolve through line-item Stripe Price IDs without amount guessing",
    async run() {
      resetTestState()
      // Sessions that predate creditPackageId metadata resolve ONLY through a
      // line-item Stripe Price ID mapped to an active package — $45.00 USD.
      const legacy500 = await handleStripeCreditCheckoutEvent(
        checkoutCompletedEvent({
          paymentIntentId: "pi_legacy_500",
          sessionId: "cs_legacy_500",
          eventId: "evt_legacy_500",
          amountTotal: 4500,
          currency: "usd",
          metadata: { userId: "user_legacy_500", userEmail: "legacy500@example.com" },
          lineItems: [{ price: { id: PRICE_500 } }],
        }),
      )
      assert.equal(legacy500.processed, true)
      assert.equal(legacy500.synced, true)
      assert.equal(legacy500.creditsIssued, 500)
      const account500 = await getCreditAccount("user_legacy_500")
      assert.equal(account500!.purchasedBalance, 500)
      assert.equal(account500!.includedBalance, 50)
      await assertCreditInvariant("user_legacy_500")
      assert.equal(topupRows[0]?.creditPackageId, "topup_500_usd")

      // $85.00 USD → 1,000 credits via the same line-item Price ID fallback.
      const legacy1000 = await handleStripeCreditCheckoutEvent(
        checkoutCompletedEvent({
          paymentIntentId: "pi_legacy_1000",
          sessionId: "cs_legacy_1000",
          eventId: "evt_legacy_1000",
          amountTotal: 8500,
          currency: "usd",
          metadata: { userId: "user_legacy_1000", userEmail: "legacy1000@example.com" },
          lineItems: [{ price: { id: PRICE_1000 } }],
        }),
      )
      assert.equal(legacy1000.synced, true)
      assert.equal(legacy1000.creditsIssued, 1000)
      assert.equal(topupRows[1]?.creditPackageId, "topup_1000_usd")
      await assertCreditInvariant("user_legacy_1000")

      // Legacy resolution still supports Adaptive Pricing: the package's own
      // Stripe Price identifies it while Stripe charges in another currency.
      const legacyAdaptive = await handleStripeCreditCheckoutEvent(
        checkoutCompletedEvent({
          paymentIntentId: "pi_legacy_adaptive",
          sessionId: "cs_legacy_adaptive",
          eventId: "evt_legacy_adaptive",
          amountTotal: 4280,
          currency: "eur",
          metadata: { userId: "user_legacy_adaptive", userEmail: "legacyadaptive@example.com" },
          lineItems: [{ price: { id: PRICE_500 } }],
        }),
      )
      assert.equal(legacyAdaptive.synced, true)
      assert.equal(legacyAdaptive.creditsIssued, 500, "localized charge through a trusted Price still grants exactly the package credits")
      const adaptiveAccount = await getCreditAccount("user_legacy_adaptive")
      assert.equal(adaptiveAccount!.includedBalance, 50)
      assert.equal(adaptiveAccount!.purchasedBalance, 500)
      await assertCreditInvariant("user_legacy_adaptive")
      assert.equal(topupRows[2]?.metadata.adaptivePricing, true)
      assert.equal(topupRows[2]?.currency, "EUR")
    },
  },
  {
    name: "untrusted line-item Price IDs and amount+currency alone never grant credits",
    async run() {
      resetTestState()
      // Line item carries a Price ID that maps to no configured package.
      const untrustedPrice = await handleStripeCreditCheckoutEvent(
        checkoutCompletedEvent({
          paymentIntentId: "pi_untrusted_price",
          sessionId: "cs_untrusted_price",
          eventId: "evt_untrusted_price",
          amountTotal: 4500,
          currency: "usd",
          metadata: { userId: "user_untrusted_price", userEmail: "untrusted@example.com" },
          lineItems: [{ price: { id: "price_untrusted_other_product" } }],
        }),
      )
      assert.equal(untrustedPrice.processed, true)
      assert.equal(untrustedPrice.synced, false)
      assert.match(untrustedPrice.reason ?? "", /No trusted package identifier/)

      // Exact $45.00 USD amount with no trusted identifier must never resolve.
      const amountOnly500 = await handleStripeCreditCheckoutEvent(
        checkoutCompletedEvent({
          paymentIntentId: "pi_amount_only_500",
          sessionId: "cs_amount_only_500",
          eventId: "evt_amount_only_500",
          amountTotal: 4500,
          currency: "usd",
          metadata: { userId: "user_amount_only_500", userEmail: "amountonly@example.com" },
        }),
      )
      assert.equal(amountOnly500.processed, true)
      assert.equal(amountOnly500.synced, false)
      assert.match(amountOnly500.reason ?? "", /No trusted package identifier/)

      // Same for the $85.00 USD amount.
      const amountOnly1000 = await handleStripeCreditCheckoutEvent(
        checkoutCompletedEvent({
          paymentIntentId: "pi_amount_only_1000",
          sessionId: "cs_amount_only_1000",
          eventId: "evt_amount_only_1000",
          amountTotal: 8500,
          currency: "usd",
          metadata: { userId: "user_amount_only_1000", userEmail: "amountonly1000@example.com" },
        }),
      )
      assert.equal(amountOnly1000.processed, true)
      assert.equal(amountOnly1000.synced, false)
      assert.match(amountOnly1000.reason ?? "", /No trusted package identifier/)

      // Amount matches the 500 package but in an unconfigured currency (EUR
      // packages are inactive without a Stripe Price) — must not resolve.
      const wrongCurrency = await handleStripeCreditCheckoutEvent(
        checkoutCompletedEvent({
          paymentIntentId: "pi_wrong_currency",
          sessionId: "cs_wrong_currency",
          eventId: "evt_wrong_currency",
          amountTotal: 4500,
          currency: "eur",
          metadata: { userId: "user_wrong_currency", userEmail: "wrong@example.com" },
        }),
      )
      assert.equal(wrongCurrency.processed, true)
      assert.equal(wrongCurrency.synced, false)
      assert.match(wrongCurrency.reason ?? "", /No trusted package identifier/)

      assert.equal(topupRows.length, 0, "no top-up rows for untrusted or amount-only payments")
      assert.equal(ledgerRows.length, 0, "no ledger entries for untrusted or amount-only payments")
      assert.equal(sentEmails.length, 0)
      for (const userId of ["user_untrusted_price", "user_amount_only_500", "user_amount_only_1000", "user_wrong_currency"]) {
        const account = await getCreditAccount(userId)
        assert.equal(account?.purchasedBalance ?? 0, 0)
      }
    },
  },
  {
    name: "unpaid sessions and non-payment modes grant zero credits",
    async run() {
      resetTestState()
      const unpaid = await handleStripeCreditCheckoutEvent(
        checkoutCompletedEvent({
          paymentIntentId: "pi_unpaid",
          sessionId: "cs_unpaid",
          eventId: "evt_unpaid",
          amountTotal: 4500,
          currency: "usd",
          metadata: fiveHundredMetadata("user_unpaid"),
          paymentStatus: "unpaid",
        }),
      )
      assert.equal(unpaid.processed, true)
      assert.equal(unpaid.synced, false)
      assert.match(unpaid.reason ?? "", /credits will not be issued/)

      const subscriptionMode = await handleStripeCreditCheckoutEvent(
        checkoutCompletedEvent({
          paymentIntentId: "pi_sub_mode",
          sessionId: "cs_sub_mode",
          eventId: "evt_sub_mode",
          amountTotal: 4500,
          currency: "usd",
          metadata: fiveHundredMetadata("user_sub_mode"),
          mode: "subscription",
        }),
      )
      assert.equal(subscriptionMode.processed, false)
      assert.match(subscriptionMode.reason ?? "", /not in payment mode/)

      assert.equal(topupRows.length, 0)
      assert.equal(ledgerRows.length, 0)
      assert.equal(sentEmails.length, 0)
      for (const userId of ["user_unpaid", "user_sub_mode"]) {
        const account = await getCreditAccount(userId)
        assert.equal(account?.purchasedBalance ?? 0, 0)
      }
    },
  },
]

async function main() {
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

  const packages100 = getCreditTopUpPackageById("topup_100_usd")
  const packages500 = getCreditTopUpPackageById("topup_500_usd")
  const packages1000 = getCreditTopUpPackageById("topup_1000_usd")
  console.log("")
  console.log(`100-credit package ($10 USD): ${failures === 0 ? "PASS" : "FAIL"} (grants ${packages100?.creditsGranted}, ${packages100?.monetaryAmountCents} cents)`)
  console.log(`500-credit package ($45 USD): ${failures === 0 ? "PASS" : "FAIL"} (grants ${packages500?.creditsGranted}, ${packages500?.monetaryAmountCents} cents)`)
  console.log(`1,000-credit package ($85 USD): ${failures === 0 ? "PASS" : "FAIL"} (grants ${packages1000?.creditsGranted}, ${packages1000?.monetaryAmountCents} cents)`)
  console.log(failures === 0 ? `All ${tests.length} credit top-up package tests passed.` : `${failures} test(s) failed.`)
  if (failures > 0) process.exitCode = 1
}

  await main()
}

void run()
