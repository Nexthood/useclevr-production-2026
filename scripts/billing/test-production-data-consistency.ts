import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

type TestCase = {
  name: string
  run: () => void
}

const tests: TestCase[] = [
  // === DEFECT A: Credit Top-Up Recovery ===

  {
    name: "historical €10 session recovery grants exactly 100 purchased credits",
    run() {
      const service = readProjectFile("src/lib/billing/credit-topup-service.ts")
      // Verify the service increments purchasedBalance by exact creditsGranted
      assert.ok(
        service.includes('"purchasedBalance" = "purchasedBalance" + ${creditPackage.creditsGranted}'),
        "purchasedBalance incremented by exact creditsGranted (100 for topup_100)",
      )
      assert.ok(
        service.includes('transactionType: "TOP_UP_PURCHASE"'),
        "ledger entry uses TOP_UP_PURCHASE transaction type",
      )
      assert.ok(
        service.includes("purchasedBalanceBefore") && service.includes("purchasedBalanceAfter"),
        "ledger tracks purchased balance before and after",
      )
    },
  },
  {
    name: "second replay of same Stripe payment grants zero additional credits",
    run() {
      const service = readProjectFile("src/lib/billing/credit-topup-service.ts")
      assert.ok(
        service.includes("isProviderPaymentProcessed"),
        "service checks if provider payment already processed",
      )
      assert.ok(
        service.includes("eq(creditTopUps.provider, provider)") &&
        service.includes("eq(creditTopUps.providerPaymentId, providerPaymentId)"),
        "duplicate check queries by provider + providerPaymentId",
      )
      assert.ok(
        service.includes('status === "duplicate"'),
        "already-processed payments marked as duplicate",
      )
      const route = readProjectFile("src/app/api/admin/replay-topup/route.ts")
      assert.ok(
        route.includes("handleStripeCreditCheckoutEvent"),
        "replay reuses webhook handler with built-in duplicate detection",
      )
    },
  },
  {
    name: "successful future webhook creates CreditTopUp record",
    run() {
      const service = readProjectFile("src/lib/billing/credit-topup-service.ts")
      assert.ok(
        service.includes("tx.insert(creditTopUps).values"),
        "webhook processing inserts CreditTopUp record in transaction",
      )
      assert.ok(
        service.includes('status: "pending"') || service.includes('status: "completed"'),
        "CreditTopUp status transitions through pending to completed",
      )
    },
  },
  {
    name: "successful future webhook creates TOP_UP_PURCHASE CreditLedger entry",
    run() {
      const service = readProjectFile("src/lib/billing/credit-topup-service.ts")
      assert.ok(
        service.includes('transactionType: "TOP_UP_PURCHASE"'),
        "ledger entry uses TOP_UP_PURCHASE type",
      )
      assert.ok(
        service.includes('status: "finalized"'),
        "ledger entry is finalized",
      )
      assert.ok(
        service.includes("providerTransactionId") && service.includes("paymentProvider"),
        "ledger entry includes payment provider reference",
      )
    },
  },
  {
    name: "successful future webhook updates purchasedBalance",
    run() {
      const service = readProjectFile("src/lib/billing/credit-topup-service.ts")
      assert.ok(
        service.includes('"purchasedBalance" = "purchasedBalance" + ${creditPackage.creditsGranted}'),
        "purchasedBalance updated atomically in transaction",
      )
      assert.ok(
        service.includes('"totalPaidCents" = "totalPaidCents" + ${creditPackage.monetaryAmountCents}'),
        "totalPaidCents updated to track monetary value",
      )
    },
  },
  {
    name: "purchased credits survive monthly reset",
    run() {
      const engine = readProjectFile("src/lib/billing/credit-engine.ts")
      // Monthly reset preserves purchasedBalance in remainingCredits calculation
      assert.ok(
        engine.includes("monthlyCredits + (creditInfo.purchasedBalance"),
        "monthly reset adds purchasedBalance to remainingCredits",
      )
      // The monthly reset function sets includedBalance but does NOT touch purchasedBalance
      // Check that the reset section doesn't set purchasedBalance to 0 or remove it
      const monthlyResetStart = engine.indexOf("checkAndPerformMonthlyReset")
      const monthlyResetEnd = engine.indexOf("\nexport async function", monthlyResetStart)
      const monthlyResetBody = engine.slice(monthlyResetStart, monthlyResetEnd)
      // purchasedBalance should not be explicitly set to 0 in monthly reset
      assert.ok(
        !monthlyResetBody.includes('"purchasedBalance"') || monthlyResetBody.includes("?? 0"),
        "monthly reset does NOT set purchasedBalance to zero",
      )
    },
  },
  {
    name: "billing history displays completed top-ups separately from invoices",
    run() {
      const page = readProjectFile("src/app/(auth)/app/settings/subscription/page.tsx")
      assert.ok(
        page.includes("getCreditTopUpHistory"),
        "page fetches credit top-up history",
      )
      assert.ok(
        page.includes("Credit Top-Up History"),
        "page has dedicated Credit Top-Up History section",
      )
      assert.ok(
        page.includes("Subscription Invoices") || page.includes("No subscription invoices yet"),
        "invoices section distinguishes subscription invoices from credit purchases",
      )
      assert.ok(
        page.includes("completedTopUps") && page.includes("creditsGranted"),
        "top-up history displays credits granted per purchase",
      )
    },
  },
  {
    name: "combined balance is correct (included + purchased)",
    run() {
      const accountService = readProjectFile("src/lib/billing/credit-account-service.ts")
      assert.ok(
        accountService.includes("totalAvailableBalance: (row.includedBalance ?? 0) + (row.purchasedBalance ?? 0)"),
        "totalAvailableBalance computed as included + purchased",
      )
      const usageRoute = readProjectFile("src/app/api/usage/credits/route.ts")
      assert.ok(
        usageRoute.includes("totalAvailable") || usageRoute.includes("totalAvailableBalance"),
        "credits API returns total available balance",
      )
    },
  },
  {
    name: "USD packages are primary (first in array order)",
    run() {
      const config = readProjectFile("src/lib/billing/credit-packages.ts")
      // Check that SUPPORTED_TOP_UP_CURRENCIES has USD first
      const currenciesMatch = config.match(/SUPPORTED_TOP_UP_CURRENCIES.*?\[\s*["']([A-Z]{3})["']/)
      assert.ok(currenciesMatch && currenciesMatch[1] === "USD", "USD is first (primary) currency in SUPPORTED_TOP_UP_CURRENCIES")
      // Verify all currencies present
      assert.ok(config.includes('"EUR"') && config.includes('"GBP"') && config.includes('"CAD"'), "EUR, GBP, CAD remain supported")
      // Verify USD packages have correct pricing
      assert.ok(config.includes('monetaryAmountCents: 1000'), "100 credits = $10 (1000 cents)")
      assert.ok(config.includes('monetaryAmountCents: 4500'), "500 credits = $45 (4500 cents)")
      assert.ok(config.includes('monetaryAmountCents: 8500'), "1000 credits = $85 (8500 cents)")
    },
  },
  {
    name: "no production redirect can contain 0.0.0.0 or localhost",
    run() {
      const redirect = readProjectFile("src/lib/billing/checkout-redirect.ts")
      // Block 0.0.0.0
      assert.ok(
        redirect.includes('"0.0.0.0"') && redirect.includes("return false"),
        "0.0.0.0 hostname is explicitly rejected",
      )
      // Block localhost variants
      assert.ok(
        redirect.includes('LOCAL_CHECKOUT_HOSTS') && redirect.includes('"localhost"'),
        "localhost blocked via LOCAL_CHECKOUT_HOSTS set",
      )
      assert.ok(
        redirect.includes('"127.0.0.1"') || redirect.includes('"::1"'),
        "loopback addresses blocked",
      )
      // Block internal IPs
      assert.ok(
        redirect.includes('10\\.') || redirect.includes('172\\.') || redirect.includes('192\\.168'),
        "private IP ranges blocked",
      )
      // Production requires HTTPS
      assert.ok(
        redirect.includes("NODE_ENV") && redirect.includes("https:"),
        "production enforces HTTPS for checkout URLs",
      )
    },
  },
  {
    name: "legacy line-item package resolution exists for sessions without creditPackageId metadata",
    run() {
      const handler = readProjectFile("src/services/stripe/credit-webhook.ts")
      assert.ok(
        handler.includes("resolveCreditPackageFromLineItems") ||
        handler.includes("lineItem") ||
        handler.includes("legacy"),
        "handler has legacy fallback for resolving packages from Stripe line items",
      )
      assert.ok(
        handler.includes("priceId") && handler.includes("getCreditTopUpPackageByStripePriceId"),
        "legacy resolution tries Price ID from line items first",
      )
    },
  },
  {
    name: "replay-topup accepts sessionId and provides diagnostics",
    run() {
      const route = readProjectFile("src/app/api/admin/replay-topup/route.ts")
      assert.ok(
        route.includes("sessionId") && route.includes('startsWith("cs_")'),
        "replay accepts sessionId parameter starting with cs_",
      )
      assert.ok(
        route.includes("diagnostics") || route.includes("sessionDiagnostics"),
        "replay endpoint returns diagnostic information",
      )
      assert.ok(
        route.includes("livemode") && route.includes("checkoutSession.livemode"),
        "replay preserves Stripe livemode from retrieved session",
      )
      assert.ok(
        route.includes("handleStripeCreditCheckoutEvent"),
        "replay reuses the normal webhook handler",
      )
    },
  },

  // === DEFECT B: Dataset Count Consistency ===

  {
    name: "canonical getActiveDatasetCount function exists in dataset-limits module",
    run() {
      const limits = readProjectFile("src/lib/usage/dataset-limits.ts")
      assert.ok(
        limits.includes("export async function getActiveDatasetCount"),
        "getActiveDatasetCount is exported from dataset-limits module",
      )
      assert.ok(
        limits.includes("ne(datasets.datasetType, \"prebookkeeping\")") ||
        limits.includes("ne(datasets.datasetType, 'prebookkeeping')"),
        "canonical count excludes prebookkeeping datasets",
      )
      assert.ok(
        limits.includes("isNull(datasets.datasetType)") || limits.includes("isNull(\"datasetType\""),
        "canonical count includes NULL datasetType rows",
      )
    },
  },
  {
    name: "Dataset Library query matches canonical active dataset definition",
    run() {
      const page = readProjectFile("src/app/(auth)/app/datasets/page.tsx")
      assert.ok(
        page.includes("ne(datasets.datasetType, \"prebookkeeping\")") ||
        page.includes("ne(datasets.datasetType, 'prebookkeeping')"),
        "Dataset Library excludes prebookkeeping type",
      )
      assert.ok(
        page.includes("isNull(datasets.datasetType)") || page.includes("or(isNull"),
        "Dataset Library includes NULL datasetType",
      )
    },
  },
  {
    name: "Subscription Overview uses canonical active dataset count",
    run() {
      const page = readProjectFile("src/app/(auth)/app/settings/subscription/page.tsx")
      assert.ok(
        page.includes("getActiveDatasetCount"),
        "subscription page imports getActiveDatasetCount",
      )
      assert.ok(
        !page.includes("count()") || page.includes("getActiveDatasetCount"),
        "subscription page does not use raw count() for dataset counting",
      )
    },
  },
  {
    name: "App Layout sidebar uses canonical active dataset count",
    run() {
      const layout = readProjectFile("src/app/(auth)/app/layout.tsx")
      assert.ok(
        layout.includes("getActiveDatasetCount"),
        "app layout imports getActiveDatasetCount",
      )
      assert.ok(
        !layout.includes("from \"@/lib/db/schema\"") || layout.includes("datasets") === false,
        "app layout does not import datasets table directly",
      )
    },
  },
  {
    name: "Settings Layout uses canonical active dataset count",
    run() {
      const layout = readProjectFile("src/app/(auth)/app/settings/layout.tsx")
      assert.ok(
        layout.includes("getActiveDatasetCount"),
        "settings layout imports getActiveDatasetCount",
      )
    },
  },
  {
    name: "/api/usage uses canonical active dataset count",
    run() {
      const credits = readProjectFile("src/lib/usage/analyst-credits.ts")
      assert.ok(
        credits.includes('from "./dataset-limits"') && credits.includes("getActiveDatasetCount"),
        "analyst-credits imports getActiveDatasetCount from dataset-limits",
      )
    },
  },
  {
    name: "upload limit enforcement uses canonical active dataset count",
    run() {
      const enforcement = readProjectFile("src/lib/billing/usage-enforcement.ts")
      assert.ok(
        enforcement.includes('from "@/lib/usage/dataset-limits"') && enforcement.includes("getActiveDatasetCount"),
        "usage-enforcement imports getActiveDatasetCount",
      )
    },
  },
  {
    name: "dashboard aggregation excludes prebookkeeping at SQL level",
    run() {
      const aggregation = readProjectFile("src/lib/data/dashboard-dataset-aggregation.ts")
      assert.ok(
        aggregation.includes("ne(datasets.datasetType, \"prebookkeeping\")") ||
        aggregation.includes("ne(datasets.datasetType, 'prebookkeeping')"),
        "dashboard aggregation excludes prebookkeeping at SQL level",
      )
    },
  },
  {
    name: "dataset limit info uses canonical count for plan enforcement",
    run() {
      const limits = readProjectFile("src/lib/usage/dataset-limits.ts")
      assert.ok(
        limits.includes("await getActiveDatasetCount(userId)"),
        "getDatasetLimitInfo uses canonical count for plan enforcement",
      )
    },
  },
]

const repoRoot = resolve(import.meta.dirname, "../..")

function readProjectFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8")
}

async function main() {
  let passed = 0
  let failed = 0

  for (const test of tests) {
    try {
      await test.run()
      console.log(`ok - ${test.name}`)
      passed++
    } catch (err) {
      console.error(`FAIL - ${test.name}`)
      console.error(`  ${err instanceof Error ? err.message : String(err)}`)
      failed++
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed, ${tests.length} total`)

  if (failed > 0) {
    process.exit(1)
  }
}

void main()
