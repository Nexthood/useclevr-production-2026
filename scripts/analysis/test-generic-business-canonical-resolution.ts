import { execFileSync } from "node:child_process"
import * as fs from "node:fs"
import { buildDatasetReportInput } from "../../src/lib/reports/dataset-report-builder"
import { deleteReport, generateReport } from "../../src/lib/reports/report-generator"
import type { EcommerceReportAnalysis, RetailReportAnalysis } from "../../src/lib/reports/report-generator"

type TestDataset = Parameters<typeof buildDatasetReportInput>[0]
type DatasetReportInput = Awaited<ReturnType<typeof buildDatasetReportInput>>
type EcommerceReportInput = DatasetReportInput & {
  ecommerceAnalysis?: EcommerceReportAnalysis
}
type RetailReportInput = DatasetReportInput & {
  retailAnalysis?: RetailReportAnalysis
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function nearlyEqual(actual: number | null | undefined, expected: number, message: string, tolerance = 0.02) {
  assert(typeof actual === "number" && Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, received ${actual}`)
}

function dataset(input: {
  name: string
  rows: Record<string, unknown>[]
  columns: string[]
  businessModel: string
  precomputedMetrics?: Record<string, unknown> | null
}): TestDataset {
  return {
    id: `synthetic_${input.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
    userId: "synthetic_user",
    name: input.name,
    fileName: `${input.name}.xlsx`,
    fileSize: 1000,
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
    precomputedMetrics: input.precomputedMetrics ?? null,
    columnMapping: null,
    detectedColumns: null,
    aiInsights: null,
    status: "ready",
    analysis: {},
    datasetType: input.businessModel === "profitability" ? "profitability" : "standard",
    businessModel: input.businessModel,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as TestDataset
}

function buildGenericBusinessRows() {
  return Array.from({ length: 180 }, (_, index) => {
    const isLast = index === 179
    const quantity = isLast ? 95 : 6
    const revenue = isLast ? 4329.41 : 1900
    const cost = isLast ? 2510.21 : 1120
    return {
      invoice_id: `INV-${String(index + 1).padStart(4, "0")}`,
      customer_id: `CUS-${String((index % 89) + 1).padStart(3, "0")}`,
      product: ["Finance AI", "Retail Bot", "Ledger Lens", "Growth Map", "Cash Radar", "Stock Pulse"][index % 6],
      category: ["Sports", "Finance", "Retail", "Operations", "Analytics", "Automation"][index % 6],
      quantity,
      revenue,
      cost,
      profit: Number((revenue - cost).toFixed(2)),
      country: ["US", "NL", "DE", "GB", "HU"][index % 5],
      channel: ["eBay", "Shopify", "Amazon", "Direct", "Partner"][index % 5],
      salesperson: `Rep ${(index % 9) + 1}`,
    }
  })
}

function kpiValue(reportInput: DatasetReportInput, title: string) {
  return reportInput.kpis.find((kpi) => kpi.title === title)?.value
}

async function assertGenericBusinessCanonicalResolution() {
  const rows = buildGenericBusinessRows()
  const columns = [
    "invoice_id",
    "customer_id",
    "product",
    "category",
    "quantity",
    "revenue",
    "cost",
    "profit",
    "country",
    "channel",
    "salesperson",
  ]
  const reportInput = await buildDatasetReportInput(dataset({
    name: "08_generic_business",
    rows,
    columns,
    businessModel: "generic",
  }))

  assert(reportInput.reportType === "generic", `generic fixture must resolve reportType generic, received ${reportInput.reportType}`)
  assert(reportInput.reportProfile?.id === "generic_business", `generic fixture must use generic business profile, received ${reportInput.reportProfile?.id}`)
  nearlyEqual(reportInput.financials?.revenue, 344429.41, "revenue must sum revenue")
  nearlyEqual(reportInput.financials?.cogs, 202990.21, "generic cost must feed cost/COGS alias")
  nearlyEqual(reportInput.financials?.grossProfit, 141439.2, "explicit profit must feed generic profit/gross-profit alias")
  assert(reportInput.financials?.netProfit === null, "generic profit field must not be labeled net profit")
  nearlyEqual(reportInput.financials?.grossMargin, 41.07, "profit margin must be profit divided by revenue", 0.03)
  assert(reportInput.semanticContext?.mappings.order === "invoice_id", "transaction identifier source must be invoice_id")
  assert(reportInput.semanticContext?.mappings.cogs === "cost", "generic business cost mapping must be cost")
  assert(reportInput.semanticContext?.mappings.grossProfit === "profit", "generic business profit mapping must be profit")
  assert(reportInput.semanticContext?.mappings.netProfit === null, "generic business profit mapping must not become netProfit")
  assert(kpiValue(reportInput, "Orders") === 180, "transaction count must use distinct invoice_id")
  nearlyEqual(kpiValue(reportInput, "AOV"), 1913.5, "AOV must divide revenue by distinct invoice_id")
  assert(kpiValue(reportInput, "Customers") === 89, "customers must use distinct customer_id")
  nearlyEqual(kpiValue(reportInput, "Orders per Customer"), 2.02, "orders per customer must divide invoices by customers", 0.01)
  assert(kpiValue(reportInput, "Units Sold") === 1169, "units must sum quantity")
  assert(kpiValue(reportInput, "Products") === 6, "products must use distinct product values")
  nearlyEqual(kpiValue(reportInput, "Cost"), 202990.21, "Cost KPI must use cost")
  nearlyEqual(kpiValue(reportInput, "Profit"), 141439.2, "Profit KPI must use profit")
  nearlyEqual(kpiValue(reportInput, "Profit Margin"), 41.07, "Profit Margin KPI must use profit / revenue", 0.03)
  assert(reportInput.summary.includes("Gross profitability is available, with $141.4K gross profit and a 41.1% gross margin."), "summary must state available gross profitability")
  assert(reportInput.summary.includes("Operating and net profitability cannot be fully assessed because operating expense, interest, and tax inputs are not available."), "summary must separate unavailable operating and net profitability")
  assert(!reportInput.summary.includes("Profitability cannot be reliably assessed because required cost, expense, interest, or tax fields are missing."), "summary must not use the generic missing-profitability sentence when gross profitability is available")

  console.log(JSON.stringify({
    fixture: "08_generic_business",
    resolvedReportType: reportInput.reportType,
    resolvedModel: reportInput.reportProfile?.id,
    revenue: reportInput.financials?.revenue,
    transactionIdentifierSource: reportInput.semanticContext?.mappings.order,
    transactionCount: kpiValue(reportInput, "Orders"),
    cost: reportInput.financials?.cogs,
    profit: reportInput.financials?.grossProfit,
    profitMargin: reportInput.financials?.grossMargin,
    customers: kpiValue(reportInput, "Customers"),
    units: kpiValue(reportInput, "Units Sold"),
    products: kpiValue(reportInput, "Products"),
  }, null, 2))

  const report = await generateReport("synthetic_08_generic_business", "08_generic_business.xlsx", {
    visibility: "private",
    status: "ready",
    reportType: reportInput.reportType,
    businessModel: reportInput.businessModel,
    userId: "synthetic_user",
    workspaceId: "synthetic_user",
    idempotencyKey: "generic-business-canonical-resolution-regression",
  }, reportInput)

  assert(Boolean(report.pdfPath && fs.existsSync(report.pdfPath)), "generic business PDF must generate")
  const text = execFileSync("pdftotext", [report.pdfPath!, "-"], { encoding: "utf8" })
  const normalizedText = text.toLowerCase()
  const compactText = text.replace(/\s+/g, " ")
  assert(text.includes("EXECUTIVE BI REPORT"), "PDF must use the generic business report")
  assert(normalizedText.includes("orders") && text.includes("180"), "PDF must show invoice-backed Orders")
  assert(normalizedText.includes("aov") && (text.includes("$1.9K") || text.includes("$1,914")), "PDF must show invoice-backed AOV")
  assert(text.includes("COGS") && text.includes("$203.0K"), "PDF must show cost-backed COGS alias")
  assert(text.includes("Gross Profit") && text.includes("$141.4K"), "PDF must show profit-backed Gross Profit alias")
  assert(text.includes("Gross Margin") && text.includes("41.1%"), "PDF must show profit margin")
  assert(compactText.includes("Gross profitability is available, with $141.4K gross profit and a 41.1% gross margin."), "PDF summary must state available gross profitability")
  assert(compactText.includes("Operating and net profitability cannot be fully assessed because operating expense, interest, and tax inputs are not available."), "PDF summary must separate unavailable operating and net profitability")
  assert(!compactText.includes("Profitability cannot be reliably assessed because required cost, expense, interest, or tax fields are missing."), "PDF summary must not use the generic missing-profitability sentence when gross profitability is available")
  assert(!text.includes("Orders = Not available"), "PDF must not show Orders as unavailable")
  assert(!text.includes("AOV = Not available"), "PDF must not show AOV as unavailable")
  assert(!text.includes("No reliable order identifier"), "PDF must not claim order identifiers are missing")
  assert(!text.includes("No recognized COGS source field"), "PDF must not claim cost data is missing")
  assert(!text.includes("Add COGS"), "PDF recommendations must not ask for cost data already present")

  console.log(JSON.stringify({
    pdfPath: report.pdfPath,
    pdfContainsOrders: normalizedText.includes("orders") && text.includes("180"),
    pdfContainsAov: normalizedText.includes("aov") && (text.includes("$1.9K") || text.includes("$1,914")),
    pdfContainsCost: text.includes("$203.0K"),
    pdfContainsProfit: text.includes("$141.4K"),
    pdfContainsMargin: text.includes("41.1%"),
  }, null, 2))

  deleteReport(report.id)
}

async function assertModelScopedFallbacks() {
  const ecommerceRows = [
    { invoice_id: "INV-1", customer_id: "C-1", revenue: 100, cost: 60, profit: 40, product: "A", quantity: 1 },
    { invoice_id: "INV-2", customer_id: "C-2", revenue: 200, cost: 120, profit: 80, product: "B", quantity: 2 },
  ]
  const ecommerceInput = await buildDatasetReportInput(dataset({
    name: "ecommerce_invoice_is_not_global_order",
    rows: ecommerceRows,
    columns: Object.keys(ecommerceRows[0] ?? {}),
    businessModel: "ecommerce",
  })) as EcommerceReportInput
  assert(ecommerceInput.ecommerceAnalysis?.orders === null, "e-commerce must not globally promote invoice_id to order_id")
  assert(ecommerceInput.financials?.cogs === null, "e-commerce must not globally treat exact cost as COGS")

  const retailRows = [
    { invoice_id: "INV-1", revenue: 100, unit_cost: 10, quantity: 2, product: "A", category: "Cat", stock_on_hand: 5, reorder_point: 2 },
    { invoice_id: "INV-2", revenue: 200, unit_cost: 20, quantity: 3, product: "B", category: "Cat", stock_on_hand: 6, reorder_point: 2 },
  ]
  const retailInput = await buildDatasetReportInput(dataset({
    name: "retail_invoice_is_not_global_order",
    rows: retailRows,
    columns: Object.keys(retailRows[0] ?? {}),
    businessModel: "local_retail",
  })) as RetailReportInput
  assert(retailInput.retailAnalysis?.averageOrderValue?.status === "not_available", "retail must not globally promote invoice_id to AOV order ID")
  nearlyEqual(retailInput.financials?.cogs, 80, "retail unit-cost COGS semantics must remain unchanged")

  const profitabilityInput = await buildDatasetReportInput(dataset({
    name: "profitability_semantics_stay_precomputed",
    rows: ecommerceRows,
    columns: Object.keys(ecommerceRows[0] ?? {}),
    businessModel: "profitability",
    precomputedMetrics: {
      totalRevenue: 300,
      cogs: 180,
      grossProfit: 120,
      netProfit: 90,
    },
  }))
  assert(profitabilityInput.reportType === "profitability", "profitability report type must remain profitability")
  nearlyEqual(profitabilityInput.financials?.cogs, 180, "profitability COGS must come from precomputed metrics")
  nearlyEqual(profitabilityInput.financials?.netProfit, 90, "profitability net profit must come from precomputed metrics")
}

async function main() {
  process.env.TEMP_DIR = "/tmp/useclevr-generic-business-canonical-resolution-test"
  fs.rmSync(process.env.TEMP_DIR, { recursive: true, force: true })
  fs.mkdirSync(process.env.TEMP_DIR, { recursive: true })

  await assertGenericBusinessCanonicalResolution()
  await assertModelScopedFallbacks()
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
