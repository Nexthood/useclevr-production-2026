import { execFileSync } from "node:child_process"
import * as fs from "node:fs"
import { buildDatasetReportInput } from "../../src/lib/reports/dataset-report-builder"
import { deleteReport, generateReport } from "../../src/lib/reports/report-generator"
import type { InvestorReportAnalysis } from "../../src/lib/reports/report-generator"

type TestDataset = Parameters<typeof buildDatasetReportInput>[0]
type DatasetReportInput = Awaited<ReturnType<typeof buildDatasetReportInput>>
type InvestorReportInput = DatasetReportInput & {
  investorAnalysis?: InvestorReportAnalysis
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
  businessModel?: string
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
    precomputedMetrics: null,
    columnMapping: null,
    detectedColumns: null,
    aiInsights: null,
    status: "ready",
    analysis: {},
    datasetType: "standard",
    businessModel: input.businessModel || "investor",
    createdAt: new Date(),
    updatedAt: new Date(),
  } as TestDataset
}

function buildInvestorRows() {
  return Array.from({ length: 45 }, (_, index) => {
    const companyNumber = index + 1
    const isLast = index === 44
    return {
      company_id: `CO-${String(companyNumber).padStart(3, "0")}`,
      company_name: `Portfolio Co ${String(companyNumber).padStart(3, "0")}`,
      sector: ["Fintech", "Health", "SaaS", "Climate", "Consumer"][index % 5],
      stage: ["Seed", "Series A", "Series B", "Growth"][index % 4],
      status: index < 38 ? "Active" : index < 43 ? "Exited" : "Watchlist",
      investment_date: "2024-01-15",
      invested_amount: isLast ? 568450.45 : 470000,
      entry_valuation: isLast ? 12720000 : 4000000,
      latest_valuation: isLast ? 14010475.74 : 9700000,
      ownership_percent: isLast ? 15.545 : 13.7,
      revenue: isLast ? 3184909.53 : 2800000,
      growth_rate: 18 + (index % 9),
      runway_months: 12 + (index % 18),
    }
  })
}

async function assertInvestorFixtureAggregation() {
  const rows = buildInvestorRows()
  const columns = Object.keys(rows[0] ?? {})
  const reportInput = await buildDatasetReportInput(dataset({
    name: "05_investor_portfolio",
    rows,
    columns,
  })) as InvestorReportInput
  const investor = reportInput.investorAnalysis
  assert(reportInput.reportType === "investor", `investor fixture must resolve reportType investor, received ${reportInput.reportType}`)
  assert(reportInput.reportProfile?.id === "investor_portfolio", `investor fixture must use investor profile, received ${reportInput.reportProfile?.id}`)
  assert(investor !== undefined, "investor analysis must be present")
  assert(investor.portfolioCompanies === 45, `portfolioCompanyCount must be 45, received ${investor.portfolioCompanies}`)
  nearlyEqual(investor.totalInvested, 21248450.45, "totalInvested must sum invested_amount")
  nearlyEqual(investor.totalValuation, 440810475.74, "aggregateLatestValuation must sum latest_valuation")
  nearlyEqual(investor.avgOwnership, 13.741, "average ownership must remain averaged", 0.001)
  assert(investor.companiesByStatus.find((item) => item.status === "Active")?.count === 38, "active companies must remain 38")
  assert(investor.companiesByStatus.find((item) => item.status === "Exited")?.count === 5, "exited companies must remain 5")
  assert(investor.companiesByStatus.find((item) => item.status === "Watchlist")?.count === 2, "watchlist companies must remain 2")
  nearlyEqual(reportInput.financials?.revenue, 126384909.53, "portfolio revenue must remain source revenue sum", 0.02)

  console.log(JSON.stringify({
    resolvedReportType: reportInput.reportType,
    resolvedModel: reportInput.businessModel,
    portfolioCompanyCount: investor.portfolioCompanies,
    totalInvested: investor.totalInvested,
    aggregateLatestValuation: investor.totalValuation,
    averageOwnership: investor.avgOwnership,
    activeCompanies: investor.companiesByStatus.find((item) => item.status === "Active")?.count,
    exitedCompanies: investor.companiesByStatus.find((item) => item.status === "Exited")?.count,
    watchlistCompanies: investor.companiesByStatus.find((item) => item.status === "Watchlist")?.count,
    portfolioRevenue: reportInput.financials?.revenue,
  }, null, 2))

  const report = await generateReport("synthetic_05_investor_portfolio", "05_investor_portfolio.xlsx", {
    visibility: "private",
    status: "ready",
    reportType: reportInput.reportType,
    businessModel: reportInput.businessModel,
    userId: "synthetic_user",
    workspaceId: "synthetic_user",
    idempotencyKey: "investor-portfolio-aggregation-regression",
  }, reportInput)

  assert(Boolean(report.pdfPath && fs.existsSync(report.pdfPath)), "investor portfolio PDF must generate")
  const text = execFileSync("pdftotext", [report.pdfPath!, "-"], { encoding: "utf8" })
  assert(text.includes("INVESTOR PORTFOLIO REPORT"), "PDF must use the investor portfolio branch")
  assert(text.includes("INVESTMENT & VALUATION PERFORMANCE"), "PDF must render investor performance section")
  assert(text.includes("Total Invested") && text.includes("$21.25M"), "PDF must show Total Invested as $21.25M")
  assert((text.includes("Aggregate latest company valuations") || text.includes("Total Valuation")) && text.includes("$440.81M"), "PDF must show Aggregate Company Valuations as $440.81M")
  assert(!text.includes("$91.1K"), "PDF must not show the old investment-date sum")
  assert(!text.includes("$188.72M"), "PDF must not show entry valuation as aggregate company valuation")

  console.log(JSON.stringify({
    pdfPath: report.pdfPath,
    pdfContainsTotalInvested: text.includes("$21.25M"),
    pdfContainsAggregateCompanyValuations: text.includes("$440.81M"),
  }, null, 2))

  deleteReport(report.id)
}

async function assertInvestorAggregationSemantics() {
  const rows = [
    { company_id: "CO-001", investment_date: "2024-01-15", invested_amount: 100, entry_valuation: 1000, latest_valuation: 1500, ownership_percent: 10 },
    { company_id: "CO-002", investment_date: "2024-02-15", invested_amount: 200, entry_valuation: 2000, latest_valuation: 2500, ownership_percent: 20 },
    { company_id: "CO-003", investment_date: "2024-03-15", invested_amount: 300, entry_valuation: 3000, latest_valuation: 3500, ownership_percent: 30 },
  ]
  const reportInput = await buildDatasetReportInput(dataset({
    name: "investor_aggregation_semantics",
    rows,
    columns: Object.keys(rows[0] ?? {}),
  })) as InvestorReportInput
  const investor = reportInput.investorAnalysis
  assert(investor !== undefined, "investor aggregation semantics must build investor analysis")
  assert(investor.portfolioCompanies === 3, "multiple investor rows must count each company once")
  nearlyEqual(investor.totalInvested, 600, "invested_amount must be summed")
  nearlyEqual(investor.totalValuation, 7500, "latest_valuation must be summed")
  nearlyEqual(investor.avgOwnership, 20, "ownership_percent must be averaged")
}

async function main() {
  process.env.TEMP_DIR = "/tmp/useclevr-investor-portfolio-aggregation-test"
  fs.rmSync(process.env.TEMP_DIR, { recursive: true, force: true })
  fs.mkdirSync(process.env.TEMP_DIR, { recursive: true })

  await assertInvestorFixtureAggregation()
  await assertInvestorAggregationSemantics()
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
