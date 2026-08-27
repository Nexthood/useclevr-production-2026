import assert from "node:assert/strict"

import { resolveBusinessModel } from "../../src/lib/data/business-model"
import { buildDashboard } from "../../src/lib/data/dashboard-builder"
import { parseCSVString } from "../../src/lib/data/csvLoader"
import { buildDatasetIntelligenceEngine } from "../../src/lib/data/dataset-intelligence-engine"
import { buildDashboardSemanticAnalysis } from "../../src/lib/data/dashboard-semantic-profile"
import { buildDatasetReportInput } from "../../src/lib/reports/dataset-report-builder"
import type { SaasReportAnalysis } from "../../src/lib/reports/report-generator"

const csv = [
  "company,plan,users,price_per_user,revenue,cost,profit,startup_stage,country,date",
  "Acme AI,Pro,120,49,5880,2400,3480,Seed,US,2026-01-31",
  "BetaWorks,Enterprise,80,199,15920,7400,8520,Series A,NL,2026-01-31",
  "CloudNine,Basic,210,19,3990,1800,2190,Pre-seed,DE,2026-02-28",
  "DeltaOps,Pro,150,49,7350,3600,3750,Seed,GB,2026-02-28",
].join("\n")

function makeSaasDataset(name: string, rows: Record<string, unknown>[], columns: string[]) {
  return {
    id: `ds_${name.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`,
    userId: "user_test",
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
    analysis: { datasetType: "standard", businessModel: "saas", uploadSource: "standard" },
    datasetType: "standard",
    businessModel: "saas",
    createdAt: new Date("2026-03-31T00:00:00.000Z"),
    updatedAt: new Date("2026-03-31T00:00:00.000Z"),
  } as Parameters<typeof buildDatasetReportInput>[0]
}

function getSaasAnalysis(report: Awaited<ReturnType<typeof buildDatasetReportInput>>): SaasReportAnalysis {
  const analysis = (report as { saasAnalysis?: SaasReportAnalysis }).saasAnalysis
  assert.ok(analysis, "Expected SaaS report analysis to be available.")
  return analysis
}

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
  assert.equal(die.saas?.profile, "transactional_saas")
  assert.ok(die.saas.confidence >= 0.55)
  assert.equal(die.saas.mappings.period, "date")
  assert.equal(die.saas.mappings.plan, "plan")
  assert.equal(die.saas.mappings.users, "users")
  assert.equal(die.saas.mappings.price_per_user, "price_per_user")
  assert.equal(die.saas.mappings.revenue, "revenue")
  assert.equal(die.saas.mappings.cost, "cost")
  assert.equal(die.saas.mappings.profit, "profit")
  assert.equal(die.saas.mappings.country, "country")
  assert.equal(die.saas.mappings.startup_stage, "startup_stage")
  assert.equal(die.saas.capabilities.unitEconomics, true)
  assert.equal(die.saas.capabilities.segmentation, true)
  assert.equal(die.saas.capabilities.geography, true)
  assert.equal(die.aiContext.saas?.profile, "transactional_saas")
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

  const subscriptionSnapshot = buildDatasetIntelligenceEngine({
    rows: [
      { billing_month: "2026-03", customer_id: "cus_1", subscription_id: "sub_1", plan: "Pro", status: "active", mrr: 500, arr: 6000, renewal_date: "2027-03-01" },
      { billing_month: "2026-03", customer_id: "cus_2", subscription_id: "sub_2", plan: "Team", status: "churned", mrr: 200, arr: 2400, churn_date: "2026-03-20" },
    ],
    columns: ["billing_month", "customer_id", "subscription_id", "plan", "status", "mrr", "arr", "renewal_date", "churn_date"],
    fileName: "subscription-snapshot.csv",
  })
  assert.equal(subscriptionSnapshot.businessModel.model, "SaaS")
  assert.equal(subscriptionSnapshot.saas?.profile, "subscription_snapshot")
  assert.equal(subscriptionSnapshot.saas.capabilities.recurringRevenue, true)
  assert.equal(subscriptionSnapshot.saas.capabilities.subscriptionLifecycle, true)
  assert.ok(subscriptionSnapshot.kpis.some((kpi) => kpi.id === "mrr" && kpi.value === 700))
  assert.ok(subscriptionSnapshot.kpis.some((kpi) => kpi.id === "arr" && kpi.value === 8400))

  const customerCohort = buildDatasetIntelligenceEngine({
    rows: [
      { signup_date: "2026-01-05", customer_id: "cus_1", plan: "Pro", mrr: 500, churn: "no", expansion: 50, contraction: 0, country: "US", cohort: "2026-01" },
      { signup_date: "2026-01-18", customer_id: "cus_2", plan: "Team", mrr: 200, churn: "yes", expansion: 0, contraction: 25, country: "NL", cohort: "2026-01" },
    ],
    columns: ["signup_date", "customer_id", "plan", "mrr", "churn", "expansion", "contraction", "country", "cohort"],
    fileName: "customer-cohort.csv",
  })
  assert.equal(customerCohort.saas?.profile, "customer_cohort")
  assert.equal(customerCohort.saas.capabilities.cohortRetention, true)
  assert.equal(customerCohort.saas.mappings.expansion_mrr, "expansion")
  assert.equal(customerCohort.saas.mappings.contraction_mrr, "contraction")

  const saasFinancial = buildDatasetIntelligenceEngine({
    rows: [
      { month: "2026-01", revenue: 20000, expenses: 14000, profit: 6000, burn: 3000, cash: 120000, runway: 40 },
      { month: "2026-02", revenue: 24000, expenses: 15000, profit: 9000, burn: 2500, cash: 118000, runway: 47.2 },
    ],
    columns: ["month", "revenue", "expenses", "profit", "burn", "cash", "runway"],
    fileName: "saas-financial.csv",
  })
  assert.equal(saasFinancial.saas?.profile, "saas_financial")
  assert.equal(saasFinancial.saas.capabilities.financialRunway, true)
  assert.equal(saasFinancial.saas.mappings.cash_balance, "cash")

  const hybridSaas = buildDatasetIntelligenceEngine({
    rows: [
      { month: "2026-01", customer_id: "cus_1", subscription_id: "sub_1", plan: "Pro", status: "active", mrr: 500, revenue: 500, users: 10, unit_price: 50, burn: 1000, cash_balance: 30000, runway: 30 },
      { month: "2026-02", customer_id: "cus_2", subscription_id: "sub_2", plan: "Team", status: "active", mrr: 900, revenue: 900, users: 30, unit_price: 30, burn: 1200, cash_balance: 28800, runway: 24 },
    ],
    columns: ["month", "customer_id", "subscription_id", "plan", "status", "mrr", "revenue", "users", "unit_price", "burn", "cash_balance", "runway"],
    fileName: "hybrid-saas.csv",
  })
  assert.equal(hybridSaas.saas?.profile, "hybrid_saas")
  assert.equal(hybridSaas.saas.capabilities.recurringRevenue, true)
  assert.equal(hybridSaas.saas.capabilities.unitEconomics, true)
  assert.equal(hybridSaas.saas.capabilities.financialRunway, true)

  const caseARows = [
    { date: "2026-01-31", mrr: 10000, customers: 100, new_customers: 12, churned_customers: 2 },
    { date: "2026-02-28", mrr: 12000, customers: 120, new_customers: 15, churned_customers: 3 },
  ]
  const caseA = await buildDatasetReportInput(makeSaasDataset("saas-case-a-customer-counts", caseARows, ["date", "mrr", "customers", "new_customers", "churned_customers"]))
  const caseASaas = getSaasAnalysis(caseA)
  assert.equal(caseASaas.customers, 120)
  assert.equal(caseASaas.customerAggregation, "latest_snapshot")
  assert.equal(caseASaas.newCustomers, 27)
  assert.equal(caseASaas.newCustomerAggregation, "period_flow")
  assert.equal(caseASaas.churnedCustomers, 5)
  assert.equal(caseASaas.churnedCustomerAggregation, "period_flow")
  assert.equal(caseASaas.churnRate, 2.5)
  assert.equal(caseASaas.churnRateSource, "derived_from_counts")
  assert.ok(caseA.kpis.some((kpi) => kpi.title === "Customers" && kpi.value === 120))
  assert.ok(caseA.kpis.some((kpi) => kpi.title === "New Customers" && kpi.value === 27))
  assert.ok(caseA.kpis.some((kpi) => kpi.title === "Churned Customers" && kpi.value === 5))

  const caseBRows = [
    { date: "2026-01-31", mrr: 10000, total_customers: 100, new_customers: 12, churned_customers: 2, churn_rate: 2 },
    { date: "2026-02-28", mrr: 12000, total_customers: 120, new_customers: 15, churned_customers: 3, churn_rate: 2.5 },
  ]
  const caseB = await buildDatasetReportInput(makeSaasDataset("saas-case-b-source-churn-rate", caseBRows, ["date", "mrr", "total_customers", "new_customers", "churned_customers", "churn_rate"]))
  const caseBSaas = getSaasAnalysis(caseB)
  assert.equal(caseBSaas.customers, 120)
  assert.equal(caseBSaas.customerField, "total_customers")
  assert.equal(caseBSaas.churnedCustomers, 5)
  assert.equal(caseBSaas.churnRate, 2.5)
  assert.equal(caseBSaas.churnRateField, "churn_rate")
  assert.equal(caseBSaas.churnRateSource, "source_rate")
  assert.notEqual(caseBSaas.churnRate, 4.5)

  const caseC = await buildDatasetReportInput(makeSaasDataset("saas-case-c-no-segmentation", caseARows, ["date", "mrr", "customers", "new_customers", "churned_customers"]))
  const caseCRecommendationText = caseC.recommendations.map((item) => `${item.issue} ${item.recommendedAction} ${(item.requiredData || []).join(" ")}`).join(" ").toLowerCase()
  assert.equal(/plan|country|channel/.test(caseCRecommendationText), false)
  assert.ok(caseC.kpis.some((kpi) => kpi.title === "Customers" && kpi.value === 120))
  assert.ok((caseC.financials.dataConfidence ?? 0) >= 60)

  const caseDRows = [
    { date: "2026-01-31", mrr: 10000, customers: 100 },
    { date: "2026-02-28", mrr: 12000, customers: 120 },
  ]
  const caseD = await buildDatasetReportInput(makeSaasDataset("saas-case-d-missing-churn", caseDRows, ["date", "mrr", "customers"]))
  const caseDSaas = getSaasAnalysis(caseD)
  assert.equal(caseDSaas.customers, 120)
  assert.equal(caseDSaas.churnedCustomers, null)
  assert.equal(caseDSaas.churnRate, null)
  assert.equal(caseD.kpis.some((kpi) => /Churn/.test(kpi.title)), false)
  assert.equal(/churn rate is 0|0 churned/i.test(caseD.summary), false)
  assert.ok(caseD.recommendations.some((item) => /churned customer data is not available/i.test(item.issue)))

  const caseERows = [
    { date: "2026-01-31", mrr: 10000, customers: 100 },
    { date: "2026-02-28", mrr: 12000, customers: 120 },
    { date: "2026-03-31", mrr: 14000, customers: 140 },
  ]
  const caseE = await buildDatasetReportInput(makeSaasDataset("saas-case-e-monthly-customer-snapshots", caseERows, ["date", "mrr", "customers"]))
  const caseESaas = getSaasAnalysis(caseE)
  assert.equal(caseESaas.customers, 140)
  assert.notEqual(caseESaas.customers, 360)
  assert.ok(caseE.kpis.some((kpi) => kpi.title === "Customers" && kpi.value === 140))

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
