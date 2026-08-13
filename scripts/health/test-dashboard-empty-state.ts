import * as fs from "node:fs"

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message)
}

const aggregation = fs.readFileSync("src/lib/data/dashboard-dataset-aggregation.ts", "utf8")
const dashboard = fs.readFileSync("src/app/(auth)/app/page.tsx", "utf8")
const dailyHealth = fs.readFileSync("src/lib/executive/daily-health.ts", "utf8")
const dailyHealthPage = fs.readFileSync("src/app/(auth)/app/daily-health/page.tsx", "utf8")

assert(
  aggregation.includes('const activeDatasets = normalizedDatasets.filter((dataset) => dataset.status !== "deleted")'),
  "Dashboard aggregation must filter deleted datasets out of current analytics.",
)
assert(
  aggregation.includes("datasetCount: activeDatasets.length") &&
    aggregation.includes("activeDatasetCount: activeDatasets.length") &&
    aggregation.includes("totalRows: activeDatasets.reduce") &&
    aggregation.includes("datasets: activeDatasets"),
  "Dashboard aggregation must derive current counts, rows, and datasets from active datasets only.",
)
assert(
  dailyHealth.includes("if (source.datasets.length === 0) return null"),
  "Daily Health must not generate a current analytical brief with zero active datasets.",
)
assert(
  dashboard.includes("if (stats.dashboardData.activeDatasetCount === 0) return emptyExecutiveMetrics(stats)"),
  "Dashboard metrics must have a deterministic zero-dataset branch.",
)
assert(
  dashboard.includes("brief={dashboardStats.dashboardData.activeDatasetCount === 0 ? null : dailyBrief}") &&
    dashboard.includes("hasActiveDatasets={dashboardStats.dashboardData.activeDatasetCount > 0}"),
  "Executive Daily Health UI must receive explicit zero-dataset state.",
)
assert(
  dashboard.includes("View Full Daily Brief") &&
    dashboard.includes('aria-disabled="true"') &&
    dashboard.includes("No uploaded datasets are available yet."),
  "Executive Daily Health zero state must disable the full brief action and show a no-data message.",
)
assert(
  dashboard.includes('kpi("Revenue", null') &&
    dashboard.includes('kpi("Profit", null') &&
    dashboard.includes('kpi("Profit Margin", null') &&
    dashboard.includes('kpi("Active Datasets", 0') &&
    dashboard.includes('kpi("Rows Processed", 0'),
  "Zero-dataset KPI cards must distinguish unavailable analytics from measured count zeros.",
)
assert(
  dailyHealthPage.includes("const hasActiveDatasets = dashboardData.activeDatasetCount > 0") &&
    dailyHealthPage.includes("hasActiveDatasets ? getOrCreateDailyHealthBrief") &&
    dailyHealthPage.includes("const reports = hasActiveDatasets ?"),
  "Full Daily Health page must avoid showing current or historical briefs as active analytics when datasets are empty.",
)

console.log(JSON.stringify({
  dashboardEmptyState: "pass",
  deletedDatasetsExcluded: "pass",
  dailyHealthCurrentBriefWithZeroDatasets: "none",
  kpiNoDataState: "pass",
  fullBriefZeroDatasetGate: "pass",
}))
