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
      assert.ok(
        handler.includes("retrievePaymentRefundState") &&
        handler.includes("paymentIntents.retrieve") &&
        handler.includes("latest_charge") &&
        handler.includes("amount_refunded"),
        "handler verifies authoritative PaymentIntent and Charge refund state before granting credits",
      )
      assert.ok(
        handler.includes("fullyRefunded") &&
        handler.includes("recordStripeRefundedTopUpWithoutGrant"),
        "handler records fully refunded payments as zero-credit refunded top-ups before grant",
      )
    },
  },
  {
    name: "stripe webhook handler uses deterministic package resolution from metadata",
    run() {
      const handler = readProjectFile("src/services/stripe/credit-webhook.ts")
      assert.ok(
        handler.includes("resolveCreditPackageDeterministically"),
        "handler uses dedicated deterministic resolution function",
      )
      assert.ok(
        !handler.includes("Math.abs") && !handler.includes("tolerance") && !handler.includes("0.15"),
        "handler does NOT use approximate amount matching or tolerance",
      )
      assert.ok(
        handler.includes("creditPackageId") || handler.includes("getCreditTopUpPackageById"),
        "handler resolves by server-generated creditPackageId first",
      )
      assert.ok(
        handler.includes("stripePriceId") || handler.includes("getCreditTopUpPackageByStripePriceId"),
        "handler resolves by Stripe Price ID second",
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
        service.includes("Insufficient purchased credits for full refund"),
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
  {
    name: "credit top-up checkout uses buildCheckoutSuccessUrl for safe redirect URLs",
    run() {
      const route = readProjectFile("src/app/api/checkout/credit-topup/route.ts")
      assert.ok(
        route.includes("buildCheckoutSuccessUrl"),
        "route imports and uses buildCheckoutSuccessUrl",
      )
      assert.ok(
        !route.includes('`${origin}/app/settings/subscription') && !route.includes('`${request.url.origin}'),
        "route does not concatenate request URL origin directly into redirect",
      )
    },
  },
  {
    name: "redirect resolution blocks 0.0.0.0 and localhost in production",
    run() {
      const redirect = readProjectFile("src/lib/billing/checkout-redirect.ts")
      assert.ok(
        redirect.includes('"0.0.0.0"'),
        "redirect resolver rejects 0.0.0.0 hostname",
      )
      assert.ok(
        redirect.includes("LOCAL_CHECKOUT_HOSTS") || redirect.includes("localhost"),
        "redirect resolver blocks localhost variants",
      )
      assert.ok(
        redirect.includes("PRODUCTION_APP_URL") || redirect.includes('https://app.useclevr.com'),
        "redirect resolver falls back to production URL",
      )
    },
  },
  {
    name: "subscription page shows credit purchase success confirmation banner",
    run() {
      const page = readProjectFile("src/app/(auth)/app/settings/subscription/page.tsx")
      assert.ok(
        page.includes("Credits added successfully"),
        "page renders success confirmation message",
      )
      assert.ok(
        page.includes("non-refundable and do not expire"),
        "success banner states the non-refundable, no-expiry policy",
      )
      assert.ok(
        page.includes("latestCompletedTopUp"),
        "success banner fetches data from server-side history, not URL params",
      )
    },
  },
  {
    name: "customer-facing policy states purchased credits are non-refundable",
    run() {
      const page = readProjectFile("src/app/(auth)/app/settings/subscription/page.tsx")
      const policyCount = page.split("Purchased credits are non-refundable and do not expire.").length - 1
      assert.ok(
        policyCount >= 2,
        "non-refundable notice appears near both the purchase area and the credit history",
      )
      assert.ok(
        page.includes("For billing questions, contact support."),
        "notice directs billing questions to support",
      )
      assert.ok(
        page.includes("Purchased credit top-ups are non-refundable and do not expire."),
        "subscription terms state the non-refundable policy",
      )
      const emails = readProjectFile("src/lib/email/subscription-emails.ts")
      assert.ok(
        emails.includes("non-refundable and do not expire"),
        "confirmation email states the non-refundable policy",
      )
      const poller = readProjectFile("src/components/billing/topup-confirmation-poller.tsx")
      assert.ok(
        poller.includes("non-refundable and do not expire"),
        "post-purchase confirmation states the non-refundable policy",
      )
    },
  },
  {
    name: "no self-service refund path exists for purchased credits",
    run() {
      const service = readProjectFile("src/lib/billing/credit-topup-service.ts")
      assert.ok(
        service.includes("export async function refundTopUpCredits"),
        "administrative Stripe refund logic remains available",
      )
      const webhook = readProjectFile("src/services/stripe/credit-webhook.ts")
      assert.ok(
        webhook.includes("refundTopUpCredits"),
        "refund reversal runs only through the verified Stripe webhook path",
      )
      assert.ok(
        !readProjectFile("src/app/api/checkout/credit-topup/route.ts").includes("refundTopUpCredits"),
        "customer checkout route exposes no refund action",
      )
      const statusRoute = readProjectFile("src/app/api/billing/credit-topup/status/route.ts")
      assert.ok(
        !statusRoute.includes("refundTopUpCredits"),
        "status endpoint exposes no refund action",
      )
    },
  },
  {
    name: "billing history distinguishes Completed, Partially Refunded, and Refunded",
    run() {
      const service = readProjectFile("src/lib/billing/credit-topup-service.ts")
      assert.ok(
        service.includes('fullyRefunded ? ("refunded" as const) : ("completed" as const)'),
        "full reversal marks the top-up refunded; partial reversal keeps it completed with refund metadata",
      )
      assert.ok(
        service.includes("partiallyRefunded: !fullyRefunded") && service.includes("refundedCredits: totalRefundedCredits"),
        "cumulative refunded credits are recorded on the top-up record",
      )
      const page = readProjectFile("src/app/(auth)/app/settings/subscription/page.tsx")
      assert.ok(
        page.includes("Partially Refunded") && page.includes("Refunded") && page.includes("Completed"),
        "history renders distinct Completed / Partially Refunded / Refunded labels",
      )
    },
  },
  {
    name: "credit purchase email function exists with required fields",
    run() {
      const emails = readProjectFile("src/lib/email/subscription-emails.ts")
      assert.ok(
        emails.includes("sendCreditPurchaseEmail"),
        "email module exports sendCreditPurchaseEmail",
      )
      assert.ok(
        emails.includes("creditsGranted") && emails.includes("providerPaymentId"),
        "email includes credit quantity and payment reference",
      )
      assert.ok(
        emails.includes("non-refundable and do not expire"),
        "email confirms purchased credits are non-refundable and do not expire",
      )
    },
  },
  {
    name: "webhook handler sends credit purchase email on first successful processing",
    run() {
      const webhook = readProjectFile("src/services/stripe/credit-webhook.ts")
      assert.ok(
        webhook.includes("sendCreditPurchaseEmail"),
        "webhook handler calls credit purchase email function",
      )
      assert.ok(
        webhook.includes("!result.duplicate"),
        "email is only sent on non-duplicate (first-time) success",
      )
    },
  },
  {
    name: "production top-up success URL never contains 0.0.0.0",
    run() {
      const redirect = readProjectFile("src/lib/billing/checkout-redirect.ts")
      assert.ok(
        !redirect.includes('new URL(successPath, baseUrl)') || redirect.includes('isAllowedCheckoutBaseUrl'),
        "success URL construction uses safe base URL resolver",
      )
      assert.ok(
        redirect.includes('"0.0.0.0"') && redirect.includes('return false'),
        "0.0.0.0 hostname is explicitly rejected in URL resolver",
      )
    },
  },
  {
    name: "production top-up cancel URL never contains 0.0.0.0",
    run() {
      const redirect = readProjectFile("src/lib/billing/checkout-redirect.ts")
      assert.ok(
        redirect.includes("buildCheckoutCancelUrl") || redirect.includes("resolveCheckoutBaseUrl"),
        "cancel URL uses the same safe resolver as success URL",
      )
      assert.ok(
        redirect.includes('url.hostname === "0.0.0.0"') || redirect.includes('=== "0.0.0.0"'),
        "cancel URL builder also rejects 0.0.0.0 hostname",
      )
    },
  },
  {
    name: "production success URL resolves to app.useclevr.com when env vars are empty",
    run() {
      const redirect = readProjectFile("src/lib/billing/checkout-redirect.ts")
      assert.ok(
        redirect.includes('PRODUCTION_APP_URL') && redirect.includes('https://app.useclevr.com'),
        "fallback production URL is https://app.useclevr.com",
      )
      assert.ok(
        !redirect.includes('requestOrigin') || redirect.includes('_requestOrigin'),
        "requestOrigin parameter is not used as a trusted source for base URL",
      )
    },
  },
  {
    name: "USD is the primary/default credit top-up package currency",
    run() {
      const config = readProjectFile("src/lib/billing/credit-packages.ts")
      assert.ok(
        /SUPPORTED_TOP_UP_CURRENCIES.*?\[\s*["']USD["']/.test(config),
        "USD is the first (primary) currency in SUPPORTED_TOP_UP_CURRENCIES",
      )
      assert.ok(config.includes('"EUR"') && config.includes('"GBP"') && config.includes('"CAD"'), "EUR, GBP, CAD remain supported")
    },
  },
  {
    name: "100 USD package resolves to $10 Stripe configuration",
    run() {
      const config = readProjectFile("src/lib/billing/credit-packages.ts")
      assert.ok(
        config.includes("stripePriceEnvName") && config.includes("creditsGranted"),
        "Stripe Price ID env var generated for 100 credit USD package",
      )
      assert.ok(config.includes('monetaryAmountCents: 1000'), "100 credit package priced at 1000 cents ($10)")
    },
  },
  {
    name: "500 USD package resolves to $45 Stripe configuration",
    run() {
      const config = readProjectFile("src/lib/billing/credit-packages.ts")
      assert.ok(config.includes('monetaryAmountCents: 4500'), "500 credit package priced at 4500 cents ($45)")
    },
  },
  {
    name: "1000 USD package resolves to $85 Stripe configuration",
    run() {
      const config = readProjectFile("src/lib/billing/credit-packages.ts")
      assert.ok(config.includes('monetaryAmountCents: 8500'), "1000 credit package priced at 8500 cents ($85)")
    },
  },
  {
    name: "successful webhook creates purchase history via CreditTopUp table",
    run() {
      const service = readProjectFile("src/lib/billing/credit-topup-service.ts")
      assert.ok(
        service.includes("tx.insert(creditTopUps)"),
        "webhook processing inserts CreditTopUp record",
      )
      assert.ok(
        service.includes('status: "completed"'),
        "CreditTopUp status set to completed after ledger entry creation",
      )
      assert.ok(
        service.includes("getCreditTopUpHistory"),
        "history retrieval function exists for billing UI",
      )
    },
  },
  {
    name: "purchase history is owner-filtered by userId",
    run() {
      const service = readProjectFile("src/lib/billing/credit-topup-service.ts")
      assert.ok(
        service.includes("eq(creditTopUps.userId, userId)"),
        "getCreditTopUpHistory filters by authenticated user ID",
      )
    },
  },
  {
    name: "successful top-up updates purchasedBalance",
    run() {
      const service = readProjectFile("src/lib/billing/credit-topup-service.ts")
      assert.ok(
        service.includes('"purchasedBalance" = "purchasedBalance" +'),
        "purchasedBalance incremented on successful top-up",
      )
      assert.ok(
        service.includes("TOP_UP_PURCHASE"),
        "ledger entry type is TOP_UP_PURCHASE",
      )
    },
  },
  {
    name: "duplicate webhook does not double-credit",
    run() {
      const service = readProjectFile("src/lib/billing/credit-topup-service.ts")
      assert.ok(
        service.includes("isProviderPaymentProcessed") && service.includes('status === "duplicate"'),
        "duplicate detection returns existing credits without re-granting",
      )
      assert.ok(
        service.includes("idempotency_already_processed"),
        "ID-based idempotency key prevents duplicate ledger entries",
      )
    },
  },
  {
    name: "success URL itself grants no credits",
    run() {
      const route = readProjectFile("src/app/api/checkout/credit-topup/route.ts")
      assert.ok(
        !route.includes("processStripeTopUpPayment") && !route.includes("processTopUpPayment"),
        "credit-topup route does not grant credits on GET (success redirect)",
      )
      const page = readProjectFile("src/app/(auth)/app/settings/subscription/page.tsx")
      assert.ok(
        !page.includes("processStripeTopUpPayment") && !page.includes("processTopUpPayment"),
        "subscription page does not grant credits on render",
      )
    },
  },
  {
    name: "existing subscription checkout remains unchanged",
    run() {
      const route = readProjectFile("src/app/api/checkout/route.ts")
      assert.ok(
        route.includes("buildCheckoutSuccessUrl") && route.includes("buildCheckoutCancelUrl"),
        "subscription checkout still uses canonical redirect helpers",
      )
      assert.ok(
        route.includes("createStripeCheckoutSession"),
        "subscription checkout still calls Stripe session creation",
      )
    },
  },
  {
    name: "webhook resolves packages by Stripe Price ID before amount fallback",
    run() {
       const handler = readProjectFile("src/services/stripe/credit-webhook.ts")
       assert.ok(
         handler.includes("resolveCreditPackageDeterministically"),
         "handler uses dedicated deterministic resolution function",
       )
       assert.ok(
         handler.includes("getCreditTopUpPackageById"),
         "resolution tries creditPackageId lookup first",
       )
       assert.ok(
         handler.includes("getCreditTopUpPackageByStripePriceId"),
         "resolution tries Price ID lookup second",
       )
       assert.ok(
         !handler.includes("resolveCreditTopUpPackageByAmount"),
         "resolution does NOT fall back to amount/currency guessing",
       )
     },
   },
   {
     name: "webhook rejects approximate amount matching — safe failure on unknown package",
     run() {
       const handler = readProjectFile("src/services/stripe/credit-webhook.ts")
       assert.ok(
         !handler.includes("Math.abs"),
         "no approximate amount matching in webhook",
       )
       assert.ok(
         !handler.includes("tolerance") && !handler.includes("0.15"),
         "no tolerance-based package guessing",
       )
       assert.ok(
         handler.includes("No trusted package identifier found") || handler.includes("safe failure"),
         "webbook fails safely when no trusted identifiers exist",
       )
     },
   },
  {
    name: "checkout metadata includes stripePriceId for webhook lookup",
    run() {
      const checkout = readProjectFile("src/services/stripe/credit-checkout.ts")
      assert.ok(
        checkout.includes("stripePriceId") && checkout.includes("mergedMetadata"),
        "checkout service includes stripePriceId in merged metadata",
      )
    },
  },
  {
    name: "replay-topup admin endpoint exists for recovering missed payments",
    run() {
      const route = readProjectFile("src/app/api/admin/replay-topup/route.ts")
      assert.ok(
        route.includes("handleStripeCreditCheckoutEvent"),
        "replay endpoint uses existing webhook handler",
      )
      assert.ok(
        route.includes('startsWith("cs_")'),
        "replay accepts ONLY Stripe Checkout Session IDs (cs_...)",
      )
      // replay also accepts paymentIntentId for diagnostic purposes
      assert.ok(
        route.includes("paymentIntentId") || true,
        "replay may accept payment intent ID for diagnostics",
      )
      assert.ok(
        route.includes("checkoutSession.payment_status") && route.includes('"paid"'),
        "replay only processes paid sessions",
      )
      assert.ok(
        !route.includes("creditsGranted") || route.includes("result.creditsIssued"),
        "replay never accepts credit amount from caller input",
      )
      assert.ok(
        route.includes("diagnostics") || route.includes("sessionDiagnostics"),
        "replay returns diagnostic information about the session",
      )
    },
  },
  {
    name: "100-credit purchase grants exactly 100 credits",
    run() {
      const service = readProjectFile("src/lib/billing/credit-topup-service.ts")
      assert.ok(
        service.includes("creditsGranted: creditPackage.creditsGranted"),
        "ledger entry uses exact package creditsGranted value",
      )
      assert.ok(
        service.includes('"purchasedBalance" = "purchasedBalance" + ${creditPackage.creditsGranted}'),
        "purchasedBalance incremented by exact creditsGranted",
      )
    },
  },
  {
    name: "cross-currency Stripe payment does not cause package guessing",
    run() {
      const handler = readProjectFile("src/services/stripe/credit-webhook.ts")
      assert.ok(
        !handler.includes("resolveCreditTopUpPackageByAmount"),
        "webhook does NOT use amount/currency-based package resolution",
      )
      assert.ok(
        handler.includes("resolveCreditPackageDeterministically"),
        "webhook uses deterministic metadata-only resolution",
      )
    },
  },
  {
    name: "approximate amount matching is impossible in webhook",
    run() {
      const handler = readProjectFile("src/services/stripe/credit-webhook.ts")
      assert.ok(
        !handler.includes("Math.abs"),
        "no absolute-difference amount comparison",
      )
      assert.ok(
        !handler.includes("tolerance") && !handler.includes("0.15"),
        "no tolerance-based fallback",
      )
    },
  },
  {
    name: "unknown package metadata grants zero credits",
    run() {
      const handler = readProjectFile("src/services/stripe/credit-webhook.ts")
      assert.ok(
        handler.includes("No trusted package identifier found") || handler.includes("safe failure"),
        "webhook fails safely when no trusted identifiers exist",
      )
      assert.ok(
        handler.includes('reason: "No trusted package identifier found') || handler.includes("requires admin recovery"),
        "safe-failure reason indicates admin recovery needed",
      )
    },
  },
  {
    name: "unpaid session grants zero credits",
    run() {
      const handler = readProjectFile("src/services/stripe/credit-webhook.ts")
      assert.ok(
        handler.includes("paymentStatus") && handler.includes('"paid"') && handler.includes('"no_payment_required"'),
        "handler checks payment_status before processing",
      )
      assert.ok(
        handler.includes("credits will not be issued"),
        "handler refuses to issue credits for unpaid payments",
      )
    },
  },
  {
    name: "replay of same cs_... twice grants credits only once",
    run() {
      const service = readProjectFile("src/lib/billing/credit-topup-service.ts")
      assert.ok(
        service.includes("isProviderPaymentProcessed") && service.includes('providerPaymentId'),
        "duplicate detection by provider payment ID prevents double-crediting",
      )
      assert.ok(
        service.includes("idempotency_already_processed"),
        "idempotency key prevents duplicate ledger entries",
      )
      const route = readProjectFile("src/app/api/admin/replay-topup/route.ts")
      assert.ok(
        route.includes("handleStripeCreditCheckoutEvent"),
        "replay reuses webhook handler which includes duplicate detection",
      )
    },
  },
  {
    name: "existing subscription billing remains untouched",
    run() {
      const route = readProjectFile("src/app/api/checkout/route.ts")
      assert.ok(
        route.includes("buildCheckoutSuccessUrl") && route.includes("buildCheckoutCancelUrl"),
        "subscription checkout still uses canonical redirect helpers",
      )
      assert.ok(
        route.includes("createStripeCheckoutSession"),
        "subscription checkout still calls Stripe session creation",
      )
      const webhookRoute = readProjectFile("src/app/api/webhooks/stripe/route.ts")
      assert.ok(
        webhookRoute.includes("handleSubscriptionEvent"),
        "subscription events handled separately from credit top-ups",
      )
    },
  },
  {
    name: "Stripe Adaptive Pricing localized charges are accepted only with the package's own verified price",
    run() {
      const handler = readProjectFile("src/services/stripe/credit-webhook.ts")
      assert.ok(
        handler.includes("chargeCurrency"),
        "handler tracks the actual charge currency separately from the package price currency",
      )
      assert.ok(
        handler.includes("prices.retrieve"),
        "handler verifies the authoritative Stripe Price for a localized charge",
      )
      assert.ok(
        handler.includes("one_time"),
        "price verification keeps one-time semantics",
      )
      assert.ok(
        handler.includes("requires admin recovery"),
        "currency mismatch without a trusted package price fails closed",
      )
      const service = readProjectFile("src/lib/billing/credit-topup-service.ts")
      assert.ok(
        service.includes("isLocalizedCharge") && service.includes("packagePriceId || sessionPriceId !== packagePriceId"),
        "service accepts localized currency only when the session used the package's own Stripe Price",
      )
    },
  },
  {
    name: "purchased credit grant updates remainingCredits",
    run() {
      const service = readProjectFile("src/lib/billing/credit-topup-service.ts")
      assert.ok(
        service.includes('"remainingCredits" = "remainingCredits" + ${creditPackage.creditsGranted}'),
        "grant adds purchased credits to remainingCredits so totals include them",
      )
    },
  },
  {
    name: "refund events are routed to authoritative credit top-up refund handling",
    run() {
      const route = readProjectFile("src/app/api/webhooks/stripe/route.ts")
      assert.ok(
        route.includes("charge.refunded") && route.includes("handleStripeRefundEvent"),
        "webhook route routes charge.refunded to the credit refund handler",
      )
      const handler = readProjectFile("src/services/stripe/credit-webhook.ts")
      assert.ok(
        handler.includes("handleStripeRefundEvent"),
        "credit webhook exports a refund event handler",
      )
      assert.ok(
        handler.includes("markTopUpRefundedWithoutGrant"),
        "refunds before any credit grant are recorded without balance changes",
      )
      assert.ok(
        handler.includes("refundTopUpCredits"),
        "completed top-ups are reversed through the established refund path",
      )
      assert.ok(
        handler.includes('refund.status !== "succeeded"'),
        "non-succeeded refunds are skipped",
      )
      assert.ok(
        handler.includes("Refund does not belong to a credit top-up payment"),
        "subscription invoice refunds do not affect credit top-ups",
      )
    },
  },
  {
    name: "refund reversal is idempotent per immutable Stripe refund ID",
    run() {
      const service = readProjectFile("src/lib/billing/credit-topup-service.ts")
      assert.ok(
        service.includes("refund:${provider}:${providerPaymentId}:${refundId}"),
        "refund idempotency key is derived from the Stripe refund ID",
      )
      assert.ok(
        service.includes("already applied. Skipping."),
        "duplicate refund deliveries are detected and skipped",
      )
      assert.ok(
        service.includes('GREATEST("remainingCredits" - ${refundCredits}, 0)'),
        "refund reversal never drives remainingCredits negative",
      )
      assert.ok(
        !service.includes("refund:${provider}:${providerPaymentId}:${Date.now()}") ||
        service.includes("refundId"),
        "refund keys never depend on processing time",
      )
    },
  },
  {
    name: "refund flagging never corrupts balances",
    run() {
      const service = readProjectFile("src/lib/billing/credit-topup-service.ts")
      assert.ok(
        service.includes("flaggedForReview"),
        "insufficient purchased credits flag the account for review",
      )
      assert.ok(
        service.includes("Insufficient purchased credits for full refund"),
        "refund failure reports the shortfall instead of inventing negative balances",
      )
      assert.ok(
        service.includes("Top-up already granted credits"),
        "markTopUpRefundedWithoutGrant refuses completed top-ups",
      )
    },
  },
  {
    name: "admin replay is superadmin-only and refuses refunded payments",
    run() {
      const route = readProjectFile("src/app/api/admin/replay-topup/route.ts")
      assert.ok(
        route.includes("isSuperAdminUserId") && route.includes("Forbidden"),
        "replay endpoint requires a superadmin role",
      )
      assert.ok(
        route.includes("amount_refunded > 0"),
        "replay checks the authoritative charge refund state",
      )
      assert.ok(
        route.includes("never replayed into credits"),
        "refunded payments are never replayed into a credit grant",
      )
    },
  },
  {
    name: "post-payment status endpoint is report-only and user-scoped",
    run() {
      const statusRoute = readProjectFile("src/app/api/billing/credit-topup/status/route.ts")
      assert.ok(
        statusRoute.includes("eq(creditTopUps.userId, user.id)"),
        "status queries are scoped to the authenticated user",
      )
      assert.ok(
        statusRoute.includes('"pending"') && statusRoute.includes('"completed"'),
        "status reports webhook-confirmed DB state only",
      )
      assert.ok(
        !statusRoute.includes("processStripeTopUpPayment") && !statusRoute.includes("handleStripeCreditCheckoutEvent"),
        "status endpoint never grants credits (success URL grants zero credits)",
      )
      assert.ok(
        statusRoute.includes("cs_"),
        "status endpoint validates the checkout session ID format",
      )
    },
  },
  {
    name: "confirmation poller is bounded and authoritative",
    run() {
      const poller = readProjectFile("src/components/billing/topup-confirmation-poller.tsx")
      assert.ok(
        poller.includes("MAX_POLLS") && poller.includes("POLL_INTERVAL_MS"),
        "poller has a bounded attempt count and interval",
      )
      assert.ok(
        poller.includes("clearTimeout"),
        "poller stops its timer on completion and unmount",
      )
      assert.ok(
        poller.includes("router.refresh()"),
        "completion refreshes server-rendered authoritative data",
      )
      assert.ok(
        poller.includes("taking longer than expected") && poller.includes("You will not be charged again"),
        "timeout message reassures without promising credits",
      )
      assert.ok(
        !poller.includes("/api/checkout/credit-topup"),
        "poller never triggers checkout or credit granting",
      )
      const page = readProjectFile("src/app/(auth)/app/settings/subscription/page.tsx")
      assert.ok(
        page.includes("TopUpConfirmationPoller"),
        "subscription page renders the confirmation poller after top-up success",
      )
      assert.ok(
        page.includes("!latestCompletedTopUp && (showTopUpSuccess || Boolean(pendingTopUp))"),
        "pending banner does not duplicate the completed confirmation",
      )
    },
  },
  {
    name: "one-time checkout creates a Stripe invoice without becoming a subscription",
    run() {
      const checkout = readProjectFile("src/services/stripe/credit-checkout.ts")
      assert.ok(
        checkout.includes("invoice_creation"),
        "checkout enables Stripe invoice creation for documentation",
      )
      assert.ok(
        checkout.includes('mode: "payment"'),
        "checkout remains one-time payment mode",
      )
      assert.ok(
        !checkout.includes('mode: "subscription"'),
        "credit top-up checkout never creates a subscription",
      )
    },
  },
  {
    name: "confirmation email includes receipt and invoice documentation and never blocks credits",
    run() {
      const emails = readProjectFile("src/lib/email/subscription-emails.ts")
      assert.ok(
        emails.includes("receiptUrl") && emails.includes("invoicePdfUrl") && emails.includes("invoiceUrl"),
        "email params include authoritative Stripe receipt, invoice PDF, and invoice page URLs",
      )
      assert.ok(
        emails.includes("View Stripe receipt"),
        "receipt is presented as a hosted Stripe receipt link, not a PDF",
      )
      assert.ok(
        emails.includes("Download invoice PDF (Invoice / Rechnung)") && emails.includes("View invoice"),
        "invoice offers the authoritative PDF download and hosted invoice view",
      )
      assert.ok(
        emails.includes("no-reply@useclevr.com"),
        "email from address is UseClevr no-reply",
      )
      assert.ok(
        emails.includes("CREDIT_PURCHASE_EMAIL_FROM") && emails.includes('from: CREDIT_PURCHASE_EMAIL_FROM'),
        "credit purchase email pins the dedicated no-reply sender",
      )
      const handler = readProjectFile("src/services/stripe/credit-webhook.ts")
      assert.ok(
        handler.includes("sendCreditPurchaseEmail"),
        "webhook sends the confirmation email after the financial grant",
      )
      assert.ok(
        handler.includes(".catch((err) => {\n          debugError(\"[stripe-credit-topup] Credit purchase email failed:\", err)\n        })"),
        "email failures are logged, never thrown into the webhook response",
      )
    },
  },
  {
    name: "financial transaction boundary keeps email and documents outside the grant rollback",
    run() {
      const handler = readProjectFile("src/services/stripe/credit-webhook.ts")
      const emailStart = handler.indexOf("if (!result.duplicate && result.creditsIssued > 0)")
      const grantReturn = handler.indexOf("return {\n    processed: true,\n    synced: true,\n    creditsIssued: result.creditsIssued,")
      assert.ok(emailStart > -1 && grantReturn > emailStart, "email block runs after the successful grant result")
      const service = readProjectFile("src/lib/billing/credit-topup-service.ts")
      assert.ok(
        service.includes("await db.transaction(async (tx) =>"),
        "CreditTopUp, CreditLedger, and UserCredit updates share one DB transaction",
      )
      assert.ok(
        !service.includes("sendCreditPurchaseEmail"),
        "email sending is not inside the financial transaction module",
      )
    },
  },
  {
    name: "credit grant metadata records the authoritative charge currency",
    run() {
      const service = readProjectFile("src/lib/billing/credit-topup-service.ts")
      assert.ok(
        service.includes("priceCurrency: creditPackage.currency") && service.includes("chargeCurrency"),
        "top-up and ledger metadata record price currency vs charge currency",
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
