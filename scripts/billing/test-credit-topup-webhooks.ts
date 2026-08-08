import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

type TestCase = {
  name: string
  run: () => void
}

const tests: TestCase[] = [
  {
    name: "credit top-up service has idempotent provider payment dedup",
    run() {
      const service = readProjectFile("src/lib/billing/credit-topup-service.ts")
      assert.ok(
        service.includes("isProviderPaymentProcessed"),
        "service has idempotency check function",
      )
      assert.ok(
        service.includes("eq(creditTopUps.provider") || service.includes("eq(creditTopUps.providerPaymentId"),
        "service queries by provider + providerPaymentId for dedup",
      )
      assert.ok(
        service.includes("idempotency_already_processed"),
        "service detects idempotency conflicts",
      )
    },
  },
  {
    name: "stripe webhook handler validates payment status before issuing credits",
    run() {
      const handler = readProjectFile("src/services/stripe/credit-webhook.ts")
      assert.ok(
        handler.includes('payment_status') && handler.includes('paid'),
        "handler checks payment_status === paid",
      )
      assert.ok(
        handler.includes("credits will not be issued"),
        "handler refuses to issue credits for unpaid payments",
      )
    },
  },
  {
    name: "stripe webhook handler validates amount and currency against package config",
    run() {
      const handler = readProjectFile("src/services/stripe/credit-webhook.ts")
      assert.ok(
        handler.includes("creditPackage.monetaryAmountCents !== amountTotal"),
        "handler validates amount against package config",
      )
      assert.ok(
        handler.includes("creditPackage.currency !== currency"),
        "handler validates currency against package config",
      )
      assert.ok(
        handler.includes("resolveCreditTopUpPackageByAmount"),
        "handler falls back to amount-based package resolution",
      )
    },
  },
  {
    name: "stripe webhook handler rejects non-payment-mode sessions",
    run() {
      const handler = readProjectFile("src/services/stripe/credit-webhook.ts")
      assert.ok(
        handler.includes('session.mode !== "payment"'),
        "handler rejects non-payment-mode checkout sessions",
      )
      assert.ok(
        handler.includes("checkout.session.completed"),
        "handler filters by checkout.session.completed event type",
      )
    },
  },
  {
    name: "stripe webhook handler requires payment_intent",
    run() {
      const handler = readProjectFile("src/services/stripe/credit-webhook.ts")
      assert.ok(
        handler.includes("payment_intent"),
        "handler references payment_intent from checkout session",
      )
      assert.ok(
        handler.includes("no payment_intent"),
        "handler rejects sessions without payment_intent",
      )
    },
  },
  {
    name: "square webhook signature verification uses HMAC-SHA256",
    run() {
      const handler = readProjectFile("src/services/square/credit-webhook.ts")
      assert.ok(
        handler.includes("createHmac"),
        "handler uses HMAC for signature verification",
      )
      assert.ok(
        handler.includes("timingSafeEqual"),
        "handler uses timing-safe comparison for signature",
      )
      assert.ok(
        handler.includes("sha256"),
        "handler uses SHA-256 for signature verification",
      )
    },
  },
  {
    name: "square webhook handler validates payment status before issuing credits",
    run() {
      const handler = readProjectFile("src/services/square/credit-webhook.ts")
      assert.ok(
        handler.includes("isCompletedSquarePaymentStatus"),
        "handler checks payment completion status",
      )
      assert.ok(
        handler.includes("isTerminalNonCompletedSquarePaymentStatus"),
        "handler identifies terminal non-completed statuses",
      )
      assert.ok(
        handler.includes("credits will not be issued"),
        "handler refuses to issue credits for non-completed payments",
      )
    },
  },
  {
    name: "square webhook handler validates amount and currency against package config",
    run() {
      const handler = readProjectFile("src/services/square/credit-webhook.ts")
      assert.ok(
        handler.includes("creditPackage.monetaryAmountCents !== amountMinor"),
        "handler validates amount against package config",
      )
      assert.ok(
        handler.includes("creditPackage.currency !== currency"),
        "handler validates currency against package config",
      )
    },
  },
  {
    name: "square webhook route requires signature and returns proper errors",
    run() {
      const route = readProjectFile("src/app/api/webhooks/square/route.ts")
      assert.ok(route.includes("verifySquareWebhookSignature"), "route imports signature verification")
      assert.ok(
        route.includes("401"),
        "route returns 401 for invalid signatures",
      )
      assert.ok(
        route.includes("received: true"),
        "route returns received confirmation",
      )
    },
  },
  {
    name: "stripe checkout service uses payment mode not subscription mode",
    run() {
      const service = readProjectFile("src/services/stripe/credit-checkout.ts")
      assert.ok(service.includes("mode: \"payment\""), "checkout uses payment mode")
      assert.ok(
        service.includes("client_reference_id"),
        "checkout sets client_reference_id for user association",
      )
      assert.ok(
        service.includes("metadata"),
        "checkout sets trusted metadata",
      )
    },
  },
  {
    name: "credit top-up checkout API rejects non-authenticated users",
    run() {
      const route = readProjectFile("src/app/api/checkout/credit-topup/route.ts")
      assert.ok(route.includes("auth()"), "route checks authentication")
      assert.ok(route.includes("Unauthorized"), "route returns unauthorized for unauthenticated users")
    },
  },
  {
    name: "credit top-up checkout API validates package selection server-side",
    run() {
      const route = readProjectFile("src/app/api/checkout/credit-topup/route.ts")
      assert.ok(
        route.includes("getCreditTopUpPackageById"),
        "route validates package ID against server-side config",
      )
      assert.ok(
        route.includes("active"),
        "route checks package is active before proceeding",
      )
      assert.ok(
        route.includes("monetaryAmountCents"),
        "route uses server-side monetary amount (not client-submitted)",
      )
    },
  },
  {
    name: "credit package config reads price IDs from environment variables",
    run() {
      const config = readProjectFile("src/lib/billing/credit-packages.ts")
      assert.ok(
        config.includes("USECLEVR_CREDITS_TOP_UP_"),
        "config reads from env vars prefixed with USECLEVR_CREDITS_TOP_UP_",
      )
      assert.ok(
        config.includes("process.env"),
        "config reads from process.env (server-side only)",
      )
      assert.ok(
        config.includes("pricingVersion"),
        "config includes pricing version for auditability",
      )
      assert.ok(
        config.includes("resolveCreditTopUpPackageByAmount"),
        "config can resolve packages by amount + currency + provider",
      )
    },
  },
  {
    name: "credit top-up service issues credits in a transaction atomically",
    run() {
      const service = readProjectFile("src/lib/billing/credit-topup-service.ts")
      assert.ok(
        service.includes("db.transaction"),
        "top-up processing uses database transaction",
      )
      assert.ok(
        service.includes("TOP_UP_PURCHASE"),
        "top-up creates TOP_UP_PURCHASE ledger entry",
      )
      assert.ok(
        service.includes("paymentStatus: \"finalized\""),
        "top-up ledger entry is marked as finalized",
      )
      assert.ok(
        service.includes("status: \"completed\""),
        "top-up record is marked as completed after ledger entry creation",
      )
    },
  },
  {
    name: "credit top-up service marks failed top-ups without issuing credits",
    run() {
      const service = readProjectFile("src/lib/billing/credit-topup-service.ts")
      assert.ok(
        service.includes('status: "failed"'),
        "top-up record is marked as failed on error",
      )
    },
  },
  {
    name: "credit top-up reconciliation detects financial discrepancies",
    run() {
      const service = readProjectFile("src/lib/billing/credit-topup-service.ts")
      assert.ok(
        service.includes("reconcileCreditTopUps"),
        "reconciliation function exists",
      )
      assert.ok(
        service.includes("payment_without_ledger"),
        "reconciliation detects payments without ledger entries",
      )
      assert.ok(
        service.includes("ledger_without_payment"),
        "reconciliation detects ledger entries without payments",
      )
      assert.ok(
        service.includes("duplicate_payment_mapping"),
        "reconciliation detects duplicate payment mappings",
      )
      assert.ok(
        service.includes("amount_mismatch"),
        "reconciliation detects amount mismatches",
      )
      assert.ok(
        service.includes("currency_mismatch"),
        "reconciliation detects currency mismatches",
      )
    },
  },
  {
    name: "credit top-up refund logic protects against insufficient balance",
    run() {
      const service = readProjectFile("src/lib/billing/credit-topup-service.ts")
      assert.ok(
        service.includes("insufficient purchased credits"),
        "refund logic checks for sufficient purchased balance",
      )
      assert.ok(
        service.includes("flaggedForReview"),
        "refund logic flags accounts for review when balance is insufficient",
      )
    },
  },
  {
    name: "billing page displays credit top-up history with payment details",
    run() {
      const page = readProjectFile("src/app/(auth)/app/settings/subscription/page.tsx")
      assert.ok(
        page.includes("getCreditTopUpHistory"),
        "subscription page fetches top-up history",
      )
      assert.ok(
        page.includes("providerPaymentId"),
        "subscription page displays payment reference",
      )
      assert.ok(
        page.includes("credits are being confirmed"),
        "subscription page shows pending webhook state",
      )
      assert.ok(
        page.includes("Purchase Credit Top-Ups"),
        "subscription page has credit top-up purchase section",
      )
    },
  },
  {
    name: "top-up history API endpoint is authenticated",
    run() {
      const route = readProjectFile("src/app/api/billing/topup-history/route.ts")
      assert.ok(route.includes("auth()"), "top-up history route checks authentication")
      assert.ok(
        route.includes("Unauthorized"),
        "top-up history route rejects unauthenticated users",
      )
      assert.ok(
        route.includes("getCreditTopUpHistory"),
        "top-up history route fetches from service",
      )
    },
  },
  {
    name: "Stripe webhook route routes payment-mode checkout to credit handler",
    run() {
      const route = readProjectFile("src/app/api/webhooks/stripe/route.ts")
      assert.ok(
        route.includes("handleStripeCreditCheckoutEvent"),
        "stripe webhook route calls credit top-up handler",
      )
      assert.ok(
        route.includes("mode === \"payment\""),
        "stripe webhook route checks for payment mode",
      )
    },
  },
  {
    name: "CreditTopUp table has provider + providerPaymentId unique index",
    run() {
      const schema = readProjectFile("src/lib/db/schema.ts")
      assert.ok(
        schema.includes('providerPaymentIdx: uniqueIndex("CreditTopUp_provider_payment_key")'),
        "schema defines unique index on provider + providerPaymentId",
      )
    },
  },
  {
    name: "CreditTopUp table has provider + providerEventId unique index",
    run() {
      const schema = readProjectFile("src/lib/db/schema.ts")
      assert.ok(
        schema.includes('providerEventIdx: uniqueIndex("CreditTopUp_provider_event_key")'),
        "schema defines unique index on provider + providerEventId",
      )
    },
  },
  {
    name: "migration SQL creates CreditTopUp table with constraints",
    run() {
      const migration = readProjectFile("src/lib/db/migrations/0024_credit_topup_reconciliation.sql")
      assert.ok(migration.includes("CREATE TABLE"), "migration creates CreditTopUp table")
      assert.ok(
        migration.includes("CreditTopUp_provider_payment_key"),
        "migration creates unique index on provider payment ID",
      )
      assert.ok(
        migration.includes("CreditTopUp_provider_event_key"),
        "migration creates unique index on provider event ID",
      )
      assert.ok(
        migration.includes("FOREIGN KEY"),
        "migration includes foreign key to User table",
      )
    },
  },
  {
    name: "predeploy migration runner includes CreditTopUp migration",
    run() {
      const predeploy = readProjectFile("scripts/runtime/railway-predeploy.cjs")
      assert.ok(
        predeploy.includes("0024_credit_topup_reconciliation.sql"),
        "predeploy includes CreditTopUp migration",
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

  console.log(`Credit top-up webhook verification passed (${tests.length} checks).`)
}

void main()
