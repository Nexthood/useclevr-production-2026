import * as fs from "fs"
import { calculateProfitabilityAnalysis } from "../../src/lib/profitability/two-file-analysis"

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

function nearlyEqual(actual: number | null, expected: number, message: string) {
  assert(actual !== null, `${message}: expected ${expected}, received null`)
  assert(Math.abs((actual as number) - expected) < 0.001, `${message}: expected ${expected}, received ${actual}`)
}

const revenueFile = {
  role: "revenue" as const,
  name: "profitability_revenue.csv",
  columns: ["period", "department", "revenue", "sales_volume", "customer_id", "product"],
  rows: [
    { period: "2026-01", department: "Retail", revenue: 6000, sales_volume: 60, customer_id: "C1", product: "Store Sales" },
    { period: "2026-01", department: "Online", revenue: 4000, sales_volume: 40, customer_id: "C2", product: "Online Sales" },
  ],
}

const expensesFile = {
  role: "expenses" as const,
  name: "profitability_expenses.csv",
  columns: ["period", "department", "category", "amount"],
  rows: [
    { period: "2026-01", department: "Retail", category: "COGS", amount: 2500 },
    { period: "2026-01", department: "Online", category: "Cost of goods sold", amount: 1500 },
    { period: "2026-01", department: "Retail", category: "Rent", amount: 1200 },
    { period: "2026-01", department: "Online", category: "Marketing", amount: 800 },
    { period: "2026-01", department: "Retail", category: "Interest expense", amount: 300 },
    { period: "2026-01", department: "Retail", category: "Tax expense", amount: 700 },
  ],
}

async function main() {
  const waitingForExpenses = calculateProfitabilityAnalysis({
    analysisId: "pa_wait_expenses",
    revenueFile,
  })
  assert(waitingForExpenses.status === "waiting_for_expenses", "Revenue-only upload should wait for expenses")
  assert(waitingForExpenses.netProfit === null, "Revenue-only upload must not fabricate net profit")

  const waitingForRevenue = calculateProfitabilityAnalysis({
    analysisId: "pa_wait_revenue",
    expensesFile,
  })
  assert(waitingForRevenue.status === "waiting_for_revenue", "Expenses-only upload should wait for revenue")
  assert(waitingForRevenue.grossMargin === null, "Expenses-only upload must not fabricate margin")

  const analysis = calculateProfitabilityAnalysis({
    analysisId: "pa_profitability_pair_a",
    revenueFile,
    expensesFile,
  })

  assert(analysis.status === "ready", "Paired files should produce ready analysis")
  assert(analysis.matchKey === "period_department", "Files should match on period + department")
  nearlyEqual(analysis.totalRevenue, 10000, "Revenue")
  nearlyEqual(analysis.cogs, 4000, "COGS")
  nearlyEqual(analysis.operatingExpenses, 2000, "Operating expenses")
  nearlyEqual(analysis.interestExpense, 300, "Interest")
  nearlyEqual(analysis.taxExpense, 700, "Taxes")
  nearlyEqual(analysis.grossProfit, 6000, "Gross profit")
  nearlyEqual(analysis.operatingProfit, 4000, "Operating profit")
  nearlyEqual(analysis.netProfit, 3000, "Net profit")
  nearlyEqual(analysis.grossMargin, 60, "Gross margin")
  nearlyEqual(analysis.operatingMargin, 40, "Operating margin")
  nearlyEqual(analysis.netMargin, 30, "Net margin")
  assert(analysis.grossProfit !== analysis.netProfit, "Gross Profit and Net Profit must remain distinct")

  const unrelatedExpensesFile = {
    ...expensesFile,
    name: "profitability_expenses_unrelated.csv",
    rows: expensesFile.rows.map((row) => ({ ...row, department: "Unrelated" })),
  }
  const unrelated = calculateProfitabilityAnalysis({
    analysisId: "pa_profitability_pair_b",
    revenueFile,
    expensesFile: unrelatedExpensesFile,
  })
  assert(unrelated.profitabilityAnalysisId !== analysis.profitabilityAnalysisId, "Second pair must keep a separate analysis id")
  assert(unrelated.departmentComparison.some((row) => row.department === "Unrelated"), "Second pair should not mutate first pair departments")
  assert(!analysis.departmentComparison.some((row) => row.department === "Unrelated"), "First pair must not include unrelated expenses")

  const tempDir = "/tmp/useclevr-profitability-report-test"
  process.env.TEMP_DIR = tempDir
  const { generateReport, listReports, deleteReport } = await import("../../src/lib/reports/report-generator")
  const { buildDatasetReportInput } = await import("../../src/lib/reports/dataset-report-builder")
  const builtInput = await buildDatasetReportInput({
    id: "ds_1784303088293_88d3ce8a",
    userId: "synthetic_user",
    name: "Synthetic Profitability Analysis",
    fileName: "synthetic_profitability.csv",
    fileSize: 1000,
    mimeType: "text/csv",
    storageKey: "private/storage/key.csv",
    checksum: null,
    rowCount: revenueFile.rows.length + expensesFile.rows.length,
    columnCount: revenueFile.columns.length + expensesFile.columns.length,
    columns: [...revenueFile.columns, ...expensesFile.columns],
    data: [...revenueFile.rows, ...expensesFile.rows],
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
    precomputedMetrics: analysis,
    columnMapping: null,
    detectedColumns: null,
    aiInsights: null,
    status: "ready",
    analysis: { profitability: analysis },
    datasetType: "profitability",
    businessModel: "generic",
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any)
  const builtText = `${builtInput.summary} ${builtInput.findings.join(" ")}`
  assert(!/\b(ds|pa)_[a-z0-9_-]+\b/i.test(builtText), "Customer report text must not expose dataset or profitability analysis IDs")
  assert(builtInput.reportType === "profitability" && "financials" in builtInput, "Builder must return profitability financials for profitability datasets")
  const profitabilityInput = builtInput as typeof builtInput & { financials: {
    grossProfit: number | null
    operatingProfit: number | null
    netProfit: number | null
  } }
  assert(profitabilityInput.financials.grossProfit === 6000, "Report builder must calculate gross profit from revenue minus COGS")
  assert(profitabilityInput.financials.operatingProfit === 4000, "Report builder must calculate operating profit from gross profit minus operating expenses")
  assert(profitabilityInput.financials.netProfit === 3000, "Report builder must calculate net profit after interest and tax")
  assert(profitabilityInput.financials.netProfit !== profitabilityInput.financials.grossProfit, "Report builder must not copy gross profit into net profit")

  const report = await generateReport("synthetic_profitability_dataset", "Synthetic Profitability Analysis", {
    visibility: "private",
    status: "ready",
    reportType: "profitability",
    businessModel: "generic",
    userId: "synthetic_user",
    workspaceId: "synthetic_user",
    idempotencyKey: "synthetic-profitability-test",
  }, {
    summary: "Synthetic combined profitability report.",
    findings: ["Revenue and expenses are paired by analysis id."],
    kpis: [
      { title: "Revenue", value: analysis.totalRevenue!, format: "currency" },
      { title: "COGS", value: analysis.cogs!, format: "currency" },
      { title: "Gross Profit", value: analysis.grossProfit!, format: "currency" },
      { title: "Operating Profit", value: analysis.operatingProfit!, format: "currency" },
      { title: "Net Profit", value: analysis.netProfit!, format: "currency" },
      { title: "Gross Margin", value: analysis.grossMargin!, format: "percent" },
      { title: "Operating Margin", value: analysis.operatingMargin!, format: "percent" },
      { title: "Net Margin", value: analysis.netMargin!, format: "percent" },
    ],
    charts: [{ type: "bar", title: "Top cost categories", data: analysis.topCostCategories.map(([name, value]) => ({ name, value })) }],
    aiInsights: [],
    predictions: [],
    alerts: [],
    rowCount: revenueFile.rows.length + expensesFile.rows.length,
    columns: [...revenueFile.columns, ...expensesFile.columns],
  })
  const persisted = listReports("synthetic_profitability_dataset").some((item) => item.id === report.id && item.reportType === "profitability")
  const pdfGenerated = Boolean(report.pdfPath && fs.existsSync(report.pdfPath))
  assert(report.kpis.find((kpi) => kpi.title === "Net Margin")?.value === "30.0%", "Percent KPIs must use one decimal place")
  assert(report.kpis.find((kpi) => kpi.title === "COGS")?.value === "$4.0K", "Currency KPIs must use compact professional formatting")
  if (report.pdfPath && fs.existsSync(report.pdfPath)) fs.unlinkSync(report.pdfPath)
  deleteReport(report.id)
  fs.rmSync(tempDir, { recursive: true, force: true })

  assert(persisted, "Profitability report should persist")
  assert(pdfGenerated, "Profitability PDF should generate")

  console.log(JSON.stringify({
    status: analysis.status,
    revenue: analysis.totalRevenue,
    cogs: analysis.cogs,
    operatingExpenses: analysis.operatingExpenses,
    grossProfit: analysis.grossProfit,
    operatingProfit: analysis.operatingProfit,
    netProfit: analysis.netProfit,
    grossMargin: analysis.grossMargin,
    operatingMargin: analysis.operatingMargin,
    netMargin: analysis.netMargin,
    reportPersisted: persisted,
    pdfGenerated,
    datasetIsolation: "pass",
  }))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
