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
  datasetType?: "standard" | "accountancy"
  businessModel?: string
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
    precomputedMetrics: null,
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

  const ledgerRows = [
    {
      transaction_date: "2026-01-01",
      journal_id: "J-001",
      account_code: "4000",
      account_name: "Sales",
      debit: 407365.82,
      credit: 414876.69,
      tax_code: "VAT21",
      counterparty: "Customer A",
      document_number: "INV-001",
      department: "Finance",
    },
  ]
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
  assert(reportInput.kpis.some((kpi) => kpi.title === "Debit total" && kpi.value === 407365.82), "ledger report must include exact debit total")
  assert(reportInput.kpis.some((kpi) => kpi.title === "Credit total" && kpi.value === 414876.69), "ledger report must include exact credit total")

  const falsePositiveInput = await buildDatasetReportInput(dataset({
    name: "customer_credit_summary",
    rows: [{ customer_id: "C-001", plan: "Pro", credit: 500, revenue: 1200 }],
    columns: ["customer_id", "plan", "credit", "revenue"],
    datasetType: "standard",
    businessModel: "generic",
  }))
  assert(falsePositiveInput.reportType !== "accountancy", "single credit field standard dataset must not become accountancy")

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
  assert(!text.includes("Operating Profit $407.4K"), "accountancy ledger PDF must not render debit as operating profit")
  assert(!text.includes("Directly from source field: debit"), "accountancy ledger PDF must not use debit as a P&L metric source")

  console.log(JSON.stringify({
    reportType: reportInput.reportType,
    reportProfileId: reportInput.reportProfile?.id,
    operatingProfit: reportInput.financials?.operatingProfit,
    totalDebits: reportInput.kpis.find((kpi) => kpi.title === "Debit total")?.value,
    totalCredits: reportInput.kpis.find((kpi) => kpi.title === "Credit total")?.value,
    pdfPath: report.pdfPath,
  }, null, 2))

  if (report.pdfPath && fs.existsSync(report.pdfPath)) fs.unlinkSync(report.pdfPath)
  deleteReport(report.id)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
