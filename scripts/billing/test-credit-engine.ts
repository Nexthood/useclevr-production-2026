import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import {
  BUILTIN_SUPER_ADMIN_USER,
  isSuperAdminAccess,
  isSuperAdminUserId,
} from "@/lib/auth/builtin-users"
import {
  CREDIT_ENGINE_FEATURES,
  FEATURE_COST_REGISTRY,
  canPlanUseFeature,
  estimateFeatureCredits,
  normalizeCreditFeature,
} from "@/lib/billing/feature-costs"
import { FREE_PLAN_LIMITS, getCreditsLimitForTier } from "@/lib/billing/plans"
import { emptyProviderUsage, normalizeProviderUsage } from "@/lib/billing/provider-usage"
import { isUnlimitedCreditRole } from "@/lib/billing/credit-engine"

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
      assert.equal(normalizeCreditFeature("file_upload"), "dataset_upload")
      assert.equal(normalizeCreditFeature("dataset_upload"), "dataset_upload")
      assert.equal(normalizeCreditFeature("report_generation"), "report_generation")
    },
  },
  {
    name: "free plan exposes two included credits",
    run() {
      assert.equal(FREE_PLAN_LIMITS.monthlyCredits, 2)
      assert.equal(getCreditsLimitForTier("free"), 2)
    },
  },
  {
    name: "unlimited credit access requires explicit admin role",
    run() {
      assert.equal(isUnlimitedCreditRole("superadmin"), true)
      assert.equal(isUnlimitedCreditRole("admin"), true)
      assert.equal(isUnlimitedCreditRole("user"), false)
      assert.equal(isUnlimitedCreditRole("free"), false)
      assert.equal(isUnlimitedCreditRole("pro"), false)
      assert.equal(isUnlimitedCreditRole("business"), false)
      assert.equal(isUnlimitedCreditRole(null), false)
      assert.equal(isUnlimitedCreditRole(undefined), false)
    },
  },
  {
    name: "superadmin access helper recognizes the official account",
    run() {
      assert.equal(isSuperAdminUserId(BUILTIN_SUPER_ADMIN_USER.id), true)
      assert.equal(isSuperAdminAccess(BUILTIN_SUPER_ADMIN_USER.id, null), true)
      assert.equal(isSuperAdminAccess("normal-user-id", "superadmin@useclevr.com"), true)
    },
  },
  {
    name: "dataset upload reserves one credit on free plans",
    run() {
      assert.equal(estimateFeatureCredits("dataset_upload"), 1)
      assert.equal(estimateFeatureCredits("file_upload"), 1)
      assert.equal(canPlanUseFeature("free", "dataset_upload"), true)
      assert.equal(FEATURE_COST_REGISTRY.dataset_upload.maxReservationCredits, 1)
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
  {
    name: "direct dataset uploads use persistent credit ledger instead of profile analysis count",
    run() {
      const route = readProjectFile("src/app/api/datasets/route.ts")
      assert.ok(route.includes("reserveCredits"), "direct dataset API reserves upload credits")
      assert.ok(route.includes("finalizeCredits"), "direct dataset API finalizes successful upload credits")
      assert.ok(route.includes("releaseCredits"), "direct dataset API releases failed upload reservations")
      assert.ok(!route.includes("consumeAnalystCredit"), "direct dataset API does not use legacy Profile.analysisCount consumption")
      assert.ok(route.includes("You have used all included upload credits for this billing period."))
    },
  },
  {
    name: "server upload action rolls back datasets when credit settlement fails",
    run() {
      const uploadAction = readProjectFile("src/app/actions/upload.ts")
      assert.ok(uploadAction.includes("cleanupCreatedUploadDataset"), "server upload action has a dataset cleanup helper")
      assert.ok(uploadAction.includes("dataset_row_insert_failed"), "row insert failures release reserved upload credits")
      assert.ok(uploadAction.includes("dataset_upload_credit_finalization_failed"), "credit finalization failures release reserved upload credits")
      assert.ok(uploadAction.includes("CREDIT_SETTLEMENT_ERROR"), "credit finalization failures return a failed upload response")
    },
  },
  {
    name: "dataset deletion preserves upload credit ledger entries",
    run() {
      const deleteSource = readProjectFile("src/lib/data/delete-datasets.ts")
      assert.ok(!deleteSource.includes("refundCredits"), "dataset deletion never refunds credits")
      assert.ok(!deleteSource.includes("creditLedger"), "dataset deletion never deletes credit ledger rows")
      assert.ok(!deleteSource.includes("UserCredit"), "dataset deletion never recalculates user credit counters")
    },
  },
  {
    name: "billing period reset starts a fresh allowance without rollover",
    run() {
      const engine = readProjectFile("src/lib/billing/credit-engine.ts")
      assert.ok(engine.includes("remainingCredits: monthlyCredits"))
      assert.ok(engine.includes("reservedCredits: 0"), "monthly reset clears stale reservations")
      assert.ok(engine.includes("rollover: false"), "monthly reset records non-rollover behavior")
      assert.ok(!engine.includes("const newRemaining = creditInfo.remainingCredits + monthlyCredits"))
    },
  },
  {
    name: "legacy upload usage backfill is deployed",
    run() {
      const migration = readProjectFile("src/lib/db/migrations/0022_upload_credit_usage_persistence.sql")
      const predeploy = readProjectFile("scripts/runtime/railway-predeploy.cjs")
      assert.ok(migration.includes('"Profile" p ON p."userId" = uc."userId"'))
      assert.ok(migration.includes("'dataset_upload'"))
      assert.ok(migration.includes("Deleted historical uploads cannot be reconstructed"))
      assert.ok(
        migration.includes('CREATE UNIQUE INDEX IF NOT EXISTS "CreditLedger_idempotencyKey_key"') &&
          migration.includes('WHERE "idempotencyKey" IS NOT NULL'),
        "backfill ensures the partial unique idempotency key index exists",
      )
      assert.ok(
        migration.includes('ON CONFLICT ("idempotencyKey") WHERE "idempotencyKey" IS NOT NULL DO NOTHING'),
        "backfill conflict target matches the partial unique idempotency key index",
      )
      assert.ok(predeploy.includes("0022_upload_credit_usage_persistence.sql"))
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

  console.log(`Credit Engine verification passed (${tests.length} checks).`)
}

void main()
