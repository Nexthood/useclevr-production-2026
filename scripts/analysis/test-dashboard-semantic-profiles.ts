import * as assert from "node:assert/strict"
import * as fs from "node:fs"
import * as path from "node:path"
import { parseCSVStreaming } from "../../src/lib/data/csvLoader"
import { buildDashboardSemanticAnalysis } from "../../src/lib/data/dashboard-semantic-profile"
import { resolveBusinessModel } from "../../src/lib/data/business-model"

type ParsedFixture = Awaited<ReturnType<typeof parseCSVStreaming>>

async function main() {
  const fixtureRoot = path.join(process.cwd(), "test-fixtures", "business-models")
  const ecommerceCsv = await parseFixture(path.join(fixtureRoot, "02_ecommerce.csv"))
  const ecommerceXlsx = await parseFixture(path.join(fixtureRoot, "02_ecommerce.xlsx"))
  const saasCsv = await parseFixture(path.join(fixtureRoot, "03_saas_startup.csv"))
  const saasXlsx = await parseFixture(path.join(fixtureRoot, "03_saas_startup.xlsx"))
  const retailXlsx = await parseFixture(path.join(fixtureRoot, "01_local_retail.xlsx"))

  assert.equal(resolveBusinessModel({
    explicit: "generic",
    datasetType: "standard",
    columns: ecommerceCsv.columns,
    datasetName: "02_ecommerce",
  }), "ecommerce", "generic default must not block E-Commerce classification for a standard upload")

  assert.equal(resolveBusinessModel({
    explicit: "generic",
    datasetType: "standard",
    columns: saasCsv.columns,
    datasetName: "03_saas_startup",
  }), "saas", "generic default must not block SaaS classification for a standard upload")

  const ecommerce = await buildDashboardSemanticAnalysis(buildDataset("dashboard_02_ecommerce_xlsx", "02_ecommerce.xlsx", ecommerceXlsx, "standard", "generic"))
  const ecommerceCsvAnalysis = await buildDashboardSemanticAnalysis(buildDataset("dashboard_02_ecommerce_csv", "02_ecommerce.csv", ecommerceCsv, "standard", "generic"))
  const saas = await buildDashboardSemanticAnalysis(buildDataset("dashboard_03_saas_xlsx", "03_saas_startup.xlsx", saasXlsx, "standard", "generic"))
  const saasCsvAnalysis = await buildDashboardSemanticAnalysis(buildDataset("dashboard_03_saas_csv", "03_saas_startup.csv", saasCsv, "standard", "generic"))
  const retail = await buildDashboardSemanticAnalysis(buildDataset("dashboard_01_retail_xlsx", "01_local_retail.xlsx", retailXlsx, "standard", "generic"))

  assert.equal(ecommerce.uploadType, "standard")
  assert.equal(ecommerce.businessProfile, "ecommerce")
  assert.equal(ecommerce.reportProfileId, "ecommerce")
  nearlyEqual(metric(ecommerce, "Revenue"), 87419.2, "E-Commerce revenue must match report semantics")
  assert.equal(metric(ecommerce, "Orders"), 220)
  nearlyEqual(metric(ecommerce, "Average Order Value"), 397.36, "E-Commerce AOV must match report semantics")
  assert.equal(metric(ecommerce, "Customers"), 96)
  assert.equal(metric(ecommerce, "Units Sold"), 550)
  assert.equal(metric(ecommerce, "Products"), 12)
  nearlyEqual(metric(ecommerce, "Return Rate"), 5.91, "E-Commerce return rate must match report semantics")

  assert.deepEqual(
    snapshotMetrics(ecommerceCsvAnalysis, ["Revenue", "Orders", "Average Order Value", "Customers", "Units Sold", "Products", "Return Rate"]),
    snapshotMetrics(ecommerce, ["Revenue", "Orders", "Average Order Value", "Customers", "Units Sold", "Products", "Return Rate"]),
    "E-Commerce CSV/XLSX dashboard semantics must match",
  )

  assert.equal(saas.uploadType, "standard")
  assert.equal(saas.businessProfile, "saas")
  assert.equal(saas.reportProfileId, "saas_startup")
  assert.equal(metric(saas, "MRR"), 13494)
  assert.equal(metric(saas, "ARR"), 161928)
  assert.equal(metric(saas, "Customers"), 12)
  assert.equal(metric(saas, "New Customers"), 12)
  nearlyEqual(metric(saas, "Churn Rate"), 16.67, "SaaS churn rate must match report semantics")
  assert.equal(metric(saas, "Expansion MRR"), 204)
  assert.equal(metric(saas, "Contraction MRR"), 120)
  assert.equal(metric(saas, "Net Expansion MRR"), 84)
  nearlyEqual(metric(saas, "LTV/CAC"), 8.7, "SaaS LTV/CAC must match report semantics")
  assert.equal(metric(saas, "Active Users"), 480)
  assert.equal(metric(saas, "Support Tickets"), 30)
  assert.equal(metric(saas, "Cash Balance"), 606500)
  assert.equal(saas.confidence.score, 100)
  assert.ok(saas.trends.some((trend) => trend.title === "MRR Trend"))
  assert.ok(!saas.metrics.some((item) => item.label === "Orders" || item.label === "Average Order Value"), "SaaS dashboard metrics must not force E-Commerce cards")

  assert.deepEqual(
    snapshotMetrics(saasCsvAnalysis, ["MRR", "ARR", "Customers", "New Customers", "Churn Rate", "Expansion MRR", "Contraction MRR", "Net Expansion MRR", "LTV/CAC"]),
    snapshotMetrics(saas, ["MRR", "ARR", "Customers", "New Customers", "Churn Rate", "Expansion MRR", "Contraction MRR", "Net Expansion MRR", "LTV/CAC"]),
    "SaaS CSV/XLSX dashboard semantics must match",
  )

  assert.equal(retail.businessProfile, "local_retail")
  assert.equal(retail.reportProfileId, "local_retail")
  assert.ok(retail.metrics.some((item) => item.label === "Revenue"))

  const noRevenueDataset = buildDataset("dashboard_missing_revenue", "saas_without_revenue.csv", saasCsv, "standard", "generic")
  noRevenueDataset.columns = noRevenueDataset.columns.filter((column) => column !== "mrr" && column !== "arr")
  noRevenueDataset.data = noRevenueDataset.data.map(({ mrr: _mrr, arr: _arr, ...row }) => row)
  const noRevenue = await buildDashboardSemanticAnalysis(noRevenueDataset)
  assert.ok(!noRevenue.metrics.some((item) => item.label === "Revenue" && item.value === 0), "missing revenue must not become $0")

  const switchSequence = [ecommerce, saas, retail, ecommerceCsvAnalysis].map((item) => item.businessProfile)
  assert.deepEqual(switchSequence, ["ecommerce", "saas", "local_retail", "ecommerce"], "dataset switching must not retain stale profile state")

  console.log(JSON.stringify({
    ecommerce: snapshotMetrics(ecommerce, ["Revenue", "Orders", "Average Order Value", "Customers", "Units Sold", "Products", "Return Rate"]),
    saas: snapshotMetrics(saas, ["MRR", "ARR", "Customers", "New Customers", "Churn Rate", "Expansion MRR", "Contraction MRR", "Net Expansion MRR", "LTV/CAC"]),
    switchSequence,
  }, null, 2))
}

async function parseFixture(filePath: string): Promise<ParsedFixture> {
  const buffer = fs.readFileSync(filePath)
  const file = new File([buffer], path.basename(filePath), { type: mimeTypeForFile(filePath) })
  return parseCSVStreaming(file, 1000)
}

function buildDataset(id: string, fileName: string, parsed: ParsedFixture, datasetType: string, businessModel: string) {
  return {
    id,
    name: fileName.replace(/\.(csv|xlsx)$/i, ""),
    fileName,
    fileSize: 1,
    rowCount: parsed.rowCount,
    columnCount: parsed.columns.length,
    columns: parsed.columns,
    data: parsed.previewRows,
    datasetType,
    businessModel,
    analysisStatus: "ready",
    status: "ready",
    createdAt: new Date("2026-08-15T00:00:00Z"),
    updatedAt: new Date("2026-08-15T00:00:00Z"),
    analysis: { datasetType, businessModel, uploadSource: "standard_upload_regression" },
    aiInsights: null,
    precomputedMetrics: parsed.aggregatedMetrics,
    detectedColumns: null,
  }
}

function metric(analysis: Awaited<ReturnType<typeof buildDashboardSemanticAnalysis>>, label: string) {
  const value = analysis.metrics.find((item) => item.label === label)?.value
  assert.ok(typeof value === "number", `${label} must be available`)
  return value
}

function snapshotMetrics(analysis: Awaited<ReturnType<typeof buildDashboardSemanticAnalysis>>, labels: string[]) {
  return Object.fromEntries(labels.map((label) => [label, metric(analysis, label)]))
}

function nearlyEqual(actual: number, expected: number, message: string, tolerance = 0.02) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, received ${actual}`)
}

function mimeTypeForFile(filePath: string) {
  return filePath.endsWith(".xlsx")
    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    : "text/csv"
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
