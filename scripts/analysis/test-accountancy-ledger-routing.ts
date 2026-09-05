import { execFileSync } from "node:child_process"
import * as fs from "node:fs"
import { buildDatasetReportInput, resolveReportModel } from "../../src/lib/reports/dataset-report-builder"
import { deleteReport, generateReport } from "../../src/lib/reports/report-generator"

type TestDataset = Parameters<typeof buildDatasetReportInput>[0]

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

function dataset(input: {
  name: string
  rows: Record<string, unknown>[]
  columns: string[]
  datasetType?: "standard" | "accountancy" | "profitability"
  businessModel?: string
  precomputedMetrics?: Record<string, unknown> | null
}): TestDataset {
  return {
    id: `synthetic_${input.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
    userId: "synthetic_user",
    name: input.name,
    fileName: `${input.name}.csv`,
    fileSize: 1000,
    mimeType: "text/csv",
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
    precomputedMetrics: input.precomputedMetrics ?? null,
    columnMapping: null,
    detectedColumns: null,
    aiInsights: null,
    status: "ready",
    analysis: {},
    datasetType: input.datasetType || "standard",
    businessModel: input.businessModel || "generic",
    createdAt: new Date(),
    updatedAt: new Date(),
  } as TestDataset
}

function buildLedgerRows(rowCount: number) {
  return Array.from({ length: rowCount }, (_, index) => ({
    transaction_date: `2026-01-${String((index % 28) + 1).padStart(2, "0")}`,
    journal_id: `J-${String(index + 1).padStart(3, "0")}`,
    account_code: String(4000 + (index % 7)),
    account_name: `Account ${index % 7}`,
    debit: index === 0 ? 407365.82 : 0,
    credit: index === 0 ? 414876.69 : 0,
    document_number: `DOC-${String(index + 1).padStart(3, "0")}`,
  }))
}

function kpiValue(reportInput: Awaited<ReturnType<typeof buildDatasetReportInput>>, title: string) {
  return reportInput.kpis.find((kpi) => kpi.title === title)?.value ?? null
}

async function main() {
  process.env.TEMP_DIR = "/tmp/useclevr-accountancy-ledger-routing-test"
  fs.rmSync(process.env.TEMP_DIR, { recursive: true, force: true })

  const ledgerColumns = [
    "transaction_date",
    "journal_id",
    "account_code",
    "account_name",
    "debit",
    "credit",
    "tax_code",
    "counterparty",
    "document_number",
    "department",
  ]

  assert(
    resolveReportModel("standard", "generic", ledgerColumns, "standard_upload") === "accountancy",
    "standard uploads with debit, credit, and account or journal evidence must resolve to accountancy",
  )

  assert(
    resolveReportModel("standard", "generic", ["customer_id", "plan", "credit", "revenue"], "customer_credits") === "generic",
    "a normal business dataset with only one unrelated credit field must not resolve to accountancy",
  )

  const ledgerRows = buildLedgerRows(200)
  const reportInput = await buildDatasetReportInput(dataset({
    name: "10_accountancy_ledger",
    rows: ledgerRows,
    columns: ledgerColumns,
    datasetType: "standard",
    businessModel: "generic",
  }))

  assert(reportInput.reportType === "accountancy", "ledger schema must build reportType accountancy")
  assert(reportInput.reportProfile?.id === "accountancy_ledger", "ledger schema must use accountancy ledger report profile")
  assert(reportInput.financials?.operatingProfit === null, "ledger schema must keep operating profit unavailable")
  assert(reportInput.financials?.revenue === null, "ledger schema must keep revenue unavailable")
  assert(reportInput.financials?.dataConfidence === 100, "complete ledger data confidence must use ledger field coverage")
  assert(reportInput.semanticContext?.confidence === 100, "complete ledger semantic confidence must use ledger field coverage")
  assert(reportInput.kpis.some((kpi) => kpi.title === "Debit total" && kpi.value === 407365.82), "ledger report must include exact debit total")
  assert(reportInput.kpis.some((kpi) => kpi.title === "Credit total" && kpi.value === 414876.69), "ledger report must include exact credit total")
  assert(kpiValue(reportInput, "Invoices / documents") === 200, "ledger report must include exact document count")
  assert(kpiValue(reportInput, "Accounts") === 7, "ledger report must include exact account count")

  const partialLedgerInput = await buildDatasetReportInput(dataset({
    name: "partial_ledger",
    rows: [{ transaction_date: "2026-01-01", account_name: "Bank", debit: 120, document_number: "DOC-001" }],
    columns: ["transaction_date", "account_name", "debit", "document_number"],
    datasetType: "accountancy",
    businessModel: "generic",
  }))
  assert(partialLedgerInput.reportType === "accountancy", "partial ledger must keep accountancy reportType")
  assert(partialLedgerInput.financials?.dataConfidence === 75, "partial ledger confidence must reflect missing credit field")
  assert(partialLedgerInput.financials?.revenue === null, "partial ledger must not fabricate revenue")
  assert(partialLedgerInput.financials?.netProfit === null, "partial ledger must not fabricate net profit")

  const insufficientLedgerInput = await buildDatasetReportInput(dataset({
    name: "insufficient_ledger",
    rows: [{ transaction_date: "2026-01-01", account_name: "Bank" }],
    columns: ["transaction_date", "account_name"],
    datasetType: "accountancy",
    businessModel: "generic",
  }))
  assert(insufficientLedgerInput.reportType === "accountancy", "explicit insufficient ledger must keep accountancy reportType")
  assert(insufficientLedgerInput.financials?.dataConfidence === 40, "insufficient ledger confidence must reflect date and account only")
  assert(kpiValue(insufficientLedgerInput, "Debit total") === null, "insufficient ledger must not expose debit total without debit values")
  assert(kpiValue(insufficientLedgerInput, "Credit total") === null, "insufficient ledger must not expose credit total without credit values")
  assert(kpiValue(insufficientLedgerInput, "Invoices / documents") === 1, "insufficient ledger must keep document row fallback")
  assert(kpiValue(insufficientLedgerInput, "Accounts") === 1, "insufficient ledger must keep recognized account count")
  assert(insufficientLedgerInput.financials?.revenue === null, "insufficient ledger must not fabricate revenue")

  const falsePositiveInput = await buildDatasetReportInput(dataset({
    name: "generic_business_control",
    rows: [{ invoice_id: "INV-001", revenue: 1200, cost: 800, cogs: 700, profit: 500 }],
    columns: ["invoice_id", "revenue", "cost", "cogs", "profit"],
    datasetType: "standard",
    businessModel: "generic",
  }))
  assert(falsePositiveInput.reportType === "generic", "generic business control must keep generic reportType")
  assert(falsePositiveInput.financials?.dataConfidence === 40, "generic business data confidence must keep generic financial completeness formula")

  const profitabilityInput = await buildDatasetReportInput(dataset({
    name: "profitability_confidence",
    rows: [{ source: "selected pair" }],
    columns: ["source"],
    datasetType: "profitability",
    businessModel: "profitability",
    precomputedMetrics: {
      totalRevenue: 1000,
      cogs: 400,
      operatingExpenses: 200,
      interestExpense: 50,
      taxExpense: 100,
      dataConfidence: 73,
    },
  }))
  assert(profitabilityInput.reportType === "profitability", "profitability report must remain profitability")
  assert(profitabilityInput.financials?.dataConfidence === 73, "profitability data confidence must still come from profitability metrics")

  const report = await generateReport("synthetic_10_accountancy_ledger", "10_accountancy_ledger", {
    visibility: "private",
    status: "ready",
    reportType: reportInput.reportType,
    businessModel: reportInput.businessModel,
    userId: "synthetic_user",
    workspaceId: "synthetic_user",
    idempotencyKey: "accountancy-ledger-routing-regression",
  }, reportInput)

  assert(Boolean(report.pdfPath && fs.existsSync(report.pdfPath)), "accountancy ledger PDF must generate")
  const text = execFileSync("pdftotext", [report.pdfPath!, "-"], { encoding: "utf8" })
  assert(text.includes("ACCOUNTANCY LEDGER SUMMARY"), "accountancy ledger PDF must enter ledger branch")
  assert(text.includes("Total Debits") && text.includes("$407.4K"), "accountancy ledger PDF must show total debits")
  assert(text.includes("Total Credits") && text.includes("$414.9K"), "accountancy ledger PDF must show total credits")
  assert(text.includes("Net Movement") && text.includes("-$7.5K"), "accountancy ledger PDF must show net movement")
  assert(text.includes("Data Confidence") && text.includes("100 / 100"), "accountancy ledger PDF must show ledger-specific confidence")
  assert(!text.includes("Operating Profit $407.4K"), "accountancy ledger PDF must not render debit as operating profit")
  assert(!text.includes("Directly from source field: debit"), "accountancy ledger PDF must not use debit as a P&L metric source")

  console.log(JSON.stringify({
    reportType: reportInput.reportType,
    reportProfileId: reportInput.reportProfile?.id,
    operatingProfit: reportInput.financials?.operatingProfit,
    totalDebits: reportInput.kpis.find((kpi) => kpi.title === "Debit total")?.value,
    totalCredits: reportInput.kpis.find((kpi) => kpi.title === "Credit total")?.value,
    documents: reportInput.kpis.find((kpi) => kpi.title === "Invoices / documents")?.value,
    accounts: reportInput.kpis.find((kpi) => kpi.title === "Accounts")?.value,
    dataConfidence: reportInput.financials?.dataConfidence,
    pdfPath: report.pdfPath,
  }, null, 2))

  if (report.pdfPath && fs.existsSync(report.pdfPath)) fs.unlinkSync(report.pdfPath)
  deleteReport(report.id)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
