import * as fs from "fs"
import { calculateBusinessBalancedScorecard } from "../../src/lib/business/balanced-scorecard"
import { buildDatasetReportInput } from "../../src/lib/reports/dataset-report-builder"
import { deleteReport, generateReport } from "../../src/lib/reports/report-generator"
import type { ReportFinancials } from "../../src/lib/reports/report-generator"

type TestDataset = Parameters<typeof buildDatasetReportInput>[0]

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

function dataset(name: string, rows: Record<string, unknown>[], columns: string[], businessModel = "startup"): TestDataset {
  return {
    id: `synthetic_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
    userId: "synthetic_user",
    name,
    fileName: `${name}.csv`,
    fileSize: 1000,
    mimeType: "text/csv",
    storageKey: null,
    checksum: null,
    rowCount: rows.length,
    columnCount: columns.length,
    columns,
    data: rows,
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
    businessModel,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as TestDataset
}

function financials(input: Awaited<ReturnType<typeof buildDatasetReportInput>>) {
  assert("financials" in input && input.financials, "Report input must include financials")
  return input.financials as ReportFinancials
}

async function assertPdf(reportInput: Awaited<ReturnType<typeof buildDatasetReportInput>>, name: string) {
  const report = await generateReport(`synthetic_${name}`, name, {
    visibility: "private",
    status: "ready",
    reportType: reportInput.reportType,
    businessModel: reportInput.businessModel,
    userId: "synthetic_user",
    workspaceId: "synthetic_user",
    idempotencyKey: `report-accuracy-${name}`,
  }, reportInput)
  assert(Boolean(report.pdfPath && fs.existsSync(report.pdfPath)), `${name}: PDF must generate`)
  assert(report.summary.includes("AI-assisted") || report.summary.length > 0, `${name}: summary must be present`)
  if (report.pdfPath && fs.existsSync(report.pdfPath)) fs.unlinkSync(report.pdfPath)
  deleteReport(report.id)
}

async function main() {
  process.env.TEMP_DIR = "/tmp/useclevr-report-accuracy-test"

  const complete = await buildDatasetReportInput(dataset("complete_financial_dataset", [
    { period: "2026-01", revenue: 1000, cogs: 400, operating_expenses: 200, interest_expense: 50, tax_expense: 100, customer_id: "A", order_id: "O1" },
    { period: "2026-02", revenue: 2000, cogs: 700, operating_expenses: 300, interest_expense: 50, tax_expense: 150, customer_id: "B", order_id: "O2" },
  ], ["period", "revenue", "cogs", "operating_expenses", "interest_expense", "tax_expense", "customer_id", "order_id"]))
  const completeFinancials = financials(complete)
  assert(completeFinancials.revenue === 3000, "Complete dataset revenue must calculate")
  assert(completeFinancials.cogs === 1100, "Complete dataset COGS must calculate")
  assert(completeFinancials.grossProfit === 1900, "Complete dataset gross profit must derive from revenue and COGS")
  assert(completeFinancials.operatingProfit === 1400, "Complete dataset operating profit must derive from gross profit and opex")
  assert(completeFinancials.netProfit === 1050, "Complete dataset net profit must derive only when interest and tax exist")
  assert(completeFinancials.netMargin === 35, "Complete dataset net margin must derive from supported net profit")
  assert(completeFinancials.metricSources?.revenue?.kind === "source_value", "Complete dataset revenue must be classified as a source value")
  assert(completeFinancials.metricSources?.grossProfit?.kind === "derived_value", "Complete dataset gross profit must be classified as a valid derived value")

  const revenueOnly = await buildDatasetReportInput(dataset("startup_dataset", [
    { revenue: 19_090_000 },
    { revenue: 516 },
  ], ["revenue"]))
  const revenueOnlyFinancials = financials(revenueOnly)
  assert(revenueOnlyFinancials.revenue === 19_090_516, "Revenue-only dataset keeps supported revenue")
  assert(revenueOnlyFinancials.cogs === null, "Revenue-only dataset must not fabricate COGS")
  assert(revenueOnlyFinancials.grossProfit === null, "Revenue-only dataset must not fabricate gross profit")
  assert(revenueOnlyFinancials.operatingProfit === null, "Revenue-only dataset must not fabricate operating profit")
  assert(revenueOnlyFinancials.netProfit === null, "Revenue-only dataset must not fabricate net profit")
  assert(revenueOnlyFinancials.metricSources?.cogs?.kind === "unavailable", "Missing COGS must be classified as unavailable")
  assert(revenueOnlyFinancials.metricSources?.grossProfit?.kind === "unavailable", "Missing gross profit inputs must be classified as unavailable")
  assert(revenueOnly.summary.includes("Profitability cannot be reliably assessed"), "Revenue-only summary must explain missing profitability inputs")
  assert(revenueOnly.summary.includes("Trend analysis is unavailable"), "Revenue-only summary must explain missing trend inputs")
  assert((revenueOnly.recommendations || []).some((item) => item.requiredData?.includes("COGS")), "Revenue-only recommendations must request missing cost data")

  const explicitNetProfit = await buildDatasetReportInput(dataset("explicit_net_profit_dataset", [
    { revenue: 1000, net_profit: 150 },
    { revenue: 2000, net_profit: 350 },
  ], ["revenue", "net_profit"]))
  const explicitFinancials = financials(explicitNetProfit)
  assert(explicitFinancials.netProfit === 500, "Explicit net_profit field must be used safely")
  assert(explicitFinancials.metricSources?.netProfit?.kind === "source_value", "Explicit net_profit must be classified as a source value")
  assert(explicitFinancials.grossProfit === null, "Explicit net profit must not fabricate gross profit")
  assert(explicitFinancials.operatingProfit === null, "Explicit net profit must not fabricate operating profit")

  const actualZero = await buildDatasetReportInput(dataset("actual_zero_expenses_dataset", [
    { period: "2026-01", revenue: 1000, cogs: 0, operating_expenses: 0, interest_expense: 0, tax_expense: 0 },
  ], ["period", "revenue", "cogs", "operating_expenses", "interest_expense", "tax_expense"]))
  const zeroFinancials = financials(actualZero)
  assert(zeroFinancials.cogs === 0, "Actual zero COGS must remain zero")
  assert(zeroFinancials.operatingExpenses === 0, "Actual zero opex must remain zero")
  assert(zeroFinancials.netProfit === 1000, "Actual zero costs must support net profit")
  assert(zeroFinancials.metricSources?.cogs?.kind === "source_value", "Actual zero COGS must remain a source value")
  assert(zeroFinancials.metricSources?.operatingExpenses?.kind === "source_value", "Actual zero opex must remain a source value")

  const onePerspective = calculateBusinessBalancedScorecard({
    rows: [{ revenue: 1000 }, { revenue: 2000 }],
    columns: ["revenue"],
    businessModel: "generic",
  })
  assert(onePerspective.availablePerspectiveCount === 1, "One-perspective fixture should have one available perspective")
  assert(onePerspective.strongestPerspective === null, "One perspective must not produce strongest perspective")
  assert(onePerspective.weakestPerspective === null, "One perspective must not produce weakest perspective")

  const multiplePerspectives = calculateBusinessBalancedScorecard({
    rows: [
      { date: "2026-01-01", revenue: 1000, cogs: 400, customer_id: "A", order_id: "O1", product: "Core" },
      { date: "2026-02-01", revenue: 2000, cogs: 600, customer_id: "B", order_id: "O2", product: "Plus" },
    ],
    columns: ["date", "revenue", "cogs", "customer_id", "order_id", "product"],
    businessModel: "generic",
  })
  assert(multiplePerspectives.availablePerspectiveCount >= 2, "Multiple-perspective fixture should have comparable perspectives")
  assert(multiplePerspectives.strongestPerspective !== null, "Multiple perspectives must keep strongest comparison")
  assert(multiplePerspectives.weakestPerspective !== null, "Multiple perspectives must keep weakest comparison")

  await assertPdf(revenueOnly, "startup_dataset")
  await assertPdf(complete, "complete_financial_dataset")
  fs.rmSync(process.env.TEMP_DIR, { recursive: true, force: true })

  console.log(JSON.stringify({
    startupDataset: {
      revenue: revenueOnlyFinancials.revenue,
      cogs: revenueOnlyFinancials.cogs,
      grossProfit: revenueOnlyFinancials.grossProfit,
      operatingProfit: revenueOnlyFinancials.operatingProfit,
      netProfit: revenueOnlyFinancials.netProfit,
      recommendations: revenueOnly.recommendations?.length || 0,
    },
    completeFinancialDataset: {
      revenue: completeFinancials.revenue,
      cogs: completeFinancials.cogs,
      grossProfit: completeFinancials.grossProfit,
      operatingProfit: completeFinancials.operatingProfit,
      netProfit: completeFinancials.netProfit,
    },
    actualZero: {
      cogs: zeroFinancials.cogs,
      operatingExpenses: zeroFinancials.operatingExpenses,
      netProfit: zeroFinancials.netProfit,
    },
    bbsc: {
      onePerspectiveStrongest: onePerspective.strongestPerspective,
      onePerspectiveWeakest: onePerspective.weakestPerspective,
      multiplePerspectiveStrongest: multiplePerspectives.strongestPerspective?.shortTitle,
      multiplePerspectiveWeakest: multiplePerspectives.weakestPerspective?.shortTitle,
    },
  }))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
