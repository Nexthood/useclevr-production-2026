import "./profitability-report-test-db"

import assert from "node:assert/strict"
import fs from "node:fs"
import { resolve } from "node:path"

import { checkActionEnforcement, getConcurrentAnalysisCount } from "../../src/lib/billing/usage-enforcement"
import {
  REPORT_RUNTIME_VERSION,
  deleteReportsForDatasets,
  findReportByIdempotencyKey,
  generateReport,
  isCurrentReportRuntime,
  listReports,
} from "../../src/lib/reports/report-generator"
import type { datasets } from "../../src/lib/db/schema"
import { buildDatasetReportInput } from "../../src/lib/reports/dataset-report-builder"

/**
 * Regression coverage for both Profitability report-generation entry points:
 *
 * 1. Profitability Analysis page -> "Generate / Regenerate Report"
 *    POST /api/reports {datasetId, timezone, timezoneOffset} + Idempotency-Key profitability:<analysisId>:report
 * 2. Profitability Dashboard -> "Generate Report"
 *    POST /api/reports {datasetId, idempotencyKey: dashboard-report:<datasetId>:<client>}
 *
 * Both buttons share POST /api/reports, so both previously crashed with HTTP 500 inside
 * checkActionEnforcement -> getConcurrentAnalysisCount when the ConcurrentAnalysisCount
 * relation is missing. The fake database installed by profitability-report-test-db replicates
 * that exact failure so the test fails if the enforcement lookup ever throws again.
 */

type DatasetRecord = typeof datasets.$inferSelect

const DATASET_ID = "pa_profitability_regression_entrypoints"
const REVENUE_SOURCE_ROWS = 5000
const EXPENSE_SOURCE_ROWS = 3500
const CANONICAL_ROW_COUNT = REVENUE_SOURCE_ROWS + EXPENSE_SOURCE_ROWS
const ANALYSIS_PAGE_KEY = `profitability:${DATASET_ID}:report`
const DASHBOARD_KEY = `dashboard-report:${DATASET_ID}:550e8400-e29b-41d4-a716-446655440000`

function canonicalProfitabilityDataset(): DatasetRecord {
  return {
    id: DATASET_ID,
    userId: "user_profitability_regression_pro",
    name: "Revenue + Expense Analysis",
    fileName: "profitability-analysis",
    fileSize: 288000,
    mimeType: "text/csv",
    storageKey: null,
    checksum: null,
    rowCount: CANONICAL_ROW_COUNT,
    columnCount: 9,
    columns: ["date", "product", "country", "customer_id", "revenue", "category", "vendor", "department", "amount"],
    data: [],
    columnTypes: {},
    previewRowCount: 0,
    previewGenerated: false,
    fullAnalysisCompleted: true,
    analysisStatus: "ready",
    analysisProgress: 100,
    analysisMessage: null,
    analysisError: null,
    invalidRowCount: 0,
    missingValueCounts: {},
    precomputedMetrics: {
      totalRevenue: 16327920,
      totalExpenses: 6121332,
      cogs: null,
      operatingExpenses: 6121332,
      operatingExpenseCoverage: "complete",
      interestExpense: null,
      taxExpense: null,
      grossProfit: null,
      operatingProfit: 10206588,
      netProfit: null,
      profit: null,
      grossMargin: null,
      operatingMargin: 62.51,
      netMargin: null,
      margin: null,
      expenseCategories: [["Salaries", 3261464], ["Marketing", 794290], ["Software", 520000]],
      topCostCategories: [["Salaries", 3261464], ["Marketing", 794290], ["Software", 520000]],
      revenueByProduct: [["Product A", 2000000], ["Product B", 1500000]],
      revenueByRegion: null,
      revenueByMonth: null,
      periodTrends: [
        { period: "2026-01", revenue: 1300000 },
        { period: "2026-02", revenue: 1400000 },
      ],
      departmentComparison: [["Sales", 42], ["IT", 12]],
      matchKey: null,
      dataConfidence: 90,
      dataQualityNotes: [],
      missingColumns: ["cogs", "interest", "tax"],
      unavailableMetrics: ["grossProfit"],
      periodComparison: null,
      hasBothFiles: true,
      hasRevenue: true,
      hasExpenses: true,
      status: "ready",
      statusLabel: "Profitability analysis is ready.",
      metricSources: {},
      profitabilityAnalysisId: DATASET_ID,
      profitability_analysis_id: DATASET_ID,
      profitabilityFileRole: "combined",
      profitability_file_role: "combined",
      sourceFiles: [
        {
          name: "revenue_source.csv",
          role: "revenue",
          columns: ["date", "product", "country", "customer_id", "revenue"],
          rowCount: REVENUE_SOURCE_ROWS,
        },
        {
          name: "expense_source.csv",
          role: "expenses",
          columns: ["date", "category", "vendor", "department", "amount"],
          rowCount: EXPENSE_SOURCE_ROWS,
        },
      ],
    },
    columnMapping: {
      profitabilityAnalysisId: DATASET_ID,
      profitabilityFileRole: "combined",
      sourceFiles: [
        { name: "revenue_source.csv", role: "revenue", rowCount: REVENUE_SOURCE_ROWS },
        { name: "expense_source.csv", role: "expenses", rowCount: EXPENSE_SOURCE_ROWS },
      ],
    },
    detectedColumns: null,
    aiInsights: null,
    status: "ready",
    analysis: {
      dataset_type: "profitability",
      datasetCategory: "profitability",
      datasetType: "profitability",
      business_model: "generic",
      businessModel: "generic",
      uploadSource: "profitability_upload",
      profitability: { status: "ready", hasRevenue: true, hasExpenses: true },
      profitability_analysis_id: DATASET_ID,
      profitabilityAnalysisId: DATASET_ID,
      profitability_file_role: "combined",
      profitabilityFileRole: "combined",
    },
    datasetType: "profitability",
    businessModel: "generic",
    createdAt: new Date("2026-09-16T17:34:58.151Z"),
    updatedAt: new Date("2026-09-16T17:34:58.810Z"),
  } as unknown as DatasetRecord
}

function rawKpiValue(kpis: { title: string; value: number; format: string }[], title: string) {
  const kpi = kpis.find((candidate) => candidate.title === title)
  assert.ok(kpi, `generated report input must include the ${title} KPI`)
  return kpi.value
}

function persistedKpiValue(kpis: { title: string; value: string }[], title: string) {
  const kpi = kpis.find((candidate) => candidate.title === title)
  assert.ok(kpi, `generated report must persist the ${title} KPI`)
  return kpi.value
}

function assertCanonicalProfitabilityReport(
  reportInput: Awaited<ReturnType<typeof buildDatasetReportInput>>,
  userId: string,
) {
  assert.equal(reportInput.reportType, "profitability", "Profitability datasets must build the profitability P&L report")
  assert.equal(reportInput.reportProfile?.id, "profitability_pnl", "Profitability datasets must use the profitability P&L profile")
  assert.equal(reportInput.rowCount, CANONICAL_ROW_COUNT, "Profitability report must match the canonical paired row count")
  assert.equal(reportInput.kpis.length > 0, true, "Profitability report must expose KPIs")
  assert.ok(reportInput.financials, "Profitability report must include financials")
  assert.equal(rawKpiValue(reportInput.kpis, "Revenue"), 16327920)
  assert.equal(rawKpiValue(reportInput.kpis, "Operating Profit"), 10206588)
  assert.equal(rawKpiValue(reportInput.kpis, "Operating Margin"), 62.51)
  assert.equal(reportInput.financials?.grossProfit, null, "Gross profit must stay unavailable while COGS is missing")
  assert.equal(reportInput.semanticContext?.datasetType, "profitability")
  assert.ok(userId, "report generation must run for the authenticated dataset owner")
}

async function generateForEntryPoint(
  dataset: DatasetRecord,
  userId: string,
  idempotencyKey: string,
  timezone?: string,
) {
  // Mirrors the POST /api/reports call sequence for both buttons.
  const enforcement = await checkActionEnforcement(userId, "report_generation", "user", "useclevr@example.test")
  assert.equal(
    enforcement.allowed,
    true,
    "report_generation enforcement must pass even when the concurrent analysis count lookup fails",
  )

  const reportInput = await buildDatasetReportInput(dataset)
  assertCanonicalProfitabilityReport(reportInput, userId)

  const report = await generateReport(
    dataset.id,
    dataset.name,
    {
      visibility: "private",
      includePredictions: true,
      includeAlerts: true,
      timezone,
      timezoneOffset: timezone ? -120 : undefined,
      status: "ready",
      reportType: reportInput.reportType,
      businessModel: reportInput.businessModel,
      userId,
      workspaceId: userId,
      idempotencyKey,
    },
    reportInput,
  )
  return { report, reportInput }
}

async function main() {
  const dataset = canonicalProfitabilityDataset()
  const userId = dataset.userId
  await deleteReportsForDatasets([dataset.id])

  // Entry point 1: Profitability Analysis page ("Generate / Regenerate Report" payload).
  const analysis = await generateForEntryPoint(dataset, userId, ANALYSIS_PAGE_KEY, "Europe/Budapest")
  assert.equal(analysis.report.reportType, "profitability")
  assert.equal(analysis.report.reportProfile?.id, "profitability_pnl")
  assert.equal(analysis.report.businessModel, "generic")
  assert.equal(analysis.report.userId, userId)
  assert.equal(analysis.report.workspaceId, userId)
  assert.equal(analysis.report.idempotencyKey, ANALYSIS_PAGE_KEY)
  assert.equal(analysis.report.runtimeVersion, REPORT_RUNTIME_VERSION)
  assert.equal(isCurrentReportRuntime(analysis.report), true, "Profitability reports must satisfy the current report runtime")
  assert.equal(analysis.report.rowCount, CANONICAL_ROW_COUNT)
  assert.equal(persistedKpiValue(analysis.report.kpis, "Revenue"), "$16.33M")
  assert.equal(persistedKpiValue(analysis.report.kpis, "Operating Profit"), "$10.21M")
  assert.equal(persistedKpiValue(analysis.report.kpis, "Operating Margin"), "62.5%")
  assert.equal(analysis.report.kpiRawValues?.["Operating Margin"], 62.51, "raw KPI values must persist for analytics")
  assert.equal(analysis.report.financials?.operatingProfit, 10206588)
  assert.equal(analysis.report.financials?.grossProfit, null)
  assert.equal(analysis.report.diagnostics?.rowCount, CANONICAL_ROW_COUNT, "diagnostics must carry the authoritative row count")
  assert.equal(analysis.report.diagnostics?.rowsUsedForKpis, CANONICAL_ROW_COUNT)
  assert.notEqual(analysis.report.semanticContext?.datasetType, null)
  assert.ok(analysis.report.summary.toLowerCase().includes("operating profit"), "summary must present the profitability result")
  assert.ok(typeof analysis.report.pdfPath === "string" && fs.existsSync(analysis.report.pdfPath), "Profitability report must generate a PDF file")

  const persistedForAnalysisPage = listReports(dataset.id)
  assert.equal(persistedForAnalysisPage.length, 1, "the Analysis page entry point must persist exactly one report")
  assert.equal(persistedForAnalysisPage[0].id, analysis.report.id)

  // Retry/regenerate with the same dataset-scoped key replays the same report idempotently.
  const replayCandidate = findReportByIdempotencyKey(dataset.id, ANALYSIS_PAGE_KEY)
  assert.ok(replayCandidate, "route idempotency lookup must find the profitability report")
  assert.equal(isCurrentReportRuntime(replayCandidate), true, "retries must replay instead of regenerate")
  assert.equal(listReports(dataset.id).length, 1, "idempotent retry must not duplicate stored reports")

  // Entry point 2: Profitability Dashboard ("Generate Report" payload).
  const dashboard = await generateForEntryPoint(dataset, userId, DASHBOARD_KEY)
  assert.equal(dashboard.report.reportType, "profitability")
  assert.equal(dashboard.report.reportProfile?.id, "profitability_pnl")
  assert.equal(dashboard.report.rowCount, CANONICAL_ROW_COUNT)
  assert.equal(isCurrentReportRuntime(dashboard.report), true)
  assert.notEqual(dashboard.report.id, analysis.report.id, "dashboard entry point keeps its own report identity")
  assert.ok(typeof dashboard.report.pdfPath === "string" && fs.existsSync(dashboard.report.pdfPath))

  const persistedForDashboard = listReports(dataset.id)
  assert.equal(persistedForDashboard.length, 2, "both entry points must register reports under Reports & Downloads")
  for (const report of persistedForDashboard) {
    assert.equal(report.userId, userId, "persisted reports must be attributed to the dataset owner")
    assert.equal(report.datasetId, dataset.id, "persisted reports must stay scoped to the canonical Profitability dataset")
  }

  // The enforcement lookup that produced the production HTTP 500 must fail open.
  const concurrentCount = await getConcurrentAnalysisCount(userId)
  assert.equal(concurrentCount, 0, "a missing ConcurrentAnalysisCount relation must not throw or block report generation")

  assertPredeployCreatesConcurrentAnalysisCount()
  assertReportsRouteReturnsStructuredErrors()

  await deleteReportsForDatasets([dataset.id])
  assert.equal(listReports(dataset.id).length, 0, "cleanup must remove every report created by this regression test")

  console.log("PASS: profitability report entry points (analysis page + dashboard) regression test")
}

function readProjectFile(relativePath: string) {
  return fs.readFileSync(resolve(process.cwd(), relativePath), "utf8")
}

function assertPredeployCreatesConcurrentAnalysisCount() {
  const predeploy = readProjectFile("scripts/runtime/railway-predeploy.cjs")
  assert.ok(
    predeploy.includes('readMigrationStatement("src/lib/db/migrations/0033_concurrent_analysis_count.sql")'),
    "predeploy must create the ConcurrentAnalysisCount table used by report-generation enforcement",
  )
  const migration = readProjectFile("src/lib/db/migrations/0033_concurrent_analysis_count.sql")
  assert.ok(
    migration.includes('CREATE TABLE IF NOT EXISTS "ConcurrentAnalysisCount"'),
    "0033 migration must create the ConcurrentAnalysisCount table idempotently",
  )
  assert.ok(
    migration.includes('CREATE UNIQUE INDEX IF NOT EXISTS "ConcurrentAnalysisCount_userId_key"'),
    "0033 migration must create the per-user unique index matching the drizzle schema",
  )
}

function assertReportsRouteReturnsStructuredErrors() {
  const routeSource = readProjectFile("src/app/api/reports/route.ts")
  assert.ok(
    routeSource.includes("ReportIntegrityError"),
    "POST /api/reports must classify integrity failures with a structured response",
  )
  assert.ok(
    routeSource.includes("code: 'DATASET_ROW_COUNT_MISMATCH'"),
    "integrity failures must return a structured code instead of a bare HTTP 500",
  )
  assert.ok(
    routeSource.includes("code: 'REPORT_GENERATION_FAILED'"),
    "unexpected generation failures must return a stable structured code",
  )
}

main().catch((error) => {
  console.error("FAIL:", error)
  process.exit(1)
})
