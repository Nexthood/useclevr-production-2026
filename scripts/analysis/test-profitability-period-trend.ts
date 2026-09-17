import * as fs from "fs"
import { execFileSync } from "child_process"
import { calculateProfitabilityAnalysis } from "../../src/lib/profitability/two-file-analysis"

/**
 * Regression coverage for the two verified Profitability report accuracy defects:
 *
 * Defect 1 - reporting period: the persisted profitability precomputedMetrics omitted
 * reportingPeriod, so the report derived the period from periodTrends (capped at 24
 * buckets by the two-file engine) and produced "2025-01-01 to 2025-01-24" instead of
 * the full "2025-01-01 to 2025-12-31" span covered by the Revenue + Expense rows.
 *
 * Defect 2 - revenue trend: the report compared the first and last of those same 24
 * truncated daily period buckets and printed "Revenue declined by 18.9%" (daily revenue
 * on 2025-01-24 vs 2025-01-01) instead of a deterministic trend from the complete
 * revenue time series.
 *
 * The fixes pin these rules:
 * - reportingPeriod comes from the persisted two-file analysis and covers every period
 *   bucket built from the Revenue and Expense rows actually used in the analysis.
 * - revenueGrowth compares the first and last complete calendar month, aggregating ALL
 *   revenue rows per month: ((lastMonthRevenue - firstMonthRevenue) / firstMonthRevenue) * 100.
 * - Both stored and legacy persisted metrics resolve to the same deterministic values.
 */

const REVENUE_FIXTURE = "scripts/analysis/fixtures/profitability_revenue_large_test.csv"
const EXPENSES_FIXTURE = "scripts/analysis/fixtures/profitability_expense_large_test.csv"
const REVENUE_ROW_COUNT = 5000
const EXPENSES_ROW_COUNT = 3500
const TOTAL_REVENUE = 16327920
const TOTAL_EXPENSES = 6121332
const OPERATING_PROFIT = 10206588
const EXPECTED_REPORTING_PERIOD = "2025-01-01 to 2025-12-31"

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  assert(actual === expected, `${message}: expected ${String(expected)}, received ${String(actual)}`)
}

function nearlyEqual(actual: number | null, expected: number, message: string) {
  assert(actual !== null, `${message}: expected ${expected}, received null`)
  if (actual === null) return
  const expectedRounded = Math.round(expected * 100) / 100
  assert(Math.abs(actual - expectedRounded) < 0.005, `${message}: expected ${expectedRounded}, received ${actual}`)
}

function assertIncludes(text: string, expected: string, message: string) {
  assert(text.includes(expected), `${message}: expected "${expected}"`)
}

function assertNotIncludes(text: string, unexpected: string, message: string) {
  assert(!text.includes(unexpected), `${message}: unexpected "${unexpected}"`)
}

function parseClientCsv(filePath: string) {
  const text = fs.readFileSync(filePath, "utf8").trim()
  const lines = text.split("\n")
  assert(lines.length > 1, `${filePath} must contain a header row and data rows`)

  const parseCSVLine = (line: string) => {
    const values: string[] = []
    let current = ""
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      const nextChar = line[i + 1]
      if (char === '"' && inQuotes && nextChar === '"') {
        current += '"'
        i++
      } else if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === "," && !inQuotes) {
        values.push(current.trim())
        current = ""
      } else {
        current += char
      }
    }
    values.push(current.trim())
    return values
  }

  const columns = parseCSVLine(lines[0]).map((header) => header.trim().replace(/^"|"$/g, ""))
  const rows = lines.slice(1).map((line) => {
    const values = parseCSVLine(line).map((value) => value.trim().replace(/^"|"$/g, ""))
    const row: Record<string, string> = {}
    columns.forEach((column, index) => {
      row[column] = values[index] || ""
    })
    return row
  })
  return { columns, rows }
}

function monthlyRevenueFromRows(rows: Record<string, string>[]) {
  const monthly: Record<string, number> = {}
  for (const row of rows) {
    const amount = Math.abs(Number.parseFloat(row.revenue))
    if (!Number.isFinite(amount)) continue
    const match = row.date.match(/(\d{4})[-/](\d{1,2})/)
    if (!match) continue
    const month = `${match[1]}-${match[2].padStart(2, "0")}`
    monthly[month] = (monthly[month] || 0) + amount
  }
  return monthly
}

function expectedRevenueGrowth(monthly: Record<string, number>) {
  const months = Object.keys(monthly).filter(Boolean).sort()
  assert(months.length >= 2, "Fixture must contain at least two revenue months")
  const first = monthly[months[0]]
  const last = monthly[months[months.length - 1]]
  assert(first > 0, "First revenue month must be non-zero for a deterministic trend")
  return ((last - first) / first) * 100
}

function persistedProfitabilityMetrics(analysis: Record<string, unknown>) {
  const source = analysis as {
    totalRevenue: number | null
    totalExpenses: number | null
    cogs: number | null
    operatingExpenses: number | null
    interestExpense: number | null
    taxExpense: number | null
    grossProfit: number | null
    operatingProfit: number | null
    netProfit: number | null
    grossMargin: number | null
    operatingMargin: number | null
    netMargin: number | null
    revenueGrowth: number | null
    reportingPeriod: string | null
    expenseCategories: [string, number][]
    revenueByProduct: [string, number][]
    revenueByRegion: [string, number][]
    revenueByMonth: Record<string, number>
    periodTrends: unknown[]
    departmentComparison: unknown[]
    matchKey: string | null
    dataConfidence: number
    dataQualityNotes: string[]
    missingColumns: string[]
    unavailableMetrics: string[]
    metricSources: unknown
    hasBothFiles: boolean
    hasRevenue: boolean
    hasExpenses: boolean
    status: string
    statusLabel: string
    profitabilityAnalysisId: string
    sourceFiles: Array<{ role: string; name: string; rowCount: number; columns: string[] }>
  }
  return {
    totalRevenue: source.totalRevenue,
    totalExpenses: source.totalExpenses,
    cogs: source.cogs,
    operatingExpenses: source.operatingExpenses,
    interestExpense: source.interestExpense,
    taxExpense: source.taxExpense,
    grossProfit: source.grossProfit,
    operatingProfit: source.operatingProfit,
    netProfit: source.netProfit,
    profit: source.netProfit,
    grossMargin: source.grossMargin,
    operatingMargin: source.operatingMargin,
    netMargin: source.netMargin,
    margin: source.netMargin,
    revenueGrowth: source.revenueGrowth,
    reportingPeriod: source.reportingPeriod,
    expenseCategories: source.expenseCategories,
    topCostCategories: source.expenseCategories,
    revenueByProduct: source.revenueByProduct,
    revenueByRegion: source.revenueByRegion,
    revenueByMonth: source.revenueByMonth,
    periodTrends: source.periodTrends,
    departmentComparison: source.departmentComparison,
    matchKey: source.matchKey,
    dataConfidence: source.dataConfidence,
    dataQualityNotes: source.dataQualityNotes,
    missingColumns: source.missingColumns,
    unavailableMetrics: source.unavailableMetrics,
    metricSources: source.metricSources,
    periodComparison: undefined,
    hasBothFiles: source.hasBothFiles,
    hasRevenue: source.hasRevenue,
    hasExpenses: source.hasExpenses,
    status: source.status,
    statusLabel: source.statusLabel,
    profitabilityAnalysisId: source.profitabilityAnalysisId,
    profitability_analysis_id: source.profitabilityAnalysisId,
    profitability_file_role: "combined",
    profitabilityFileRole: "combined",
    sourceFiles: source.sourceFiles,
  }
}

function legacyPersistedMetrics(metrics: Record<string, unknown>) {
  const legacy: Record<string, unknown> = { ...metrics }
  delete legacy.reportingPeriod
  delete legacy.revenueGrowth
  return legacy
}

function syntheticDataset(input: {
  datasetId: string
  precomputedMetrics: Record<string, unknown>
  profitabilityAnalysis: Record<string, unknown>
}) {
  return {
    id: input.datasetId,
    userId: "synthetic_profitability_regression_user",
    name: "Revenue + Expense Analysis",
    fileName: "profitability-analysis",
    fileSize: 398803,
    mimeType: "text/csv",
    storageKey: "private/storage/profitability-analysis",
    checksum: null,
    rowCount: REVENUE_ROW_COUNT + EXPENSES_ROW_COUNT,
    columnCount: 9,
    columns: ["date", "product", "country", "customer_id", "revenue", "category", "vendor", "department", "amount"],
    data: [],
    columnTypes: null,
    previewRowCount: null,
    previewGenerated: null,
    fullAnalysisCompleted: null,
    analysisStatus: "ready",
    analysisProgress: 100,
    analysisMessage: "Analysis is ready.",
    analysisError: null,
    invalidRowCount: null,
    missingValueCounts: null,
    precomputedMetrics: input.precomputedMetrics,
    columnMapping: {
      profitabilityAnalysisId: input.datasetId,
      profitabilityFileRole: "combined",
      sourceFiles: input.profitabilityAnalysis.sourceFiles,
    },
    detectedColumns: null,
    aiInsights: null,
    status: "ready",
    analysis: { datasetType: "profitability", uploadSource: "profitability_upload", profitability: input.profitabilityAnalysis },
    datasetType: "profitability",
    businessModel: "generic",
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any
}

async function main() {
  const revenueCsv = parseClientCsv(REVENUE_FIXTURE)
  const expensesCsv = parseClientCsv(EXPENSES_FIXTURE)
  assertEqual(revenueCsv.rows.length, REVENUE_ROW_COUNT, "Revenue fixture row count")
  assertEqual(expensesCsv.rows.length, EXPENSES_ROW_COUNT, "Expenses fixture row count")
  assertEqual(revenueCsv.rows.length + expensesCsv.rows.length, 8500, "Combined source rows")

  const analysis = calculateProfitabilityAnalysis({
    analysisId: "pa_period_trend_regression",
    revenueFile: {
      role: "revenue",
      name: "profitability_revenue_large_test.csv",
      columns: revenueCsv.columns,
      rows: revenueCsv.rows,
      rowCount: revenueCsv.rows.length,
    },
    expensesFile: {
      role: "expenses",
      name: "profitability_expenses_large_test.csv",
      columns: expensesCsv.columns,
      rows: expensesCsv.rows,
      rowCount: expensesCsv.rows.length,
    },
  })

  const deterministicGrowth = expectedRevenueGrowth(monthlyRevenueFromRows(revenueCsv.rows))
  const deterministicGrowthRounded = Math.round(deterministicGrowth * 100) / 100
  const expectedGrowthHighlight = `Revenue Growth ${deterministicGrowthRounded > 0 ? "+" : ""}${deterministicGrowthRounded.toFixed(1)}%`
  const expectedDeclineWording = `Revenue has declined by ${Math.abs(deterministicGrowthRounded).toFixed(1)}% over the reporting period.`

  // Level 1: the two-file engine must derive both values from the complete source data.
  assertEqual(analysis.status, "ready", "Paired fixture analysis must be ready")
  assertEqual(analysis.sourceFiles[0]?.rowCount, REVENUE_ROW_COUNT, "Processed revenue row count")
  assertEqual(analysis.sourceFiles[1]?.rowCount, EXPENSES_ROW_COUNT, "Processed expense row count")
  nearlyEqual(analysis.totalRevenue, TOTAL_REVENUE, "Total revenue")
  nearlyEqual(analysis.operatingExpenses, TOTAL_EXPENSES, "Operating expenses")
  nearlyEqual(analysis.totalExpenses, TOTAL_EXPENSES, "Total expenses")
  assertEqual(analysis.cogs, null, "COGS must remain unavailable for this fixture pair")
  nearlyEqual(analysis.operatingProfit, OPERATING_PROFIT, "Operating profit")
  assertEqual(analysis.reportingPeriod, EXPECTED_REPORTING_PERIOD, "Reporting period from all rows of both files")
  nearlyEqual(analysis.revenueGrowth, deterministicGrowth, "Deterministic first-vs-last-month revenue growth")
  assertEqual(Object.keys(analysis.revenueByMonth).length, 12, "Monthly aggregation must cover all twelve revenue months")
  const monthlySum = Object.values(analysis.revenueByMonth).reduce((total, value) => total + value, 0)
  nearlyEqual(monthlySum, TOTAL_REVENUE, "Monthly revenue aggregation must cover every revenue row")
  assert(analysis.periodTrends.length <= 24, "Engine period trends remain capped for display")
  assertNotIncludes(`${analysis.periodTrends[analysis.periodTrends.length - 1]?.period || ""}`, EXPECTED_REPORTING_PERIOD, "Truncated period trends must not fully cover the reporting period")

  // Level 2: the production upload whitelist must persist both values.
  const uploadSource = fs.readFileSync("src/app/actions/upload.ts", "utf8")
  assertIncludes(uploadSource, "reportingPeriod: profitabilityData.reportingPeriod,", "Upload persistence must store reportingPeriod")
  assertIncludes(uploadSource, "revenueGrowth: profitabilityData.revenueGrowth,", "Upload persistence must store revenueGrowth")
  const persistedMetrics = persistedProfitabilityMetrics(analysis as unknown as Record<string, unknown>)
  assertEqual(typeof persistedMetrics.reportingPeriod, "string", "Persisted metrics must carry reportingPeriod")
  assertEqual(typeof persistedMetrics.revenueGrowth, "number", "Persisted metrics must carry revenueGrowth")

  // Level 3: reports built from the persisted metrics shape must stay accurate.
  const tempDir = "/tmp/useclevr-profitability-period-trend-test"
  process.env.TEMP_DIR = tempDir
  const { generateReport, deleteReport } = await import("../../src/lib/reports/report-generator")
  const { buildDatasetReportInput } = await import("../../src/lib/reports/dataset-report-builder")

  const reportInput = await buildDatasetReportInput(
    syntheticDataset({
      datasetId: "ds_period_trend_regression",
      precomputedMetrics: persistedMetrics,
      profitabilityAnalysis: analysis as unknown as Record<string, unknown>,
    }),
  )
  assertEqual(reportInput.reportType, "profitability", "Profitability dataset must build a profitability report")
  assertEqual(reportInput.financials.reportingPeriod, EXPECTED_REPORTING_PERIOD, "Report reporting period")
  nearlyEqual(reportInput.financials.revenueGrowth ?? null, deterministicGrowth, "Report revenue growth")
  nearlyEqual(reportInput.financials.revenue ?? null, TOTAL_REVENUE, "Report total revenue")
  nearlyEqual(reportInput.financials.operatingExpenses ?? null, TOTAL_EXPENSES, "Report operating expenses total")
  nearlyEqual(reportInput.financials.operatingProfit, OPERATING_PROFIT, "Report operating profit")
  assertEqual(reportInput.financials.cogs, null, "Report COGS must remain unavailable")
  const recommendationText = reportInput.recommendations.map((item) => `${item.issue} ${item.businessImpact} ${item.recommendedAction}`).join(" ")
  if (deterministicGrowth < 0) {
    assertIncludes(recommendationText, expectedDeclineWording, "Revenue decline recommendation must quote the deterministic trend")
  }
  assertNotIncludes(recommendationText, "18.9", "Recommendations must not state the truncated-trend decline")
  assertNotIncludes(`${reportInput.summary} ${recommendationText}`, "2025-01-24", "Report text must not expose the truncated period end")

  // Level 4: legacy persisted metrics (pre-fix records) must regenerate accurately.
  const legacyReportInput = await buildDatasetReportInput(
    syntheticDataset({
      datasetId: "ds_period_trend_legacy",
      precomputedMetrics: legacyPersistedMetrics(persistedMetrics),
      profitabilityAnalysis: analysis as unknown as Record<string, unknown>,
    }),
  )
  assertEqual(legacyReportInput.financials.reportingPeriod, EXPECTED_REPORTING_PERIOD, "Legacy records must recover the full reporting period")
  nearlyEqual(legacyReportInput.financials.revenueGrowth ?? null, deterministicGrowth, "Legacy records must recover the deterministic revenue growth")
  assertNotIncludes(`${legacyReportInput.financials.reportingPeriod}`, "2025-01-24", "Legacy reporting period must not use the truncated trend span")

  // Level 5: generated PDFs must contain the corrected period and trend on every generation.
  const generatedPdfs: Array<{ reportId: string; pdfPath: string }> = []
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const report = await generateReport(`ds_period_trend_generation_${attempt}`, "Revenue + Expense Analysis", {
      visibility: "private",
      status: "ready",
      reportType: reportInput.reportType,
      businessModel: reportInput.businessModel,
      userId: "synthetic_profitability_regression_user",
      workspaceId: "synthetic_profitability_regression_user",
      idempotencyKey: `synthetic-period-trend-test-${attempt}`,
    }, reportInput)
    const pdfPath = report.pdfPath
    if (typeof pdfPath !== "string" || pdfPath.length === 0 || !fs.existsSync(pdfPath)) {
      throw new Error(`PDF generation attempt ${attempt} must produce a file`)
    }
    generatedPdfs.push({ reportId: report.id, pdfPath })
    const pdfText = execFileSync("pdftotext", [pdfPath, "-"], { encoding: "utf8" }).replace(/\s+/g, " ")
    assertIncludes(pdfText, "2025-01-01 to 2025-12-31", `PDF attempt ${attempt} must show the full reporting period`)
    assertNotIncludes(pdfText, "2025-01-24", `PDF attempt ${attempt} must not show the truncated period end`)
    assertIncludes(pdfText, expectedGrowthHighlight, `PDF attempt ${attempt} must show the deterministic revenue growth highlight`)
    assertNotIncludes(pdfText, "-18.9%", `PDF attempt ${attempt} must not show the truncated-trend decline`)
    if (deterministicGrowth < 0) {
      assertIncludes(pdfText, expectedDeclineWording, `PDF attempt ${attempt} must state the deterministic decline in recommendations`)
    }
  }

  // Idempotent replay must return the identical stored report instead of diverging.
  const replayedInput = await buildDatasetReportInput(
    syntheticDataset({
      datasetId: "ds_period_trend_regression",
      precomputedMetrics: persistedMetrics,
      profitabilityAnalysis: analysis as unknown as Record<string, unknown>,
    }),
  )
  assertEqual(replayedInput.financials.reportingPeriod, reportInput.financials.reportingPeriod, "Rebuilt reporting period must be identical")
  assertEqual(replayedInput.financials.revenueGrowth, reportInput.financials.revenueGrowth, "Rebuilt revenue growth must be identical")
  assertEqual(replayedInput.summary, reportInput.summary, "Rebuilt summary must be identical")

  for (const generated of generatedPdfs) {
    if (generated.pdfPath && fs.existsSync(generated.pdfPath)) fs.unlinkSync(generated.pdfPath)
    deleteReport(generated.reportId)
  }
  fs.rmSync(tempDir, { recursive: true, force: true })

  console.log(JSON.stringify({
    status: analysis.status,
    revenueRows: analysis.sourceFiles[0]?.rowCount,
    expenseRows: analysis.sourceFiles[1]?.rowCount,
    reportingPeriod: analysis.reportingPeriod,
    revenueGrowth: analysis.revenueGrowth,
    deterministicGrowthPercent: Math.round(deterministicGrowth * 100) / 100,
    totalRevenue: analysis.totalRevenue,
    totalExpenses: analysis.totalExpenses,
    operatingProfit: analysis.operatingProfit,
    pdfGenerations: generatedPdfs.length,
    verdict: "pass",
  }))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
