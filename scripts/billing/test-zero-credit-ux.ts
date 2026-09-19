import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { CREDIT_TOP_UPS_BILLING_HREF } from "@/lib/billing/credit-topup-navigation"
import {
  buildCreditExhaustionStateFromUsage,
  planUsableCredits,
  usableCreditsFromBalances,
} from "@/lib/billing/credit-exhaustion"

type TestCase = {
  name: string
  run: () => Promise<void> | void
}

function readProjectFile(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8")
}

const tests: TestCase[] = [
  {
    name: "Free zero-credit state upgrades instead of offering top-ups",
    run() {
      const state = buildCreditExhaustionStateFromUsage({
        tier: "free",
        remainingCredits: 0,
        reservedCredits: 0,
        includedBalance: 0,
        purchasedBalance: 0,
        requiredCredits: 1,
      })
      assert.equal(state.tier, "free")
      assert.equal(state.reason, "zero_credits")
      assert.equal(state.usableCredits, 0)
      assert.equal(state.cta.action, "upgrade")
      assert.equal(state.cta.href, "/app/settings/checkout?plan=pro_monthly&discount=auto")
      assert.equal(state.title, "Free credits exhausted")
      assert.match(state.message, /Upgrade to Pro or Business/)
    },
  },
  {
    name: "Free zero-credit state counts preserved purchased credits as usable",
    run() {
      const exhausted = buildCreditExhaustionStateFromUsage({
        tier: "free",
        remainingCredits: 0,
        reservedCredits: 0,
        includedBalance: 0,
        purchasedBalance: 0,
        requiredCredits: 1,
      })
      assert.equal(exhausted.usableCredits, 0)
      assert.equal(exhausted.reason, "zero_credits")
      assert.equal(exhausted.cta.action, "upgrade")
      assert.equal(exhausted.cta.href, "/app/settings/checkout?plan=pro_monthly&discount=auto")
      assert.equal(exhausted.title, "Free credits exhausted")
      assert.match(exhausted.message, /Upgrade to Pro or Business/)

      const preserved = buildCreditExhaustionStateFromUsage({
        tier: "free",
        remainingCredits: 5,
        reservedCredits: 0,
        includedBalance: 0,
        purchasedBalance: 5,
        requiredCredits: 10,
      })
      assert.equal(preserved.usableCredits, 5, "preserved purchased credits must count toward the usable balance")
      assert.equal(preserved.reason, "insufficient_credits")
      assert.equal(preserved.cta.action, "upgrade", "Free must upgrade instead of purchasing top-ups")
      assert.match(preserved.message, /cannot purchase top-ups/i)
    },
  },
  {
    name: "Free partial balance reports insufficient credits with the upgrade CTA",
    run() {
      const state = buildCreditExhaustionStateFromUsage({
        tier: "free",
        remainingCredits: 2,
        reservedCredits: 0,
        includedBalance: 2,
        requiredCredits: 10,
      })
      assert.equal(state.usableCredits, 2)
      assert.equal(state.reason, "insufficient_credits")
      assert.equal(state.cta.action, "upgrade")
      assert.equal(state.title, "Not enough credits")
    },
  },  {
    name: "Pro zero-credit state shows the Add Credits top-up CTA",
    run() {
      const state = buildCreditExhaustionStateFromUsage({
        tier: "pro",
        remainingCredits: 0,
        reservedCredits: 0,
        includedBalance: 0,
        purchasedBalance: 0,
        requiredCredits: 10,
      })
      assert.equal(state.tier, "pro")
      assert.equal(state.reason, "zero_credits")
      assert.equal(state.usableCredits, 0)
      assert.equal(state.cta.action, "add_credits")
      assert.equal(state.cta.href, CREDIT_TOP_UPS_BILLING_HREF)
      assert.equal(state.cta.href, "/app/settings/subscription?tab=billing#credit-topups")
      assert.equal(state.title, "Out of credits")
    },
  },
  {
    name: "Business zero-credit state shows the Add Credits top-up CTA",
    run() {
      const state = buildCreditExhaustionStateFromUsage({
        tier: "business",
        remainingCredits: 0,
        reservedCredits: 0,
        includedBalance: 0,
        purchasedBalance: 0,
        requiredCredits: 10,
      })
      assert.equal(state.tier, "business")
      assert.equal(state.cta.action, "add_credits")
      assert.equal(state.cta.href, CREDIT_TOP_UPS_BILLING_HREF)
    },
  },
  {
    name: "Pro reserved credits reduce the usable balance for the CTA copy",
    run() {
      const state = buildCreditExhaustionStateFromUsage({
        tier: "pro",
        remainingCredits: 4,
        reservedCredits: 2,
        includedBalance: 4,
        purchasedBalance: 0,
        requiredCredits: 10,
      })
      assert.equal(state.usableCredits, 2)
      assert.equal(state.reason, "insufficient_credits")
      assert.equal(state.cta.action, "add_credits")
      assert.match(state.message, /Add credits to continue/)
    },
  },
  {
    name: "usable balances never go negative",
    run() {
      assert.equal(usableCreditsFromBalances(1, 3), 0)
      assert.equal(usableCreditsFromBalances(-5, 0), 0)
      assert.equal(usableCreditsFromBalances(10, 2), 8)
      assert.equal(planUsableCredits("free", { remainingCredits: 5, reservedCredits: 7, includedBalance: 2 }), 0)
      assert.equal(planUsableCredits("business", { remainingCredits: 3, reservedCredits: 9, includedBalance: 3 }), 0)
    },
  },
  {
    name: "zero-credit payloads ship from every credit-consuming API route",
    run() {
      const analyze = readProjectFile("src/app/api/analyze/route.ts")
      assert.ok(
        analyze.includes("creditState: await buildCreditExhaustionState"),
        "analyze 402 must embed an authoritative creditState payload",
      )
      const chat = readProjectFile("src/app/api/chat/route.ts")
      assert.ok(
        chat.includes("creditState: await buildCreditExhaustionState"),
        "chat 402 must embed an authoritative creditState payload",
      )
      const reports = readProjectFile("src/app/api/reports/generate/route.ts")
      assert.ok(
        reports.includes("creditState: await buildCreditExhaustionState"),
        "report generation 402 must embed an authoritative creditState payload",
      )
      const uploadSimple = readProjectFile("src/app/api/upload/simple/route.ts")
      assert.ok(
        uploadSimple.split("creditState: await buildCreditExhaustionState").length - 1 >= 2,
        "both upload/simple exhaustion paths must embed creditState",
      )
      const upload = readProjectFile("src/app/api/upload/route.ts")
      assert.ok(
        upload.includes("buildCreditExhaustionStateFromUsage"),
        "upload 402 must embed a tier-aware creditState payload",
      )
    },
  },
  {
    name: "modal renders only from the authoritative server payload",
    run() {
      const modal = readProjectFile("src/components/shared/zero-credit-modal.tsx")
      assert.ok(
        modal.includes("record.creditState"),
        "modal must read the server-issued creditState payload, not a client estimate",
      )
      assert.ok(
        modal.includes("state.usableCredits"),
        "modal must display the authoritative usable-credit balance",
      )
      assert.ok(
        modal.includes("USAGE_REFRESH_EVENT"),
        "exhaustion must refresh the authoritative usage balances",
      )
      assert.ok(
        modal.includes("state.cta.href || CREDIT_TOP_UPS_BILLING_HREF"),
        "paid plans must link Add Credits to the billing credit-topups anchor",
      )
      assert.ok(
        modal.includes('"/app/settings/checkout?plan=pro_monthly&discount=auto"') &&
          modal.includes('"/app/settings/checkout?plan=business_monthly"'),
        "free plans must offer Pro and Business upgrade CTAs",
      )
      assert.ok(
        !modal.includes("fetch("),
        "modal must stay display-only so the UI cannot bypass server enforcement",
      )
    },
  },
  {
    name: "AI surfaces route 402 responses into the zero-credit modal",
    run() {
      for (const surface of [
        "src/components/chat/chat-panel.tsx",
        "src/components/chat/ai-chat-interface.tsx",
        "src/components/retail/retail-inventory-client.tsx",
      ]) {
        const file = readProjectFile(surface)
        assert.ok(
          file.includes("zeroCredit.openFromResponse(") || file.includes("zeroCredit.openFromPayload("),
          `${surface} must inspect 402 responses for the authoritative payload`,
        )
        assert.ok(
          file.includes("<ZeroCreditModal"),
          `${surface} must render the zero-credit modal`,
        )
      }
      const uploadForm = readProjectFile("src/components/forms/csv-upload.tsx")
      assert.ok(
        uploadForm.includes("parseCreditExhaustionPayload(result)"),
        "upload surface must use the server-issued creditState payload",
      )
      assert.ok(
        uploadForm.includes('creditState.tier !== "free"'),
        "paid upload failures must use the Add Credits modal instead of the Free upgrade modal",
      )
      assert.ok(
        uploadForm.includes("<ZeroCreditModal"),
        "upload surface must render the zero-credit modal",
      )
    },
  },
  {
    name: "sidebar hides the top-up purchase CTA on Free while purchased credits show as usable",
    run() {
      const monitor = readProjectFile("src/components/ui/usage-monitor.tsx")
      assert.equal(
        monitor.split("<AddCreditsLink").length - 1,
        1,
        "the + Add Credits purchase CTA must render only in the paid-plan variant",
      )
      assert.ok(
        monitor.includes('const isPaidPlan = isPro || subscriptionTier === "pro" || subscriptionTier === "business"'),
        "the paid-plan branch must own the Add Credits purchase CTA",
      )
      assert.ok(
        monitor.split("<UpgradeLink").length - 1 >= 2,
        "both Free variants must offer the Upgrade to Pro action instead of a purchase CTA",
      )
      assert.ok(
        monitor.includes("Your purchased credits remain usable on the Free plan."),
        "the Free card must keep showing preserved purchased credits as usable",
      )
      const checkoutGate = readProjectFile("src/app/api/checkout/credit-topup/route.ts")
      assert.ok(
        checkoutGate.includes('accountTier !== "pro" && accountTier !== "business"'),
        "the server-side checkout gate must keep Free from purchasing top-ups",
      )
    },
  },
  {
    name: "server-side credit enforcement keeps guarding concurrent requests",
    run() {
      const engine = readProjectFile("src/lib/billing/credit-engine.ts")
      assert.ok(
        engine.includes('AND ("remainingCredits" - "reservedCredits") >= ${estimatedCredits}'),
        "reservations must be rejected by an atomic conditional UPDATE so concurrent requests cannot overdraw",
      )
      assert.ok(
        engine.includes('GREATEST(0, "reservedCredits"'),
        "reservation release must clamp at zero",
      )
      assert.ok(
        engine.includes('"includedBalance" = GREATEST(0, "includedBalance"'),
        "finalization must clamp the included balance at zero",
      )
      assert.ok(
        engine.includes('"purchasedBalance" - GREATEST(0,'),
        "purchased balance debits must clamp at zero",
      )
      const exhaustion = readProjectFile("src/lib/billing/credit-exhaustion.ts")
      assert.ok(
        exhaustion.includes("Math.max(0,"),
        "exhaustion payloads must clamp balances at zero before responding",
      )
    },
  },
]

async function main() {
  let passed = 0
  let failed = 0
  for (const test of tests) {
    try {
      await test.run()
      passed++
      console.log(`PASS ${test.name}`)
    } catch (error) {
      failed++
      console.error(`FAIL ${test.name}`)
      console.error(error instanceof Error ? error.message : String(error))
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

void main()
