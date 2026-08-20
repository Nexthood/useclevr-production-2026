import { execFileSync } from "node:child_process"
import * as fs from "node:fs"
import * as path from "node:path"
import { parseCSVStreaming } from "../../src/lib/data/csvLoader"
import { buildDatasetReportInput } from "../../src/lib/reports/dataset-report-builder"
import { deleteReport, generateReport } from "../../src/lib/reports/report-generator"

type TestDataset = Parameters<typeof buildDatasetReportInput>[0]
type DatasetReportInput = Awaited<ReturnType<typeof buildDatasetReportInput>>

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function nearlyEqual(actual: number | null | undefined, expected: number, message: string, tolerance = 0.02) {
  assert(typeof actual === "number" && Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, received ${actual}`)
}

function mimeTypeForFile(filePath: string) {
  return filePath.endsWith(".xlsx")
    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    : "text/csv"
}

async function parseFixture(filePath: string) {
  const buffer = fs.readFileSync(filePath)
  const file = new File([buffer], path.basename(filePath), { type: mimeTypeForFile(filePath) })
  return parseCSVStreaming(file, 1000)
}

function dataset(input: {
  id: string
  name: string
  rows: Record<string, unknown>[]
  columns: string[]
  rowCount: number
  mimeType: string
}): TestDataset {
  return {
    id: input.id,
    userId: "synthetic_user",
    name: input.name,
    fileName: input.name,
    fileSize: 1000,
    mimeType: input.mimeType,
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
    businessModel: "local_retail",
    createdAt: new Date(),
    updatedAt: new Date(),
  } as TestDataset
}

function kpiValue(reportInput: DatasetReportInput, title: string) {
  return reportInput.kpis.find((kpi) => kpi.title === title)?.value
}

function numberValue(value: unknown) {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : null
}

function latestSnapshots(rows: Record<string, unknown>[]) {
  const latest = new Map<string, Record<string, unknown>>()
  rows.forEach((row, index) => {
    const key = `${row.store_id}::${row.product_id}`
    const current = latest.get(key)
    const candidateTime = new Date(String(row.date)).getTime()
    const currentTime = current ? new Date(String(current.date)).getTime() : NaN
    if (!current || candidateTime > currentTime || (candidateTime === currentTime && index >= rows.indexOf(current))) {
      latest.set(key, row)
    }
  })
  return Array.from(latest.values())
}

function expectedInventoryValue(rows: Record<string, unknown>[]) {
  return latestSnapshots(rows).reduce((total, row) => {
    const stock = numberValue(row.stock_on_hand)
    const unitCost = numberValue(row.unit_cost)
    return stock === null || unitCost === null ? total : total + stock * unitCost
  }, 0)
}

function stockByCategoryTotal(reportInput: DatasetReportInput) {
  return reportInput.retailAnalysis?.stockByCategory.reduce((total, item) => total + item.value, 0) ?? null
}

async function assertLocalRetailFixture(extension: "csv" | "xlsx") {
  const fixturePath = path.join(process.cwd(), "test-fixtures", "business-models", `01_local_retail.${extension}`)
  const parsed = await parseFixture(fixturePath)
  const rows = parsed.previewRows
  const reportInput = await buildDatasetReportInput(dataset({
    id: `retail_inventory_snapshot_${extension}`,
    name: `01_local_retail.${extension}`,
    rows,
    columns: parsed.columns,
    rowCount: parsed.rowCount,
    mimeType: mimeTypeForFile(fixturePath),
  }))

  const snapshots = latestSnapshots(rows)
  const historicalStock = rows.reduce((total, row) => total + (numberValue(row.stock_on_hand) ?? 0), 0)
  const currentStock = snapshots.reduce((total, row) => total + (numberValue(row.stock_on_hand) ?? 0), 0)
  const reorderRequired = snapshots.filter((row) => {
    const stock = numberValue(row.stock_on_hand)
    const reorderPoint = numberValue(row.reorder_point)
    return stock !== null && reorderPoint !== null && stock <= reorderPoint
  }).length

  assert(parsed.rowCount === 180, `${extension}: fixture must contain 180 transaction rows`)
  nearlyEqual(reportInput.financials?.revenue, 79800, `${extension}: revenue must use all transaction rows`, 0.01)
  nearlyEqual(reportInput.financials?.cogs, 48100, `${extension}: COGS must use all transaction rows`, 0.01)
  nearlyEqual(reportInput.financials?.grossProfit, 31700, `${extension}: gross profit must use all transaction rows`, 0.01)
  nearlyEqual(reportInput.financials?.grossMargin, 39.72, `${extension}: gross margin must use all transaction rows`, 0.03)
  nearlyEqual(kpiValue(reportInput, "Units Sold"), 1216, `${extension}: units sold must use all transaction rows`, 0.01)
  assert(reportInput.retailAnalysis?.productCount === 35, `${extension}: product count must remain distinct product IDs`)
  assert(historicalStock === 10643, `${extension}: historical stock sum guard must be 10,643`)
  assert(currentStock === 6341, `${extension}: independent latest-snapshot stock must be 6,341`)
  assert(reportInput.retailAnalysis?.currentStock === 6341, `${extension}: Current Stock must use latest store-product snapshots`)
  assert(reportInput.retailAnalysis?.currentStock !== historicalStock, `${extension}: Current Stock must not sum historical stock snapshots`)
  assert(reorderRequired === 11, `${extension}: independent reorder count must be 11 current positions`)
  assert(reportInput.retailAnalysis?.reorderRequiredCount === 11, `${extension}: Reorder Required must use latest store-product snapshots`)
  assert(kpiValue(reportInput, "Low Stock Positions") === 11, `${extension}: Low Stock Positions KPI must use latest store-product snapshots`)
  nearlyEqual(reportInput.retailAnalysis?.inventoryValue, expectedInventoryValue(rows), `${extension}: inventory value must use latest store-product snapshots`, 0.01)
  assert(stockByCategoryTotal(reportInput) === 6341, `${extension}: stock by category must use latest store-product snapshots`)

  return reportInput
}

async function assertSyntheticSameStoreProduct() {
  const rows = [
    { date: "2026-01-01", store_id: "STORE-1", product_id: "SKU-1", category: "Coffee", units_sold: 1, revenue: 10, unit_cost: 2, stock_on_hand: 100, reorder_point: 50 },
    { date: "2026-01-10", store_id: "STORE-1", product_id: "SKU-1", category: "Coffee", units_sold: 1, revenue: 10, unit_cost: 2, stock_on_hand: 70, reorder_point: 50 },
    { date: "2026-01-20", store_id: "STORE-1", product_id: "SKU-1", category: "Coffee", units_sold: 1, revenue: 10, unit_cost: 2, stock_on_hand: 40, reorder_point: 50 },
  ]
  const reportInput = await buildDatasetReportInput(dataset({
    id: "retail_inventory_snapshot_same_store_product",
    name: "same_store_product.csv",
    rows,
    columns: Object.keys(rows[0] ?? {}),
    rowCount: rows.length,
    mimeType: "text/csv",
  }))
  const currentStock = reportInput.retailAnalysis?.currentStock ?? null
  assert(currentStock !== 210, "same-store same-product current stock must not sum historical rows")
  assert(currentStock === 40, "same-store same-product current stock must use the latest dated row")
  assert(reportInput.retailAnalysis?.reorderRequiredCount === 1, "same-store same-product reorder status must use the latest dated row")
}

async function main() {
  process.env.TEMP_DIR = "/tmp/useclevr-local-retail-inventory-snapshot-test"
  fs.rmSync(process.env.TEMP_DIR, { recursive: true, force: true })
  fs.mkdirSync(process.env.TEMP_DIR, { recursive: true })

  await assertLocalRetailFixture("csv")
  const xlsxReportInput = await assertLocalRetailFixture("xlsx")
  await assertSyntheticSameStoreProduct()

  const report = await generateReport("retail_inventory_snapshot_xlsx", "01_local_retail.xlsx", {
    visibility: "private",
    status: "ready",
    reportType: xlsxReportInput.reportType,
    businessModel: xlsxReportInput.businessModel,
    userId: "synthetic_user",
    workspaceId: "synthetic_user",
    idempotencyKey: "local-retail-inventory-snapshot-regression",
  }, xlsxReportInput)
  assert(Boolean(report.pdfPath && fs.existsSync(report.pdfPath)), "local retail PDF must generate")
  const pdfText = execFileSync("pdftotext", [report.pdfPath!, "-"], { encoding: "utf8" })
  assert(pdfText.includes("RETAIL EXECUTIVE REPORT"), "PDF must use the retail report branch")
  assert(pdfText.includes("6,341"), "PDF must show Current Stock 6,341")
  assert(/LOW STOCK POSITIONS/i.test(pdfText), "PDF must show inventory-position low-stock terminology")
  assert(pdfText.includes("11"), "PDF must show Reorder Required count 11")
  assert(!pdfText.includes("10,643"), "PDF must not show historical stock sum as Current Stock")

  console.log(JSON.stringify({
    fixture: "01_local_retail",
    snapshotGrain: "store_id + product_id latest valid date",
    currentStock: xlsxReportInput.retailAnalysis?.currentStock,
    reorderRequiredCount: xlsxReportInput.retailAnalysis?.reorderRequiredCount,
    inventoryValue: xlsxReportInput.retailAnalysis?.inventoryValue,
    revenue: xlsxReportInput.financials?.revenue,
    cogs: xlsxReportInput.financials?.cogs,
    grossProfit: xlsxReportInput.financials?.grossProfit,
    grossMargin: xlsxReportInput.financials?.grossMargin,
    unitsSold: kpiValue(xlsxReportInput, "Units Sold"),
    products: xlsxReportInput.retailAnalysis?.productCount,
    pdfPath: report.pdfPath,
  }, null, 2))

  deleteReport(report.id)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
