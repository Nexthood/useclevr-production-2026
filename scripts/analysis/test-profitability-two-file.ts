import * as fs from "fs"
import { execFileSync } from "child_process"
import { calculateProfitabilityAnalysis } from "../../src/lib/profitability/two-file-analysis"
import { resolveBusinessModel } from "../../src/lib/data/business-model"
import { buildDashboardSemanticAnalysis } from "../../src/lib/data/dashboard-semantic-profile"

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

function nearlyEqual(actual: number | null, expected: number, message: string) {
  assert(actual !== null, `${message}: expected ${expected}, received null`)
  assert(Math.abs((actual as number) - expected) < 0.001, `${message}: expected ${expected}, received ${actual}`)
}

function assertIncludes(text: string, expected: string, message: string) {
  assert(text.includes(expected), `${message}: expected "${expected}"`)
}

function assertNotIncludes(text: string, unexpected: string, message: string) {
  assert(!text.includes(unexpected), `${message}: unexpected "${unexpected}"`)
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
  assert(waitingForRevenue.operatingProfit === null, "Expenses-only upload must not derive operating profit without revenue")

  const opexOnlyExpensesFile = {
    role: "expenses" as const,
    name: "profitability_expenses_opex_only.csv",
    columns: ["period", "department", "category", "amount"],
    rows: [
      { period: "2026-01", department: "Retail", category: "Salaries", amount: 1200 },
      { period: "2026-01", department: "Online", category: "Marketing", amount: 800 },
    ],
  }
  const opexOnly = calculateProfitabilityAnalysis({
    analysisId: "pa_profitability_opex_only",
    revenueFile,
    expensesFile: opexOnlyExpensesFile,
  })
  nearlyEqual(opexOnly.totalRevenue, 10000, "Opex-only paired revenue")
  nearlyEqual(opexOnly.operatingExpenses, 2000, "Opex-only paired operating expenses")
  assert(opexOnly.reportingPeriod === "2026-01", "Opex-only paired reporting period must come from source periods")
  assert(opexOnly.cogs === null, "Opex-only paired COGS must remain unavailable")
  assert(opexOnly.grossProfit === null, "Opex-only paired gross profit must remain unavailable")
  assert(opexOnly.grossMargin === null, "Opex-only paired gross margin must remain unavailable")
  nearlyEqual(opexOnly.operatingProfit, 8000, "Opex-only paired operating profit")
  nearlyEqual(opexOnly.operatingMargin, 80, "Opex-only paired operating margin")
  assert(opexOnly.interestExpense === null, "Missing interest must remain unavailable")
  assert(opexOnly.taxExpense === null, "Missing tax must remain unavailable")
  assert(opexOnly.netProfit === null, "Net profit must require source-backed interest and tax")
  assert(opexOnly.netMargin === null, "Net margin must require source-backed net profit")
  assert(opexOnly.metricSources.operatingProfit?.kind === "derived_value", "Opex-only operating profit must be derived")
  assert(opexOnly.metricSources.operatingProfit?.note.includes("Revenue minus source-backed operating expenses"), "Opex-only operating profit provenance must name the paired formula")

  const partialOpex = calculateProfitabilityAnalysis({
    analysisId: "pa_profitability_partial_opex",
    revenueFile,
    expensesFile: {
      ...opexOnlyExpensesFile,
      name: "profitability_expenses_partial_opex.csv",
      operatingExpenseCoverage: "partial",
    },
  })
  nearlyEqual(partialOpex.totalRevenue, 10000, "Partial opex paired revenue")
  nearlyEqual(partialOpex.operatingExpenses, 2000, "Partial opex source total")
  assert(partialOpex.operatingExpenseCoverage === "partial", "Partial opex must preserve incomplete source coverage")
  assert(partialOpex.operatingProfit === null, "Partial opex must not derive operating profit")
  assert(partialOpex.operatingMargin === null, "Partial opex must not derive operating margin")
  assert(partialOpex.metricSources.operatingProfit?.kind === "unavailable", "Partial opex operating profit must be unavailable")
  assert(partialOpex.metricSources.operatingProfit?.note.includes("complete operating-expense source"), "Partial opex provenance must require complete operating expenses")

  const explicitZeroInterestTax = calculateProfitabilityAnalysis({
    analysisId: "pa_profitability_zero_interest_tax",
    revenueFile,
    expensesFile: {
      ...opexOnlyExpensesFile,
      rows: [
        ...opexOnlyExpensesFile.rows,
        { period: "2026-01", department: "Retail", category: "Interest expense", amount: 0 },
        { period: "2026-01", department: "Retail", category: "Tax expense", amount: 0 },
      ],
    },
  })
  nearlyEqual(explicitZeroInterestTax.operatingProfit, 8000, "Explicit zero interest/tax operating profit")
  nearlyEqual(explicitZeroInterestTax.interestExpense, 0, "Explicit zero interest")
  nearlyEqual(explicitZeroInterestTax.taxExpense, 0, "Explicit zero tax")
  nearlyEqual(explicitZeroInterestTax.netProfit, 8000, "Explicit zero interest/tax net profit")
  nearlyEqual(explicitZeroInterestTax.netMargin, 80, "Explicit zero interest/tax net margin")

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

  const opexOnlyBuiltInput = await buildDatasetReportInput({
    id: "ds_profitability_opex_only",
    userId: "synthetic_user",
    name: "Synthetic Opex-Only Profitability Analysis",
    fileName: "synthetic_profitability_opex_only.csv",
    fileSize: 1000,
    mimeType: "text/csv",
    storageKey: "private/storage/key.csv",
    checksum: null,
    rowCount: revenueFile.rows.length + opexOnlyExpensesFile.rows.length,
    columnCount: revenueFile.columns.length + opexOnlyExpensesFile.columns.length,
    columns: [...revenueFile.columns, ...opexOnlyExpensesFile.columns],
    data: [...revenueFile.rows, ...opexOnlyExpensesFile.rows],
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
    precomputedMetrics: opexOnly,
    columnMapping: null,
    detectedColumns: null,
    aiInsights: null,
    status: "ready",
    analysis: { profitability: opexOnly },
    datasetType: "profitability",
    businessModel: "generic",
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any)
  assert(opexOnlyBuiltInput.reportType === "profitability", "Opex-only paired report must remain profitability")
  assert(opexOnlyBuiltInput.financials?.revenue === 10000, "Opex-only paired report must retain revenue")
  assert(opexOnlyBuiltInput.financials?.operatingExpenses === 2000, "Opex-only paired report must retain operating expenses")
  assert(opexOnlyBuiltInput.financials?.operatingProfit === 8000, "Opex-only paired report must derive operating profit")
  assert(opexOnlyBuiltInput.financials?.operatingMargin === 80, "Opex-only paired report must derive operating margin")
  assert(opexOnlyBuiltInput.financials?.cogs === null, "Opex-only paired report must keep COGS unavailable")
  assert(opexOnlyBuiltInput.financials?.grossProfit === null, "Opex-only paired report must keep gross profit unavailable")
  assert(opexOnlyBuiltInput.financials?.netProfit === null, "Opex-only paired report must keep net profit unavailable without interest/tax")
  assert(opexOnlyBuiltInput.financials?.metricSources?.operatingProfit?.kind === "derived_value", "Opex-only paired report must mark operating profit as derived")
  assert(opexOnlyBuiltInput.summary.includes("Operating profit is $8.0K"), "Opex-only paired summary must state operating profit")
  assert(opexOnlyBuiltInput.summary.includes("Gross profitability cannot be calculated because COGS is unavailable."), "Opex-only paired summary must explain gross profitability availability")
  assert(opexOnlyBuiltInput.summary.includes("Net profitability cannot be fully assessed because interest and/or tax inputs are unavailable."), "Opex-only paired summary must explain net profitability availability")
  assertNotIncludes(opexOnlyBuiltInput.summary, "gross margin of not available and net margin of not available", "Opex-only paired summary must avoid unavailable-margin boilerplate")
  assert(!(opexOnlyBuiltInput.recommendations || []).some((item) => item.requiredData?.includes("Operating Profit")), "Opex-only paired recommendations must not request derived operating profit")
  assert((opexOnlyBuiltInput.recommendations || []).some((item) => item.requiredData?.includes("COGS")), "Opex-only paired recommendations must request COGS for gross profitability")
  assert((opexOnlyBuiltInput.recommendations || []).some((item) => item.requiredData?.includes("Interest Expense") || item.requiredData?.includes("Tax Expense")), "Opex-only paired recommendations must request interest/tax for net profitability")

  const poisonedChildBusinessModel = resolveBusinessModel({
    explicit: "marketplace",
    uploadSource: "profitability",
    datasetType: "profitability",
    columns: ["date", "category", "vendor", "department", "amount"],
    datasetName: "useclevr_expense_large_test",
    analysis: { datasetType: "profitability", businessModel: "marketplace", profitability: opexOnly },
  })
  assert(poisonedChildBusinessModel === "generic", "Profitability dataset_type must outrank child marketplace schema and stored business model")

  const dashboardSemantic = await buildDashboardSemanticAnalysis({
    id: "ds_profitability_dashboard_poisoned_child",
    name: "useclevr_expense_large_test",
    fileName: "useclevr_expense_large_test.csv",
    fileSize: 1000,
    rowCount: revenueFile.rows.length + opexOnlyExpensesFile.rows.length,
    columnCount: revenueFile.columns.length + opexOnlyExpensesFile.columns.length,
    columns: [...revenueFile.columns, "vendor", ...opexOnlyExpensesFile.columns],
    data: [...revenueFile.rows, ...opexOnlyExpensesFile.rows.map((row) => ({ ...row, vendor: "Supplier A" }))],
    datasetType: "profitability",
    businessModel: "marketplace",
    analysisStatus: "ready",
    status: "ready",
    createdAt: new Date(),
    updatedAt: new Date(),
    analysis: { datasetType: "profitability", businessModel: "marketplace", profitabilityFileRole: "expense_input", profitability: opexOnly },
    aiInsights: {
      recommendedActions: [
        { title: "Active sellers", impact: "Marketplace seller coverage.", action: "Review active sellers." },
      ],
    },
    precomputedMetrics: opexOnly,
    detectedColumns: null,
  })
  const dashboardMetricLabels = dashboardSemantic.metrics.map((metric) => metric.label)
  const dashboardRecommendationText = dashboardSemantic.recommendations.map((item) => `${item.issue} ${item.businessImpact} ${item.recommendedAction}`).join(" ")
  assert(dashboardSemantic.businessProfile === "profitability", "Dashboard semantic profile must remain Profitability for paired Profitability datasets")
  assert(dashboardSemantic.reportProfileId === "profitability_pnl", "Dashboard must use the Profitability report profile")
  assert(dashboardMetricLabels.includes("Revenue"), "Dashboard must expose Profitability revenue")
  assert(dashboardMetricLabels.includes("Operating Expenses"), "Dashboard must expose Profitability operating expenses")
  assert(dashboardMetricLabels.includes("Operating Profit"), "Dashboard must expose Profitability operating profit")
  assert(dashboardMetricLabels.includes("Operating Margin"), "Dashboard must expose Profitability operating margin")
  assert(!dashboardMetricLabels.includes("GMV"), "Dashboard must not expose Marketplace GMV for Profitability analysis")
  assert(!dashboardMetricLabels.includes("Active Sellers"), "Dashboard must not expose Marketplace active sellers for Profitability analysis")
  assertNotIncludes(dashboardRecommendationText, "seller", "Dashboard recommendations must not use stored Marketplace recommendations for Profitability analysis")

  const partialOpexBuiltInput = await buildDatasetReportInput({
    id: "ds_profitability_partial_opex",
    userId: "synthetic_user",
    name: "Synthetic Partial Opex Profitability Analysis",
    fileName: "synthetic_profitability_partial_opex.csv",
    fileSize: 1000,
    mimeType: "text/csv",
    storageKey: "private/storage/key.csv",
    checksum: null,
    rowCount: revenueFile.rows.length + opexOnlyExpensesFile.rows.length,
    columnCount: revenueFile.columns.length + opexOnlyExpensesFile.columns.length,
    columns: [...revenueFile.columns, ...opexOnlyExpensesFile.columns],
    data: [...revenueFile.rows, ...opexOnlyExpensesFile.rows],
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
    precomputedMetrics: partialOpex,
    columnMapping: null,
    detectedColumns: null,
    aiInsights: null,
    status: "ready",
    analysis: { profitability: partialOpex },
    datasetType: "profitability",
    businessModel: "generic",
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any)
  assert(partialOpexBuiltInput.reportType === "profitability", "Partial opex report must remain profitability")
  assert(partialOpexBuiltInput.financials?.operatingExpenses === 2000, "Partial opex report must retain source operating expenses")
  assert(partialOpexBuiltInput.financials?.operatingProfit === null, "Partial opex report must not re-derive operating profit")
  assert(partialOpexBuiltInput.financials?.operatingMargin === null, "Partial opex report must not re-derive operating margin")

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

  const opexOnlyReport = await generateReport("synthetic_opex_profitability_dataset", "Synthetic Opex-Only Profitability Analysis", {
    visibility: "private",
    status: "ready",
    reportType: opexOnlyBuiltInput.reportType,
    businessModel: opexOnlyBuiltInput.businessModel,
    userId: "synthetic_user",
    workspaceId: "synthetic_user",
    idempotencyKey: "synthetic-opex-profitability-test",
  }, opexOnlyBuiltInput)
  assert(opexOnlyReport.pdfPath && fs.existsSync(opexOnlyReport.pdfPath), "Opex-only paired profitability PDF must generate")
  const opexOnlyPdfPath = opexOnlyReport.pdfPath
  if (!opexOnlyPdfPath) throw new Error("Opex-only paired profitability PDF path must be present")
  const opexPdfText = execFileSync("pdftotext", [opexOnlyPdfPath, "-"], { encoding: "utf8" }).replace(/\s+/g, " ")
  assertIncludes(opexPdfText, "Operating Profit $8.0K", "Opex-only PDF must show derived operating profit")
  assertIncludes(opexPdfText, "Operating Margin 80.0%", "Opex-only PDF must show derived operating margin")
  assertIncludes(opexPdfText, "COGS Not available", "Opex-only PDF must keep COGS unavailable")
  assertIncludes(opexPdfText, "Gross Profit Not available", "Opex-only PDF must keep gross profit unavailable")
  assertIncludes(opexPdfText, "Interest Expense Not available", "Opex-only PDF must keep interest unavailable")
  assertIncludes(opexPdfText, "Tax Expense Not available", "Opex-only PDF must keep tax unavailable")
  assertIncludes(opexPdfText, "Expense Category Categorize and analyze costs Available", "Opex-only PDF must mark expense category available")
  assertIncludes(opexPdfText, "Expense Amount Quantify total cost by category Available", "Opex-only PDF must mark expense amount available")
  assertIncludes(opexPdfText, "Date / Period Analyze cost trends Available", "Opex-only PDF must mark period available")
  assertNotIncludes(opexPdfText, "Missing financial fields: COGS, Gross Profit, Operating Profit, Net Profit", "Opex-only PDF must not request derived operating profit")
  if (opexOnlyReport.pdfPath) fs.unlinkSync(opexOnlyReport.pdfPath)
  deleteReport(opexOnlyReport.id)
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
    opexOnlyOperatingProfit: opexOnly.operatingProfit,
    partialOpexOperatingProfit: partialOpex.operatingProfit,
    explicitZeroNetProfit: explicitZeroInterestTax.netProfit,
    reportPersisted: persisted,
    pdfGenerated,
    datasetIsolation: "pass",
  }))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
