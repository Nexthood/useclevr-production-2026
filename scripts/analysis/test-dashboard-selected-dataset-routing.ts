import assert from "node:assert/strict"
import fs from "node:fs"

import Papa from "papaparse"

import {
  isDashboardEligibleDataset,
  selectDashboardScopeDatasets,
  type DashboardAggregatedDataset,
} from "../../src/lib/data/dashboard-dataset-aggregation"
import { buildDashboardSemanticAnalysis } from "../../src/lib/data/dashboard-semantic-profile"
import type { BusinessModel } from "../../src/lib/data/business-model"
import type { DatasetSource } from "../../src/lib/data/dataset-source"

type DashboardDatasetInput = Parameters<typeof buildDashboardSemanticAnalysis>[0]

const marketplaceRows = loadCsvRows("test-fixtures/business-models/04_marketplace_startup.csv")
const saasRows = loadCsvRows("test-fixtures/business-models/03_saas_startup.csv")
const investorRows = Array.from({ length: 12 }, (_, index) => ({
  company_id: `PC-${String(index + 1).padStart(3, "0")}`,
  company_name: `Portfolio Company ${index + 1}`,
  sector: ["Fintech", "Health", "SaaS"][index % 3],
  stage: ["Seed", "Series A", "Series B"][index % 3],
  country: ["United States", "Netherlands", "Germany"][index % 3],
  investment_date: `2024-${String((index % 9) + 1).padStart(2, "0")}-15`,
  invested_amount: 250000 + index * 10000,
  ownership_percent: 10 + index,
  latest_valuation: 1500000 + index * 125000,
  annual_revenue: 500000 + index * 25000,
  growth_rate: 0.08 + index * 0.01,
  burn_rate_monthly: 65000 + index * 2500,
  runway_months: 8 + index,
  status: index < 9 ? "Active" : "Watchlist",
}))

const marketplaceDataset = datasetInput({
  id: "route-dataset-a",
  rows: marketplaceRows,
})
const investorDataset = datasetInput({
  id: "route-dataset-b",
  rows: investorRows,
})

async function main() {
  assertDashboardAliasPreservesSearchParams()
  assertDashboardPageDoesNotFallbackForExplicitMissingDataset()

  await assertOpen(marketplaceDataset, {
    datasetId: "route-dataset-a",
    businessProfile: "marketplace",
    reportProfileId: "marketplace_startup",
    requiredMetric: "GMV",
    forbiddenMetric: "Portfolio Companies",
  })

  await assertOpen(investorDataset, {
    datasetId: "route-dataset-b",
    businessProfile: "investor",
    reportProfileId: "investor_portfolio",
    requiredMetric: "Portfolio Companies",
    forbiddenMetric: "GMV",
  })

  await assertSwitchSequence([marketplaceDataset, investorDataset, marketplaceDataset, investorDataset, marketplaceDataset])
  await assertSwitchSequence([investorDataset, marketplaceDataset, investorDataset, marketplaceDataset, investorDataset])

  await assertRefreshKeepsDataset(marketplaceDataset)
  await assertDirectUrlKeepsDataset(investorDataset)
  await assertBackThenOpenKeepsDataset(investorDataset, marketplaceDataset)
  assertDashboardScopeResolver()

  process.stdout.write("Dashboard selected-dataset routing regression passed.\n")
}

function assertDashboardAliasPreservesSearchParams() {
  const source = fs.readFileSync("src/app/(auth)/app/dashboard/page.tsx", "utf8")
  assert.doesNotMatch(source, /redirect\(["']\/app["']\)/, "dashboard alias must not drop datasetId by redirecting to bare /app")
  assert.match(source, /searchParams\?: Promise<Record<string, string \| string\[\] \| undefined>>/, "dashboard alias accepts search params")
  assert.match(source, /query\.set\(key, value\)/, "dashboard alias copies scalar search params")
  assert.match(source, /query\.append\(key, item\)/, "dashboard alias copies repeated search params")
  assert.match(source, /redirect\(suffix \? `\/app\?\$\{suffix\}` : "\/app"\)/, "dashboard alias redirects to /app with the selected dataset query intact")
}

function assertDashboardPageDoesNotFallbackForExplicitMissingDataset() {
  const source = fs.readFileSync("src/app/(auth)/app/page.tsx", "utf8")
  assert.match(source, /const activeDatasetId = stats\.latestDataset\?\.id \?\? null/, "invalid or ineligible explicit dataset IDs fall back to the resolved dashboard dataset")
  assert.match(source, /getStats\(userId, selectedDatasetId\)/, "dashboard must load an explicit selected dataset directly instead of loading workspace context first")
  assert.match(source, /getOrCreateDailyHealthBrief\(\{ userId, datasetId: activeDatasetId \}\)/, "daily health must use the active selected dataset scope")
  assert.match(source, /const activeTraceDatasetId = dashboardData\.latestUpload\?\.id \?\? null/, "AI activity uses the resolved active dashboard dataset ID")
  assert.match(source, /eq\(aiInteractionTraces\.datasetId, activeTraceDatasetId\)/, "AI activity trace queries are scoped to the resolved active dashboard dataset")
  assert.doesNotMatch(source, /includeCompatibleDatasets/, "dashboard page must not expand selected dataset analytics to compatible workspace datasets")
  assert.match(source, /brief=\{dashboardStats\.dashboardData\.activeDatasetCount === 0 \? null : dailyBrief\}/, "daily health uses selected dashboard stats")
  assert.match(source, /<SourceMix dashboardData=\{dashboardStats\.dashboardData\}/, "upload history source mix uses the selected dataset scope")
  assert.match(source, /dashboardStats\.dashboardData\.totalRows/, "upload history row totals use the selected dataset scope")
  assert.match(source, /dashboardStats\.allDatasets\.slice\(0, 6\)/, "upload history list uses selected dataset stats")
  assert.match(source, /<ActivityList stats=\{dashboardStats\}/, "AI activity uses selected dashboard stats")
}

function assertDashboardScopeResolver() {
  const standard = aggregatedDataset({
    id: "scope-standard",
    rows: marketplaceRows,
    businessModel: "marketplace",
    datasetType: "standard",
    createdAt: "2026-01-01T00:00:00.000Z",
  })
  const retailA = aggregatedDataset({
    id: "scope-retail-a",
    rows: marketplaceRows,
    businessModel: "marketplace",
    datasetType: "retail",
    createdAt: "2026-01-02T00:00:00.000Z",
  })
  const retailB = aggregatedDataset({
    id: "scope-retail-b",
    rows: marketplaceRows,
    businessModel: "marketplace",
    datasetType: "retail",
    createdAt: "2026-01-03T00:00:00.000Z",
  })
  const profitability = aggregatedDataset({
    id: "scope-profitability",
    rows: marketplaceRows,
    businessModel: "generic",
    datasetType: "profitability",
    createdAt: "2026-01-04T00:00:00.000Z",
  })
  const clevrsync = aggregatedDataset({
    id: "scope-clevrsync",
    rows: marketplaceRows,
    businessModel: "marketplace",
    datasetType: "connector",
    source: "google_sheets",
    createdAt: "2026-01-05T00:00:00.000Z",
  })
  const accountancy = aggregatedDataset({
    id: "scope-accountancy",
    rows: marketplaceRows,
    businessModel: "marketplace",
    datasetType: "accountancy",
    createdAt: "2026-01-06T00:00:00.000Z",
  })
  const accountancyDocument = aggregatedDataset({
    id: "scope-accountancy-document",
    rows: marketplaceRows,
    businessModel: "marketplace",
    datasetType: "standard",
    source: "accountancy_document",
    createdAt: "2026-01-08T00:00:00.000Z",
  })
  const prebookkeeping = aggregatedDataset({
    id: "scope-prebookkeeping",
    rows: marketplaceRows,
    businessModel: "marketplace",
    datasetType: "prebookkeeping",
    createdAt: "2026-01-07T00:00:00.000Z",
  })
  const datasets = [standard, retailA, retailB, profitability, clevrsync, accountancy, accountancyDocument, prebookkeeping]

  assert.deepEqual(
    selectDashboardScopeDatasets(datasets, null).map((dataset) => dataset.id),
    [clevrsync.id],
    "newest dashboard-eligible dataset becomes the dashboard default",
  )
  for (const dataset of [standard, retailA, retailB, profitability, clevrsync]) {
    assert.deepEqual(
      selectDashboardScopeDatasets(datasets, dataset.id).map((selected) => selected.id),
      [dataset.id],
      `${dataset.datasetType} explicit selection uses exactly one selected dataset`,
    )
  }
  assert.deepEqual(
    selectDashboardScopeDatasets(datasets, retailA.id).map((dataset) => dataset.id),
    [retailA.id],
    "Retail A never includes Retail B",
  )
  assert.deepEqual(
    selectDashboardScopeDatasets(datasets, accountancy.id).map((dataset) => dataset.id),
    [clevrsync.id],
    "Accountancy cannot become the dashboard dataset and falls back to the newest eligible dataset",
  )
  assert.deepEqual(
    selectDashboardScopeDatasets(datasets, prebookkeeping.id).map((dataset) => dataset.id),
    [clevrsync.id],
    "Pre-bookkeeping cannot become the dashboard dataset and falls back to the newest eligible dataset",
  )
  assert.equal(isDashboardEligibleDataset(accountancy), false, "Accountancy is not dashboard eligible")
  assert.equal(isDashboardEligibleDataset(accountancyDocument), false, "Accountancy document sources are not dashboard eligible")
  assert.equal(isDashboardEligibleDataset(prebookkeeping), false, "Pre-bookkeeping is not dashboard eligible")
}

async function assertSwitchSequence(sequence: DashboardDatasetInput[]) {
  const seen: string[] = []
  for (const dataset of sequence) {
    const analysis = await buildDashboardSemanticAnalysis(dataset)
    seen.push(`${analysis.datasetId}:${analysis.businessProfile}`)
    assert.equal(analysis.datasetId, dataset.id, "semantic analysis must preserve the selected dataset ID through repeated switches")
    assert.equal(analysis.businessProfile, dataset.id === marketplaceDataset.id ? "marketplace" : "investor")
  }
  assert.deepEqual(seen, sequence.map((dataset) => `${dataset.id}:${dataset.id === marketplaceDataset.id ? "marketplace" : "investor"}`))
}

async function assertRefreshKeepsDataset(dataset: DashboardDatasetInput) {
  const first = await buildDashboardSemanticAnalysis(dataset)
  const second = await buildDashboardSemanticAnalysis(dataset)
  assert.equal(second.datasetId, first.datasetId, "refresh-equivalent reload keeps the selected dataset ID")
  assert.equal(second.businessProfile, first.businessProfile, "refresh-equivalent reload keeps the selected semantic profile")
}

async function assertDirectUrlKeepsDataset(dataset: DashboardDatasetInput) {
  const analysis = await buildDashboardSemanticAnalysis(dataset)
  assert.equal(`/app?datasetId=${encodeURIComponent(dataset.id)}`, "/app?datasetId=route-dataset-b")
  assert.equal(analysis.datasetId, dataset.id, "direct URL selected dataset ID reaches semantic analysis")
  assert.equal(analysis.businessProfile, "investor", "direct URL selected dataset keeps Investor semantics")
}

async function assertBackThenOpenKeepsDataset(previous: DashboardDatasetInput, next: DashboardDatasetInput) {
  const previousAnalysis = await buildDashboardSemanticAnalysis(previous)
  const nextAnalysis = await buildDashboardSemanticAnalysis(next)
  assert.equal(previousAnalysis.datasetId, previous.id, "previous dashboard load uses the requested dataset")
  assert.equal(nextAnalysis.datasetId, next.id, "browser-back/open-equivalent dashboard load uses the newly requested dataset")
  assert.equal(nextAnalysis.businessProfile, "marketplace", "browser-back/open-equivalent dashboard load keeps Marketplace semantics")
}

async function assertOpen(
  dataset: DashboardDatasetInput,
  expected: {
    datasetId: string
    businessProfile: "marketplace" | "investor"
    reportProfileId: "marketplace_startup" | "investor_portfolio"
    requiredMetric: string
    forbiddenMetric: string
  },
) {
  const analysis = await buildDashboardSemanticAnalysis(dataset)
  assert.equal(analysis.datasetId, expected.datasetId, "dashboard semantic analysis must carry the selected dataset ID")
  assert.equal(analysis.businessProfile, expected.businessProfile, "dashboard semantic analysis must use the selected dataset's profile")
  assert.equal(analysis.reportProfileId, expected.reportProfileId, "dashboard report profile must match the selected dataset")
  assert.ok(analysis.metrics.some((metric) => metric.label === expected.requiredMetric), `selected ${expected.businessProfile} dataset exposes ${expected.requiredMetric}`)
  assert.ok(!analysis.metrics.some((metric) => metric.label === expected.forbiddenMetric), `selected ${expected.businessProfile} dataset must not expose ${expected.forbiddenMetric}`)
}

function datasetInput(input: {
  id: string
  rows: Record<string, unknown>[]
}): DashboardDatasetInput {
  const columns = Object.keys(input.rows[0] ?? {})
  return {
    id: input.id,
    name: `Selected dataset ${input.id}`,
    fileName: `${input.id}.csv`,
    fileSize: 1000,
    rowCount: input.rows.length,
    columnCount: columns.length,
    columns,
    data: input.rows,
    datasetType: "standard",
    businessModel: null,
    analysisStatus: "ready",
    status: "ready",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    analysis: { uploadSource: "standard" },
    aiInsights: null,
    precomputedMetrics: null,
    detectedColumns: null,
  }
}

function aggregatedDataset(input: {
  id: string
  rows: Record<string, unknown>[]
  businessModel: BusinessModel
  datasetType?: string
  source?: DatasetSource
  createdAt?: string
}): DashboardAggregatedDataset {
  const columns = Object.keys(input.rows[0] ?? {})
  const createdAt = new Date(input.createdAt ?? "2026-01-01T00:00:00.000Z")
  return {
    id: input.id,
    name: `Scoped ${input.businessModel} dataset`,
    fileName: `${input.id}.csv`,
    fileSize: 1000,
    rowCount: input.rows.length,
    columnCount: columns.length,
    columns,
    data: input.rows,
    datasetType: input.datasetType ?? "standard",
    businessModel: input.businessModel,
    analysisStatus: "ready",
    source: input.source ?? "csv",
    status: "ready",
    createdAt,
    updatedAt: createdAt,
    analysis: { uploadSource: "standard" },
    aiInsights: null,
    precomputedMetrics: null,
    detectedColumns: null,
  }
}

function loadCsvRows(path: string): Record<string, unknown>[] {
  const csv = fs.readFileSync(path, "utf8")
  const parsed = Papa.parse<Record<string, unknown>>(csv, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  })
  assert.deepEqual(parsed.errors, [], `CSV fixture parse errors for ${path}`)
  return parsed.data
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
