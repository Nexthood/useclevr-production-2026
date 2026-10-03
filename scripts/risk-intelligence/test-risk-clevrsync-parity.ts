/**
 * Regression: ClevrSync Google Sheets Retail datasets are first-class Risk
 * Intelligence datasets. This suite pins the exact production persistence
 * representation used by ClevrSync (Dataset record + DatasetRows + dataset.data
 * + stored datasetType "standard" + source "google_sheets" + analysis
 * uploadSource "clevrsync") and proves parity with an equivalent uploaded
 * Retail dataset through the canonical capability layer — the production
 * failure shape that previously excluded capable datasets by name tokens.
 */
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { inArray } from "drizzle-orm"

import { getRiskDatasetEligibility } from "@/lib/risk-intelligence/risk-engine"
import {
  canAccessRiskDataset,
  calculateRiskIntelligenceForDataset,
  listRiskIntelligenceDatasets,
  resolveRiskDatasetSelection,
} from "@/lib/risk-intelligence/risk-service"
import { db } from "@/lib/db"
import { datasetRows, datasets, users } from "@/lib/db/schema"
import { loadDatasetData } from "@/lib/data/dataset-access"

const RETAIL_COLUMNS = [
  "Date",
  "Order ID",
  "Product",
  "Category",
  "Quantity",
  "Unit Price",
  "Revenue",
  "Cost",
  "Profit",
  "Customer",
  "Country",
  "Inventory",
]

const PRODUCTS = ["Desk Lamp", "Office Chair", "Standing Desk"]
const CATEGORIES = ["Lighting", "Furniture", "Accessories"]
const COUNTRIES = ["Netherlands", "Germany", "France"]

function buildRetailRows() {
  return Array.from({ length: 500 }, (_, index) => {
    const quantity = (index % 9) + 1
    const unitPrice = 19.99 + (index % 7) * 10
    const revenue = Number(((index % 9) + 1) * 110)
    const cost = Number(((index % 9) + 1) * 56)
    return {
      "Date": `2026-0${(index % 6) + 1}-15`,
      "Order ID": `ORD-${10000 + index}`,
      "Product": PRODUCTS[index % PRODUCTS.length],
      "Category": CATEGORIES[index % CATEGORIES.length],
      "Quantity": quantity,
      "Unit Price": unitPrice,
      "Revenue": revenue,
      "Cost": cost,
      "Profit": revenue - cost,
      "Customer": `Customer ${index % 30}`,
      "Country": COUNTRIES[index % COUNTRIES.length],
      "Inventory": 10 + (index % 12),
    } as Record<string, unknown>
  })
}

function retailNetMarginPct(rows: Array<Record<string, unknown>>) {
  const revenue = rows.reduce((sum, row) => sum + Number(row["Revenue"] || 0), 0)
  const cost = rows.reduce((sum, row) => sum + Number(row["Cost"] || 0), 0)
  return ((revenue - cost) / revenue) * 100
}

async function main() {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12)
  const ownerA = `clevr_parity_user_${suffix}`
  const ownerB = `clevr_parity_ownerb_${suffix}`
  const clevrSyncDatasetId = `ds_clevr_${suffix}`
  const uploadedDatasetId = `ds_upload_${suffix}`
  const ecommerceDatasetId = `ds_ecommerce_${suffix}`
  const deletedDatasetId = `ds_deleted_${suffix}`
  const ineligibleDatasetId = `ds_ineligible_${suffix}`
  const markerDatasetId = `synthetic_provider_path_dataset_${suffix}`
  const now = new Date()

  const rows = buildRetailRows()
  const userContextA = { id: ownerA, role: "user", email: `${ownerA}@example.test` }
  const userContextB = { id: ownerB, role: "user", email: `${ownerB}@example.test` }

  try {
    await db.insert(users).values([
      { id: ownerA, email: `${ownerA}@example.test`, name: "Clevr Parity A", createdAt: now },
      { id: ownerB, email: `${ownerB}@example.test`, name: "Clevr Parity B", createdAt: now },
    ])
    // ClevrSync persistence shape: full dataset.data AND canonical datasetRows,
    // stored datasetType "standard", source "google_sheets", uploadSource
    // "clevrsync", business_model "generic" — exactly what ClevrSync sync
    // writes through the standard upload persistence path.
    await db.insert(datasets).values([
      {
        id: clevrSyncDatasetId,
        userId: ownerA,
        name: "UseClevr ClevrSync Retail Test 500 - Retail Sales 2026",
        fileName: "UseClevr ClevrSync Retail Test 500 - Retail Sales 2026.csv",
        fileSize: 48123,
        rowCount: rows.length,
        columnCount: RETAIL_COLUMNS.length,
        columns: RETAIL_COLUMNS,
        data: rows,
        datasetType: "standard",
        businessModel: "generic",
        source: "google_sheets",
        mimeType: "text/csv",
        status: "ready",
        analysisStatus: "ready",
        analysisProgress: 100,
        analysis: {
          dataset_type: "standard",
          datasetCategory: "standard",
          datasetType: "standard",
          business_model: "generic",
          businessModel: "generic",
          uploadSource: "clevrsync",
          source: "google_sheets",
        },
        createdAt: now,
        updatedAt: now,
      },
      {
        // Uploaded Retail: identical canonical rows/geometry, upload provenance.
        id: uploadedDatasetId,
        userId: ownerA,
        name: "Clevr Parity Uploaded Retail",
        fileName: "clevr-parity-uploaded-retail.csv",
        fileSize: 48123,
        rowCount: rows.length,
        columnCount: RETAIL_COLUMNS.length,
        columns: RETAIL_COLUMNS,
        data: rows,
        datasetType: "retail",
        businessModel: "local_retail",
        source: "csv",
        mimeType: "text/csv",
        status: "ready",
        analysisStatus: "ready",
        analysisProgress: 100,
        analysis: {
          dataset_type: "retail",
          datasetCategory: "retail",
          datasetType: "retail",
          business_model: "local_retail",
          businessModel: "local_retail",
          uploadSource: "upload",
          source: "csv",
        },
        createdAt: now,
        updatedAt: now,
      },
      {
        // Workspace fixture-named dataset: selection must never fall back to it.
        id: ecommerceDatasetId,
        userId: ownerA,
        name: "02_ecommerce",
        fileName: "02_ecommerce.csv",
        fileSize: 88123,
        rowCount: 220,
        columnCount: 7,
        columns: ["order_id", "order_date", "customer_id", "order_total", "cost", "country", "currency"],
        data: [
          { order_id: "O-1", order_date: "2026-01-10", customer_id: "C1", order_total: 1200, cost: 500, country: "NL", currency: "EUR" },
          { order_id: "O-2", order_date: "2026-02-10", customer_id: "C2", order_total: 950, cost: 420, country: "DE", currency: "EUR" },
        ],
        datasetType: "standard",
        businessModel: "generic",
        source: "csv",
        mimeType: "text/csv",
        status: "ready",
        analysisStatus: "ready",
        analysisProgress: 100,
        analysis: { dataset_type: "standard", uploadSource: "upload", source: "csv" },
        createdAt: now,
        updatedAt: now,
      },
      {
        // Deleted datasets stay excluded for every owner.
        id: deletedDatasetId,
        userId: ownerA,
        name: "Clevr Parity Deleted Retail",
        fileName: "clevr-parity-deleted.csv",
        rowCount: rows.length,
        columnCount: RETAIL_COLUMNS.length,
        columns: RETAIL_COLUMNS,
        data: rows,
        datasetType: "standard",
        businessModel: "generic",
        source: "google_sheets",
        mimeType: "text/csv",
        status: "deleted",
        analysisStatus: "ready",
        analysisProgress: 100,
        analysis: { dataset_type: "standard", uploadSource: "clevrsync", source: "google_sheets" },
        createdAt: now,
        updatedAt: now,
      },
    ])

    await db.insert(datasetRows).values(
      rows.slice(0, 10).map((row, index) => ({
        id: `${clevrSyncDatasetId}-row-${index}`,
        datasetId: clevrSyncDatasetId,
        rowIndex: index,
        data: row,
      })),
    )

    await db.insert(datasets).values([
      {
        // Ineligible content stays excluded by canonical capability only.
        id: ineligibleDatasetId,
        userId: ownerA,
        name: "Clevr Parity Unmapped Notes",
        fileName: "clevr-parity-unmapped.csv",
        rowCount: 2,
        columnCount: 1,
        columns: ["handwritten_note"],
        data: [{ handwritten_note: "call the supplier about the January invoice" }, { handwritten_note: "check printer toner" }],
        datasetType: "standard",
        businessModel: "generic",
        source: "csv",
        mimeType: "text/csv",
        status: "ready",
        analysisStatus: "ready",
        analysisProgress: 100,
        analysis: { dataset_type: "standard", uploadSource: "upload", source: "csv" },
        createdAt: now,
        updatedAt: now,
      },
      {
        // Internal synthetic-record marker identity stays hidden.
        id: markerDatasetId,
        userId: ownerA,
        name: "internal check record",
        fileName: "internal-check.csv",
        rowCount: 2,
        columnCount: 2,
        columns: ["revenue", "cost"],
        data: [{ revenue: 100, cost: 10 }, { revenue: 100, cost: 10 }],
        datasetType: "standard",
        businessModel: "generic",
        source: "csv",
        mimeType: "text/csv",
        status: "ready",
        analysisStatus: "ready",
        analysisProgress: 100,
        analysis: { dataset_type: "standard", uploadSource: "upload", source: "csv" },
        createdAt: now,
        updatedAt: now,
      },
    ])

    // ─── 1. ClevrSync persisted dataset is Risk-eligible ─────────────────────
    const clevrDatasetRecord = await db.query.datasets.findFirst({ where: inArray(datasets.id, [clevrSyncDatasetId]) })
    assert.ok(clevrDatasetRecord, "ClevrSync dataset record was persisted")
    const clevrPersistedRows = await loadDatasetData(clevrSyncDatasetId, clevrDatasetRecord!)
    assert.equal(clevrPersistedRows.length, 500, "canonical persisted rows load through the ClevrSync representation")
    const clevrEligibility = getRiskDatasetEligibility({
      id: clevrDatasetRecord!.id,
      name: clevrDatasetRecord!.name || clevrDatasetRecord!.id,
      fileName: clevrDatasetRecord!.fileName,
      datasetType: clevrDatasetRecord!.datasetType,
      rowCount: clevrDatasetRecord!.rowCount,
      columns: clevrDatasetRecord!.columns,
      analysis: clevrDatasetRecord!.analysis,
    }, clevrPersistedRows)
    assert.equal(clevrEligibility.eligible, true, "ClevrSync Google Sheets Retail dataset is Risk-eligible from canonical capabilities")
    assert.equal(clevrEligibility.semanticDatasetType, "retail", "ClevrSync Retail classifies as Retail semantic type despite stored standard type")
    assert.ok(clevrEligibility.applicableRuleCount > 0, "ClevrSync Retail supports deterministic risk rules")

    // ─── 2. It appears in Risk selector candidates ───────────────────────────
    const candidates = await listRiskIntelligenceDatasets(userContextA, {})
    const candidateIds = new Set(candidates.map((dataset) => dataset.id))
    assert.ok(candidateIds.has(clevrSyncDatasetId), "ClevrSync dataset appears in the Risk selector candidates")
    assert.ok(candidateIds.has(uploadedDatasetId), "uploaded Retail dataset appears in the Risk selector candidates")
    const clevrSummary = candidates.find((dataset) => dataset.id === clevrSyncDatasetId)
    assert.ok(clevrSummary, "ClevrSync summary exists")
    assert.equal(clevrSummary!.semanticDatasetType, "retail", "selector marks the ClevrSync dataset as Retail")
    assert.ok(clevrSummary!.sourceLabel.includes("ClevrSync"), "selector shows ClevrSync provenance")
    const retailScoped = await listRiskIntelligenceDatasets(userContextA, { scope: "retail" })
    assert.ok(retailScoped.some((dataset) => dataset.id === clevrSyncDatasetId), "ClevrSync dataset is a Retail-scoped selector candidate")

    // ─── 3. Equivalent uploaded Retail receives the same capability result ───
    const uploadedEligibility = getRiskDatasetEligibility({
      id: uploadedDatasetId,
      name: "Clevr Parity Uploaded Retail",
      fileName: "clevr-parity-uploaded-retail.csv",
      datasetType: "retail",
      rowCount: rows.length,
      columns: RETAIL_COLUMNS,
    }, rows)
    assert.equal(uploadedEligibility.eligible, true, "uploaded Retail remains eligible")
    assert.deepEqual(
      clevrEligibility.applicableModuleLabels,
      uploadedEligibility.applicableModuleLabels,
      "ClevrSync and uploaded Retail expose identical risk capability modules",
    )
    assert.equal(clevrEligibility.applicableRuleCount, uploadedEligibility.applicableRuleCount, "ClevrSync and uploaded Retail expose the same applicable rule count")
    assert.equal(clevrEligibility.semanticDatasetType, uploadedEligibility.semanticDatasetType, "equivalent canonical data yields the same semantic type")

    // ─── 4. Selecting the ClevrSync dataset calculates only that dataset ──────
    const selected = await calculateRiskIntelligenceForDataset(clevrSyncDatasetId, userContextA, {})
    assert.equal(selected.success, true, "selected ClevrSync dataset calculates Risk Intelligence")
    if (selected.success) {
      assert.equal(selected.result.dataset.id, clevrSyncDatasetId, "risk result keeps the selected immutable dataset ID")
      assert.equal(selected.result.dataset.rowCount, 500, "risk result uses only the selected dataset's 500 rows")
      assert.equal(selected.result.dataset.semanticDatasetType, "retail", "risk result scope stays Retail")
      const expectedNetMargin = retailNetMarginPct(rows)
      assert.ok(
        selected.result.metrics.netMarginPct.value !== null &&
          Math.abs(selected.result.metrics.netMarginPct.value - expectedNetMargin) <= 0.05,
        `risk net margin must come from the selected dataset's own rows (expected ${expectedNetMargin.toFixed(2)}, received ${selected.result.metrics.netMarginPct.value})`,
      )
      assert.ok(selected.result.findings.length > 0, "selected ClevrSync dataset produces deterministic findings")
    }
    const selectedScoped = await calculateRiskIntelligenceForDataset(clevrSyncDatasetId, userContextA, { scope: "retail" })
    assert.equal(selectedScoped.success, true, "selected ClevrSync dataset calculates within the Retail scope")

    // ─── 5. No fallback to 02_ecommerce or other workspace datasets ───────────
    const ecommerceSelected = await calculateRiskIntelligenceForDataset(ecommerceDatasetId, userContextA, {})
    assert.equal(ecommerceSelected.success, true, "ecommerce fixture dataset remains independently calculable")
    if (ecommerceSelected.success && selected.success) {
      assert.equal(ecommerceSelected.result.dataset.id, ecommerceDatasetId, "ecommerce selection calculates the ecommerce dataset only")
      assert.notEqual(ecommerceSelected.result.metrics.netMarginPct.value, selected.result.metrics.netMarginPct.value, "workspace datasets are never combined or swapped by fallback")
    }
    const multiSelection = resolveRiskDatasetSelection(
      [{ id: clevrSyncDatasetId }, { id: uploadedDatasetId }, { id: ecommerceDatasetId }],
      null,
    )
    assert.equal(multiSelection.selectedDatasetId, null, "multiple eligible datasets require an explicit selection, never auto-selection")
    assert.equal(multiSelection.staleSelection, false, "unselected multi-dataset state is not stale")
    const staleSelection = resolveRiskDatasetSelection(
      [{ id: clevrSyncDatasetId }, { id: uploadedDatasetId }, { id: ecommerceDatasetId }],
      "ds_missing_or_deleted",
    )
    assert.equal(staleSelection.selectedDatasetId, null, "stale requested dataset clears selection")
    assert.equal(staleSelection.staleSelection, true, "stale requested dataset is reported as stale, never fallback-selected")
    const explicitSelection = resolveRiskDatasetSelection(
      [{ id: clevrSyncDatasetId }, { id: uploadedDatasetId }, { id: ecommerceDatasetId }],
      clevrSyncDatasetId,
    )
    assert.equal(explicitSelection.selectedDatasetId, clevrSyncDatasetId, "explicit selection resolves the requested ClevrSync dataset")
    assert.equal(explicitSelection.staleSelection, false, "explicit ClevrSync selection is not stale")

    // ─── 6. Owner isolation stays enforced ────────────────────────────────────
    assert.equal(canAccessRiskDataset(userContextB, ownerA), false, "owner isolation denies cross-user access decisions")
    assert.equal(canAccessRiskDataset(userContextA, ownerA), true, "owner isolation grants same-user access")
    const ownerBList = await listRiskIntelligenceDatasets(userContextB, {})
    assert.equal(ownerBList.some((dataset) => dataset.id === clevrSyncDatasetId), false, "Owner B never sees Owner A's ClevrSync dataset in Risk candidates")
    const ownerBSelected = await calculateRiskIntelligenceForDataset(clevrSyncDatasetId, userContextB, {})
    assert.equal(ownerBSelected.success, false, "Owner B cannot calculate Owner A's ClevrSync dataset")
    if (!ownerBSelected.success) {
      assert.equal(ownerBSelected.status, 404, "cross-user calculation returns 404 dataset_not_found")
    }

    // ─── 7. Deleted, ineligible, and synthetic-marker behavior unchanged ──────
    const deletedList = await listRiskIntelligenceDatasets(userContextA, {})
    assert.equal(deletedList.some((dataset) => dataset.id === deletedDatasetId), false, "deleted ClevrSync-style dataset stays excluded from selector candidates")
    const deletedCalc = await calculateRiskIntelligenceForDataset(deletedDatasetId, userContextA, {})
    assert.equal(deletedCalc.success, false, "deleted dataset cannot calculate Risk Intelligence")
    if (!deletedCalc.success) {
      assert.equal(deletedCalc.status, 404, "deleted dataset returns 404 dataset_not_found")
    }

    assert.equal(deletedList.some((dataset) => dataset.id === ineligibleDatasetId), false, "ineligible dataset stays excluded from selector candidates")
    const ineligibleCalc = await calculateRiskIntelligenceForDataset(ineligibleDatasetId, userContextA, {})
    assert.equal(ineligibleCalc.success, false, "ineligible dataset cannot calculate Risk Intelligence")
    if (!ineligibleCalc.success) {
      assert.equal(ineligibleCalc.status, 400, "ineligible dataset returns 400 unsupported_dataset_type")
    }

    assert.equal(deletedList.some((dataset) => dataset.id === markerDatasetId), false, "internal synthetic-marker dataset stays hidden from selector candidates")
    const markerCalc = await calculateRiskIntelligenceForDataset(markerDatasetId, userContextA, {})
    assert.equal(markerCalc.success, false, "internal synthetic-marker dataset cannot calculate Risk Intelligence")
    if (!markerCalc.success) {
      assert.equal(markerCalc.status, 404, "internal synthetic-marker dataset returns 404 dataset_not_found")
    }

    process.stdout.write("Risk Intelligence ClevrSync eligibility parity regression passed.\n")
  } finally {
    await db.delete(datasetRows).where(inArray(datasetRows.datasetId, [clevrSyncDatasetId, uploadedDatasetId, ecommerceDatasetId, deletedDatasetId, ineligibleDatasetId, markerDatasetId])).catch(() => {})
    await db.delete(datasets).where(inArray(datasets.id, [clevrSyncDatasetId, uploadedDatasetId, ecommerceDatasetId, deletedDatasetId, ineligibleDatasetId, markerDatasetId])).catch(() => {})
    await db.delete(users).where(inArray(users.id, [ownerA, ownerB])).catch(() => {})
  }
}

// Direct-title, no-name veto contract: word tokens in user-authored names can
// never exclude a capable dataset at the engine level either.
function assertNameTokensNeverVetoEligibility() {
  const rows = buildRetailRows()
  const eligibility = getRiskDatasetEligibility({
    id: "ds_word_token_veto_probe",
    name: "UseClevr ClevrSync Retail Test 500 - Retail Sales 2026",
    fileName: "UseClevr ClevrSync Retail Test 500 - Retail Sales 2026.csv",
    datasetType: "standard",
    rowCount: rows.length,
    columns: RETAIL_COLUMNS,
  }, rows)
  assert.equal(eligibility.eligible, true, "name word tokens never veto canonical Risk eligibility")
}

assertNameTokensNeverVetoEligibility()

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
