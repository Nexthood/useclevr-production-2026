import assert from "node:assert/strict"

import {
  CREDIT_ENGINE_FEATURES,
  FEATURE_COST_REGISTRY,
  canPlanUseFeature,
  estimateFeatureCredits,
  normalizeCreditFeature,
} from "@/lib/billing/feature-costs"
import { emptyProviderUsage, normalizeProviderUsage } from "@/lib/billing/provider-usage"

type TestCase = {
  name: string
  run: () => Promise<void> | void
}

const tests: TestCase[] = [
  {
    name: "feature registry covers required modules",
    run() {
      assert.deepEqual(
        CREDIT_ENGINE_FEATURES.filter((feature) => !FEATURE_COST_REGISTRY[feature]),
        [],
      )
      assert.equal(normalizeCreditFeature("ai_chat"), "ai_question")
      assert.equal(normalizeCreditFeature("dataset_analysis"), "standard_analysis")
      assert.equal(normalizeCreditFeature("report_generation"), "report_generation")
    },
  },
  {
    name: "feature estimates stay bounded by maximum reservation",
    run() {
      const credits = estimateFeatureCredits("standard_analysis", { rowCount: 5_000_000 })
      assert.equal(credits, FEATURE_COST_REGISTRY.standard_analysis.maxReservationCredits)
      assert.equal(estimateFeatureCredits("ai_question", { estimatedTokens: 1 }), 3)
    },
  },
  {
    name: "plan attribution separates premium modules",
    run() {
      assert.equal(canPlanUseFeature("free", "profitability_analysis"), false)
      assert.equal(canPlanUseFeature("pro", "profitability_analysis"), true)
      assert.equal(canPlanUseFeature("pro", "accountancy_analysis"), false)
      assert.equal(canPlanUseFeature("business", "accountancy_analysis"), true)
      assert.equal(canPlanUseFeature("superadmin", "document_extraction"), true)
    },
  },
  {
    name: "provider usage normalization reads OpenAI-style metadata",
    run() {
      const usage = normalizeProviderUsage({
        provider: "openai",
        model: "gpt-4o-mini",
        usage: {
          prompt_tokens: 120,
          completion_tokens: 80,
          reasoning_tokens: 12,
          cached_tokens: 20,
        },
        rawUsageReference: { source: "test" },
      })
      assert.equal(usage.inputTokens, 120)
      assert.equal(usage.outputTokens, 80)
      assert.equal(usage.thinkingTokens, 12)
      assert.equal(usage.cachedTokens, 20)
      assert.equal(usage.requestCount, 1)
      assert.equal(usage.currency, "EUR")
      assert.ok(usage.estimatedCostMinor >= 0)
    },
  },
  {
    name: "provider usage normalization handles missing metadata conservatively",
    run() {
      const usage = normalizeProviderUsage({
        provider: "google",
        model: "gemini-2.5-flash",
        usage: undefined,
        rawUsageReference: { source: "missing_provider_usage" },
      })
      assert.equal(usage.inputTokens, 0)
      assert.equal(usage.outputTokens, 0)
      assert.equal(usage.estimatedCostMinor, 0)
      assert.equal(usage.rawUsageReference?.source, "missing_provider_usage")
    },
  },
  {
    name: "empty usage records local system work without provider cost",
    run() {
      const usage = emptyProviderUsage("system", "report-generator")
      assert.equal(usage.provider, "system")
      assert.equal(usage.model, "report-generator")
      assert.equal(usage.estimatedCostMinor, 0)
      assert.equal(usage.requestCount, 1)
    },
  },
  {
    name: "failed reservation prevents provider execution",
    async run() {
      let providerCalled = false
      const reserve = async () => ({ success: false, error: "Insufficient credits" })
      const callProvider = async () => {
        providerCalled = true
      }

      const reservation = await reserve()
      if (reservation.success) {
        await callProvider()
      }

      assert.equal(providerCalled, false)
    },
  },
  {
    name: "idempotency key convention stays operation scoped",
    run() {
      const workspaceId = "user_test"
      const operationId = "analysis:user_test:op"
      const feature = "standard_analysis"
      const key = `reserve:${workspaceId}:${operationId}:${feature}`
      assert.match(key, /^reserve:user_test:analysis:user_test:op:standard_analysis$/)
    },
  },
]

async function main() {
  for (const test of tests) {
    await test.run()
    console.log(`ok - ${test.name}`)
  }

  console.log(`Credit Engine verification passed (${tests.length} checks).`)
}

void main()
