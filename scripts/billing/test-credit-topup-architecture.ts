import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

type TestCase = {
  name: string
  run: () => void | Promise<void>
}

const tests: TestCase[] = [
  {
    name: "monthly reset preserves purchased credits in remainingCredits calculation",
    run() {
      const engine = readProjectFile("src/lib/billing/credit-engine.ts")
      assert.ok(
        engine.includes('remainingCredits: monthlyCredits + (creditInfo.purchasedBalance ?? 0)'),
        "monthly reset sets remainingCredits to monthlyCredits + purchasedBalance",
      )
      assert.ok(
        engine.includes('balanceAfter: monthlyCredits + (creditInfo.purchasedBalance ?? 0)'),
        "monthly reset ledger balanceAfter includes purchased credits",
      )
    },
  },
  {
    name: "plan change preserves purchased credits in remainingCredits calculation",
    run() {
      const engine = readProjectFile("src/lib/billing/credit-engine.ts")
      assert.ok(
        engine.includes('+ (creditInfo.purchasedBalance ?? 0)'),
        "plan change adds purchasedBalance to remainingCredits",
      )
    },
  },
  {
    name: "syncCreditPlanToProfile reads purchasedBalance before updating remainingCredits",
    run() {
      const accountService = readProjectFile("src/lib/billing/credit-account-service.ts")
      assert.ok(
        accountService.includes("purchasedBalance"),
        "syncCreditPlanToProfile references purchasedBalance",
      )
      assert.ok(
        accountService.includes("monthlyCredits + purchasedBalance"),
        "syncCreditPlanToProfile sets remainingCredits including purchased credits",
      )
    },
  },
  {
    name: "finalizeCredits consumes included credits before purchased credits with no Free-tier consumption block",
    run() {
      const engine = readProjectFile("src/lib/billing/credit-engine.ts")
      assert.ok(
        engine.includes('"includedBalance" >= ${actualCredits}'),
        "finalizeCredits checks if includedBalance covers the charge first",
      )
      assert.ok(
        engine.includes('"purchasedBalance" - GREATEST(0, ${actualCredits} - "includedBalance")'),
        "finalizeCredits deducts from purchased only after included is exhausted",
      )
      assert.ok(
        engine.includes('THEN "purchasedBalance"'),
        "finalizeCredits leaves purchased unchanged when included covers the full charge",
      )
      assert.ok(
        !engine.includes("paidPlanTier") && !engine.includes("purchasedConsumable") && !engine.includes("planTier"),
        "finalizeCredits must not gate purchased-credit consumption on the plan tier — preserved purchased credits stay consumable after a downgrade to Free",
      )
    },
  },
  {
    name: "credit packs use 100, 500, and 1000 denominations",
    run() {
      const packages = readProjectFile("src/lib/billing/credit-packages.ts")
      assert.ok(packages.includes('id: "topup_100"'), "has topup_100 pack")
      assert.ok(packages.includes('id: "topup_500"'), "has topup_500 pack")
      assert.ok(packages.includes('id: "topup_1000"'), "has topup_1000 pack")
      assert.ok(!packages.includes('topup_550'), "removed old topup_550 pack")
      assert.ok(!packages.includes('topup_1200'), "removed old topup_1200 pack")
      assert.ok(!packages.includes('topup_3000'), "removed old topup_3000 pack")
      assert.ok(!packages.includes('topup_7500'), "removed old topup_7500 pack")
    },
  },
  {
    name: "credit packs require Stripe Price ID env var to be active",
    run() {
      const packages = readProjectFile("src/lib/billing/credit-packages.ts")
      assert.ok(
        packages.includes('active: Boolean(stripePriceId || squareCatalogId)'),
        "packs are inactive until Stripe Price ID is configured",
      )
    },
  },
  {
    name: "usage monitor shows total available credits label not just included",
    run() {
      const monitor = readProjectFile("src/components/ui/usage-monitor.tsx")
      assert.ok(
        monitor.includes("credits available"),
        "monitor shows 'credits available' label",
      )
    },
  },
  {
    name: "usage monitor shows breakdown of included vs purchased when both exist",
    run() {
      const monitor = readProjectFile("src/components/ui/usage-monitor.tsx")
      assert.ok(
        monitor.includes("includedBalance > 0 && purchasedBalance > 0"),
        "monitor conditionally shows both included and purchased counts",
      )
    },
  },
  {
    name: "usage monitor paid Pro section shows total available not just included",
    run() {
      const monitor = readProjectFile("src/components/ui/usage-monitor.tsx")
      assert.ok(
        monitor.includes("totalAvailable.toLocaleString()} credits available"),
        "paid Pro section displays total available credits",
      )
    },
  },
  {
    name: "top-up checkout uses payment mode not subscription mode",
    run() {
      const checkout = readProjectFile("src/services/stripe/credit-checkout.ts")
      assert.ok(checkout.includes('mode: "payment"'), "checkout session uses payment mode")
    },
  },
  {
    name: "stripe webhook handler only grants credits for paid status",
    run() {
      const webhook = readProjectFile("src/services/stripe/credit-webhook.ts")
      assert.ok(
        webhook.includes('payment_status !== "paid"') ||
          webhook.includes('paymentStatus !== "paid"'),
        "webhook rejects non-paid payments",
      )
      assert.ok(
        webhook.includes("credits will not be issued"),
        "webhook explicitly states credits not issued for unpaid",
      )
    },
  },
  {
    name: "top-up processing is idempotent via provider payment dedup",
    run() {
      const service = readProjectFile("src/lib/billing/credit-topup-service.ts")
      assert.ok(
        service.includes("isProviderPaymentProcessed"),
        "service checks for already-processed payments",
      )
      assert.ok(
        service.includes("idempotency_already_processed"),
        "service throws on idempotency conflict",
      )
      assert.ok(
        service.includes("eq(creditTopUps.providerPaymentId"),
        "dedup queries by providerPaymentId",
      )
    },
  },
  {
    name: "top-up ledger entry uses unique idempotency key",
    run() {
      const service = readProjectFile("src/lib/billing/credit-topup-service.ts")
      assert.ok(
        service.includes('idempotencyKey = `topup:${provider}:${providerPaymentId}`'),
        "idempotency key is scoped to provider + payment ID",
      )
    },
  },
  {
    name: "schema has unique index on CreditTopUp provider + providerPaymentId",
    run() {
      const schema = readProjectFile("src/lib/db/schema.ts")
      assert.ok(
        schema.includes('uniqueIndex("CreditTopUp_provider_payment_key")'),
        "schema enforces uniqueness at DB level",
      )
    },
  },
  {
    name: "top-up history API filters by authenticated user ID",
    run() {
      const historyRoute = readProjectFile("src/app/api/billing/topup-history/route.ts")
      assert.ok(
        historyRoute.includes("userId"),
        "top-up history route uses userId for filtering",
      )
      assert.ok(
        historyRoute.includes("getCreditTopUpHistory"),
        "top-up history route calls service with userId",
      )
      const service = readProjectFile("src/lib/billing/credit-topup-service.ts")
      assert.ok(
        service.includes("eq(creditTopUps.userId"),
        "top-up history service queries by userId column",
      )
    },
  },
  {
    name: "subscription page fetches and displays top-up history",
    run() {
      const page = readProjectFile("src/app/(auth)/app/settings/subscription/page.tsx")
      assert.ok(
        page.includes("getCreditTopUpHistory"),
        "page imports top-up history function",
      )
      assert.ok(
        page.includes("completedTopUps"),
        "page renders completed top-ups separately",
      )
    },
  },
  {
    name: "subscription page renders credit package cards with pricing",
    run() {
      const page = readProjectFile("src/app/(auth)/app/settings/subscription/page.tsx")
      assert.ok(
        page.includes("Purchase Credit Top-Ups"),
        "page has purchase section heading",
      )
      assert.ok(
        page.includes("monetaryAmountCents / 100"),
        "page displays monetary amount from server config",
      )
      assert.ok(
        page.includes("creditsGranted"),
        "page displays credits granted from server config",
      )
    },
  },
  {
    name: "subscription invoice history is sourced from Stripe with authoritative refund state",
    run() {
      const page = readProjectFile("src/app/(auth)/app/settings/subscription/page.tsx")
      assert.ok(
        page.includes("stripe.invoices.list") && page.includes("stripe.charges.list"),
        "page lists Stripe invoices and charges for the signed-in customer",
      )
      assert.ok(
        page.includes("invoice.subscription"),
        "only subscription invoices are listed — credit top-up invoices stay in Credit Top-Up History",
      )
      assert.ok(
        page.includes("amount_refunded") && page.includes('"Refunded"') && page.includes('"Partially refunded"'),
        "subscription invoice status reflects Stripe refund state",
      )
      assert.ok(
        !/providerPaymentId|payment_intent}/.test(page),
        "subscription invoice rows never expose internal payment provider references",
      )
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

  console.log(`Credit top-up architecture verification passed (${tests.length} checks).`)
}

void main()
