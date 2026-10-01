import assert from "node:assert/strict"

import { calculateProfitabilityAnalysis } from "../../src/lib/profitability/two-file-analysis"
import {
  profitabilityOriginalFileNames,
  resolveCanonicalFinancialMetrics,
} from "../../src/lib/data/canonical-financial-metrics"
import { calculateBusinessBalancedScorecard } from "../../src/lib/business/balanced-scorecard"
import { deriveDatasetSource, getDatasetSourceLabel } from "../../src/lib/data/dataset-source"
import { buildDashboardSemanticAnalysis } from "../../src/lib/data/dashboard-semantic-profile"
import { calculateMetrics } from "../../src/lib/executive/daily-health"

/**
 * Regression coverage for the canonical deterministic financial resolver and its
 * BBSC Financial perspective integration.
 *
 * Fixture values replicate the validated controlled XLSX Profitability result:
 * revenue 86,312.00, operating expenses 34,633.20, operating profit 51,678.80,
 * operating margin 59.87%. The values are computed by the semantic two-file
 * resolver from fixture rows; no production IDs and no hardcoded metric payloads.
 */

function nearlyEqual(actual: number | null, expected: number, message: string) {
  assert.ok(actual !== null, `${message}: expected ${expected}, received null`)
  assert.ok(Math.abs((actual as number) - expected) < 0.001, `${message}: expected ${expected}, received ${actual}`)
}

const revenueFile = {
  role: "revenue" as const,
  name: "revenue_control.xlsx",
  columns: ["period", "department", "revenue"],
  rows: [
    { period: "2026-01", department: "Retail", revenue: 26312 },
    { period: "2026-02", department: "Retail", revenue: 30000 },
    { period: "2026-03", department: "Retail", revenue: 30000 },
  ],
}

const expensesFile = {
  role: "expenses" as const,
  name: "expenses_control.xlsx",
  columns: ["period", "department", "category", "amount"],
  rows: [
    { period: "2026-01", department: "Retail", category: "Rent", amount: 4000 },
    { period: "2026-01", department: "Retail", category: "Salaries", amount: 6000 },
    { period: "2026-01", department: "Retail", category: "Marketing", amount: 1544.4 },
    { period: "2026-02", department: "Retail", category: "Rent", amount: 4000 },
    { period: "2026-02", department: "Retail", category: "Salaries", amount: 6000 },
    { period: "2026-02", department: "Retail", category: "Marketing", amount: 1544.4 },
    { period: "2026-03", department: "Retail", category: "Rent", amount: 4000 },
    { period: "2026-03", department: "Retail", category: "Salaries", amount: 6000 },
    { period: "2026-03", department: "Retail", category: "Marketing", amount: 1544.4 },
  ],
}

function profitabilityDatasetFixture(overrides: Record<string, unknown> = {}) {
  const payload = calculateProfitabilityAnalysis({
    analysisId: "pa_canonical_financial_regression",
    revenueFile,
    expensesFile,
  })
  return {
    id: "pa_canonical_financial_regression",
    datasetType: "profitability",
    businessModel: "profitability",
    columns: ["period", "department", "revenue", "category", "amount"],
    data: [],
    rowCount: revenueFile.rows.length + expensesFile.rows.length,
    analysis: {
      datasetType: "profitability",
      uploadSource: "profitability_upload",
      profitability: payload,
    },
    precomputedMetrics: payload,
    columnMapping: {
      profitabilityAnalysisId: "pa_canonical_financial_regression",
      sourceFiles: payload.sourceFiles,
    },
    ...overrides,
  }
}

function financialKpiLabels(scorecard: ReturnType<typeof calculateBusinessBalancedScorecard>) {
  return scorecard.perspectives.financial.kpis.map((kpi) => kpi.label)
}

async function main() {
  const dataset = profitabilityDatasetFixture()

  // 1. Profitability -> canonical financial metrics.
  const financials = resolveCanonicalFinancialMetrics(dataset)
  assert.ok(financials, "Profitability dataset must resolve canonical financial metrics")
  assert.equal(financials!.sourceType, "profitability")
  assert.equal(financials!.sourceDatasetId, "pa_canonical_financial_regression")
  nearlyEqual(financials!.revenue, 86312, "canonical revenue")
  nearlyEqual(financials!.operatingExpenses, 34633.2, "canonical operating expenses")
  nearlyEqual(financials!.operatingProfit, 51678.8, "canonical operating profit")
  nearlyEqual(financials!.netProfit, 51678.8, "canonical net profit")
  nearlyEqual(financials!.operatingMargin, 59.87, "canonical operating margin")
  for (const field of ["revenue", "operatingExpenses", "operatingProfit", "operatingMargin", "netProfit"]) {
    assert.ok(financials!.availableFields.includes(field), `canonical resolver must expose ${field}`)
  }
  assert.equal(financials!.confidence, 100)

  // 2. Profitability -> BBSC Financial perspective is available, never N/A.
  const scorecard = calculateBusinessBalancedScorecard({
    rows: dataset.data,
    columns: dataset.columns,
    businessModel: "profitability",
    canonicalFinancials: financials,
  })
  const financial = scorecard.perspectives.financial
  assert.equal(financial.status, "available", "BBSC Financial must be available for a valid Profitability dataset")
  assert.ok(financial.score !== null && financial.score >= 0 && financial.score <= 100, "Financial score must be a deterministic 0-100 value")
  const labels = financialKpiLabels(scorecard)
  for (const expected of ["Revenue", "Operating Expenses", "Operating Profit", "Operating Margin"]) {
    assert.ok(labels.includes(expected), `BBSC must recognize ${expected} as a financial signal`)
  }
  for (const kpi of financial.kpis) {
    assert.ok(
      kpi.sourceFields.every((sourceField) => sourceField.startsWith("profitability.")),
      "BBSC Financial KPIs must trace to canonical Profitability source fields",
    )
  }
  const revenueKpi = financial.kpis.find((kpi) => kpi.label === "Revenue")
  assert.ok(revenueKpi, "Revenue KPI missing")
  assert.equal(revenueKpi!.value, "$86,312", "Revenue KPI must display the canonical total")
  const expectedFinancialScore = Math.round(
    financial.kpis.reduce((total, kpi) => total + kpi.score, 0) / financial.kpis.length,
  )
  assert.equal(financial.score, expectedFinancialScore, "Financial score must be the average of its KPI scores")
  assert.ok(financial.weight > 0, "available Financial perspective must carry scoring weight")
  assert.equal(
    scorecard.overallScore,
    expectedFinancialScore,
    "overall score must remain the equal-weight average of available perspectives",
  )

  // 3. Missing COGS: gross metrics stay unavailable, Financial stays available.
  assert.equal(financials!.cogs, null, "COGS must stay unavailable without a source COGS field")
  assert.equal(financials!.grossProfit, null, "Gross profit must stay unavailable without COGS")
  assert.equal(financials!.grossMargin, null, "Gross margin must stay unavailable without COGS")
  assert.ok(!labels.includes("COGS"), "BBSC must not expose a COGS KPI without source COGS")
  assert.ok(!labels.includes("Gross Profit"), "BBSC must not expose Gross Profit without source COGS")
  assert.ok(!labels.includes("Gross Margin"), "BBSC must not expose Gross Margin without source COGS")

  // 4. No fabricated metrics: operating expenses are never reinterpreted as COGS.
  assert.ok(financials!.missingFields.includes("cogs"))
  assert.ok(financials!.missingFields.includes("grossProfit"))
  assert.ok(financials!.missingFields.includes("grossMargin"))

  // 5. Dataset source isolation: values come only from the passed dataset.
  const otherDataset = profitabilityDatasetFixture({
    id: "pa_other_isolation",
    precomputedMetrics: {
      ...calculateProfitabilityAnalysis({
        analysisId: "pa_other_isolation",
        revenueFile,
        expensesFile,
      }),
      totalRevenue: 1000,
      totalExpenses: 250,
      operatingProfit: 750,
      netProfit: 750,
      operatingMargin: 75,
      netMargin: 75,
      margin: 75,
      profitabilityAnalysisId: "pa_other_isolation",
    },
  })
  const isolated = resolveCanonicalFinancialMetrics(otherDataset)
  assert.ok(isolated, "second dataset must resolve independently")
  nearlyEqual(isolated!.revenue, 1000, "second dataset revenue isolation")
  nearlyEqual(isolated!.operatingProfit, 750, "second dataset operating profit isolation")
  assert.equal(
    resolveCanonicalFinancialMetrics({ datasetType: "retail" }),
    null,
    "non-profitability datasets must not resolve canonical financials",
  )
  assert.equal(resolveCanonicalFinancialMetrics(null), null, "missing dataset must resolve to null")

  // 6. Dashboard semantic profile and trend series agree with the canonical resolver.
  const payload = (dataset as { precomputedMetrics: Record<string, unknown> }).precomputedMetrics
  const semanticAnalysis = await buildDashboardSemanticAnalysis({
    id: "pa_canonical_financial_regression",
    name: "Revenue + Expense Analysis",
    fileName: "profitability-analysis",
    fileSize: 1000,
    rowCount: 12,
    columnCount: 5,
    columns: ["period", "department", "revenue", "category", "amount"],
    data: [],
    datasetType: "profitability",
    businessModel: "profitability",
    analysisStatus: "ready",
    status: "ready",
    createdAt: new Date("2026-09-16T17:34:58.151Z"),
    updatedAt: new Date("2026-09-16T17:34:58.810Z"),
    analysis: { datasetType: "profitability", profitability: payload },
    aiInsights: null,
    precomputedMetrics: payload,
    detectedColumns: null,
  } as unknown as Parameters<typeof buildDashboardSemanticAnalysis>[0])
  const semanticValues = (label: string) => {
    const metric = semanticAnalysis.metrics.find((item) => item.label === label)
    assert.ok(metric, `semantic metric ${label} missing`)
    assert.equal(metric.available, true, `semantic metric ${label} must be available`)
    return metric.value
  }
  nearlyEqual(semanticValues("Revenue") as number, 86312, "semantic KPI revenue parity")
  nearlyEqual(semanticValues("Operating Expenses") as number, 34633.2, "semantic KPI operating expenses parity")
  nearlyEqual(semanticValues("Operating Profit") as number, 51678.8, "semantic KPI operating profit parity")
  nearlyEqual(semanticValues("Operating Margin") as number, 59.87, "semantic KPI operating margin parity")
  const revenueTrend = semanticAnalysis.trends.find((trend) => trend.metricLabel === "Revenue")
  assert.ok(revenueTrend, "semantic revenue trend panel missing")
  assert.equal(revenueTrend!.state, "trend", "dated fixture must produce a Revenue trend")
  const januaryBucket = revenueTrend!.data.filter((point) => point.label.startsWith("2026-01"))
  const februaryBucket = revenueTrend!.data.filter((point) => point.label.startsWith("2026-02"))
  const marchBucket = revenueTrend!.data.filter((point) => point.label.startsWith("2026-03"))
  nearlyEqual(januaryBucket.reduce((total, point) => total + point.value, 0), 26312, "January revenue bucket")
  nearlyEqual(februaryBucket.reduce((total, point) => total + point.value, 0), 30000, "February revenue bucket")
  nearlyEqual(marchBucket.reduce((total, point) => total + point.value, 0), 30000, "March revenue bucket")
  assert.ok(
    Math.abs(revenueTrend!.data.reduce((total, point) => total + point.value, 0) - 86312) < 0.01,
    "trend buckets must sum to the canonical revenue total",
  )

  // 7. Executive Daily Health consumes the same canonical Profitability totals.
  const dailyHealth = calculateMetrics({
    userId: "user_canonical_financial_regression",
    workspaceId: null,
    workspaceKey: "user:user_canonical_financial_regression",
    date: "2026-10-01",
    profileComplete: true,
    hasBusinessProfile: true,
    datasets: [{
      id: "pa_canonical_financial_regression",
      name: "Revenue + Expense Analysis",
      datasetType: "profitability",
      rowCount: 12,
      columnCount: 5,
      createdAt: new Date("2026-09-16T17:34:58.151Z"),
      columns: ["period", "department", "revenue", "category", "amount"],
      rows: [],
      analysisStatus: "ready",
      analysis: { datasetType: "profitability", profitability: payload },
      aiInsights: null,
      precomputedMetrics: payload,
    }],
  })
  assert.equal(dailyHealth.isProfitabilityAnalysis, true, "Daily Health must detect the active Profitability analysis")
  nearlyEqual(dailyHealth.totalRevenue as number, 86312, "Daily Health canonical revenue parity")
  nearlyEqual(dailyHealth.totalProfit as number, 51678.8, "Daily Health canonical operating profit parity")
  nearlyEqual(dailyHealth.profitMargin as number, 59.87, "Daily Health canonical operating margin parity")
  assert.equal(dailyHealth.lowStockCount, null, "Daily Health must not fabricate inventory metrics for Profitability data")

  // 8. Upload provenance: original XLSX inputs must not be mislabeled as CSV
  // because the paired workflow transported them as CSV.
  const originalNames = profitabilityOriginalFileNames(dataset)
  assert.deepEqual(
    originalNames,
    ["revenue_control.xlsx", "expenses_control.xlsx"],
    "original source file names must come from immutable stored profitability metadata",
  )
  assert.equal(
    deriveDatasetSource({
      source: "csv",
      datasetType: "profitability",
      fileName: "profitability-analysis",
      originalFileNames: originalNames,
    }),
    "excel",
    "paired XLSX profitability input must surface Excel provenance over the CSV transport format",
  )
  assert.equal(
    getDatasetSourceLabel(
      deriveDatasetSource({
        source: "csv",
        datasetType: "profitability",
        fileName: "profitability-analysis",
        originalFileNames: originalNames,
      }),
    ),
    "Excel",
  )
  assert.equal(
    deriveDatasetSource({ source: "csv", fileName: "report.csv" }),
    "csv",
    "non-profitability datasets keep stored-source precedence without originalFileNames",
  )
  assert.equal(
    deriveDatasetSource({ source: "excel", fileName: "report.csv" }),
    "excel",
    "stored authoritative source wins without profitability original files",
  )

  console.log(JSON.stringify({
    verdict: "pass",
    canonicalFinancials: {
      revenue: financials!.revenue,
      operatingExpenses: financials!.operatingExpenses,
      operatingProfit: financials!.operatingProfit,
      operatingMargin: financials!.operatingMargin,
      cogs: financials!.cogs,
      grossProfit: financials!.grossProfit,
      grossMargin: financials!.grossMargin,
    },
    bbscFinancial: {
      status: financial.status,
      score: financial.score,
      overallScore: scorecard.overallScore,
      kpis: labels,
    },
    provenance: "Excel",
  }, null, 2))
}

main().catch((error) => {
  console.error("FAIL:", error)
  process.exit(1)
})
