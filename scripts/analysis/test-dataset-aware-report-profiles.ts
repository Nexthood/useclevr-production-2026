import { execFileSync } from "node:child_process"
import * as fs from "node:fs"
import * as path from "node:path"
import { parseCSVStreaming } from "../../src/lib/data/csvLoader"
import type { ReportProfileId } from "../../src/lib/reports/report-profiles"

type DatasetInput = Parameters<typeof import("../../src/lib/reports/dataset-report-builder").buildDatasetReportInput>[0]

type FixtureCase = {
  family: string
  baseName: string
  businessModel: string
  expectedProfile: ReportProfileId
}

const availableFixtures: FixtureCase[] = [
  { family: "local_retail", baseName: "local-retail", businessModel: "local_retail", expectedProfile: "local_retail" },
  { family: "ecommerce", baseName: "ecommerce", businessModel: "ecommerce", expectedProfile: "ecommerce" },
  { family: "saas_startup", baseName: "startup-saas", businessModel: "saas", expectedProfile: "saas_startup" },
  { family: "investor_portfolio", baseName: "investor-portfolio", businessModel: "investor", expectedProfile: "investor_portfolio" },
  { family: "business_consulting", baseName: "business-consulting", businessModel: "generic", expectedProfile: "business_consulting" },
]

const requiredFixtureNames = [
  "01_local_retail",
  "02_ecommerce",
  "03_saas_startup",
  "04_marketplace_startup",
  "05_investor_portfolio",
  "06_business_consulting",
  "07_professional_services",
  "08_generic_business",
  "09_profitability_pnl",
  "10_accountancy_ledger",
]

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

async function main() {
  process.env.TEMP_DIR = "/tmp/useclevr-dataset-aware-report-profile-test"
  fs.rmSync(process.env.TEMP_DIR, { recursive: true, force: true })
  fs.mkdirSync(process.env.TEMP_DIR, { recursive: true })

  const { buildDatasetReportInput } = await import("../../src/lib/reports/dataset-report-builder")
  const { deleteReport, generateReport } = await import("../../src/lib/reports/report-generator")
  const { listReportProfiles } = await import("../../src/lib/reports/report-profiles")

  const profileIds = listReportProfiles().map((profile) => profile.id).sort()
  for (const expected of [
    "local_retail",
    "ecommerce",
    "saas_startup",
    "marketplace_startup",
    "investor_portfolio",
    "business_consulting",
    "professional_services",
    "generic_business",
    "profitability_pnl",
    "accountancy_ledger",
  ] satisfies ReportProfileId[]) {
    assert(profileIds.includes(expected), `Missing report profile: ${expected}`)
  }

  const fixtureRoot = path.join(process.cwd(), "test-fixtures", "business-models")
  const results: Array<{ fixture: string; profile: string; rows: number; pdfVerified?: boolean }> = []

  for (const fixture of availableFixtures) {
    for (const extension of ["csv", "xlsx"] as const) {
      const filePath = path.join(fixtureRoot, `${fixture.baseName}.${extension}`)
      assert(fs.existsSync(filePath), `Missing available fixture ${filePath}`)
      const parsed = await parseFixture(filePath)
      const dataset = buildDataset({
        id: `profile_${fixture.family}_${extension}`,
        filePath,
        rowCount: parsed.rowCount,
        columns: parsed.columns,
        rows: parsed.previewRows,
        businessModel: fixture.businessModel,
      })
      const reportInput = await buildDatasetReportInput(dataset)
      assert(reportInput.reportProfile?.id === fixture.expectedProfile, `${fixture.family}.${extension}: expected ${fixture.expectedProfile}, received ${reportInput.reportProfile?.id}`)
      assert(reportInput.rowCount === parsed.rowCount, `${fixture.family}.${extension}: report row count mismatch`)

      if (fixture.family === "local_retail") {
        assert(reportInput.reportProfile.title === "Retail Executive Report", "local retail must use Retail Executive Report")
        assert(reportInput.kpis.some((kpi) => kpi.title === "Gross Profit"), "local retail must include Gross Profit")
        assert(reportInput.kpis.some((kpi) => kpi.title === "Gross Margin"), "local retail must include Gross Margin")
        assert(reportInput.kpis.some((kpi) => kpi.title === "Units Sold"), "local retail must include Units Sold")
        assert(reportInput.kpis.some((kpi) => kpi.title === "Current Stock"), "local retail must include Current Stock")
        assert(reportInput.kpis.some((kpi) => kpi.title === "Inventory Value"), "local retail must include Inventory Value")
        assert(reportInput.kpis.some((kpi) => kpi.title === "Products / SKUs"), "local retail must include Products / SKUs")
        assert(reportInput.kpis.some((kpi) => kpi.title === "Reorder Required"), "local retail must include Reorder Required")
        assert(reportInput.financials?.revenue === 4455, "local retail revenue must match fixture")
        assert(reportInput.financials?.cogs === 2180, "local retail COGS must use fixture cost field")
        assert(reportInput.financials?.grossProfit === 2275, "local retail gross profit must be revenue minus cost")
        assert(reportInput.financials?.grossMargin === 51.07, "local retail gross margin must match fixture")
        const recommendationText = reportInput.recommendations?.map((item) => `${item.issue} ${item.recommendedAction}`).join(" ") || ""
        assert(!/interest|tax|operating expenses/i.test(recommendationText), "local retail recommendations must not lead with generic P&L missing-field advice")
      }

      if (fixture.family === "local_retail" && extension === "xlsx") {
        const report = await generateReport(dataset.id, "01_local_retail.xlsx", {
          visibility: "private",
          status: "ready",
          reportType: reportInput.reportType,
          businessModel: reportInput.businessModel,
          userId: "synthetic_user",
          workspaceId: "synthetic_user",
          idempotencyKey: "dataset-aware-retail-profile",
        }, reportInput)
        assert(Boolean(report.pdfPath && fs.existsSync(report.pdfPath)), "local retail PDF must generate")
        const pdfText = execFileSync("pdftotext", [report.pdfPath!, "-"], { encoding: "utf8" })
        assert(pdfText.includes("RETAIL EXECUTIVE REPORT"), "local retail PDF must identify the retail report")
        assert(pdfText.includes("SALES & MARGIN PERFORMANCE"), "local retail PDF must include sales and margin page")
        assert(pdfText.includes("INVENTORY INTELLIGENCE"), "local retail PDF must include inventory page")
        assert(pdfText.includes("PRODUCT / CATEGORY / SUPPLIER INTELLIGENCE"), "local retail PDF must include product/category/supplier page")
        assert(pdfText.includes("RETAIL RECOMMENDATIONS + PROVENANCE"), "local retail PDF must include retail recommendations page")
        assert(!pdfText.includes("Interest Expense"), "local retail PDF must not render generic interest expense row")
        assert(!pdfText.includes("Tax Expense"), "local retail PDF must not render generic tax expense row")
        assert(!pdfText.includes("COST INTELLIGENCE"), "local retail PDF must not render generic cost intelligence page")
        if (report.pdfPath) fs.unlinkSync(report.pdfPath)
        deleteReport(report.id)
        results.push({ fixture: `${fixture.baseName}.${extension}`, profile: reportInput.reportProfile.id, rows: reportInput.rowCount, pdfVerified: true })
      } else {
        results.push({ fixture: `${fixture.baseName}.${extension}`, profile: reportInput.reportProfile.id, rows: reportInput.rowCount })
      }
    }
  }

  const missingRequiredFixtures = requiredFixtureNames.flatMap((name) => {
    return ["csv", "xlsx"].map((extension) => `${name}.${extension}`).filter((fileName) => !fs.existsSync(path.join(fixtureRoot, fileName)))
  })

  fs.rmSync(process.env.TEMP_DIR, { recursive: true, force: true })

  console.log(JSON.stringify({
    implementedProfiles: profileIds,
    availableFixtureResults: results,
    exactRequiredFixtureMatrix: {
      expected: requiredFixtureNames.length * 2,
      found: requiredFixtureNames.length * 2 - missingRequiredFixtures.length,
      missing: missingRequiredFixtures,
    },
  }, null, 2))
}

async function parseFixture(filePath: string) {
  const buffer = fs.readFileSync(filePath)
  const file = new File([buffer], path.basename(filePath), { type: mimeTypeForFile(filePath) })
  return parseCSVStreaming(file, 1000)
}

function buildDataset(input: {
  id: string
  filePath: string
  rowCount: number
  columns: string[]
  rows: Record<string, unknown>[]
  businessModel: string
}): DatasetInput {
  return {
    id: input.id,
    userId: "synthetic_user",
    name: path.basename(input.filePath),
    fileName: path.basename(input.filePath),
    fileSize: fs.statSync(input.filePath).size,
    mimeType: mimeTypeForFile(input.filePath),
    storageKey: null,
    checksum: null,
    rowCount: input.rowCount,
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
    businessModel: input.businessModel,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as DatasetInput
}

function mimeTypeForFile(filePath: string) {
  return filePath.endsWith(".xlsx")
    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    : "text/csv"
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
