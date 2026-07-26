import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { getStandardAnalysisStatusLabel, getStandardUploadSuccessView } from "../../src/lib/upload/standard-upload-success"

const repoRoot = resolve(import.meta.dirname, "../..")

function readProjectFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8")
}

function assertIncludes(source: string, expected: string, message: string) {
  assert.ok(source.includes(expected), message)
}

function assertNotIncludes(source: string, forbidden: string, message: string) {
  assert.equal(source.includes(forbidden), false, message)
}

function main() {
  const result = {
    datasetId: "ds_standard_123",
    datasetType: "standard",
    dataset_type: "standard",
    rowsProcessed: 1234567,
    columnsDetected: 9876,
    analysisStatus: "ready",
    redirectTo: "/app/dashboard?datasetId=ds_standard_123",
  }

  const view = getStandardUploadSuccessView(result)

  assert.equal(view.title, "Upload completed successfully")
  assert.equal(view.description, "Your standard dataset was uploaded and is ready for analysis.")
  assert.equal(view.dashboardHref, "/app/dashboard?datasetId=ds_standard_123", "standard dashboard route keeps the dataset ID")
  assert.equal(view.datasetHref, "/app/datasets/ds_standard_123", "View Dataset opens the standard dataset detail page")
  assert.deepEqual(
    view.metrics,
    [
      { label: "Dataset type", value: "Standard" },
      { label: "Rows processed", value: "1,234,567" },
      { label: "Columns detected", value: "9,876" },
      { label: "Analysis status", value: "Ready" },
    ],
    "standard KPI labels and full values are visible",
  )

  assert.equal(getStandardAnalysisStatusLabel("processing"), "Processing")
  assert.equal(getStandardAnalysisStatusLabel("pending"), "Processing")
  assert.equal(getStandardAnalysisStatusLabel("failed"), "Failed")
  assert.equal(getStandardAnalysisStatusLabel("completed"), "Ready")

  const encodedView = getStandardUploadSuccessView({
    datasetId: "ds id/with spaces",
    datasetType: "standard",
    rowsProcessed: 12,
    columnsDetected: 4,
    analysisStatus: "failed",
  })
  assert.equal(encodedView.dashboardHref, "/app/dashboard?datasetId=ds%20id%2Fwith%20spaces")
  assert.equal(encodedView.datasetHref, "/app/datasets/ds%20id%2Fwith%20spaces")
  assert.equal(encodedView.metrics[3]?.value, "Failed", "standard displays the full failed analysis status")

  const uploadSource = readProjectFile("src/components/forms/csv-upload.tsx")
  const sharedPanelSource = readProjectFile("src/components/forms/upload-success-panel.tsx")
  const retailSource = readProjectFile("src/components/retail/retail-inventory-client.tsx")
  const profitabilitySource = readProjectFile("src/components/forms/profitability-upload.tsx")
  const accountancySource = readProjectFile("src/components/accountancy/accountancy-upload.tsx")
  const prebookkeepingSource = readProjectFile("src/app/(auth)/app/prebookkeeping/page.tsx")

  assert.equal(
    uploadSource.match(/<UploadSuccessPanel/g)?.length,
    1,
    "Standard Upload renders exactly one success panel",
  )
  assertIncludes(uploadSource, 'const showStandardSuccessPanelOnly = uploadStatus === "success" && uploadResult', "standard success mode has a single-panel guard")
  assertIncludes(uploadSource, "{showStandardSuccessPanelOnly ? (", "standard success panel replaces the dropzone")
  assertIncludes(uploadSource, 'setUploadStatus("idle")', "Upload Another File resets the Standard UI status")
  assertIncludes(uploadSource, "setUploadResult(null)", "Upload Another File clears only the completed UI result")
  assertNotIncludes(uploadSource.match(/const resetUploader[\s\S]*?^  }/m)?.[0] || "", "fetch(", "Standard reset does not call a delete API")

  assertIncludes(sharedPanelSource, 'uploadMode === "standard" && resolvedDatasetType === "standard"', "standard variant only renders for dataset_type standard")
  assertIncludes(sharedPanelSource, 'data-upload-success-panel="standard"', "standard panel has one identifiable success panel")
  assertIncludes(sharedPanelSource, "grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4", "standard KPIs use mobile, tablet, and desktop columns")
  assertIncludes(sharedPanelSource, "whitespace-normal break-words", "standard KPI values wrap instead of truncating")
  assertNotIncludes(sharedPanelSource.match(/function StandardResultMetric[\s\S]*?^}/m)?.[0] || "", "truncate", "standard KPI values are not truncated")

  assertIncludes(sharedPanelSource, 'if (uploadMode === "retail") return "/app/retail"', "Retail Upload route remains unchanged")
  assertIncludes(sharedPanelSource, 'if (uploadMode === "profitability") return "/app/profitability"', "Profitability Upload route remains unchanged")
  assertIncludes(sharedPanelSource, 'if (uploadMode === "accountancy") return "/app/accountancy"', "Accountancy Upload route remains unchanged")
  assertIncludes(sharedPanelSource, 'if (uploadMode === "prebookkeeping") return "/app/prebookkeeping"', "Pre-bookkeeping Upload route remains unchanged")
  assertIncludes(sharedPanelSource, 'if (uploadMode === "retail") return "Open Retail"', "Retail Upload label remains unchanged")
  assertIncludes(sharedPanelSource, 'if (uploadMode === "profitability") return "Open Profitability"', "Profitability Upload label remains unchanged")
  assertIncludes(sharedPanelSource, 'if (uploadMode === "accountancy") return "Open Accountancy"', "Accountancy Upload label remains unchanged")
  assertIncludes(sharedPanelSource, 'if (uploadMode === "prebookkeeping") return "Open Pre-bookkeeping"', "Pre-bookkeeping Upload label remains unchanged")
  assertIncludes(sharedPanelSource.match(/function ResultMetric[\s\S]*?^}/m)?.[0] || "", "truncate", "non-standard KPI layout remains on the existing shared metric component")

  assertIncludes(retailSource, 'uploadMode="retail"', "Retail Upload still uses the retail success flow")
  assertIncludes(profitabilitySource, 'uploadMode="profitability"', "Profitability Upload still uses the profitability success flow")
  assertNotIncludes(accountancySource, "StandardUploadSuccessPanel", "Accountancy Upload does not use the Standard success panel")
  assertNotIncludes(prebookkeepingSource, "StandardUploadSuccessPanel", "Pre-bookkeeping Upload does not use the Standard success panel")
}

main()
