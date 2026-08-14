import { execFileSync } from "node:child_process"
import * as fs from "node:fs"
import * as path from "node:path"
import * as XLSX from "xlsx"
import { parseCSVStreaming } from "../../src/lib/data/csvLoader"
import type { ReportDiagnostics, ReportSemanticContext } from "../../src/lib/reports/report-generator"

type DatasetInput = Parameters<typeof import("../../src/lib/reports/dataset-report-builder").buildDatasetReportInput>[0]

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

function buildRows() {
  const categories = ["Labor", "Software", "Marketing", "Facilities"]
  const vendors = ["Northwind", "Contoso", "Fabrikam", "Tailspin"]
  return Array.from({ length: 120 }, (_, index) => {
    const month = Math.floor(index / 10) + 1
    const revenue = 1000 + index * 12
    const cogs = 300 + (index % 7) * 9
    const grossProfit = revenue - cogs
    const operatingExpenses = 150 + (index % 5) * 11
    const operatingProfit = grossProfit - operatingExpenses
    const interestExpense = 12 + (index % 3)
    const taxExpense = 30 + (index % 4)
    const netProfit = operatingProfit - interestExpense - taxExpense

    return {
      date: `2026-${String(month).padStart(2, "0")}-${String((index % 10) + 1).padStart(2, "0")}`,
      revenue,
      cogs,
      gross_profit: grossProfit,
      operating_expenses: operatingExpenses,
      operating_profit: operatingProfit,
      interest_expense: interestExpense,
      tax_expense: taxExpense,
      net_profit: netProfit,
      expense_category: categories[index % categories.length],
      expense_amount: operatingExpenses,
      vendor_supplier: vendors[index % vendors.length],
      billable_hours: 4 + (index % 6),
      customer_count: 10 + (index % 8),
    }
  })
}

async function main() {
  process.env.TEMP_DIR = "/tmp/useclevr-full-row-report-semantic-test"
  fs.rmSync(process.env.TEMP_DIR, { recursive: true, force: true })
  fs.mkdirSync(process.env.TEMP_DIR, { recursive: true })

  const fixturePath = path.join(process.env.TEMP_DIR, "UseClevr_Full_Report_Test_Dataset.xlsx")
  const rows = buildRows()
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Report Fixture")
  XLSX.writeFile(workbook, fixturePath)

  const buffer = fs.readFileSync(fixturePath)
  const file = new File([buffer], "UseClevr_Full_Report_Test_Dataset.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const parsed = await parseCSVStreaming(file, 1000)
  assert(parsed.rowCount === 120, "XLSX parser must parse 120 rows")

  const { buildDatasetReportInput } = await import("../../src/lib/reports/dataset-report-builder")
  const { deleteReport, generateReport } = await import("../../src/lib/reports/report-generator")

  const dataset = {
    id: "synthetic_full_report_fixture",
    userId: "synthetic_user",
    name: "UseClevr Full Report Test Dataset",
    fileName: "UseClevr_Full_Report_Test_Dataset.xlsx",
    fileSize: buffer.length,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    storageKey: null,
    checksum: null,
    rowCount: parsed.rowCount,
    columnCount: parsed.columns.length,
    columns: parsed.columns,
    data: parsed.previewRows,
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
    businessModel: "generic",
    createdAt: new Date(),
    updatedAt: new Date(),
  } as DatasetInput

  const reportInput = await buildDatasetReportInput(dataset) as Awaited<ReturnType<typeof buildDatasetReportInput>> & {
    diagnostics: ReportDiagnostics
    semanticContext: ReportSemanticContext
  }
  assert(reportInput.rowCount === 120, "report rowCount must be 120")
  assert(reportInput.diagnostics?.rowCount === 120, "diagnostic rowCount must be 120")
  assert(reportInput.diagnostics?.rowsUsedForKpis === 120, "rowsUsedForKpis must be 120")
  assert(reportInput.diagnostics?.rowsUsedForSummary === 120, "rowsUsedForSummary must be 120")
  assert(reportInput.summary.includes("120 loaded rows"), "executive summary must use 120 loaded rows")
  assert(!reportInput.summary.includes("100 loaded rows"), "executive summary must not use 100 loaded rows")

  assert(reportInput.semanticContext?.dateField === "date", "date must be recognized")
  assert(reportInput.semanticContext?.expenseCategoryField === "expense_category", "expense_category must be recognized")
  assert(reportInput.semanticContext?.expenseAmountField === "expense_amount", "expense_amount must be recognized")
  assert(reportInput.semanticContext?.vendorField === "vendor_supplier", "vendor_supplier must be recognized")
  assert(reportInput.semanticContext?.revenueField === "revenue", "revenue must be recognized")
  assert(reportInput.semanticContext?.netProfitField === "net_profit", "net_profit must be recognized")
  assert(reportInput.diagnostics?.trendAvailable === true, "trendAvailable must be true")
  assert((reportInput.financials?.periodTrends || []).length >= 2, "period trend rows must be generated")
  assert((reportInput.financials?.topCostCategories || []).length > 0, "cost categories must be generated")

  const sharedDate = reportInput.semanticContext?.dateField
  assert(reportInput.diagnostics?.dateField === sharedDate, "Executive Summary dateField must match shared context")
  assert(reportInput.semanticContext?.mappings.date === sharedDate, "Trend Analysis dateField must match shared context")
  assert(reportInput.semanticContext?.dateField === sharedDate, "Cost Intelligence dateField must match shared context")
  assert(reportInput.rowCount === reportInput.diagnostics?.rowCount, "Executive Summary rowCount must match provenance rowCount")

  const report = await generateReport("synthetic_full_report_fixture", "UseClevr Full Report Test Dataset", {
    visibility: "private",
    status: "ready",
    reportType: reportInput.reportType,
    businessModel: reportInput.businessModel,
    userId: "synthetic_user",
    workspaceId: "synthetic_user",
    idempotencyKey: "full-row-report-semantic-consistency",
  }, reportInput)

  assert(Boolean(report.pdfPath && fs.existsSync(report.pdfPath)), "fresh PDF must generate")
  const pdfText = execFileSync("pdftotext", [report.pdfPath!, "-"], { encoding: "utf8" })
  assert(pdfText.includes("Rows Analyzed") && pdfText.includes("120"), "PDF must show 120 rows analyzed")
  assert(pdfText.includes("120 loaded rows"), "PDF executive summary must show 120 loaded rows")
  assert(!pdfText.includes("100 loaded rows"), "PDF must not mention 100 loaded rows")
  assert(!pdfText.includes("Trend unavailable"), "PDF must not report trend unavailable")
  assert(!pdfText.includes("No valid reporting-period and net-profit series exists"), "PDF must not reject valid date/net-profit trend")
  assert(!pdfText.includes("No expense category field found"), "PDF must not report expense category missing")
  assert(!pdfText.includes("Expense Category Categorize and analyze costs Missing"), "PDF must not mark expense category missing")
  assert(!pdfText.includes("Expense Amount Quantify total cost by category Missing"), "PDF must not mark expense amount missing")
  assert(!pdfText.includes("Date / Period Analyze cost trends Missing"), "PDF must not mark date missing")
  assert(!pdfText.includes("Vendor / Supplier Identify vendor opportunities Missing"), "PDF must not mark vendor missing")

  const reportsRouteSource = fs.readFileSync("src/app/api/reports/route.ts", "utf8")
  assert(reportsRouteSource.includes("isCurrentReportRuntime(existingReport)"), "Reports route must verify idempotent reports use the current runtime")
  assert(reportsRouteSource.includes("legacyReportInvalidated"), "Reports route must invalidate legacy idempotent reports instead of replaying stale PDFs")

  if (report.pdfPath) fs.unlinkSync(report.pdfPath)
  deleteReport(report.id)
  fs.rmSync(process.env.TEMP_DIR, { recursive: true, force: true })

  console.log(JSON.stringify({
    rowCount: reportInput.rowCount,
    rowsUsedForKpis: reportInput.diagnostics?.rowsUsedForKpis,
    rowsUsedForSummary: reportInput.diagnostics?.rowsUsedForSummary,
    mappings: {
      date: reportInput.semanticContext?.dateField,
      expenseCategory: reportInput.semanticContext?.expenseCategoryField,
      expenseAmount: reportInput.semanticContext?.expenseAmountField,
      vendor: reportInput.semanticContext?.vendorField,
      revenue: reportInput.semanticContext?.revenueField,
      netProfit: reportInput.semanticContext?.netProfitField,
    },
    trendAvailable: reportInput.diagnostics?.trendAvailable,
    pdfVerified: true,
  }))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
