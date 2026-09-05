import * as fs from "fs"
import { calculateBusinessBalancedScorecard, type BbscReportModel } from "../../src/lib/business/balanced-scorecard"

type Scenario = {
  name: string
  model: BbscReportModel
  columns: string[]
  rows: Record<string, unknown>[]
  expectedLabels: string[]
  forbiddenLabels: string[]
}

const scenarios: Scenario[] = [
  {
    name: "Local Retail",
    model: "local_retail",
    columns: ["date", "sku", "category", "revenue", "cost", "quantity", "stock", "reorder_point", "customer_id", "order_id"],
    rows: [
      { date: "2026-01-01", sku: "A", category: "Shoes", revenue: 120, cost: 70, quantity: 2, stock: 4, reorder_point: 5, customer_id: "C1", order_id: "O1" },
      { date: "2026-02-01", sku: "B", category: "Bags", revenue: 180, cost: 90, quantity: 4, stock: 20, reorder_point: 8, customer_id: "C2", order_id: "O2" },
      { date: "2026-03-01", sku: "A", category: "Shoes", revenue: 220, cost: 100, quantity: 3, stock: 6, reorder_point: 5, customer_id: "C1", order_id: "O3" },
    ],
    expectedLabels: ["Low stock / stockouts", "Dead stock", "Basket value"],
    forbiddenLabels: ["MRR", "Latest valuation"],
  },
  {
    name: "E-Commerce",
    model: "ecommerce",
    columns: ["date", "order_id", "country", "channel", "product", "revenue", "shipping_cost", "return_cost", "customer_id"],
    rows: [
      { date: "2026-01-01", order_id: "O1", country: "NL", channel: "Web", product: "A", revenue: 100, shipping_cost: 8, return_cost: 0, customer_id: "C1" },
      { date: "2026-02-01", order_id: "O2", country: "DE", channel: "Marketplace", product: "B", revenue: 140, shipping_cost: 10, return_cost: 4, customer_id: "C2" },
      { date: "2026-03-01", order_id: "O3", country: "NL", channel: "Web", product: "A", revenue: 180, shipping_cost: 11, return_cost: 0, customer_id: "C1" },
    ],
    expectedLabels: ["Shipping cost ratio", "Return cost ratio", "Channel performance", "Market expansion"],
    forbiddenLabels: ["Low stock / stockouts", "MRR"],
  },
  {
    name: "SaaS Startup",
    model: "saas",
    columns: ["date", "mrr", "arr", "runway", "customer_id", "churned", "ltv", "cac", "active_users", "expansion_mrr"],
    rows: [
      { date: "2026-01-01", mrr: 5000, arr: 60000, runway: 10, customer_id: "A", churned: "false", ltv: 2000, cac: 300, active_users: 100, expansion_mrr: 200 },
      { date: "2026-02-01", mrr: 6500, arr: 78000, runway: 11, customer_id: "B", churned: "false", ltv: 2200, cac: 280, active_users: 125, expansion_mrr: 350 },
      { date: "2026-03-01", mrr: 8000, arr: 96000, runway: 12, customer_id: "A", churned: "true", ltv: 2300, cac: 260, active_users: 160, expansion_mrr: 500 },
    ],
    expectedLabels: ["MRR", "ARR", "Runway", "Churn", "Expansion MRR"],
    forbiddenLabels: ["Low stock / stockouts", "Latest valuation"],
  },
  {
    name: "Investor Portfolio",
    model: "investor",
    columns: ["date", "company", "sector", "stage", "invested_capital", "latest_valuation", "ownership"],
    rows: [
      { date: "2026-01-01", company: "One", sector: "AI", stage: "Seed", invested_capital: 100000, latest_valuation: 900000, ownership: 8 },
      { date: "2026-02-01", company: "Two", sector: "Retail", stage: "Series A", invested_capital: 150000, latest_valuation: 1400000, ownership: 6 },
      { date: "2026-03-01", company: "Three", sector: "AI", stage: "Seed", invested_capital: 80000, latest_valuation: 1200000, ownership: 5 },
    ],
    expectedLabels: ["Invested capital", "Latest valuation", "Sector diversification", "Stage diversification"],
    forbiddenLabels: ["Low stock / stockouts", "MRR"],
  },
  {
    name: "Investor Portfolio investment events",
    model: "investor",
    columns: ["company_id", "company_name", "sector", "stage", "investment_date", "invested_amount", "latest_valuation", "annual_revenue", "growth_rate"],
    rows: [
      { company_id: "CO-001", company_name: "One", sector: "AI", stage: "Seed", investment_date: "2024-01-15", invested_amount: 100000, latest_valuation: 900000, annual_revenue: 200000, growth_rate: 0.18 },
      { company_id: "CO-002", company_name: "Two", sector: "Retail", stage: "Series A", investment_date: "2024-02-15", invested_amount: 150000, latest_valuation: 1400000, annual_revenue: 350000, growth_rate: 0.22 },
      { company_id: "CO-003", company_name: "Three", sector: "AI", stage: "Seed", investment_date: "2024-03-15", invested_amount: 80000, latest_valuation: 1200000, annual_revenue: 275000, growth_rate: 0.15 },
    ],
    expectedLabels: ["Portfolio company annual revenue", "Invested capital", "Latest valuation", "Portfolio growth rate", "Sector diversification", "Stage diversification"],
    forbiddenLabels: ["Growth trend", "Revenue", "MRR"],
  },
  {
    name: "Business Consulting",
    model: "business_consulting",
    columns: ["date", "client_id", "revenue", "consultant_cost", "gross_margin", "billable_hours", "service_line"],
    rows: [
      { date: "2026-01-01", client_id: "C1", revenue: 8000, consultant_cost: 3500, gross_margin: 4500, billable_hours: 60, service_line: "Strategy" },
      { date: "2026-02-01", client_id: "C2", revenue: 9000, consultant_cost: 4200, gross_margin: 4800, billable_hours: 70, service_line: "Finance" },
      { date: "2026-03-01", client_id: "C1", revenue: 12000, consultant_cost: 5000, gross_margin: 7000, billable_hours: 80, service_line: "Strategy" },
    ],
    expectedLabels: ["Client concentration", "Billable hours", "Cost efficiency"],
    forbiddenLabels: ["Low stock / stockouts", "MRR", "Latest valuation"],
  },
  {
    name: "Generic Business",
    model: "generic",
    columns: ["date", "revenue", "cost", "customer_id", "order_id", "product"],
    rows: [
      { date: "2026-01-01", revenue: 1000, cost: 600, customer_id: "C1", order_id: "O1", product: "A" },
      { date: "2026-02-01", revenue: 1300, cost: 700, customer_id: "C2", order_id: "O2", product: "B" },
      { date: "2026-03-01", revenue: 1700, cost: 850, customer_id: "C1", order_id: "O3", product: "A" },
    ],
    expectedLabels: ["Revenue", "Gross profit", "Customers", "Growth trend"],
    forbiddenLabels: ["Low stock / stockouts", "MRR", "Latest valuation"],
  },
]

function allKpiLabels(scorecard: ReturnType<typeof calculateBusinessBalancedScorecard>) {
  return Object.values(scorecard.perspectives).flatMap((perspective) => perspective.kpis.map((kpi) => kpi.label))
}

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

async function main() {
  for (const scenario of scenarios) {
    const scorecard = calculateBusinessBalancedScorecard({
      rows: scenario.rows,
      columns: scenario.columns,
      businessModel: scenario.model,
    })
    const labels = allKpiLabels(scorecard)

    assert(scorecard.title === "Business Balanced Scorecard", `${scenario.name}: title mismatch`)
    assert(scorecard.alsoKnownAs === "Balanced Scorecard (BSC)", `${scenario.name}: BSC alias missing`)
    assert(scorecard.overallScore !== null && scorecard.overallScore >= 0 && scorecard.overallScore <= 100, `${scenario.name}: invalid overall score`)
    assert(scorecard.scoringInputs.rowCount === scenario.rows.length, `${scenario.name}: row isolation mismatch`)
    for (const expected of scenario.expectedLabels) {
      assert(labels.includes(expected), `${scenario.name}: missing expected KPI ${expected}`)
    }
    for (const forbidden of scenario.forbiddenLabels) {
      assert(!labels.includes(forbidden), `${scenario.name}: unrelated KPI ${forbidden} present`)
    }
    if (scenario.name === "Investor Portfolio investment events") {
      const growth = scorecard.perspectives.growth
      assert(growth.trend === "unknown", `${scenario.name}: investment_date must not create a growth trend`)
      assert(growth.kpis.some((kpi) => kpi.label === "Portfolio growth rate" && kpi.sourceFields.includes("growth_rate")), `${scenario.name}: growth_rate must remain cross-sectional source evidence`)
      assert(!growth.kpis.some((kpi) => kpi.sourceFields.includes("investment_date")), `${scenario.name}: investment_date must not source Growth perspective KPIs`)
      assert(!growth.findings.some((finding) => /Growth trend is calculated from dated values/i.test(finding)), `${scenario.name}: invalid growth-trend reason present`)
    }
  }

  const tempDir = "/tmp/useclevr-bbsc-report-test"
  process.env.TEMP_DIR = tempDir
  const { generateReport, listReports, deleteReport } = await import("../../src/lib/reports/report-generator")
  const scenario = scenarios.find((item) => item.model === "ecommerce")!
  const bbsc = calculateBusinessBalancedScorecard({
    rows: scenario.rows,
    columns: scenario.columns,
    businessModel: scenario.model,
  })
  const report = await generateReport("synthetic_bbsc_dataset", "Synthetic BBSC Dataset", {
    visibility: "private",
    status: "ready",
    reportType: scenario.model,
    businessModel: scenario.model,
    userId: "synthetic_user",
    workspaceId: "synthetic_user",
    idempotencyKey: "synthetic-bbsc-test",
  }, {
    summary: "Synthetic BBSC report.",
    findings: ["Synthetic priority"],
    kpis: [{ title: "Revenue", value: 420, format: "currency" }],
    charts: [],
    aiInsights: [],
    predictions: [],
    alerts: [],
    bbsc,
    rowCount: scenario.rows.length,
    columns: scenario.columns,
  })
  const persisted = listReports("synthetic_bbsc_dataset").some((item) => item.id === report.id && item.bbsc?.overallScore === bbsc.overallScore)
  const pdfExists = Boolean(report.pdfPath && fs.existsSync(report.pdfPath))
  if (report.pdfPath && fs.existsSync(report.pdfPath)) fs.unlinkSync(report.pdfPath)
  deleteReport(report.id)
  fs.rmSync(tempDir, { recursive: true, force: true })

  assert(persisted, "Report persistence missing BBSC payload")
  assert(pdfExists, "PDF generation missing for BBSC report")

  console.log(JSON.stringify({
    scenarios: scenarios.length,
    reportPersisted: persisted,
    pdfGenerated: pdfExists,
    datasetIsolation: "pass",
  }))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
