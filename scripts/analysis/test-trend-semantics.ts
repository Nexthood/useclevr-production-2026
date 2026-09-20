import * as assert from "node:assert/strict"

import { buildDashboardSemanticAnalysis, type DashboardSemanticTrend } from "../../src/lib/data/dashboard-semantic-profile"
import { isTrendEligible, MINIMUM_TREND_OBSERVATIONS, resolveTrendSemantics, snapshotTrendExplanation } from "../../src/lib/data/trend-semantics"

type TestDataset = Parameters<typeof buildDashboardSemanticAnalysis>[0]

const REVENUE_UNAVAILABLE_REASON = "Revenue requires a recognized revenue source field."
const PROFIT_UNAVAILABLE_REASON = "Profit requires a profit value or sufficient revenue and cost fields."

function dataset(input: { id: string; columns: string[]; rows: Record<string, unknown>[] }): TestDataset {
  return {
    id: input.id,
    name: input.id,
    fileName: `${input.id}.xlsx`,
    fileSize: 1000,
    rowCount: input.rows.length,
    columnCount: input.columns.length,
    columns: input.columns,
    data: input.rows,
    datasetType: "standard",
    businessModel: "generic",
    analysisStatus: "ready",
    status: "ready",
    createdAt: new Date("2026-08-15T00:00:00Z"),
    updatedAt: new Date("2026-08-15T00:00:00Z"),
    analysis: { uploadSource: "trend_semantics_test" },
    aiInsights: null,
    precomputedMetrics: null,
    detectedColumns: null,
  } as unknown as TestDataset
}

function trendPanel(analysis: Awaited<ReturnType<typeof buildDashboardSemanticAnalysis>>, metricLabel: string): DashboardSemanticTrend {
  const panel = analysis.trends.find((trend) => trend.metricLabel === metricLabel)
  assert.ok(panel, `dashboard must expose a ${metricLabel} trend panel`)
  return panel
}

function revenueRows(input: { dates: (string | null)[]; revenue: number[] }) {
  return input.dates.map((date, index) => ({ date, revenue: input.revenue[index] }))
}

async function main() {
  // Rule check: eligibility requires at least MINIMUM_TREND_OBSERVATIONS distinct valid periods.
  assert.equal(MINIMUM_TREND_OBSERVATIONS, 2, "trend eligibility minimum is two observations")
  assert.equal(isTrendEligible([]), false, "empty series is not trend eligible")
  assert.equal(isTrendEligible([{ label: "2025-01", value: 10 }]), false, "single period is not trend eligible")
  assert.equal(isTrendEligible([{ label: "2025-01", value: 10 }, { label: "2025-02", value: 20 }]), true, "two distinct periods are trend eligible")
  assert.equal(isTrendEligible([{ label: "2025-01", value: 10 }, { label: "2025-01", value: 20 }]), false, "duplicate period labels collapse into one period")
  assert.equal(isTrendEligible([{ label: "", value: 10 }, { label: "2025-02", value: 20 }]), false, "empty period labels must not count toward eligibility")
  assert.equal(isTrendEligible([{ label: "2025-01", value: null }, { label: "2025-02", value: 20 }]), false, "null values must not count toward eligibility")

  // 1. Revenue + valid dates + multiple periods -> Revenue Trend
  const multiPeriod = await buildDashboardSemanticAnalysis(dataset({
    id: "trend_multi_period",
    columns: ["date", "revenue", "profit"],
    rows: [
      { date: "2025-01-15", revenue: 100, profit: 10 },
      { date: "2025-02-15", revenue: 200, profit: 20 },
      { date: "2025-03-15", revenue: 300, profit: 30 },
    ],
  }))
  const revenueTrendPanel = trendPanel(multiPeriod, "Revenue")
  assert.equal(revenueTrendPanel.state, "trend", "multiple valid periods must render a Revenue Trend")
  assert.equal(revenueTrendPanel.title, "Revenue Trend")
  assert.deepEqual(revenueTrendPanel.data, [
    { label: "2025-01-15", value: 100 },
    { label: "2025-02-15", value: 200 },
    { label: "2025-03-15", value: 300 },
  ], "Revenue Trend must plot exactly the aggregated source periods")

  // 5. Profit + valid multiple periods -> Profit Trend
  const profitTrendPanel = trendPanel(multiPeriod, "Profit")
  assert.equal(profitTrendPanel.state, "trend", "multiple valid profit periods must render a Profit Trend")
  assert.equal(profitTrendPanel.title, "Profit Trend")
  assert.deepEqual(profitTrendPanel.data, [
    { label: "2025-01-15", value: 10 },
    { label: "2025-02-15", value: 20 },
    { label: "2025-03-15", value: 30 },
  ], "Profit Trend must plot exactly the aggregated source periods")

  // 2. Revenue + one valid time period -> Revenue Snapshot
  const onePeriod = await buildDashboardSemanticAnalysis(dataset({
    id: "trend_one_period",
    columns: ["date", "revenue"],
    rows: [
      { date: "2025-01-15", revenue: 100 },
      { date: "2025-01-15", revenue: 200 },
    ],
  }))
  const onePeriodRevenue = trendPanel(onePeriod, "Revenue")
  assert.equal(onePeriodRevenue.state, "snapshot", "one valid period must render a Revenue Snapshot")
  assert.equal(onePeriodRevenue.title, "Revenue Snapshot")
  assert.equal(onePeriodRevenue.data.length, 0, "snapshot panels must not plot chart points")
  assert.equal(onePeriodRevenue.snapshotValue, 300, "snapshot value must equal the deterministic source total")
  assert.equal(onePeriodRevenue.emptyLabel, snapshotTrendExplanation("Revenue"))

  // 3. Revenue + no temporal dimension -> Revenue Snapshot
  const noTemporal = await buildDashboardSemanticAnalysis(dataset({
    id: "trend_no_temporal",
    columns: ["revenue", "region"],
    rows: [
      { revenue: 500, region: "EMEA" },
      { revenue: 250, region: "APAC" },
    ],
  }))
  const noTemporalRevenue = trendPanel(noTemporal, "Revenue")
  assert.equal(noTemporalRevenue.state, "snapshot", "revenue without a temporal dimension must render a snapshot")
  assert.equal(noTemporalRevenue.title, "Revenue Snapshot")
  assert.equal(noTemporalRevenue.data.length, 0, "snapshot without temporal dimension must not plot chart points")
  assert.equal(noTemporalRevenue.snapshotValue, 750)
  assert.match(noTemporalRevenue.emptyLabel, /No sufficient time-series data is available for a revenue trend/)

  // 4. No revenue metric -> Revenue unavailable
  const noRevenue = await buildDashboardSemanticAnalysis(dataset({
    id: "trend_no_revenue",
    columns: ["team_member", "note"],
    rows: [
      { team_member: "Ada", note: "ok" },
      { team_member: "Ben", note: "ok" },
    ],
  }))
  const noRevenuePanel = trendPanel(noRevenue, "Revenue")
  assert.equal(noRevenuePanel.state, "unavailable", "missing revenue metric must render an unavailable panel")
  assert.equal(noRevenuePanel.title, "Revenue data unavailable")
  assert.equal(noRevenuePanel.data.length, 0, "unavailable panels must not plot chart points")
  assert.equal(noRevenuePanel.snapshotValue, null)
  assert.equal(noRevenuePanel.emptyLabel, REVENUE_UNAVAILABLE_REASON)

  // 6. Profit + one period -> Profit Snapshot
  const oneProfitPeriod = await buildDashboardSemanticAnalysis(dataset({
    id: "trend_profit_one_period",
    columns: ["date", "revenue", "profit"],
    rows: [
      { date: "2025-01-15", revenue: 400, profit: 40 },
      { date: "2025-01-15", revenue: 600, profit: 60 },
    ],
  }))
  const oneProfitPeriodPanel = trendPanel(oneProfitPeriod, "Profit")
  assert.equal(oneProfitPeriodPanel.state, "snapshot", "one profit period must render a Profit Snapshot")
  assert.equal(oneProfitPeriodPanel.title, "Profit Snapshot")
  assert.equal(oneProfitPeriodPanel.data.length, 0, "profit snapshot must not plot chart points")
  assert.equal(oneProfitPeriodPanel.snapshotValue, 100)
  assert.equal(oneProfitPeriodPanel.emptyLabel, "No sufficient time-series data is available for a profit trend.")

  // 7. Missing profit and insufficient revenue/cost fields -> Profit unavailable
  const profitUnavailable = await buildDashboardSemanticAnalysis(dataset({
    id: "trend_profit_unavailable",
    columns: ["date", "revenue"],
    rows: [
      { date: "2025-01-15", revenue: 100 },
      { date: "2025-02-15", revenue: 200 },
    ],
  }))
  const profitUnavailablePanel = trendPanel(profitUnavailable, "Profit")
  assert.equal(profitUnavailablePanel.state, "unavailable", "profit without profit or cost fields must be unavailable")
  assert.equal(profitUnavailablePanel.title, "Profit data unavailable")
  assert.equal(profitUnavailablePanel.emptyLabel, PROFIT_UNAVAILABLE_REASON)
  assert.equal(profitUnavailablePanel.data.length, 0, "profit unavailable panel must not plot chart points")
  assert.equal(profitUnavailablePanel.snapshotValue, null)

  // 8. Duplicate dates collapsing into one period -> Snapshot, not Trend
  const duplicateDates = await buildDashboardSemanticAnalysis(dataset({
    id: "trend_duplicate_dates",
    columns: ["date", "revenue"],
    rows: [
      { date: "2025-01-15", revenue: 10 },
      { date: "2025-01-15", revenue: 20 },
      { date: "2025-01-15", revenue: 30 },
      { date: "2025-01-15", revenue: 40 },
      { date: "2025-01-15", revenue: 50 },
    ],
  }))
  const duplicateDatesPanel = trendPanel(duplicateDates, "Revenue")
  assert.equal(duplicateDatesPanel.state, "snapshot", "duplicate dates must collapse into one period and render a snapshot")
  assert.equal(duplicateDatesPanel.title, "Revenue Snapshot")
  assert.equal(duplicateDatesPanel.data.length, 0, "collapsed duplicates must not plot a one-point trend chart")
  assert.equal(duplicateDatesPanel.snapshotValue, 150)

  // 9. Invalid/null dates must not count toward trend eligibility
  const invalidDates = await buildDashboardSemanticAnalysis(dataset({
    id: "trend_invalid_dates",
    columns: ["date", "revenue"],
    rows: [
      { date: "not-a-date", revenue: 100 },
      { date: null, revenue: 200 },
      { date: "2025-01-15", revenue: 300 },
    ],
  }))
  const invalidDatesPanel = trendPanel(invalidDates, "Revenue")
  assert.equal(invalidDatesPanel.state, "snapshot", "invalid and null dates must not make a dataset trend eligible")
  assert.equal(invalidDatesPanel.title, "Revenue Snapshot")
  assert.equal(invalidDatesPanel.data.length, 0, "invalid dates must not contribute chart points")
  assert.equal(invalidDatesPanel.snapshotValue, 600, "snapshot value stays the deterministic source total")

  // 10. No artificial chart points are generated.
  const allScenarios = [multiPeriod, onePeriod, noTemporal, noRevenue, oneProfitPeriod, profitUnavailable, duplicateDates, invalidDates]
  for (const analysis of allScenarios) {
    for (const panel of analysis.trends) {
      if (panel.state === "trend") {
        assert.ok(
          panel.data.every((point) => Number.isFinite(point.value) && point.label.trim().length > 0),
          `${panel.title} trend points must be finite observations with real period labels`,
        )
        assert.ok(panel.data.length >= MINIMUM_TREND_OBSERVATIONS, `${panel.title} must plot at least two observations`)
      } else {
        assert.equal(panel.data.length, 0, `${panel.title} must not generate artificial chart points`)
      }
    }
  }

  // Resolver edge: single-point series with an explicit metric renders a snapshot of that value.
  const singlePointResolution = resolveTrendSemantics({
    metricLabel: "Revenue",
    series: [{ label: "2025-01", value: 887512 }],
    metricValue: null,
    unavailableReason: REVENUE_UNAVAILABLE_REASON,
  })
  assert.equal(singlePointResolution.state, "snapshot", "one usable observation must render a snapshot")
  assert.equal(singlePointResolution.snapshotValue, 887512, "single observation must become the snapshot value without duplication")
  assert.equal(singlePointResolution.data.length, 0, "single observation must never become a one-point line")

  console.log(JSON.stringify({ verdict: "pass", scenarios: 10 }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
