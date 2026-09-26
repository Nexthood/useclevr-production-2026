import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { billingPlans, getBillingPlanByTier } from "@/lib/billing/plans"
import { canPlanUseFeature, estimateFeatureCredits } from "@/lib/billing/feature-costs"

type TestCase = {
  name: string
  run: () => Promise<void> | void
}

function readProjectFile(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8")
}

const tests: TestCase[] = [
  {
    name: "predeploy sync runs the credit engine migration that seeds SubscriptionPlan",
    run() {
      const predeploy = readProjectFile("scripts/runtime/railway-predeploy.cjs")
      assert.ok(
        predeploy.includes('readMigrationStatement("src/lib/db/migrations/0012_credit_engine.sql")'),
        "predeploy must run 0012_credit_engine.sql (SubscriptionPlan seed + credit tables)",
      )
      assert.ok(
        predeploy.indexOf("0012_credit_engine.sql") <
          predeploy.indexOf("0022_upload_credit_usage_persistence.sql"),
        "0012 must run before 0022 so UserCredit/CreditLedger exist before their ALTERs",
      )
      assert.ok(
        predeploy.includes('readMigrationStatement("src/lib/db/migrations/0008_dataset_type.sql")'),
        "predeploy must run 0008_dataset_type.sql so Dataset.datasetType converges",
      )
    },
  },
  {
    name: "SubscriptionPlan seed covers every plan id the credit engine writes",
    run() {
      const migration = readProjectFile("src/lib/db/migrations/0012_credit_engine.sql")
      for (const plan of billingPlans) {
        assert.ok(
          migration.includes(`('${plan.id}',`),
          `0012 seed must contain plan id ${plan.id}`,
        )
      }
      assert.equal(getBillingPlanByTier("free").id, "free")
      assert.equal(getBillingPlanByTier("pro").id, "pro_monthly")
      assert.equal(getBillingPlanByTier("business").id, "business_monthly")
    },
  },
  {
    name: "standard upload analysis charges the full ten-credit feature on every plan",
    run() {
      assert.equal(canPlanUseFeature("pro", "standard_upload_analysis"), true)
      assert.equal(estimateFeatureCredits("standard_upload_analysis"), 10)
      assert.equal(canPlanUseFeature("free", "standard_upload_analysis"), true)
      assert.equal(canPlanUseFeature("pro", "profitability_analysis"), true)
    },
  },
  {
    name: "initializeUserCredits repairs the plan catalog before failing",
    run() {
      const engine = readProjectFile("src/lib/billing/credit-engine.ts")
      assert.ok(
        engine.includes("ensureSubscriptionPlanSeeded(plan.id)"),
        "initializeUserCredits must attempt SubscriptionPlan repair on insert failure",
      )
      assert.ok(
        engine.includes("onConflictDoNothing") &&
          engine.includes("subscriptionPlans"),
        "plan catalog repair must insert idempotently",
      )
    },
  },
  {
    name: "reserveCredits reuses only the pending reservation of the same operation",
    run() {
      const engine = readProjectFile("src/lib/billing/credit-engine.ts")
      assert.ok(
        engine.includes("const isReusablePending =") &&
          engine.includes("existing.status === \"pending\"") &&
          engine.includes("existing.operationId === operationId"),
        "reservation reuse must require pending status and a matching operationId",
      )
      assert.ok(
        engine.includes("idempotencyKey = `${idempotencyKey}::${operationId}`"),
        "fresh attempts after finalized entries must mint a new ledger key",
      )
      assert.ok(
        engine.includes("releaseStalePendingReservations(input.userId, 60)"),
        "a rejected reservation must reclaim stale pending reservations and retry once",
      )
    },
  },
  {
    name: "reservation rejection emits structured server diagnostics",
    run() {
      const engine = readProjectFile("src/lib/billing/credit-engine.ts")
      assert.ok(
        engine.includes("[CREDIT_RESERVATION] reservation_rejected"),
        "reserveCredits must log the rejection reason",
      )
      for (const field of [
        "subscriptionTier",
        "userCreditPlanId",
        "includedBalance",
        "purchasedBalance",
        "remainingCredits",
        "reservedCredits",
        "estimatedCredits",
        "idempotencyKey",
        "reservationUpdateMatched",
      ]) {
        assert.ok(
          engine.includes(field),
          `reservation diagnostics must include ${field}`,
        )
      }
      assert.ok(
        !engine.includes("email: input.email"),
        "reservation diagnostics must not log email addresses",
      )
    },
  },
  {
    name: "dataset library shows rows persisted without a datasetType",
    run() {
      const page = readProjectFile("src/app/(auth)/app/datasets/page.tsx")
      assert.ok(
        page.includes("or(isNull(datasets.datasetType), ne(datasets.datasetType, \"prebookkeeping\"))"),
        "library filter must keep NULL datasetType rows visible",
      )
      assert.ok(
        page.includes("[DATASET_LIBRARY] empty_result"),
        "empty library results must be observable in server logs" 	,
      )
      assert.ok(
        page.includes("[DATASET_LIBRARY] query_failed"),
        "library query failures must be observable in server logs",
      )
    },
  },
  {
    name: "clevrsync persistence keeps dataset_type and source metadata",
    run() {
      const syncRoute = readProjectFile("src/app/api/clevrsync/sync/route.ts")
      assert.ok(
        syncRoute.includes('uploadFormData.set("dataset_type", "standard")') &&
          syncRoute.includes('uploadFormData.set("uploadMode", "standard")'),
        "the clevrsync sync path must set the shared upload contract fields",
      )
      assert.equal(
        syncRoute.split('uploadFormData.set("dataset_type", "standard")').length - 1,
        2,
        "each clevrsync sync path (Google Sheets + Microsoft) must set dataset_type exactly once",
      )
      assert.ok(
        syncRoute.includes('uploadFormData.set("uploadSource", "clevrsync")'),
        "clevrsync datasets must keep their source marker",
      )
      const uploadAction = readProjectFile("src/app/actions/upload.ts")
      assert.ok(
        uploadAction.includes("explicitUploadSource || fileType || datasetCategory"),
        "persisted analysis must prefer the explicit uploadSource form field",
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
