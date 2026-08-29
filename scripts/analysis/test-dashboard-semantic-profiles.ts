import * as assert from "node:assert/strict"
import * as fs from "node:fs"
import * as path from "node:path"
import { parseCSVStreaming } from "../../src/lib/data/csvLoader"
import { buildDashboardSemanticAnalysis } from "../../src/lib/data/dashboard-semantic-profile"
import { resolveBusinessModel } from "../../src/lib/data/business-model"
import { buildDatasetReportInput } from "../../src/lib/reports/dataset-report-builder"
import { deleteReport, generateReport, listReports } from "../../src/lib/reports/report-generator"

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
  const mrrMovementRows = buildMrrMovementRows()
  const mrrMovementParsed = {
    columns: Object.keys(mrrMovementRows[0]),
    previewRows: mrrMovementRows,
    rowCount: mrrMovementRows.length,
    aggregatedMetrics: null,
  } as ParsedFixture
  const mrrMovementDataset = buildDataset("dashboard_saas_mrr_movements", "saas_subscription_mrr_movements_test.xlsx", mrrMovementParsed, "standard", "generic")
  const mrrMovement = await buildDashboardSemanticAnalysis(mrrMovementDataset)

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

  assert.equal(resolveBusinessModel({
    explicit: "generic",
    datasetType: "standard",
    columns: mrrMovementParsed.columns,
    datasetName: "saas_subscription_mrr_movements_test",
  }), "saas", "MRR movement schemas must route to SaaS, not E-Commerce")
  assert.equal(mrrMovement.businessProfile, "saas")
  assert.equal(mrrMovement.reportProfileId, "saas_startup")
  assert.equal(mrrMovement.saasAnalysis?.profile, "subscription_mrr_movements")
  assert.equal(metric(mrrMovement, "Customers"), 123)
  assert.equal(metric(mrrMovement, "MRR"), 372136)
  assert.equal(metric(mrrMovement, "ARR"), 4465632)
  assert.equal(metric(mrrMovement, "New MRR"), 3361)
  assert.equal(metric(mrrMovement, "Expansion MRR"), 5248)
  assert.equal(metric(mrrMovement, "Contraction MRR"), 1219)
  assert.equal(metric(mrrMovement, "Churned MRR"), 643)
  assert.ok(!mrrMovement.metrics.some((item) => item.label === "Revenue" || item.label === "Orders" || item.label === "Average Order Value"), "MRR movement dashboard must not render E-Commerce metrics")
  assert.ok(mrrMovement.trends.some((trend) => trend.title === "MRR Trend"), "MRR movement dashboard must expose an MRR trend")

  listReports(mrrMovementDataset.id).forEach((report) => deleteReport(report.id))
  const mrrMovementReportInput = await buildDatasetReportInput(mrrMovementDataset as Parameters<typeof buildDatasetReportInput>[0])
  const mrrMovementReport = await generateReport(
    mrrMovementDataset.id,
    mrrMovementDataset.name,
    {
      visibility: "private",
      reportType: mrrMovementReportInput.reportType,
      businessModel: mrrMovementReportInput.businessModel,
      userId: "dashboard_mrr_movement_user",
      workspaceId: "workspace_mrr_movement_test",
    },
    mrrMovementReportInput,
  )
  assert.equal(mrrMovementReport.reportProfile?.id, "saas_startup")
  assert.ok(mrrMovementReport.pdfPath, "MRR movement report generation must produce a PDF path")
  assert.ok(listReports(mrrMovementDataset.id).some((report) => report.id === mrrMovementReport.id), "MRR movement report must persist")
  deleteReport(mrrMovementReport.id)

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
    mrrMovement: snapshotMetrics(mrrMovement, ["MRR", "ARR", "Customers", "New MRR", "Expansion MRR", "Contraction MRR", "Churned MRR"]),
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

function buildMrrMovementRows() {
  const rows: Record<string, unknown>[] = [
    { month: "2025-11-01", event_date: "2025-11-01", customer_id: "cus_previous", customer_name: "Previous Customer", industry: "Software", region: "EMEA", plan: "Pro", seats_before: 7, seats_after: 7, movement_type: "no_change", mrr_before: 2100, mrr_after: 2100, mrr_delta: 0, currency: "USD", signup_date: "2024-01-10", customer_status: "active" },
    { month: "2025-12-01", event_date: "2025-12-02", customer_id: "cus_new", customer_name: "New Customer", industry: "Software", region: "North America", plan: "Business", seats_before: 0, seats_after: 12, movement_type: "new", mrr_before: 0, mrr_after: 3361, mrr_delta: 3361, currency: "USD", signup_date: "2025-12-02", customer_status: "active" },
    { month: "2025-12-01", event_date: "2025-12-03", customer_id: "cus_expansion", customer_name: "Expansion Customer", industry: "Healthcare", region: "EMEA", plan: "Enterprise", seats_before: 35, seats_after: 48, movement_type: "expansion", mrr_before: 10000, mrr_after: 15248, mrr_delta: 5248, currency: "USD", signup_date: "2024-03-15", customer_status: "active" },
    { month: "2025-12-01", event_date: "2025-12-04", customer_id: "cus_contraction", customer_name: "Contraction Customer", industry: "Finance", region: "APAC", plan: "Pro", seats_before: 20, seats_after: 16, movement_type: "contraction", mrr_before: 6219, mrr_after: 5000, mrr_delta: -1219, currency: "USD", signup_date: "2024-06-20", customer_status: "active" },
    { month: "2025-12-01", event_date: "2025-12-05", customer_id: "cus_churn", customer_name: "Churn Customer", industry: "Retail", region: "North America", plan: "Starter", seats_before: 3, seats_after: 0, movement_type: "churn", mrr_before: 643, mrr_after: 0, mrr_delta: -643, currency: "USD", signup_date: "2025-01-12", customer_status: "churned" },
  ]
  for (let index = 0; index < 120; index += 1) {
    const mrrAfter = index === 119 ? 3427 : 2900
    rows.push({
      month: "2025-12-01",
      event_date: "2025-12-06",
      customer_id: `cus_no_change_${index + 1}`,
      customer_name: `No Change Customer ${index + 1}`,
      industry: index % 2 === 0 ? "Software" : "Services",
      region: index % 3 === 0 ? "EMEA" : "North America",
      plan: index % 4 === 0 ? "Enterprise" : "Business",
      seats_before: 10,
      seats_after: 10,
      movement_type: "no_change",
      mrr_before: mrrAfter,
      mrr_after: mrrAfter,
      mrr_delta: 0,
      currency: "USD",
      signup_date: "2024-02-01",
      customer_status: "active",
    })
  }
  return rows
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
