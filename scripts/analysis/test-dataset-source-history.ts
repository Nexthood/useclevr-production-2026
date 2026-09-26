import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import {
  DATASET_SOURCES,
  DEFAULT_DATASET_SOURCE,
  deriveDatasetSource,
  getDatasetSourceLabel,
  normalizeDatasetSource,
} from "../../src/lib/data/dataset-source"
import { emptyDashboardData } from "../../src/lib/data/dashboard-dataset-aggregation"

type TestCase = {
  name: string
  run: () => Promise<void> | void
}

function readProjectFile(relativePath: string) {
  return readFileSync(`${process.cwd()}/${relativePath}`, "utf8")
}

const tests: TestCase[] = [
  {
    name: "the source vocabulary reuses the existing product sources and never duplicates enums",
    run() {
      assert.deepEqual([...DATASET_SOURCES], [
        "csv",
        "excel",
        "google_sheets",
        "onedrive",
        "sharepoint",
        "snowflake",
        "api",
        "clevrsync",
        "accountancy_document",
        "unknown",
      ])
      assert.equal(normalizeDatasetSource("GOOGLE_SHEETS"), "google_sheets")
      assert.equal(normalizeDatasetSource("postgres"), null, "unrelated values must not silently join the vocabulary")
      assert.equal(getDatasetSourceLabel("accountancy_document"), "Document")      },
  },
  {
    name: "derivation only uses authoritative or immutable stored metadata",
    run() {
      assert.equal(deriveDatasetSource({ source: "excel", fileName: "report.csv" }), "excel", "a persisted authoritative source wins")
      assert.equal(deriveDatasetSource({ uploadSource: "clevrsync" }), "clevrsync")
      assert.equal(deriveDatasetSource({ datasetType: "snowflake", fileName: "export.bin" }), "snowflake")
      assert.equal(deriveDatasetSource({ datasetType: "api" }), "api")
      assert.equal(deriveDatasetSource({ fileName: "sales.CSV" }), "csv")
      assert.equal(deriveDatasetSource({ fileName: "10_accountancy_ledger.xlsx" }), "excel")
      assert.equal(deriveDatasetSource({ fileName: "10_accountancy_ledger" }), DEFAULT_DATASET_SOURCE, "unprovable origins stay unknown and are never fabricated")
      assert.equal(deriveDatasetSource({ fileName: "ledger", mimeType: "text/csv" }), "csv")
      assert.equal(deriveDatasetSource({ fileName: "ledger", mimeType: "application/vnd.ms-excel" }), "excel")
    },
  },
  {
    name: "dashboard source counts derive from the normalized source, not from filename sniffing",
    run() {
      const empty = emptyDashboardData()
      assert.equal(Object.keys(empty.fileTypeCounts).length, DATASET_SOURCES.length, "every real source has a counter slot (other/unknown included)")
      assert.ok(!("unknown" in empty.fileTypeCounts), "unknown maps to the explicit other/unknown counter")

      const uploadRoute = readProjectFile("src/lib/data/dashboard-dataset-aggregation.ts")
      assert.ok(uploadRoute.includes("deriveDatasetSource"), "aggregation derives per-dataset sources through the central helper")
      assert.ok(!/fileName\.endsWith\(\"\.csv\"\)/.test(uploadRoute), "fileTypeCounts no longer sniffs filenames")
    },
  },
  {
    name: "new uploads persist authoritative source metadata",
    run() {
      const uploadAction = readProjectFile("src/app/actions/upload.ts")
      assert.ok(uploadAction.includes("source: datasetSource"), "the shared upload action persists the normalized source")
      assert.ok(uploadAction.includes("clevrsync_connector_type"), "ClevrSync connector types are persisted")

      const syncRoute = readProjectFile("src/app/api/clevrsync/sync/route.ts")
      const connectorTypeCount = syncRoute.split('uploadFormData.set("clevrsync_connector_type", connector.type)').length - 1
      assert.equal(connectorTypeCount, 1, "the Google Sheets connector sync path persists the connector type")

      const simpleUpload = readProjectFile("src/app/api/upload/simple/route.ts")
      assert.ok(simpleUpload.includes("deriveDatasetSource"), "standard uploads persist the normalized source")

      const accountancy = readProjectFile("src/lib/accountancy/upload-processing.ts")
      assert.ok(accountancy.includes("source: datasetSource"), "accountancy uploads persist the normalized source")
      assert.ok(accountancy.includes('"accountancy_document"'), "accountancy PDF/receipt uploads keep their document source")
    },
  },
  {
    name: "the source backfill migration is idempotent and never fabricates origins",
    run() {
      const migration = readProjectFile("src/lib/db/migrations/0034_dataset_source.sql")
      assert.ok(migration.includes('ADD COLUMN IF NOT EXISTS "source"'), "the migration is safe to re-run")
      assert.ok(migration.includes("WHERE COALESCE(\"source\", 'unknown') = 'unknown'"), "the backfill only touches unresolved rows")
      assert.ok(migration.includes("clevrsync") && migration.includes("snowflake") && migration.includes("api"), "connector markers are normalized")
      assert.ok(migration.includes("ELSE 'unknown'"), "unprovable origins stay unknown")
      assert.ok(!migration.includes("SET \"source\" = 'excel'\nWHERE \"businessModel\""), "no fabricated connector metadata")

      const predeploy = readProjectFile("scripts/runtime/railway-predeploy.cjs")
      assert.ok(predeploy.includes("0034_dataset_source.sql"), "predeploy runs the source migration")
    },
  },
  {
    name: "upload history statistics stay at workspace scope with a consistent label",
    run() {
      const page = readProjectFile("src/app/(auth)/app/page.tsx")
      assert.ok(page.includes("loadDashboardDatasetAggregation(userId)"), "the dashboard loads a workspace-scope aggregation")
      assert.ok(page.includes("workspaceData"), "Upload History reads workspace-level statistics")
      assert.ok(page.includes("rows processed across"), "the label keeps its workspace meaning")
      assert.ok(page.includes("in this workspace."), "the workspace scope is explicit in the upload history label")
      assert.ok(page.includes("workspaceData.totalRows") && page.includes("workspaceData.datasetCount"), "row totals and dataset counts share the same workspace scope")      },
  },
  {
    name: "the dataset library surfaces the persisted source",
    run() {
      const library = readProjectFile("src/app/(auth)/app/datasets/page.tsx")
      assert.ok(library.includes("source:"), "the library query selects the persisted source column")
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
