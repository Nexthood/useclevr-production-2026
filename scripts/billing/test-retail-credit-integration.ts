import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import { FEATURE_CREDIT_COSTS, estimateFeatureCredits, normalizeCreditFeature } from "../../src/lib/billing/feature-costs"

type TestCase = {
  name: string
  run: () => Promise<void> | void
}

function readProjectFile(relativePath: string) {
  return readFileSync(`${process.cwd()}/${relativePath}`, "utf8")
}

const tests: TestCase[] = [
  {
    name: "retail analysis maps onto the authoritative standard upload+analysis feature (10 credits, no duplicate constant)",
    run() {
      assert.equal(normalizeCreditFeature("retail_analysis"), "standard_upload_analysis")
      assert.equal(estimateFeatureCredits("retail_analysis"), 10)
      assert.equal(estimateFeatureCredits("standard_upload_analysis"), FEATURE_CREDIT_COSTS.STANDARD_UPLOAD_ANALYSIS)

      const client = readProjectFile("src/components/retail/retail-inventory-client.tsx")
      assert.ok(!client.includes("RETAIL_CREDIT_COST"), "no retail-specific credit constant may exist")
      assert.ok(!client.includes("retail_analysis"), "retail upload must not mint a separate retail feature name")
      assert.ok(client.includes('uploadMode: "retail"'), "retail uploads keep the shared retail upload mode")
    },
  },
  {
    name: "retail upload failure never degrades into a free completed analysis",
    run() {
      const client = readProjectFile("src/components/retail/retail-inventory-client.tsx")

      assert.ok(client.includes("setState(\"error\")"), "failed retail uploads surface an error state")
      assert.ok(!client.includes("startAnalysis(null, data)"), "failed uploads must not run the free local analysis fallback")
      assert.ok(!client.includes("Continuing with local analysis"), "the silent free-analysis fallback copy is removed")
      assert.ok(client.includes("parseCreditExhaustionPayload"), "retail surfaces the structured insufficient-credit state")
    },
  },
  {
    name: "retail upload refreshes the authoritative credit UI",
    run() {
      const client = readProjectFile("src/components/retail/retail-inventory-client.tsx")
      assert.ok(client.includes("USAGE_REFRESH_EVENT"), "retail dispatches the shared usage refresh event")
      const eventUses = client.split("USAGE_REFRESH_EVENT").length - 1
      assert.ok(eventCallsExcludingImport(client, "USAGE_REFRESH_EVENT") >= 2, "retail refreshes credits after success and after failure")
    },
  },
  {
    name: "the automatic first retail analysis is included in the upload's single credit transaction",
    run() {
      const client = readProjectFile("src/components/retail/retail-inventory-client.tsx")
      assert.ok(client.includes("initialAnalysis: true"), "retail marks its automatic first analysis as the included upload analysis")

      const schema = readProjectFile("src/lib/validation.ts")
      assert.ok(schema.includes("initialAnalysis"), "analyze schema accepts the included-initial-analysis marker")

      const route = readProjectFile("src/app/api/analyze/route.ts")
      assert.ok(route.includes("initialAnalysisGranted"), "analyze skips the separate ai_question reservation for the granted initial analysis")
      assert.ok(route.includes("consumeIncludedInitialAnalysis"), "the included analysis is granted exactly once per dataset")

      const grant = readProjectFile("src/lib/usage/initial-analysis.ts")
      assert.ok(grant.includes("initialAnalysisConsumed"), "consumed grants are persisted on the dataset")
      assert.ok(grant.includes('COALESCE("analysis"->>\'initialAnalysisConsumed\', \'false\') <> \'true\''), "the grant is consumed atomically and cannot be replayed")
      assert.ok(grant.includes("createdAt"), "the grant only applies to freshly uploaded datasets")
    },
  },
  {
    name: "13 → 3 settlement: the retail upload path reserves and finalizes 10 credits once",
    run() {
      const uploadAction = readProjectFile("src/app/actions/upload.ts")
      assert.ok(uploadAction.includes('feature: "standard_upload_analysis"'), "the shared retail upload path reserves the 10-credit feature")
      assert.ok(uploadAction.includes("finalizeCredits"), "the shared upload path finalizes the reservation")
      assert.ok(uploadAction.includes("releaseCredits(uploadCreditOperationId"), "upload failures release the reservation instead of stranding it")

      const engine = readProjectFile("src/lib/billing/credit-engine.ts")
      assert.ok(engine.includes('"remainingCredits" - "reservedCredits") >= ${estimatedCredits}'), "reservation rejects attempts above the available balance")
      assert.ok(engine.includes("GREATEST(0, \"reservedCredits\""), "finalization releases unused reservation headroom")
      assert.ok(engine.includes("releaseCreditsForOperation"), "failed operations release their reservation")
    },
  },
  {
    name: "failed AI analysis requests release their reservation instead of stranding credits",
    run() {
      const route = readProjectFile("src/app/api/analyze/route.ts")
      for (const reason of [
        "dataset_not_found",
        "dataset_load_failed",
        "request_data_load_failed",
        "no_dataset_loaded",
        "query_execution_failed",
        "no_matching_results",
        "ai_provider_failed",
        "analysis_request_failed",
        "local_ai_unavailable",
      ]) {
        assert.ok(
          route.includes(`releaseCredits(creditOperationId, "${reason}")`),
          `analyze must release its reservation on ${reason}`,
        )
      }
    },
  },
  {
    name: "double submit cannot double-charge: reservation reuse and idempotent dataset creation stay intact",
    run() {
      const engine = readProjectFile("src/lib/billing/credit-engine.ts")
      assert.ok(engine.includes("const isReusablePending ="), "pending reservations of the same operation are reused, not duplicated")
      assert.ok(engine.includes("onConflictDoNothing()"), "duplicate finalize replay stays idempotent")

      const client = readProjectFile("src/components/retail/retail-inventory-client.tsx")
      assert.ok(client.includes("activeUploadRef"), "the retail client guards against concurrent double uploads")
    },
  },
  {
    name: "accountancy uploads share the same reservation lifecycle",
    run() {
      const credits = readProjectFile("src/lib/accountancy/upload-credits.ts")
      assert.ok(credits.includes('feature: ACCOUNTANCY_UPLOAD_FEATURE'), "accountancy reservation goes through the centralized feature cost")
      assert.ok(credits.includes('"standard_upload_analysis" as const'), "the accountancy feature identifier is the authoritative upload feature")
      assert.ok(credits.includes("reserveCredits") && credits.includes("finalizeCredits") && credits.includes("releaseCredits"), "accountancy uses RESERVE → PROCESS → FINALIZE/RELEASE")

      const processor = readProjectFile("src/lib/accountancy/upload-processing.ts")
      assert.ok(processor.includes("releaseAccountancyUploadCredits(creditOutcome, \"accountancy_parse_failed\")"), "parse failure releases the reservation")
      assert.ok(processor.includes("releaseAccountancyUploadCredits(creditOutcome, \"accountancy_storage_failed\")"), "storage failure releases the reservation")
      assert.ok(processor.includes("releaseAccountancyUploadCredits(creditOutcome, \"accountancy_database_failed\")"), "database failure releases the reservation")
      assert.ok(processor.includes("finalizeAccountancyUploadCredits(creditContext, creditOutcome)"), "success finalizes the reservation")
    },
  },
]

function eventCallsExcludingImport(source: string, eventName: string) {
  return source.split(`new Event(${eventName})`).length - 1
}

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
