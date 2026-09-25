import { execFileSync } from "node:child_process"
import * as fs from "node:fs"
import { buildDatasetReportInput } from "../../src/lib/reports/dataset-report-builder"
import { buildDashboardSemanticAnalysis } from "../../src/lib/data/dashboard-semantic-profile"
import { deleteReport, generateReport } from "../../src/lib/reports/report-generator"

type TestDataset = Parameters<typeof buildDatasetReportInput>[0]

const COLUMNS = [
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

const PRODUCTS = ["Desk Lamp", "Office Chair", "Standing Desk", "Monitor Stand", "Keyboard", "Mouse"]
const CATEGORIES = ["Lighting", "Furniture", "Accessories"]
const COUNTRIES = ["Netherlands", "Germany", "France", "Belgium"]

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

function nearlyEqual(actual: number | null | undefined, expected: number, message: string, tolerance = 0.02) {
  assert(typeof actual === "number" && Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, received ${actual}`)
}

function buildRows() {
  return Array.from({ length: 500 }, (_, index) => {
    const quantity = (index % 9) + 1
    const unitPrice = 19.99 + (index % 7) * 10
    const revenue = Number((quantity * unitPrice).toFixed(2))
    const cost = Number((revenue * 0.5615).toFixed(2))
    // Profit intentionally diverges from revenue - cost on every 25th row so the
    // regression proves the explicit Profit field takes precedence over derivation.
    const profit = index % 25 === 0 ? Number((revenue - cost - 0.05).toFixed(2)) : Number((revenue - cost).toFixed(2))
    return {
      "Date": `2026-0${(index % 6) + 1}-15`,
      "Order ID": `ORD-${10000 + index}`,
      "Product": PRODUCTS[index % PRODUCTS.length],
      "Category": CATEGORIES[index % CATEGORIES.length],
      "Quantity": quantity,
      "Unit Price": unitPrice,
      "Revenue": revenue,
      "Cost": cost,
      "Profit": profit,
      "Customer": `CUS-${(index % 187) + 1}`,
      "Country": COUNTRIES[index % COUNTRIES.length],
      "Inventory": 40 + (index % 23),
    }
  })
}

function dataset(input: { id: string; name: string; rows: Record<string, unknown>[]; columns: string[]; uploadSource: string }): TestDataset {
  return {
    id: input.id,
    userId: "synthetic_user",
    name: input.name,
    fileName: `${input.name}.xlsx`,
    fileSize: 24000,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    storageKey: null,
    checksum: null,
    rowCount: input.rows.length,
    columnCount: input.columns.length,
    columns: input.columns,
    data: input.rows,
    columnTypes: null,
    previewRowCount: null,
    previewGenerated: null,
    fullAnalysisCompleted: null,
    analysisStatus: "ready",
    analysisProgress: null,
    analysisMessage: null,
    analysisError: null,
    invalidRowCount: null,
    missingValueCounts: null,
    precomputedMetrics: null,
    columnMapping: null,
    detectedColumns: null,
    aiInsights: null,
    status: "ready",
    analysis: { uploadSource: input.uploadSource },
    datasetType: "standard",
    businessModel: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as TestDataset
}

function dashboardDataset(input: { id: string; name: string; rows: Record<string, unknown>[]; columns: string[] }) {
  return {
    id: input.id,
    name: input.name,
    fileName: `${input.name}.xlsx`,
    fileSize: 24000,
    rowCount: input.rows.length,
    columnCount: input.columns.length,
    columns: input.columns,
    data: input.rows,
    datasetType: "standard",
    businessModel: null,
    analysisStatus: "ready",
    status: "ready",
    createdAt: new Date(),
    updatedAt: new Date(),
    analysis: {},
    aiInsights: null,
    precomputedMetrics: null,
    detectedColumns: null,
  }
}

function expectedTotals(rows: Record<string, unknown>[]) {
  const sum = (column: string) => rows.reduce((total, row) => total + Number(row[column]), 0)
  const revenue = round2(sum("Revenue"))
  const cost = round2(sum("Cost"))
  const profit = round2(sum("Profit"))
  return {
    revenue,
    cost,
    profit,
    profitMargin: round2((profit / revenue) * 100),
    derivedProfit: round2(revenue - cost),
  }
}

function kpiValue(reportInput: Awaited<ReturnType<typeof buildDatasetReportInput>>, title: string) {
  return reportInput.kpis.find((kpi) => kpi.title === title)?.value ?? null
}

function dashboardMetricValue(analysis: Awaited<ReturnType<typeof buildDashboardSemanticAnalysis>>, label: string) {
  return analysis.metrics.find((item) => item.label === label)?.value ?? null
}

async function assertClevrSyncProfitabilitySemantics() {
  const rows = buildRows()
  const expected = expectedTotals(rows)
  assert(
    Math.abs(expected.profit - expected.derivedProfit) > 0.5,
    `fixture must diverge explicit profit from revenue - cost, received ${expected.profit} vs ${expected.derivedProfit}`,
  )

  const clevrSyncInput = await buildDatasetReportInput(dataset({
    id: "synthetic_clevrsync_retail_test_500",
    name: "ClevrSync Retail Test 500",
    rows,
    columns: COLUMNS,
    uploadSource: "clevrsync",
  }))

  assert(clevrSyncInput.reportType === "ecommerce", `ClevrSync retail schema must resolve the e-commerce report, received ${clevrSyncInput.reportType}`)
  nearlyEqual(clevrSyncInput.financials?.revenue ?? null, expected.revenue, "revenue must sum the source Revenue field")
  nearlyEqual(clevrSyncInput.financials?.cogs ?? null, expected.cost, "recognized direct Cost must feed canonical COGS")
  nearlyEqual(clevrSyncInput.financials?.grossProfit ?? null, expected.profit, "explicit Profit must take precedence over revenue - cost")
  assert(
    Math.abs((clevrSyncInput.financials?.grossProfit ?? 0) - expected.derivedProfit) > 0.5,
    "gross profit must not silently fall back to the derived revenue - cost value",
  )
  nearlyEqual(clevrSyncInput.financials?.grossMargin ?? null, expected.profitMargin, "gross margin must be gross profit divided by revenue", 0.03)
  assert(clevrSyncInput.financials?.netProfit === null, "explicit Profit must not be relabeled as net profit")
  assert(clevrSyncInput.financials?.metricSources?.cogs?.kind === "source_value" && clevrSyncInput.financials.metricSources.cogs.note.includes("Cost"), "COGS provenance must cite the source Cost field")
  assert(clevrSyncInput.financials?.metricSources?.grossProfit?.kind === "source_value" && clevrSyncInput.financials.metricSources.grossProfit.note.includes("Profit"), "gross profit provenance must cite the source Profit field")
  assert(clevrSyncInput.semanticContext?.mappings.cogs === "Cost", "semantic context must map cogs to the source Cost field")
  assert(clevrSyncInput.semanticContext?.mappings.grossProfit === "Profit", "semantic context must map gross profit to the source Profit field")
  assert(clevrSyncInput.semanticContext?.mappings.netProfit === null, "semantic context must not map the explicit Profit field as net profit")

  nearlyEqual(kpiValue(clevrSyncInput, "Revenue") ?? null, expected.revenue, "Revenue KPI must match the source total")
  nearlyEqual(kpiValue(clevrSyncInput, "Cost") ?? null, expected.cost, "Cost KPI must expose the canonical COGS total")
  nearlyEqual(kpiValue(clevrSyncInput, "Profit") ?? null, expected.profit, "Profit KPI must expose the canonical gross profit total")
  nearlyEqual(kpiValue(clevrSyncInput, "Profit Margin") ?? null, expected.profitMargin, "Profit Margin KPI must expose gross margin", 0.03)

  const recommendationText = (clevrSyncInput.recommendations ?? []).map((item) => `${item.issue} ${item.recommendedAction} ${(item.requiredData ?? []).join(" ")}`).join(" ")
  assert(!/COGS is not available|Product COGS is not available|Add cogs|Add a source-backed COGS|add cost.*profit fields/i.test(recommendationText), "recommendations must not claim cost or profit fields are missing")
  assert(!clevrSyncInput.summary.includes("Gross profit and gross margin are not available"), "summary must not claim gross profitability is missing when source fields exist")

  const standardInput = await buildDatasetReportInput(dataset({
    id: "synthetic_standard_retail_test_500",
    name: "Standard Retail Test 500",
    rows,
    columns: COLUMNS,
    uploadSource: "standard_upload",
  }))
  assert(standardInput.financials?.cogs === clevrSyncInput.financials?.cogs, "ClevrSync and standard CSV/XLSX datasets must share central cost semantics")
  assert(standardInput.financials?.grossProfit === clevrSyncInput.financials?.grossProfit, "ClevrSync and normal datasets must share central profit semantics")
  assert(standardInput.financials?.grossMargin === clevrSyncInput.financials?.grossMargin, "ClevrSync and normal datasets must share central margin semantics")

  console.log(JSON.stringify({
    fixture: "ClevrSync Retail Test 500",
    resolvedReportType: clevrSyncInput.reportType,
    revenue: clevrSyncInput.financials?.revenue,
    cost: clevrSyncInput.financials?.cogs,
    grossProfit: clevrSyncInput.financials?.grossProfit,
    grossMargin: clevrSyncInput.financials?.grossMargin,
    profitMarginKpi: kpiValue(clevrSyncInput, "Profit Margin"),
  }, null, 2))

  return { rows, columns: COLUMNS, expected }
}

async function assertDashboardProfitabilityMetrics(rows: Record<string, unknown>[], columns: string[], expected: ReturnType<typeof expectedTotals>) {
  const analysis = await buildDashboardSemanticAnalysis(dashboardDataset({
    id: "synthetic_clevrsync_retail_test_500",
    name: "ClevrSync Retail Test 500",
    rows,
    columns,
  }))
  assert(analysis.businessProfile === "ecommerce", `dashboard must classify the ClevrSync schema as ecommerce, received ${analysis.businessProfile}`)
  assert(analysis.metrics.some((item) => item.label === "Revenue" && item.available), "dashboard must show Revenue")
  assert(analysis.metrics.some((item) => item.label === "Cost" && item.available), "dashboard must show the canonical Cost metric")
  assert(analysis.metrics.some((item) => item.label === "Profit" && item.available), "dashboard must show the canonical Profit metric")
  assert(analysis.metrics.some((item) => item.label === "Profit Margin" && item.available), "dashboard must show the canonical Profit Margin metric")
  nearlyEqual(dashboardMetricValue(analysis, "Revenue") ?? null, expected.revenue, "dashboard Revenue must match report semantics")
  nearlyEqual(dashboardMetricValue(analysis, "Cost") ?? null, expected.cost, "dashboard Cost must match canonical COGS")
  nearlyEqual(dashboardMetricValue(analysis, "Profit") ?? null, expected.profit, "dashboard Profit must match canonical gross profit")
  nearlyEqual(dashboardMetricValue(analysis, "Profit Margin") ?? null, expected.profitMargin, "dashboard Profit Margin must match canonical gross margin", 0.03)
  assert(!analysis.recommendations.some((item) => /COGS is not available|Product COGS is not available/i.test(item.issue)), "dashboard recommendations must not claim COGS is missing")
}

async function assertUnsafeCostsAreNotCogs() {
  const unsafeColumns = ["Date", "Order ID", "Product", "Category", "Quantity", "Revenue", "Shipping Cost", "Marketing Cost", "Operating Expenses", "Customer", "Country"]
  const rows = Array.from({ length: 60 }, (_, index) => ({
    "Date": `2026-0${(index % 6) + 1}-15`,
    "Order ID": `ORD-${20000 + index}`,
    "Product": PRODUCTS[index % PRODUCTS.length],
    "Category": CATEGORIES[index % CATEGORIES.length],
    "Quantity": (index % 5) + 1,
    "Revenue": Number((100 + index * 3.5).toFixed(2)),
    "Shipping Cost": 8,
    "Marketing Cost": 15,
    "Operating Expenses": 40,
    "Customer": `CUS-${(index % 17) + 1}`,
    "Country": COUNTRIES[index % COUNTRIES.length],
  }))
  const reportInput = await buildDatasetReportInput(dataset({
    id: "synthetic_clevrsync_unsafe_costs",
    name: "ClevrSync Retail Unsafe Costs",
    rows,
    columns: unsafeColumns,
    uploadSource: "clevrsync",
  }))
  assert(reportInput.financials?.cogs === null, "shipping, marketing, or operating costs must never be classified as COGS")
  assert(reportInput.financials?.grossProfit === null, "gross profit must stay unavailable without a recognized direct cost or profit field")
  assert(reportInput.financials?.grossMargin === null, "gross margin must stay unavailable without gross profit")
  assert(reportInput.financials?.netProfit === null, "net profit must never be fabricated from operating expenses")
  assert(
    (reportInput.recommendations ?? []).some((item) => /Product COGS is not available|COGS is not available/i.test(item.issue)),
    "datasets without direct cost data must keep the add-product-cost recommendation",
  )
  assert(kpiValue(reportInput, "Cost") === null, "Cost KPI must stay unavailable when no direct cost field is recognized")
  assert(kpiValue(reportInput, "Profit") === null, "Profit KPI must stay unavailable when profit cannot be derived")
  console.log(JSON.stringify({ fixture: "unsafe_costs", cogs: null, grossProfit: null, recommendationGuard: true }, null, 2))
}

async function assertReportPdfNoLongerClaimsMissingFields(rows: Record<string, unknown>[], expected: ReturnType<typeof expectedTotals>) {
  const report = await generateReport(
    "synthetic_clevrsync_retail_test_500",
    "ClevrSync Retail Test 500.xlsx",
    {
      visibility: "private",
      status: "ready",
      reportType: "ecommerce",
      businessModel: "ecommerce",
      userId: "synthetic_user",
      workspaceId: "synthetic_user",
      idempotencyKey: "clevrsync-retail-profitability-semantics",
    },
    await buildDatasetReportInput(dataset({
      id: "synthetic_clevrsync_retail_test_500",
      name: "ClevrSync Retail Test 500",
      rows,
      columns: COLUMNS,
      uploadSource: "clevrsync",
    })),
  )
  assert(Boolean(report.pdfPath && fs.existsSync(report.pdfPath)), "ClevrSync retail PDF must generate")
  const text = execFileSync("pdftotext", [report.pdfPath!, "-"], { encoding: "utf8" })
  const compactText = text.replace(/\s+/g, " ")
  const costLabel = `$${(expected.cost / 1000).toFixed(1)}K`
  const profitLabel = `$${(expected.profit / 1000).toFixed(1)}K`
  assert(text.includes("COGS"), "PDF must include the COGS row")
  assert(text.includes(costLabel), `PDF must show the recognized COGS total ${costLabel}`)
  assert(text.includes(profitLabel), `PDF must show the recognized gross profit total ${profitLabel}`)
  assert(!compactText.includes("Product COGS is not available"), "PDF must not claim product COGS is missing when the Cost field exists")
  assert(!compactText.includes("Gross profit and gross margin are not available"), "PDF summary must not claim gross profitability is missing")
  assert(!/Add cogs, cost_of_goods_sold/i.test(text), "PDF recommendations must not ask for cost fields that exist")
  deleteReport(report.id)
  console.log(JSON.stringify({ pdfPath: report.pdfPath, costLabel, profitLabel }, null, 2))
}

async function main() {
  process.env.TEMP_DIR = "/tmp/useclevr-clevrsync-retail-profitability-test"
  fs.rmSync(process.env.TEMP_DIR, { recursive: true, force: true })
  fs.mkdirSync(process.env.TEMP_DIR, { recursive: true })

  const { rows, columns, expected } = await assertClevrSyncProfitabilitySemantics()
  await assertDashboardProfitabilityMetrics(rows, columns, expected)
  await assertUnsafeCostsAreNotCogs()
  await assertReportPdfNoLongerClaimsMissingFields(rows, expected)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
