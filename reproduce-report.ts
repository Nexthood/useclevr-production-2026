console.log("SCRIPT START")

import { buildDatasetReportInput } from "./src/lib/reports/dataset-report-builder"
import { generateReport, deleteReport } from "./src/lib/reports/report-generator"

async function main() {
  console.log("MAIN START")
  const mockDataset = {
    id: "pa_profitability_test",
    userId: "test_user",
    name: "Profitability - Test",
    fileName: "profitability_test.csv",
    fileSize: 1000,
    mimeType: "text/csv",
    storageKey: "private/storage/key.csv",
    checksum: null,
    rowCount: 8,
    columnCount: 6,
    columns: ["period", "department", "revenue", "category", "amount", "sales_volume"],
    data: [],
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
    precomputedMetrics: {
      totalRevenue: 10000,
      totalExpenses: 4000,
      cogs: 4000,
      operatingExpenses: 2000,
      interestExpense: 300,
      taxExpense: 700,
      grossProfit: 6000,
      operatingProfit: 4000,
      netProfit: 3000,
      profit: 3000,
      grossMargin: 60,
      operatingMargin: 40,
      netMargin: 30,
      margin: 30,
      expenseCategories: [["COGS", 4000], ["Rent", 1200], ["Marketing", 800], ["Interest expense", 300], ["Tax expense", 700]],
      topCostCategories: [["COGS", 4000], ["Rent", 1200], ["Marketing", 800], ["Interest expense", 300], ["Tax expense", 700]],
      revenueByProduct: [["Store Sales", 6000], ["Online Sales", 4000]],
      revenueByRegion: [["Retail", 6000], ["Online", 4000]],
      revenueByMonth: [["2026-01", 10000]],
      periodTrends: [{ period: "2026-01", revenue: 10000, cogs: 4000, operatingExpenses: 2000, interestExpense: 300, taxExpense: 700, grossProfit: 6000, operatingProfit: 4000, netProfit: 3000 }],
      departmentComparison: [],
      matchKey: "period_department",
      dataConfidence: 95,
      dataQualityNotes: [],
      missingColumns: [],
      unavailableMetrics: [],
      metricSources: {},
      periodComparison: [],
      hasBothFiles: true,
      hasRevenue: true,
      hasExpenses: true,
      status: "ready",
      statusLabel: "Profitability analysis is ready",
      profitabilityAnalysisId: "pa_profitability_test",
      profitability_analysis_id: "pa_profitability_test",
      profitabilityFileRole: "combined",
      profitability_file_role: "combined",
      sourceFiles: [],
    },
    columnMapping: {
      profitabilityAnalysisId: "pa_profitability_test",
      profitabilityFileRole: "combined",
      sourceFiles: [],
    },
    detectedColumns: null,
    aiInsights: null,
    status: "ready",
    analysis: { datasetType: "profitability", businessModel: "generic", profitability: { profitabilityAnalysisId: "pa_profitability_test" } },
    datasetType: "profitability",
    businessModel: "generic",
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any

  try {
    console.log("Building dataset report input...")
    const reportInput = await buildDatasetReportInput(mockDataset)
    console.log("Report input built successfully")
    console.log("reportType:", reportInput.reportType)
    console.log("rowCount:", reportInput.rowCount)
    console.log("has semanticContext:", "semanticContext" in reportInput)
    console.log("has diagnostics:", "diagnostics" in reportInput)
    
    console.log("Generating report...")
    const report = await generateReport(
      mockDataset.id,
      mockDataset.name,
      {
        visibility: "private",
        status: "ready",
        reportType: reportInput.reportType,
        businessModel: reportInput.businessModel,
        userId: "test_user",
        workspaceId: "test_user",
        idempotencyKey: "test-profitability-report",
      },
      reportInput
    )
    console.log("Report generated successfully:", report.id)
    console.log("PDF path:", report.pdfPath)
    if (report.pdfPath && require("fs").existsSync(report.pdfPath)) {
      console.log("PDF exists!")
    } else {
      console.log("PDF does not exist")
    }
    deleteReport(report.id)
  } catch (error) {
    console.error("FAILED:", error instanceof Error ? error.message : String(error))
    if (error instanceof Error) {
      console.error("Stack:", error.stack)
    }
    process.exit(1)
  }
}

main()
