import assert from "node:assert/strict"

import { resolveBusinessModel } from "../../src/lib/data/business-model"
import { buildDashboard } from "../../src/lib/data/dashboard-builder"
import { parseCSVString } from "../../src/lib/data/csvLoader"
import { buildDatasetIntelligenceEngine } from "../../src/lib/data/dataset-intelligence-engine"
import { buildDashboardSemanticAnalysis } from "../../src/lib/data/dashboard-semantic-profile"
import { buildDatasetReportInput } from "../../src/lib/reports/dataset-report-builder"

const csv = [
  "company,plan,users,price_per_user,revenue,cost,profit,startup_stage,country,date",
  "Acme AI,Pro,120,49,5880,2400,3480,Seed,US,2026-01-31",
  "BetaWorks,Enterprise,80,199,15920,7400,8520,Series A,NL,2026-01-31",
  "CloudNine,Basic,210,19,3990,1800,2190,Pre-seed,DE,2026-02-28",
  "DeltaOps,Pro,150,49,7350,3600,3750,Seed,GB,2026-02-28",
].join("\n")

async function main() {
  const parsed = parseCSVString(csv)
  const rows = parsed.rows as Record<string, unknown>[]
  const columns = parsed.columns
  const businessModel = resolveBusinessModel({
    uploadSource: "standard",
    datasetType: "standard",
    columns,
    datasetName: "saas-startup-analysis",
  })

  assert.equal(businessModel, "saas", "standard SaaS/startup uploads resolve to the SaaS business model")

  const analysis = {
    dataset_type: "standard",
    datasetCategory: "standard",
    datasetType: "standard",
    business_model: businessModel,
    businessModel,
    uploadSource: "standard",
  }
  const dataset = {
    id: "ds_saas_startup_unit_economics",
    userId: "user_test",
    name: "saas-startup-analysis",
    fileName: "saas-startup-analysis.csv",
    fileSize: csv.length,
    mimeType: "text/csv",
    storageKey: null,
    checksum: null,
    rowCount: rows.length,
    columnCount: columns.length,
    columns,
    data: rows,
    columnTypes: {},
    previewRowCount: null,
    previewGenerated: null,
    fullAnalysisCompleted: null,
    analysisStatus: "ready",
    analysisProgress: 100,
    analysisMessage: "Analysis is ready.",
    analysisError: null,
    invalidRowCount: null,
    missingValueCounts: null,
    precomputedMetrics: null,
    columnMapping: null,
    detectedColumns: null,
    aiInsights: null,
    status: "ready",
    analysis,
    datasetType: "standard",
    businessModel,
    createdAt: new Date("2026-02-28T00:00:00.000Z"),
    updatedAt: new Date("2026-02-28T00:00:00.000Z"),
  } as Parameters<typeof buildDatasetReportInput>[0]

  const die = buildDatasetIntelligenceEngine({
    rows,
    columns,
    fileName: "saas-startup-analysis.csv",
    rawText: csv,
    mimeType: "text/csv",
  })

  assert.equal(die.businessModel.model, "SaaS", "semantic AI context classifies SaaS/startup unit economics")
  assert.equal(die.columns.find((column) => column.columnName === "company")?.canonicalRole, "Company")
  assert.equal(die.columns.find((column) => column.columnName === "plan")?.canonicalRole, "Category")
  assert.equal(die.columns.find((column) => column.columnName === "users")?.canonicalRole, "Users")
  assert.equal(die.columns.find((column) => column.columnName === "price_per_user")?.canonicalRole, "Price per User")
  assert.equal(die.columns.find((column) => column.columnName === "startup_stage")?.canonicalRole, "Category")
  assert.equal(die.columns.find((column) => column.columnName === "date")?.primaryValueType, "Date")
  assert.ok(die.relationships.some((relationship) => relationship.id === "average_revenue_per_user"))
  assert.ok(die.kpis.some((kpi) => kpi.id === "total_revenue" && kpi.value === 33140))
  assert.ok(die.kpis.some((kpi) => kpi.id === "total_cost" && kpi.value === 15200))
  assert.ok(die.kpis.some((kpi) => kpi.id === "total_profit" && kpi.value === 17940))
  assert.ok(die.kpis.some((kpi) => kpi.id === "profit_margin" && kpi.value === 54.13))
  assert.ok(die.kpis.some((kpi) => kpi.id === "total_users" && kpi.value === 560))
  assert.ok(die.kpis.some((kpi) => kpi.id === "average_revenue_per_user" && kpi.value === 59.18))
  assert.equal(die.kpis.some((kpi) => /order value|mrr|arr|churn|cac|ltv|runway/i.test(kpi.title)), false)
  assert.ok(die.dashboard.widgets.some((widget) => widget.title === "Revenue by Plan"))
  assert.ok(die.dashboard.widgets.some((widget) => widget.title === "Revenue by Startup Stage"))
  assert.ok(die.aiContext.semanticColumns.some((column) => column.columnName === "users" && column.canonicalRole === "Users"))

  const report = await buildDatasetReportInput(dataset)
  assert.equal(report.reportType, "saas")
  assert.equal(report.reportProfile.id, "saas_startup")
  assert.equal(report.semanticContext.mappings.plan, "plan")
  assert.equal(report.semanticContext.mappings.startupStage, "startup_stage")
  assert.equal(report.semanticContext.mappings.company, "company")
  assert.equal(report.semanticContext.mappings.users, "users")
  assert.equal(report.saasAnalysis?.revenue, 33140)
  assert.equal(report.saasAnalysis?.cost, 15200)
  assert.equal(report.saasAnalysis?.profit, 17940)
  assert.equal(report.saasAnalysis?.profitMargin, 54.13)
  assert.equal(report.saasAnalysis?.users, 560)
  assert.equal(report.saasAnalysis?.averageRevenuePerUser, 59.18)
  assert.ok(report.kpis.some((kpi) => kpi.title === "Total Revenue" && kpi.value === 33140))
  assert.ok(report.kpis.some((kpi) => kpi.title === "Total Profit" && kpi.value === 17940))
  assert.ok(report.kpis.some((kpi) => kpi.title === "Total Users" && kpi.value === 560))
  assert.equal(report.kpis.some((kpi) => /MRR|ARR|CAC|LTV|Churn|Burn|Runway/.test(kpi.title)), false)
  assert.ok(report.charts.some((chart) => chart.title === "Revenue by Plan"))
  assert.ok(report.charts.some((chart) => chart.title === "Revenue by Startup Stage"))

  const semanticDashboard = await buildDashboardSemanticAnalysis(dataset)
  assert.equal(semanticDashboard.businessProfile, "saas")
  assert.equal(semanticDashboard.reportProfileId, "saas_startup")
  assert.ok(semanticDashboard.metrics.some((metric) => metric.label === "Total Revenue" && metric.value === 33140))
  assert.ok(semanticDashboard.metrics.some((metric) => metric.label === "Average Revenue per User" && metric.value === 59.18))

  const dashboard = buildDashboard(dataset.id, rows)
  assert.equal(dashboard.metadata.businessModel, "SaaS")
  assert.equal(dashboard.kpis.some((kpi) => /Order Value/.test(kpi.title)), false)
  assert.ok(dashboard.kpis.some((kpi) => kpi.id === "total_users" && kpi.value === 560))
  assert.ok(dashboard.charts.some((chart) => chart.title === "Revenue by Startup Stage"))

  process.stdout.write("SaaS/startup unit-economics upload analysis tests passed.\n")
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exit(1)
})
