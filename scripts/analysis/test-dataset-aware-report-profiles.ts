import { execFileSync } from "node:child_process"
import * as fs from "node:fs"
import * as path from "node:path"
import { parseCSVStreaming } from "../../src/lib/data/csvLoader"
import type { ReportProfileId } from "../../src/lib/reports/report-profiles"

type DatasetInput = Parameters<typeof import("../../src/lib/reports/dataset-report-builder").buildDatasetReportInput>[0]
type DatasetReportInput = Awaited<ReturnType<typeof import("../../src/lib/reports/dataset-report-builder")["buildDatasetReportInput"]>>
type BuildDatasetReportInput = typeof import("../../src/lib/reports/dataset-report-builder")["buildDatasetReportInput"]
type GenerateReport = typeof import("../../src/lib/reports/report-generator")["generateReport"]
type DeleteReport = typeof import("../../src/lib/reports/report-generator")["deleteReport"]

type FixtureCase = {
  family: string
  baseName: string
  businessModel: string
  expectedProfile: ReportProfileId
}

const availableFixtures: FixtureCase[] = [
  { family: "local_retail", baseName: "01_local_retail", businessModel: "local_retail", expectedProfile: "local_retail" },
  { family: "ecommerce", baseName: "ecommerce", businessModel: "ecommerce", expectedProfile: "ecommerce" },
  { family: "saas_startup", baseName: "startup-saas", businessModel: "saas", expectedProfile: "saas_startup" },
  { family: "investor_portfolio", baseName: "investor-portfolio", businessModel: "investor", expectedProfile: "investor_portfolio" },
  { family: "business_consulting", baseName: "business-consulting", businessModel: "generic", expectedProfile: "business_consulting" },
]

const requiredFixtureNames = [
  "01_local_retail",
  "02_ecommerce",
  "03_saas_startup",
  "04_marketplace_startup",
  "05_investor_portfolio",
  "06_business_consulting",
  "07_professional_services",
  "08_generic_business",
  "09_profitability_pnl",
  "10_accountancy_ledger",
]

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

function nearlyEqual(actual: number | null | undefined, expected: number | null | undefined, message: string, tolerance = 0.02) {
  assert(typeof actual === "number" && typeof expected === "number" && Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, received ${actual}`)
}

async function main() {
  process.env.TEMP_DIR = "/tmp/useclevr-dataset-aware-report-profile-test"
  fs.rmSync(process.env.TEMP_DIR, { recursive: true, force: true })
  fs.mkdirSync(process.env.TEMP_DIR, { recursive: true })

  const { buildDatasetReportInput } = await import("../../src/lib/reports/dataset-report-builder")
  const { deleteReport, generateReport } = await import("../../src/lib/reports/report-generator")
  const { listReportProfiles } = await import("../../src/lib/reports/report-profiles")

  const profileIds = listReportProfiles().map((profile) => profile.id).sort()
  for (const expected of [
    "local_retail",
    "ecommerce",
    "saas_startup",
    "marketplace_startup",
    "investor_portfolio",
    "business_consulting",
    "professional_services",
    "generic_business",
    "profitability_pnl",
    "accountancy_ledger",
  ] satisfies ReportProfileId[]) {
    assert(profileIds.includes(expected), `Missing report profile: ${expected}`)
  }

  const fixtureRoot = path.join(process.cwd(), "test-fixtures", "business-models")
  const results: Array<{ fixture: string; profile: string; rows: number; pdfVerified?: boolean }> = []
  const retailParity: Record<string, { revenue: number | null; cogs: number | null; grossProfit: number | null; grossMargin: number | null; aovStatus?: string; inventoryValue: number | null; reorderRequiredCount: number | null }> = {}

  for (const fixture of availableFixtures) {
    for (const extension of ["csv", "xlsx"] as const) {
      const filePath = path.join(fixtureRoot, `${fixture.baseName}.${extension}`)
      assert(fs.existsSync(filePath), `Missing available fixture ${filePath}`)
      const parsed = await parseFixture(filePath)
      const dataset = buildDataset({
        id: `profile_${fixture.family}_${extension}`,
        filePath,
        rowCount: parsed.rowCount,
        columns: parsed.columns,
        rows: parsed.previewRows,
        businessModel: fixture.businessModel,
      })
      const reportInput = await buildDatasetReportInput(dataset)
      assert(reportInput.reportProfile?.id === fixture.expectedProfile, `${fixture.family}.${extension}: expected ${fixture.expectedProfile}, received ${reportInput.reportProfile?.id}`)
      assert(reportInput.rowCount === parsed.rowCount, `${fixture.family}.${extension}: report row count mismatch`)

      if (fixture.family === "local_retail") {
        assert(reportInput.reportProfile.title === "Retail Executive Report", "local retail must use Retail Executive Report")
        assert(reportInput.kpis.some((kpi) => kpi.title === "Gross Profit"), "local retail must include Gross Profit")
        assert(reportInput.kpis.some((kpi) => kpi.title === "Gross Margin"), "local retail must include Gross Margin")
        assert(reportInput.kpis.some((kpi) => kpi.title === "Units Sold"), "local retail must include Units Sold")
        assert(reportInput.kpis.some((kpi) => kpi.title === "Current Stock"), "local retail must include Current Stock")
        assert(reportInput.kpis.some((kpi) => kpi.title === "Inventory Value"), "local retail must include Inventory Value")
        assert(reportInput.kpis.some((kpi) => kpi.title === "Products / SKUs"), "local retail must include Products / SKUs")
        assert(reportInput.kpis.some((kpi) => kpi.title === "Reorder Required"), "local retail must include Reorder Required")
        assert(reportInput.financials?.revenue === 4455, "local retail revenue must match fixture")
        assert(reportInput.financials?.cogs === 2180, "local retail COGS must use fixture cost field")
        assert(reportInput.financials?.grossProfit === 2275, "local retail gross profit must be revenue minus cost")
        assert(reportInput.financials?.grossMargin === 51.07, "local retail gross margin must match fixture")
        assertRetailCategoryReconciliation(reportInput, `${fixture.baseName}.${extension}`)
        assert(reportInput.retailAnalysis?.averageOrderValue?.status === "not_available", "local retail fixture without order ID must not show AOV")
        retailParity[extension] = {
          revenue: reportInput.financials?.revenue ?? null,
          cogs: reportInput.financials?.cogs ?? null,
          grossProfit: reportInput.financials?.grossProfit ?? null,
          grossMargin: reportInput.financials?.grossMargin ?? null,
          aovStatus: reportInput.retailAnalysis?.averageOrderValue?.status,
          inventoryValue: reportInput.retailAnalysis?.inventoryValue ?? null,
          reorderRequiredCount: reportInput.retailAnalysis?.reorderRequiredCount ?? null,
        }
        const recommendationText = reportInput.recommendations?.map((item) => `${item.issue} ${item.recommendedAction}`).join(" ") || ""
        assert(!/interest|tax|operating expenses/i.test(recommendationText), "local retail recommendations must not lead with generic P&L missing-field advice")
      }

      if (fixture.family === "local_retail" && extension === "xlsx") {
        const report = await generateReport(dataset.id, "01_local_retail.xlsx", {
          visibility: "private",
          status: "ready",
          reportType: reportInput.reportType,
          businessModel: reportInput.businessModel,
          userId: "synthetic_user",
          workspaceId: "synthetic_user",
          idempotencyKey: "dataset-aware-retail-profile",
        }, reportInput)
        assert(Boolean(report.pdfPath && fs.existsSync(report.pdfPath)), "local retail PDF must generate")
        const pdfText = execFileSync("pdftotext", [report.pdfPath!, "-"], { encoding: "utf8" })
        assert(pdfText.includes("RETAIL EXECUTIVE REPORT"), "local retail PDF must identify the retail report")
        assert(pdfText.includes("SALES & MARGIN PERFORMANCE"), "local retail PDF must include sales and margin page")
        assert(pdfText.includes("INVENTORY INTELLIGENCE"), "local retail PDF must include inventory page")
        assert(pdfText.includes("PRODUCT / CATEGORY / SUPPLIER INTELLIGENCE"), "local retail PDF must include product/category/supplier page")
        assert(pdfText.includes("RETAIL RECOMMENDATIONS + PROVENANCE"), "local retail PDF must include retail recommendations page")
        assert(!pdfText.includes("Interest Expense"), "local retail PDF must not render generic interest expense row")
        assert(!pdfText.includes("Tax Expense"), "local retail PDF must not render generic tax expense row")
        assert(!pdfText.includes("COST INTELLIGENCE"), "local retail PDF must not render generic cost intelligence page")
        assert(!pdfText.includes("$443"), "local retail PDF must not display row-count revenue as Average Order Value")
        assert(pdfText.includes("No reliable order identifier"), "local retail PDF must explain unavailable AOV semantics")
        if (report.pdfPath) fs.unlinkSync(report.pdfPath)
        deleteReport(report.id)
        results.push({ fixture: `${fixture.baseName}.${extension}`, profile: reportInput.reportProfile.id, rows: reportInput.rowCount, pdfVerified: true })
      } else {
        results.push({ fixture: `${fixture.baseName}.${extension}`, profile: reportInput.reportProfile.id, rows: reportInput.rowCount })
      }
    }
  }

  assert(JSON.stringify(retailParity.csv) === JSON.stringify(retailParity.xlsx), "local retail CSV and XLSX outputs must match for financials, AOV status, inventory value, and reorder metrics")
  await assertRetailUnitCostAndAovRegressions(buildDatasetReportInput, generateReport, deleteReport)

  const missingRequiredFixtures = requiredFixtureNames.flatMap((name) => {
    return ["csv", "xlsx"].map((extension) => `${name}.${extension}`).filter((fileName) => !fs.existsSync(path.join(fixtureRoot, fileName)))
  })

  fs.rmSync(process.env.TEMP_DIR, { recursive: true, force: true })

  console.log(JSON.stringify({
    implementedProfiles: profileIds,
    availableFixtureResults: results,
    exactRequiredFixtureMatrix: {
      expected: requiredFixtureNames.length * 2,
      found: requiredFixtureNames.length * 2 - missingRequiredFixtures.length,
      missing: missingRequiredFixtures,
    },
  }, null, 2))
}

function assertRetailCategoryReconciliation(reportInput: DatasetReportInput, label: string) {
  const margins = reportInput.retailAnalysis?.grossMarginByCategory || []
  assert(margins.length > 0, `${label}: category gross margin rows must be available`)
  const revenue = margins.reduce((total, item) => total + item.revenue, 0)
  const cogs = margins.reduce((total, item) => total + item.cogs, 0)
  const grossProfit = margins.reduce((total, item) => total + item.grossProfit, 0)
  nearlyEqual(revenue, reportInput.financials?.revenue ?? null, `${label}: category revenue must reconcile`, 0.01)
  nearlyEqual(cogs, reportInput.financials?.cogs ?? null, `${label}: category COGS must reconcile`, 0.01)
  nearlyEqual(grossProfit, reportInput.financials?.grossProfit ?? null, `${label}: category gross profit must reconcile`, 0.01)
  const weightedMargin = revenue > 0 ? (grossProfit / revenue) * 100 : null
  nearlyEqual(weightedMargin, reportInput.financials?.grossMargin ?? null, `${label}: weighted category margin must reconcile`, 0.02)
}

async function assertRetailUnitCostAndAovRegressions(
  buildDatasetReportInput: BuildDatasetReportInput,
  generateReport: GenerateReport,
  deleteReport: DeleteReport,
) {
  const rows = buildSyntheticRetailRows()
  const columns = Object.keys(rows[0] ?? {})
  const unitCostDataset = buildDataset({
    id: "profile_01_local_retail_unit_cost",
    filePath: path.join(process.cwd(), "test-fixtures", "business-models", "01_local_retail.xlsx"),
    rowCount: rows.length,
    columns,
    rows,
    businessModel: "local_retail",
  })
  const reportInput = await buildDatasetReportInput(unitCostDataset)
  assert(reportInput.rowCount === 180, "synthetic local retail regression must analyze 180 rows")
  nearlyEqual(reportInput.financials?.revenue, 79800, "unit-cost retail revenue must match fixture")
  nearlyEqual(reportInput.financials?.cogs, 48100, "unit-cost retail COGS must multiply unit cost by units sold")
  nearlyEqual(reportInput.financials?.grossProfit, 31700, "unit-cost retail gross profit must match fixture")
  nearlyEqual(reportInput.financials?.grossMargin, 39.72, "unit-cost retail gross margin must match fixture", 0.03)
  assert(reportInput.retailAnalysis?.productCount === 35, "unit-cost retail fixture must preserve product/SKU count")
  assert(reportInput.retailAnalysis?.reorderRequiredCount === 10, "unit-cost retail fixture must preserve reorder count")
  assert(reportInput.retailAnalysis?.averageOrderValue?.status === "not_available", "retail rows without order semantics must mark AOV unavailable")
  assert(!reportInput.kpis.some((kpi) => kpi.title === "AOV"), "retail rows without order semantics must not expose an AOV KPI")
  assertRetailCategoryReconciliation(reportInput, "unit-cost retail")
  assert(reportInput.retailAnalysis!.grossMarginByCategory.every((item) => item.grossMargin < 60), "unit-cost retail category margins must not show impossible unit-cost percentages")
  assert(reportInput.retailAnalysis!.grossMarginByCategory.every((item) => item.cogsSource === "unit_cost x units_sold"), "unit-cost retail category rows must expose COGS provenance")

  const report = await generateReport(unitCostDataset.id, "01_local_retail.xlsx", {
    visibility: "private",
    status: "ready",
    reportType: reportInput.reportType,
    businessModel: reportInput.businessModel,
    userId: "synthetic_user",
    workspaceId: "synthetic_user",
    idempotencyKey: "retail-unit-cost-aov-regression",
  }, reportInput)
  assert(Boolean(report.pdfPath && fs.existsSync(report.pdfPath)), "unit-cost retail PDF must generate")
  const pdfText = execFileSync("pdftotext", [report.pdfPath!, "-"], { encoding: "utf8" })
  assert(pdfText.includes("RETAIL EXECUTIVE REPORT"), "unit-cost retail PDF must identify the retail report")
  assert(pdfText.includes("INVENTORY INTELLIGENCE"), "unit-cost retail PDF must keep inventory intelligence")
  assert(pdfText.includes("RETAIL RECOMMENDATIONS + PROVENANCE"), "unit-cost retail PDF must keep retail recommendations and provenance")
  assert(!pdfText.includes("$443"), "unit-cost retail PDF must not display revenue per row as AOV")
  assert(!/9[0-2]\.[0-9]%/.test(pdfText), "unit-cost retail PDF must not render impossible 90-92% category margins")
  if (report.pdfPath) fs.unlinkSync(report.pdfPath)
  deleteReport(report.id)

  const orderRows = [
    { order_id: "ORDER-001", revenue: 30, unit_cost: 10, units_sold: 1, category: "Coffee", product_id: "SKU-1" },
    { order_id: "ORDER-001", revenue: 40, unit_cost: 12, units_sold: 1, category: "Coffee", product_id: "SKU-2" },
    { order_id: "ORDER-001", revenue: 50, unit_cost: 14, units_sold: 1, category: "Coffee", product_id: "SKU-3" },
    { order_id: "ORDER-002", revenue: 60, unit_cost: 16, units_sold: 1, category: "Food", product_id: "SKU-4" },
    { order_id: "ORDER-002", revenue: 70, unit_cost: 18, units_sold: 1, category: "Food", product_id: "SKU-5" },
    { order_id: "ORDER-003", revenue: 80, unit_cost: 20, units_sold: 1, category: "Home", product_id: "SKU-6" },
    { order_id: "ORDER-003", revenue: 90, unit_cost: 22, units_sold: 1, category: "Home", product_id: "SKU-7" },
    { order_id: "ORDER-003", revenue: 100, unit_cost: 24, units_sold: 1, category: "Home", product_id: "SKU-8" },
    { order_id: "ORDER-003", revenue: 110, unit_cost: 26, units_sold: 1, category: "Home", product_id: "SKU-9" },
  ]
  const orderReport = await buildDatasetReportInput(buildDataset({
    id: "profile_retail_distinct_order_aov",
    filePath: path.join(process.cwd(), "test-fixtures", "business-models", "01_local_retail.csv"),
    rowCount: orderRows.length,
    columns: Object.keys(orderRows[0] ?? {}),
    rows: orderRows,
    businessModel: "local_retail",
  }))
  const aov = orderReport.retailAnalysis?.averageOrderValue
  assert(aov?.status === "available", "retail fixture with order ID must calculate AOV")
  nearlyEqual(aov?.value, 210, "retail AOV must divide revenue by distinct order count")
  assert(aov?.calculationMethod === "total_revenue / distinct_order_id", "retail AOV must expose distinct-order provenance")
}

function buildSyntheticRetailRows() {
  const categories = [
    { name: "Beauty", cogs: 7900 },
    { name: "Sports", cogs: 8050 },
    { name: "Electronics", cogs: 8150 },
    { name: "Office", cogs: 8000 },
    { name: "Food", cogs: 8100 },
    { name: "Home", cogs: 7900 },
  ]
  const rows: Record<string, unknown>[] = []
  for (let index = 0; index < 180; index += 1) {
    const category = categories[Math.floor(index / 30)]
    const productIndex = index % 35
    rows.push({
      date: "2026-07-01",
      store_id: `STORE-${(index % 3) + 1}`,
      product_id: `SKU-${String(productIndex + 1).padStart(3, "0")}`,
      category: category.name,
      units_sold: 10,
      revenue: 13300 / 30,
      unit_cost: category.cogs / 30 / 10,
      stock_on_hand: productIndex < 10 ? 3 : 20,
      reorder_point: 5,
      supplier: `Supplier ${(productIndex % 7) + 1}`,
      location: "Amsterdam",
    })
  }
  return rows
}

async function parseFixture(filePath: string) {
  const buffer = fs.readFileSync(filePath)
  const file = new File([buffer], path.basename(filePath), { type: mimeTypeForFile(filePath) })
  return parseCSVStreaming(file, 1000)
}

function buildDataset(input: {
  id: string
  filePath: string
  rowCount: number
  columns: string[]
  rows: Record<string, unknown>[]
  businessModel: string
}): DatasetInput {
  return {
    id: input.id,
    userId: "synthetic_user",
    name: path.basename(input.filePath),
    fileName: path.basename(input.filePath),
    fileSize: fs.statSync(input.filePath).size,
    mimeType: mimeTypeForFile(input.filePath),
    storageKey: null,
    checksum: null,
    rowCount: input.rowCount,
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
    analysis: {},
    datasetType: "standard",
    businessModel: input.businessModel,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as DatasetInput
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
