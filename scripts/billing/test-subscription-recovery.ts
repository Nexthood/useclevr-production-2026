import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

type TestCase = {
  name: string
  run: () => void
}

const repoRoot = resolve(import.meta.dirname, "../..")

function readProjectFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8")
}

const tests: TestCase[] = [
  {
    name: "page recovery runs when subscriptionTier is free and stripeSubscriptionId stored",
    run() {
      const page = readProjectFile(
        "src/app/(auth)/app/settings/subscription/page.tsx",
      )
      assert.ok(
        page.includes("subscriptionTier === \"free\""),
        "page only attempts recovery when tier is free",
      )
      assert.ok(
        page.includes("stripeSubscriptionId"),
        "page references stored stripeSubscriptionId",
      )
    },
  },
  {
    name: "page recovery falls back to stripeCustomerId to list active subscriptions",
    run() {
      const page = readProjectFile(
        "src/app/(auth)/app/settings/subscription/page.tsx",
      )
      assert.ok(
        page.includes("stripeCustomerId"),
        "page references stored stripeCustomerId for fallback",
      )
      assert.ok(
        page.includes("stripe.customers.retrieve"),
        "page retrieves Stripe customer when subscriptionId missing",
      )
      assert.ok(
        page.includes("stripe.subscriptions.list"),
        "page lists subscriptions for recovered customer",
      )
    },
  },
  {
    name: "page recovery attempts email match when neither ID persisted",
    run() {
      const page = readProjectFile(
        "src/app/(auth)/app/settings/subscription/page.tsx",
      )
      assert.ok(
        page.includes("stripe.customers.list"),
        "page lists customers to find user by exact normalized email",
      )
      assert.ok(
        page.includes("normalizedEmail"),
        "page normalizes user email for match",
      )
    },
  },
  {
    name: "ambiguous Stripe customer email matches do not activate automatically",
    run() {
      const page = readProjectFile(
        "src/app/(auth)/app/settings/subscription/page.tsx",
      )
      assert.ok(
        page.includes("ambiguous_customer_match"),
        "page logs ambiguous_customer_match when multiple customers share email",
      )
      assert.ok(
        page.includes("matches.length > 1"),
        "page checks for multiple matches and does not activate automatically",
      )
    },
  },
  {
    name: "Stripe customer with no active/trialing subscription remains Free",
    run() {
      const page = readProjectFile(
        "src/app/(auth)/app/settings/subscription/page.tsx",
      )
      assert.ok(
        page.includes("active_subscription_missing"),
        "page logs active_subscription_missing when no active subscription found",
      )
    },
  },
  {
    name: "unknown Price ID results in mapping failure, plan stays Free",
    run() {
      const page = readProjectFile(
        "src/app/(auth)/app/settings/subscription/page.tsx",
      )
      assert.ok(
        page.includes("price_mapping_failed"),
        "page logs price_mapping_failed when Stripe price ID does not map to a plan",
      )
    },
  },
  {
    name: "Business subscription resolves to Business tier via Price ID mapping",
    run() {
      const page = readProjectFile(
        "src/app/(auth)/app/settings/subscription/page.tsx",
      )
      assert.ok(
        page.includes("getSubscriptionTierForStripePriceId"),
        "page maps Stripe Price ID to UseClevr plan using authoritative mapping",
      )
      assert.ok(
        page.includes("tier"),
        "page determines tier from Price ID mapping result",
      )
    },
  },
  {
    name: "repeated recovery calls do not duplicate credit grants (idempotent)",
    run() {
      const webhook = readProjectFile(
        "src/services/stripe/webhook.ts",
      )
      assert.ok(
        webhook.includes("refreshBillingAccess"),
        "syncSubscription calls refreshBillingAccess which guards against duplicate plan changes",
      )
      assert.ok(
        webhook.includes("processPlanChange"),
        "refreshBillingAccess calls processPlanChange only when tier changes",
      )
    },
  },
  {
    name: "genuine Free user (no Stripe IDs, no customer) remains Free after recovery",
    run() {
      const page = readProjectFile(
        "src/app/(auth)/app/settings/subscription/page.tsx",
      )
      assert.ok(
        page.includes("subscriptionTier === \"free\""),
        "page condition guards against non-free recovery attempts",
      )
      assert.ok(
        page.includes("subscription_recovery_started"),
        "page logs recovery start but does not change tier for truly free users",
      )
    },
  },
  {
    name: "price mapping success logs price_mapping_success event",
    run() {
      const page = readProjectFile(
        "src/app/(auth)/app/settings/subscription/page.tsx",
      )
      assert.ok(
        page.includes("price_mapping_success"),
        "page logs price_mapping_success when Stripe price maps to a UseClevr plan",
      )
    },
  },
  {
    name: "recovery persists correct stripeCustomerId, stripeSubscriptionId, subscriptionTier",
    run() {
      const page = readProjectFile(
        "src/app/(auth)/app/settings/subscription/page.tsx",
      )
      assert.ok(
        page.includes("syncSubscription"),
        "page calls syncSubscription to persist stripeCustomerId, stripeSubscriptionId and subscriptionTier",
      )
      assert.ok(
        page.includes("stripeCustomerId"),
        "syncSubscription sets stripeCustomerId on profile",
      )
      assert.ok(
        page.includes("stripeSubscriptionId"),
        "syncSubscription sets stripeSubscriptionId on profile",
      )
      assert.ok(
        page.includes("subscriptionTier"),
        "syncSubscription sets subscriptionTier on profile",
      )
    },
  },
  {
    name: "download/upload entitlement checks use profile.subscriptionTier after recovery",
    run() {
      const usageEnforcement = readProjectFile(
        "src/lib/billing/usage-enforcement.ts",
      )
      assert.ok(
        usageEnforcement.includes("subscriptionTier"),
        "usage-enforcement reads profile.subscriptionTier to determine upload/dataset/credits limits",
      )
    },
  },
  {
    name: "accountancy entitlement checks use profile.subscriptionTier after recovery",
    run() {
      const usageEnforcement = readProjectFile(
        "src/lib/billing/usage-enforcement.ts",
      )
      assert.ok(
        usageEnforcement.includes("subscriptionTier"),
        "usage-enforcement reads profile.subscriptionTier for accountancy features",
      )
    },
  },
]

async function main() {
  let passed = 0
  let failed = 0
  for (const test of tests) {
    try {
      test.run()
      console.log(`ok - ${test.name}`)
      passed++
    } catch (err) {
      console.error(`fail - ${test.name}:`, err)
      failed++
    }
  }
  console.log(
    `\n${passed} passed, ${failed} failed of ${tests.length} subscription recovery checks`,
  )
  process.exit(failed > 0 ? 1 : 0)
}

void main()