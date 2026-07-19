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
