import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import { formatAiProviderLimit, getHybridAiEntitlement, canUseHybridAiFeature } from "../../src/lib/hybrid-ai/features"
import {
  calculateRiskIntelligence,
  getDatasetSourceHref,
  isSupportedRiskDatasetType,
  type RiskDataRow,
  type RiskDatasetInput,
} from "../../src/lib/risk-intelligence/risk-engine"
import { RISK_RULES, RISK_SEVERITY_LABELS } from "../../src/lib/risk-intelligence/risk-rules"
import { parseCanonicalDate, periodKeyFromDate } from "../../src/lib/data/canonical-date"
import { canAccessRiskDataset, normalizeRiskModuleScope, riskScopeEmptyMessage } from "../../src/lib/risk-intelligence/risk-service"

function buildDataset(overrides: Partial<RiskDatasetInput> = {}): RiskDatasetInput {
  return {
    id: "ds_risk_test",
    name: "Risk test dataset",
    fileName: "risk.csv",
    datasetType: "standard",
    businessModel: "generic",
    rowCount: 0,
    columns: ["date", "product", "category", "customer_id", "revenue", "cost", "stock", "units_sold", "currency"],
    ...overrides,
  }
}

function ruleScore(rows: RiskDataRow[], ruleId: string, dataset: Partial<RiskDatasetInput> = {}) {
  const result = calculateRiskIntelligence(buildDataset({ ...dataset, rowCount: rows.length }), rows)
  assert.ok(result, "risk result exists")
  return result.findings.find((finding) => finding.ruleId === ruleId) || null
}

const noHistoryRows = [
  { product: "A", category: "Core", customer_id: "C1", revenue: 100, cost: 40, stock: 0, units_sold: 2, currency: "EUR" },
  { product: "B", category: "Core", customer_id: "C2", revenue: 120, cost: 60, stock: 0, units_sold: 1, currency: "EUR" },
]
const noHistory = calculateRiskIntelligence(buildDataset({ rowCount: noHistoryRows.length }), noHistoryRows)
assert.ok(noHistory, "deterministic calculation runs without AI")
assert.equal(noHistory.trendComparison, "No previous comparison available.", "trend is not fabricated without comparable history")
assert.ok(noHistory.overallScore <= 100, "overall score is capped")

const isolatedDatasetRows = [
  { date: "2026-01-01", product: "Selected", category: "Core", customer_id: "C1", revenue: 100, cost: 150, stock: 0, units_sold: 3 },
  { date: "2026-01-02", product: "Selected", category: "Core", customer_id: "C2", revenue: 100, cost: 150, stock: 0, units_sold: 2 },
]
const unrelatedDatasetRows = [
  { date: "2026-01-01", product: "Other", category: "Core", customer_id: "C9", revenue: 1000, cost: 50, stock: 5, units_sold: 10 },
]
const selectedRisk = calculateRiskIntelligence(
  buildDataset({ id: "dataset_b", name: "Selected risk dataset", rowCount: isolatedDatasetRows.length }),
  isolatedDatasetRows,
)
const combinedRisk = calculateRiskIntelligence(
  buildDataset({ id: "combined", name: "Combined datasets", rowCount: isolatedDatasetRows.length + unrelatedDatasetRows.length }),
  [...isolatedDatasetRows, ...unrelatedDatasetRows],
)
assert.ok(selectedRisk, "selected dataset risk result exists")
assert.ok(combinedRisk, "combined comparison risk result exists")
assert.equal(selectedRisk.dataset.id, "dataset_b", "risk result keeps the selected immutable dataset ID")
assert.equal(selectedRisk.dataset.rowCount, isolatedDatasetRows.length, "risk result row count comes from the selected dataset only")
assert.equal(selectedRisk.metrics.netMarginPct.value, -50, "risk result uses only selected dataset financial rows")
assert.notEqual(
  selectedRisk.metrics.netMarginPct.value,
  combinedRisk.metrics.netMarginPct.value,
  "risk result is not calculated from combined workspace datasets",
)

assert.equal(isSupportedRiskDatasetType("standard"), true, "standard datasets are supported")
assert.equal(isSupportedRiskDatasetType("retail"), true, "retail datasets are supported")
assert.equal(isSupportedRiskDatasetType("profitability"), true, "profitability datasets are supported")
assert.equal(isSupportedRiskDatasetType("accountancy"), true, "accountancy datasets are supported")
assert.equal(isSupportedRiskDatasetType("pre-bookkeeping"), true, "pre-bookkeeping datasets are supported")
assert.equal(isSupportedRiskDatasetType("unknown"), false, "unrelated dataset types stay isolated")
assert.equal(
  calculateRiskIntelligence(buildDataset({ datasetType: "unknown" }), noHistoryRows),
  null,
  "unsupported dataset type does not receive a score",
)

const deadStockRows: RiskDataRow[] = [
  { product: "A", stock: 10, units_sold: 0, revenue: 10, cost: 4 },
  { product: "B", stock: 10, units_sold: 0, revenue: 10, cost: 4 },
  { product: "C", stock: 10, units_sold: 0, revenue: 10, cost: 4 },
  { product: "D", stock: 10, units_sold: 0, revenue: 10, cost: 4 },
  { product: "E", stock: 0, units_sold: 2, revenue: 10, cost: 4 },
  { product: "F", stock: 0, units_sold: 2, revenue: 10, cost: 4 },
  { product: "G", stock: 0, units_sold: 2, revenue: 10, cost: 4 },
  { product: "H", stock: 0, units_sold: 2, revenue: 10, cost: 4 },
  { product: "I", stock: 0, units_sold: 2, revenue: 10, cost: 4 },
  { product: "J", stock: 0, units_sold: 2, revenue: 10, cost: 4 },
]
assert.equal(
  ruleScore(deadStockRows.slice(0, 10), "inventory.dead_stock_ratio.v1")?.severity,
  "critical",
  "dead-stock ratio reaches critical at 35 percent and above",
)
assert.equal(
  ruleScore(deadStockRows.slice(1, 10), "inventory.dead_stock_ratio.v1")?.severity,
  "high",
  "dead-stock ratio reaches high above 20 percent",
)

const revenueDeclineRows = [
  { date: "2026-01-01", product: "A", category: "Core", customer_id: "C1", revenue: 1000, cost: 400 },
  { date: "2026-01-15", product: "B", category: "Core", customer_id: "C2", revenue: 1000, cost: 500 },
  { date: "2026-02-01", product: "A", category: "Core", customer_id: "C1", revenue: 800, cost: 450 },
  { date: "2026-02-15", product: "B", category: "Core", customer_id: "C2", revenue: 800, cost: 520 },
]
const revenueDecline = ruleScore(revenueDeclineRows, "financial.revenue_decline.v1")
assert.equal(revenueDecline?.severity, "critical", "revenue decline uses requested <= -20 percent critical threshold")
assert.equal(revenueDecline?.metricValue, -20, "revenue decline boundary is inclusive")

const profitabilityRows = [
  { date: "2026-01-01", product: "A", revenue: 100, cost: 120 },
  { date: "2026-02-01", product: "B", revenue: 100, cost: 140 },
  { date: "2026-02-01", product: "C", revenue: 100, cost: 90 },
]
assert.equal(
  ruleScore(profitabilityRows, "profitability.negative_net_margin.v1")?.severity,
  "critical",
  "negative net margin triggers profitability risk",
)
assert.ok(
  ruleScore(profitabilityRows, "profitability.unprofitable_products.v1"),
  "multiple unprofitable products trigger one product profitability rule",
)
assert.ok(
  ruleScore(revenueDeclineRows, "profitability.cost_growth_exceeds_revenue.v1"),
  "cost growth above revenue growth triggers profitability risk",
)
assert.ok(
  ruleScore(profitabilityRows, "cash_flow.expenses_exceed_revenue.v1"),
  "expenses above revenue trigger cash-flow risk",
)

const concentrationRows = [
  { product: "A", category: "Core", customer_id: "C1", revenue: 70, cost: 20 },
  { product: "B", category: "Other", customer_id: "C2", revenue: 20, cost: 8 },
  { product: "C", category: "Other", customer_id: "C3", revenue: 10, cost: 4 },
]
assert.equal(
  ruleScore(concentrationRows, "concentration.top_product_share.v1")?.severity,
  "critical",
  "top-product share reaches critical at 70 percent",
)
assert.equal(
  ruleScore(concentrationRows, "concentration.top_category_share.v1")?.severity,
  "critical",
  "top-category share reaches critical at 70 percent",
)
assert.equal(
  ruleScore(concentrationRows, "concentration.top_customer_share.v1")?.severity,
  "critical",
  "top-customer share reaches critical at 70 percent",
)

const qualityRows = [
  { date: "not-a-date", product: "A", revenue: "bad", cost: 10, currency: "EUR" },
  { date: "2026-01-01", product: "A", revenue: "bad", cost: 10, currency: "USD" },
  { date: "2026-01-01", product: "", revenue: "", cost: 10, currency: "USD" },
  { date: "2026-01-01", product: "A", revenue: "bad", cost: 10, currency: "USD" },
]
const quality = calculateRiskIntelligence(buildDataset({ rowCount: qualityRows.length }), qualityRows)
assert.ok(quality?.findings.some((finding) => finding.category === "data_quality"), "data-quality rules trigger")
assert.ok(
  quality?.findings.some((finding) => finding.ruleId === "data_quality.duplicate_rows.v1"),
  "duplicate rows are detected",
)

const revenueOnlyRows = [
  { date: "2026-01-01", revenue: 100 },
  { date: "2026-02-01", revenue: 110 },
]
const revenueOnly = calculateRiskIntelligence(buildDataset({ rowCount: 2, columns: ["date", "revenue"] }), revenueOnlyRows)
assert.ok(revenueOnly, "revenue-only data still calculates available rules")
assert.equal(
  revenueOnly.findings.some((finding) => finding.ruleId === "cash_flow.expenses_exceed_revenue.v1"),
  false,
  "unavailable cost metrics are not penalized",
)

const categorySummaries = calculateRiskIntelligence(buildDataset({ rowCount: concentrationRows.length }), concentrationRows)
assert.ok(categorySummaries?.categorySummaries.some((summary) => summary.category === "revenue_concentration"), "category summary exists")
assert.ok((categorySummaries?.overallScore || 0) >= 0 && (categorySummaries?.overallScore || 0) <= 100, "overall score stays normalized")

const freeEntitlement = getHybridAiEntitlement("free", "user", "free@example.com")
assert.equal(freeEntitlement.canUseLite, false, "other free users remain blocked")
assert.equal(
  canUseHybridAiFeature("dashboardInsights", "free", "user", "free@example.com"),
  false,
  "direct API-equivalent dashboard-insights gate blocks normal free users",
)
assert.equal(
  getHybridAiEntitlement("free", "user", "superadmin@useclevr.com").canUseMega,
  true,
  "official superadmin email bypasses subscription requirement",
)
assert.equal(
  getHybridAiEntitlement("free", "user", "  SUPERADMIN@USECLEVR.COM  ").canUseMega,
  true,
  "uppercase and whitespace superadmin email resolves after normalization",
)
assert.equal(
  formatAiProviderLimit(getHybridAiEntitlement("free", "user", "superadmin@useclevr.com").providerLimit),
  "Unlimited",
  "provider limit displays Unlimited for the superadmin account",
)

assert.equal(canAccessRiskDataset({ id: "user_a", role: "user", email: "a@example.com" }, "user_a"), true, "owner can access dataset")
assert.equal(canAccessRiskDataset({ id: "user_a", role: "user", email: "a@example.com" }, "user_b"), false, "normal users cannot access another user's dataset")
assert.equal(canAccessRiskDataset({ id: "user_a", role: "user", email: "superadmin@useclevr.com" }, "user_b"), true, "official superadmin can access managed datasets")

assert.equal(normalizeRiskModuleScope("pre-bookkeeping"), "prebookkeeping", "risk scope normalizes pre-bookkeeping")
assert.equal(normalizeRiskModuleScope("retail"), "retail", "risk scope normalizes retail")
assert.equal(normalizeRiskModuleScope("unknown"), null, "unknown risk scope is rejected")
assert.equal(
  riskScopeEmptyMessage("prebookkeeping"),
  "No Pre-bookkeeping dataset available. Upload an accounting file first.",
  "pre-bookkeeping scope has a module-specific empty state",
)
assert.equal(
  getDatasetSourceHref("acct_123", "prebookkeeping"),
  "/app/prebookkeeping?datasetId=acct_123",
  "pre-bookkeeping risk source links back to the selected pre-bookkeeping dataset",
)

const riskServiceSource = readFileSync("src/lib/risk-intelligence/risk-service.ts", "utf8")
const riskPageSource = readFileSync("src/app/(auth)/app/risk-intelligence/page.tsx", "utf8")
const riskSelectorSource = readFileSync("src/components/risk-intelligence/risk-dataset-selector.tsx", "utf8")
const datasetsPageSource = readFileSync("src/app/(auth)/app/datasets/page.tsx", "utf8")
const datasetsClientSource = readFileSync("src/components/dataset/datasets-client.tsx", "utf8")
const batchDeleteButtonSource = readFileSync("src/components/dataset/batch-delete-button.tsx", "utf8")
const datasetApiSource = readFileSync("src/app/api/datasets/route.ts", "utf8")
const bulkDeleteApiSource = readFileSync("src/app/api/datasets/bulk-delete/route.ts", "utf8")
const deleteDatasetsApiSource = readFileSync("src/lib/data/delete-datasets-api.ts", "utf8")
const deleteDatasetsServiceSource = readFileSync("src/lib/data/delete-datasets.ts", "utf8")
const deleteDatasetButtonSource = readFileSync("src/components/dataset/delete-dataset-button.tsx", "utf8")
const assistantWorkspaceSource = readFileSync("src/components/chat/ai-assistant-workspace.tsx", "utf8")
const prebookkeepingPageSource = readFileSync("src/app/(auth)/app/prebookkeeping/page.tsx", "utf8")
const accountancyUploadSource = readFileSync("src/components/accountancy/accountancy-upload.tsx", "utf8")
assert.ok(riskServiceSource.includes("scope ? eq(datasets.datasetType, scope)"), "risk dataset list filters by dataset_type scope")
assert.ok(riskServiceSource.includes("datasetId ? eq(datasets.id, datasetId)"), "risk dataset list filters by current dataset ID when supplied")
assert.ok(riskServiceSource.includes("dedupeByDatasetId"), "risk dataset list deduplicates by immutable dataset ID")
assert.ok(riskServiceSource.includes("isVisibleRiskDataset"), "risk dataset list hides test and seed records from production selectors")
assert.ok(riskPageSource.includes('params?.scope || "standard"'), "risk page defaults to standard scope instead of every user dataset")
assert.doesNotMatch(
  riskPageSource,
  /listRiskIntelligenceDatasets\([\s\S]*datasetId:\s*params\?\.datasetId/,
  "risk page lists all module-scoped datasets before selecting the active dataset",
)
assert.ok(riskPageSource.includes("selectionRedirectHref"), "risk page redirects stale active dataset IDs to another dataset or empty scope")
assert.ok(riskPageSource.includes("calculateRiskIntelligenceForDataset(selectedDatasetId"), "risk page calculates risk for one selected dataset ID")
assert.ok(riskPageSource.includes("RiskDatasetSelector"), "risk page renders the deletion-capable dataset selector")
assert.ok(riskSelectorSource.includes("DeleteDatasetButton"), "risk selector renders delete controls for dataset items")
assert.ok(riskSelectorSource.includes("BatchDeleteButton"), "risk selector renders a bulk delete control")
assert.ok(riskSelectorSource.includes("Manage datasets"), "risk selector keeps bulk checkboxes behind an explicit management mode")
assert.ok(riskSelectorSource.includes("type=\"checkbox\""), "risk selector uses keyboard-accessible checkboxes in bulk mode")
assert.ok(riskSelectorSource.includes("aria-live=\"polite\""), "risk selector announces the selected dataset count")
assert.ok(riskSelectorSource.includes("Select visible"), "risk selector distinguishes filtered visible selection from all dataset selection")
assert.ok(riskSelectorSource.includes("Select all"), "risk selector supports selecting every loaded dataset")
assert.ok(riskSelectorSource.includes("Clear"), "risk selector supports clearing bulk selection")
assert.ok(riskSelectorSource.includes("Search datasets..."), "risk selector supports lightweight filtering")
assert.ok(riskSelectorSource.includes("max-h-[22rem]"), "risk selector keeps 50+ datasets inside a bounded selector area")
assert.ok(riskSelectorSource.includes("onDeleted={handleBulkDeleted}"), "risk selector removes successfully deleted dataset IDs together after one bulk action")
assert.ok(riskSelectorSource.includes("failedIds"), "risk selector leaves partial bulk-delete failures selected for retry")
assert.ok(riskSelectorSource.includes("datasets.map"), "risk selector renders every scoped dataset item")
assert.ok(riskSelectorSource.includes("visibleDatasets.filter((dataset) => !deletedIds.has(dataset.id))"), "risk selector removes bulk-deleted datasets from local visible state together")
assert.ok(riskSelectorSource.includes("deletedIds.has(selectedDatasetId)"), "risk selector detects when bulk deletion includes the active dataset")
assert.ok(riskSelectorSource.includes("remainingDatasets[0]?.id"), "risk selector selects another available dataset after active deletion")
assert.ok(riskSelectorSource.includes("router.replace(redirectHref)"), "risk selector redirects after deleting the active dataset")
assert.ok(datasetsPageSource.includes(".limit(100)"), "dataset library loads enough rows for 50+ dataset bulk management")
assert.ok(riskServiceSource.includes("limit: datasetId ? 1 : 100"), "risk dataset selector loads enough scoped datasets for 50+ bulk management")
assert.ok(datasetsClientSource.includes("Select all"), "dataset library bulk action bar offers select all")
assert.ok(datasetsClientSource.includes("Clear"), "dataset library bulk action bar offers clear selection")
assert.ok(batchDeleteButtonSource.includes('fetch("/api/datasets/bulk-delete"'), "bulk delete sends one request to the dedicated bulk endpoint")
assert.ok(batchDeleteButtonSource.includes('method: "POST"'), "bulk delete avoids a browser DELETE request body for large selections")
assert.ok(batchDeleteButtonSource.includes("body: JSON.stringify({ datasetIds: idsToDelete })"), "bulk delete sends immutable dataset IDs in one request body")
assert.equal((batchDeleteButtonSource.match(/fetch\("/g) || []).length, 1, "bulk delete button contains one fetch call and avoids sequential item delete requests")
assert.ok(batchDeleteButtonSource.includes("deleteResult.deletedIds.length === 0"), "bulk delete refuses zero-deleted backend responses")
assert.ok(batchDeleteButtonSource.includes("deleteResult.failed.length > 0"), "bulk delete reports partial failures")
assert.ok(batchDeleteButtonSource.includes("onResetSelection?.()"), "bulk delete clears selection only after complete success")
assert.ok(datasetApiSource.includes("export async function DELETE(request: Request)"), "dataset API preserves backwards-compatible bulk delete handler")
assert.ok(datasetApiSource.includes("handleBulkDeleteDatasetsRequest(request)"), "dataset API routes legacy collection delete through the shared verified bulk handler")
assert.ok(bulkDeleteApiSource.includes("export async function POST(request: Request)"), "dataset API exposes a POST bulk delete endpoint")
assert.ok(bulkDeleteApiSource.includes("handleBulkDeleteDatasetsRequest(request)"), "POST bulk delete endpoint uses the shared verified handler")
assert.ok(deleteDatasetsApiSource.includes("sanitizeDatasetIds(rawDatasetIds)"), "bulk delete API sanitizes immutable dataset IDs")
assert.ok(deleteDatasetsApiSource.includes("requestedCount"), "bulk delete API returns requested count")
assert.ok(deleteDatasetsApiSource.includes("deletedCount"), "bulk delete API returns confirmed deleted count")
assert.ok(deleteDatasetsApiSource.includes("failedIds"), "bulk delete API returns failed IDs")
assert.ok(deleteDatasetsApiSource.includes("result.failed.length > 0"), "bulk delete API returns partial-failure status")
assert.ok(deleteDatasetsServiceSource.includes("DELETE_CHUNK_SIZE = 50"), "bulk delete service batches large ID sets server-side")
assert.ok(deleteDatasetsServiceSource.includes("const deletedDatasets = await tx.delete(datasets)"), "bulk delete service records actual deleted dataset rows")
assert.ok(deleteDatasetsServiceSource.includes(".returning()"), "bulk delete service uses returned rows from the dataset delete statement")
assert.ok(deleteDatasetsServiceSource.includes("remainingRows"), "bulk delete service verifies deleted datasets by authoritative database refetch")
assert.ok(deleteDatasetsServiceSource.includes("prebookkeepingAuditEvents"), "bulk delete service clears pre-bookkeeping module records before dataset deletion")
assert.ok(deleteDatasetsServiceSource.includes("aiGovernanceOverrides"), "bulk delete service clears AI governance dataset references before dataset deletion")
assert.ok(deleteDatasetButtonSource.includes('fetch(`/api/datasets/${encodeURIComponent(datasetId)}`'), "single dataset delete still uses the item endpoint")
assert.ok(assistantWorkspaceSource.includes("ACTIVE_DATASET_ID_KEY"), "assistant persists active dataset selection")
assert.ok(assistantWorkspaceSource.includes("nextActiveDatasetId"), "assistant selects another available dataset when the stored active dataset disappears")
assert.ok(assistantWorkspaceSource.includes("setMessages([buildDatasetContextMessage(selectedDatasetId, datasets)])"), "assistant clears prior dataset-specific messages when the active dataset changes")
assert.ok(assistantWorkspaceSource.includes("body: JSON.stringify({"), "assistant sends one request body per active dataset question")
assert.ok(assistantWorkspaceSource.includes("datasetId: selectedDatasetId || undefined"), "assistant request uses the current selected dataset ID only")
assert.ok(prebookkeepingPageSource.includes("scope=prebookkeeping"), "pre-bookkeeping review links risk intelligence with pre-bookkeeping scope")
assert.ok(accountancyUploadSource.includes("useclevr_active_prebookkeeping_dataset_id"), "successful pre-bookkeeping upload persists active dataset ID")

console.log("Risk Intelligence engine tests passed.")

// ============================================================================
// Semantic-evidence regression suite
// ============================================================================

function buildFixtureDataset(overrides: Partial<RiskDatasetInput> = {}): RiskDatasetInput {
  return {
    id: "ds_semantic_fixture",
    name: "Semantic fixture",
    fileName: "semantic-fixture.csv",
    datasetType: "standard",
    businessModel: "generic",
    rowCount: 0,
    columns: null,
    ...overrides,
  }
}

function runFixture(rows: RiskDataRow[], overrides: Partial<RiskDatasetInput> = {}) {
  return calculateRiskIntelligence(
    buildFixtureDataset({ ...overrides, rowCount: overrides.rowCount ?? rows.length, columns: overrides.columns ?? Object.keys(rows[0] ?? {}) }),
    rows,
  )
}

function assertFiniteNumbers(result: NonNullable<ReturnType<typeof calculateRiskIntelligence>>) {
  for (const metric of Object.values(result.metrics)) {
    assert.ok(
      metric.value === null || Number.isFinite(metric.value),
      `metric value must never be NaN or Infinity (${metric.source})`,
    )
  }
  for (const finding of result.findings) {
    assert.ok(Number.isFinite(finding.score), "finding score must be finite")
    assert.ok(Number.isFinite(finding.metricValue), "finding metric value must be finite")
    assert.ok(Number.isFinite(finding.estimatedImpact), "finding impact must be finite")
    assert.ok(finding.score >= 0 && finding.score <= 100, "finding score must stay within 0-100")
    assert.equal(finding.estimatedImpact, Math.round(finding.score * finding.weight), "impact must be score x weight")
    assert.equal(finding.severityLabel, RISK_SEVERITY_LABELS[finding.severity], "severity label must match severity")
  }
  assert.ok(Number.isFinite(result.overallScore), "overall score must be finite")
  assert.ok(result.overallScore >= 0 && result.overallScore <= 100, "overall score must stay normalized")
}

function assertDeterministic(rows: RiskDataRow[], overrides: Partial<RiskDatasetInput> = {}) {
  const first = runFixture(rows, overrides)
  const second = runFixture(rows, overrides)
  assert.ok(first && second, "fixture produces a risk result")
  const strip = (result: NonNullable<ReturnType<typeof calculateRiskIntelligence>>) => {
    const { calculatedAt: _calculatedAt, ...rest } = result
    return rest
  }
  assert.deepEqual(strip(first), strip(second), "risk result is deterministic across runs")
  return first
}

function assertExpectedOverallScore(result: NonNullable<ReturnType<typeof calculateRiskIntelligence>>) {
  const notApplicable = new Set(result.notApplicableRules.map((rule) => rule.ruleId))
  const applicableRules = RISK_RULES.filter((rule) => !notApplicable.has(rule.ruleId))
  const applicableWeight = applicableRules.reduce((sum, rule) => sum + rule.weight, 0)
  const triggeredWeighted = result.findings.reduce((sum, finding) => sum + finding.score * finding.weight, 0)
  assert.equal(
    result.overallScore,
    clampExpectedScore(Math.round(triggeredWeighted / Math.max(applicableWeight, Number.EPSILON))),
    "overall score aggregates only applicable rules",
  )
}

function clampExpectedScore(value: number) {
  return Math.max(0, Math.min(100, value))
}

// --- Canonical date parsing -------------------------------------------------

assert.equal(periodKeyFromDate(parseCanonicalDate("2026-03-15") as Date), "2026-03", "ISO dates parse canonically")
assert.equal(periodKeyFromDate(parseCanonicalDate("03/15/2026") as Date), "2026-03", "US dates parse canonically")
assert.equal(periodKeyFromDate(parseCanonicalDate("15-03-2026") as Date), "2026-03", "EU dates parse canonically")
assert.equal(periodKeyFromDate(parseCanonicalDate("15.03.2026") as Date), "2026-03", "German dates parse canonically")
assert.equal(periodKeyFromDate(parseCanonicalDate("2026-03") as Date), "2026-03", "Month periods parse canonically")
assert.equal(periodKeyFromDate(parseCanonicalDate("Mar 15, 2026") as Date), "2026-03", "Month-name dates parse canonically")
assert.equal(parseCanonicalDate("not-a-date"), null, "garbage text never parses as a date")
assert.equal(parseCanonicalDate("PC-001"), null, "identifier-like values never parse as dates")
assert.equal(parseCanonicalDate(44744), null, "bare numbers never parse as epoch dates")

// --- 05_investor_portfolio: investor portfolio semantics --------------------

const investorRows: RiskDataRow[] = Array.from({ length: 45 }, (_, index) => {
  const companyNumber = index + 1
  const isLast = index === 44
  return {
    company_id: `PC-${String(companyNumber).padStart(3, "0")}`,
    company_name: `Portfolio Co ${String(companyNumber).padStart(3, "0")}`,
    sector: ["Fintech", "Health", "SaaS", "Climate", "Consumer"][index % 5],
    stage: ["Seed", "Series A", "Series B", "Growth"][index % 4],
    country: ["United States", "Netherlands", "Germany", "United Kingdom"][index % 4],
    investment_date: `2020-${String((index % 12) + 1).padStart(2, "0")}-15`,
    invested_amount: isLast ? 568450.45 : 470000,
    ownership_percent: isLast ? 15.545 : 13.7,
    entry_valuation: isLast ? 12720000 : 4000000 + index * 10000,
    latest_valuation: isLast ? 14010475.74 : 9700000 + index * 1000,
    annual_revenue: isLast ? 3184909.53 : 2800000,
    growth_rate: isLast ? 0.42 : 0.08 + (index % 9) * 0.02,
    burn_rate_monthly: isLast ? 420000 : 95000 + index * 1000,
    runway_months: isLast ? 7 : 12 + (index % 18),
    employees: 20 + index,
    status: index < 38 ? "Active" : index < 43 ? "Exited" : "Watchlist",
  }
})

const investorResult = runFixture(investorRows, {
  id: "synthetic_05_investor_portfolio",
  name: "05_investor_portfolio",
  fileName: "05_investor_portfolio.xlsx",
  datasetType: "standard",
  businessModel: "saas",
})
assert.ok(investorResult, "investor portfolio produces risk intelligence")
assert.equal(investorResult.dataset.semanticDatasetType, "investor", "strong investor schema overrides stale standard/SaaS metadata")
assert.equal(investorResult.scope, "Single Investor Portfolio dataset", "investor scope label stays semantically correct")
assert.equal(
  investorResult.findings.some((finding) => finding.ruleId === "financial.revenue_decline.v1"),
  false,
  "investor portfolio never claims a revenue decline from portfolio monetary fields",
)
assert.equal(investorResult.metrics.revenueGrowthPct.available, false, "annual portfolio revenue is not a validated revenue time series")
assert.equal(investorResult.metrics.invalidDateRatio.value, 0, "investment_date parses canonically and reports zero invalid dates")
assert.equal(
  investorResult.findings.some((finding) => finding.ruleId === "data_quality.invalid_dates.v1"),
  false,
  "investment_date no longer surfaces a bogus invalid-date finding",
)
assert.equal(investorResult.trendComparison, "No previous comparison available.", "investor portfolio does not fabricate a trend from investment dates")
const investorNotApplicable = new Set(investorResult.notApplicableRules.map((rule) => rule.ruleId))
assert.ok(investorNotApplicable.has("financial.revenue_decline.v1"), "revenue decline is reported as not applicable for investor portfolios")
assert.ok(investorNotApplicable.has("inventory.dead_stock_ratio.v1"), "inventory rules are not applicable to investor portfolios")
assert.ok(investorNotApplicable.has("cash_flow.expenses_exceed_revenue.v1"), "operating expense rules are not applicable to investor portfolios without cost evidence")
assert.ok(!investorNotApplicable.has("investor.portfolio_company_concentration.v1"), "portfolio concentration is applicable when portfolio fields exist")
assert.ok(!investorNotApplicable.has("investor.portfolio_runway_breach.v1"), "portfolio runway is applicable when runway fields exist")
for (const finding of investorResult.findings) {
  assert.ok(
    finding.ruleId.startsWith("investor.") || finding.ruleId.startsWith("data_quality."),
    "investor portfolio findings stay limited to portfolio and data-quality rules",
  )
}
assert.equal(investorResult.metrics.topPortfolioCompanyRevenueShare.value, 2.5, "portfolio concentration uses portfolio-company annual revenue")
assertFiniteNumbers(investorResult)
assertDeterministic(investorRows, {
  id: "synthetic_05_investor_portfolio",
  name: "05_investor_portfolio",
  businessModel: "saas",
})

const concentratedPortfolioRows: RiskDataRow[] = [
  { company_id: "PC-001", annual_revenue: 700000, runway_months: 3 },
  { company_id: "PC-002", annual_revenue: 200000, runway_months: 4 },
  { company_id: "PC-003", annual_revenue: 100000, runway_months: 24 },
]
const concentratedPortfolio = runFixture(concentratedPortfolioRows, { name: "investor_portfolio_fixture" })
assert.ok(concentratedPortfolio, "concentrated investor fixture produces a result")
const concentrationFinding = concentratedPortfolio.findings.find((finding) => finding.ruleId === "investor.portfolio_company_concentration.v1")
assert.ok(concentrationFinding, "dominant portfolio company triggers concentration")
assert.equal(concentrationFinding?.severity, "critical", "70 percent portfolio concentration stays at the critical boundary")
assert.equal(concentrationFinding?.metricValue, 70, "portfolio concentration metric is the top company revenue share")
const runwayFinding = concentratedPortfolio.findings.find((finding) => finding.ruleId === "investor.portfolio_runway_breach.v1")
assert.ok(runwayFinding, "portfolio companies below runway threshold trigger the runway rule")
assert.equal(runwayFinding?.metricValue, 66.7, "two of three portfolio companies breach the 6-month runway threshold")
assertExpectedOverallScore(concentratedPortfolio)
assertFiniteNumbers(concentratedPortfolio)

// --- Retail: real inventory semantics ---------------------------------------

const retailRows: RiskDataRow[] = [
  { order_date: "2026-01-05", store: "North", product: "Ski jacket", category: "Outerwear", customer_id: "C1", units_sold: 0, stock: 40, revenue: 0, cost: 300, currency: "EUR" },
  { order_date: "2026-01-18", store: "North", product: "Snow boots", category: "Footwear", customer_id: "C2", units_sold: 6, stock: 5, revenue: 1200, cost: 500, currency: "EUR" },
  { order_date: "2026-02-03", store: "North", product: "Snow pants", category: "Outerwear", customer_id: "C1", units_sold: 4, stock: 0, revenue: 700, cost: 260, currency: "EUR" },
  { order_date: "2026-02-20", store: "South", product: "Ski poles", category: "Equipment", customer_id: "C2", units_sold: 0, stock: 12, revenue: 0, cost: 90, currency: "EUR" },
]
const retailResult = runFixture(retailRows, { name: "retail_sales_fixture" })
assert.ok(retailResult, "retail fixture produces risk intelligence")
assert.equal(retailResult.dataset.semanticDatasetType, "retail", "retail inventory schema classifies as retail")
assert.equal(retailResult.metrics.revenueGrowthPct.available, true, "retail revenue trend uses the confirmed revenue column")
assert.equal(retailResult.metrics.deadStockRatio.available, true, "dead stock needs stock, sold, and product evidence")
assert.ok(retailResult.findings.some((finding) => finding.ruleId === "inventory.dead_stock_ratio.v1"), "stocked product without sales triggers dead stock")
assert.ok(retailResult.findings.some((finding) => finding.ruleId === "concentration.top_product_share.v1"), "retail revenue concentration uses the product dimension")
assert.equal(retailResult.metrics.invalidDateRatio.value, 0, "retail order dates parse canonically")
assertFiniteNumbers(retailResult)
assertDeterministic(retailRows)

// --- Ecommerce: net_sales trend with real periods ---------------------------

const ecommerceRows: RiskDataRow[] = [
  { order_id: "O-1", order_date: "2026-01-10", country: "NL", customer_id: "C1", order_total: 1200, cost: 500, currency: "EUR" },
  { order_id: "O-2", order_date: "2026-01-24", country: "DE", customer_id: "C2", order_total: 1500, cost: 600, currency: "EUR" },
  { order_id: "O-3", order_date: "2026-02-05", country: "NL", customer_id: "C2", order_total: 950, cost: 420, currency: "EUR" },
  { order_id: "O-4", order_date: "2026-02-18", country: "DE", customer_id: "C3", order_total: 900, cost: 430, currency: "EUR" },
]
const ecommerceResult = runFixture(ecommerceRows, { name: "ecommerce_orders_fixture" })
assert.ok(ecommerceResult, "ecommerce fixture produces risk intelligence")
assert.ok(
  ["standard", "retail"].includes(ecommerceResult.dataset.semanticDatasetType),
  "ecommerce order schema routes through the retail-capable semantic domains",
)
assert.equal(ecommerceResult.metrics.revenueGrowthPct.available, true, "order_total acts as the validated sales series for ecommerce")
assert.ok(
  ecommerceResult.findings.some((finding) => finding.ruleId === "financial.revenue_decline.v1"),
  "ecommerce revenue decline fires from real order periods",
)
assert.equal(ecommerceResult.findings.find((finding) => finding.ruleId === "financial.revenue_decline.v1")?.metricValue, -31.5, "ecommerce revenue decline matches the period series")
assertFiniteNumbers(ecommerceResult)
assertDeterministic(ecommerceRows)

// --- SaaS: subscription metrics are not operating revenue -------------------

const saasRows: RiskDataRow[] = [
  { month: "2026-01", mrr: 50000, churned_mrr: 2000, active_customers: 420, cash_balance: 150000, burn: 25000 },
  { month: "2026-02", mrr: 48000, churned_mrr: 3500, active_customers: 415, cash_balance: 125000, burn: 25000 },
  { month: "2026-03", mrr: 51000, churned_mrr: 1800, active_customers: 421, cash_balance: 100000, burn: 25000 },
]
const saasResult = runFixture(saasRows, { name: "saas_metrics_fixture" })
assert.ok(saasResult, "SaaS fixture produces risk intelligence")
assert.equal(saasResult.dataset.semanticDatasetType, "saas", "subscription schema classifies as SaaS")
assert.equal(
  saasResult.findings.some((finding) => finding.ruleId === "financial.revenue_decline.v1"),
  false,
  "MRR is not treated as operating revenue for decline claims without a revenue concept",
)
assert.ok(saasResult.findings.some((finding) => finding.ruleId === "cash_flow.low_runway.v1"), "cash balance against burn produces the runway rule")
assert.equal(saasResult.findings.find((finding) => finding.ruleId === "cash_flow.low_runway.v1")?.metricValue, 4, "runway uses the latest cash balance and burn point")
assertFiniteNumbers(saasResult)
assertDeterministic(saasRows)

// --- Profitability: monthly P&L rows ----------------------------------------

const profitRows: RiskDataRow[] = [
  { period: "2026-01", revenue: 20000, cogs: 9000, operating_expense: 8000 },
  { period: "2026-02", revenue: 21000, cogs: 9500, operating_expense: 8500 },
  { period: "2026-03", revenue: 8000, cogs: 9800, operating_expense: 9000 },
]
const profitResult = runFixture(profitRows, { name: "profitability_pnl_fixture" })
assert.ok(profitResult, "profitability fixture produces risk intelligence")
assert.equal(profitResult.dataset.semanticDatasetType, "profitability", "P&L schema classifies as profitability")
assert.ok(profitResult.findings.some((finding) => finding.ruleId === "financial.revenue_decline.v1"), "P&L revenue decline fires from the period dimension")
assert.ok(profitResult.findings.some((finding) => finding.ruleId === "profitability.negative_net_margin.v1"), "negative P&L margin triggers profitability risk")
assert.ok(profitResult.findings.some((finding) => finding.ruleId === "cash_flow.expenses_exceed_revenue.v1"), "P&L costs above revenue trigger cash-flow risk")
assert.ok(profitResult.findings.some((finding) => finding.ruleId === "profitability.cost_growth_exceeds_revenue.v1"), "cost growth above revenue growth triggers profitability risk")
assertFiniteNumbers(profitResult)
assertDeterministic(profitRows)

// --- Accountancy: ledger rows never claim revenue or profitability risk -----

const ledgerRows: RiskDataRow[] = [
  { journal_date: "2026-01-05", account: "4010 Sales", description: "Invoice 1", debit: 0, credit: 1200 },
  { journal_date: "2026-01-06", account: "2010 Rent", description: "Rent January", debit: 800, credit: 0 },
  { journal_date: "2026-02-05", account: "4010 Sales", description: "Invoice 2", debit: 0, credit: 1500 },
  { journal_date: "2026-02-06", account: "2010 Rent", description: "Rent February", debit: 800, credit: 0 },
]
const ledgerResult = runFixture(ledgerRows, { name: "accountancy_ledger_fixture" })
assert.ok(ledgerResult, "accountancy fixture produces risk intelligence")
assert.equal(ledgerResult.dataset.semanticDatasetType, "accountancy", "debit/credit schema classifies as accountancy")
assert.equal(
  ledgerResult.findings.some((finding) => finding.ruleId === "financial.revenue_decline.v1"),
  false,
  "ledger debits and credits never produce revenue decline claims",
)
assert.ok(ledgerResult.notApplicableRules.some((rule) => rule.ruleId === "financial.revenue_decline.v1"), "revenue decline stays not applicable for ledgers")
for (const finding of ledgerResult.findings) {
  assert.ok(
    finding.ruleId.startsWith("data_quality."),
    "accountancy findings stay limited to data-quality rules without account classification",
  )
}
assertFiniteNumbers(ledgerResult)
assertDeterministic(ledgerRows)

// --- Professional services: only confidently mapped fields produce rules ----

const servicesRows: RiskDataRow[] = [
  { client_id: "CL-1", invoice_date: "2026-01-15", invoice_amount: 4200, hours: 30 },
  { client_id: "CL-2", invoice_date: "2026-01-22", invoice_amount: 5100, hours: 42 },
  { client_id: "CL-1", invoice_date: "2026-02-11", invoice_amount: 3600, hours: 26 },
]
const servicesResult = runFixture(servicesRows, { name: "professional_services_fixture" })
assert.ok(servicesResult, "professional services fixture produces risk intelligence")
assert.equal(
  servicesResult.findings.some((finding) => finding.ruleId === "financial.revenue_decline.v1"),
  false,
  "invoice amounts are not treated as operating revenue without semantic confirmation",
)
assert.ok(
  servicesResult.notApplicableRules.some((rule) => rule.ruleId === "financial.revenue_decline.v1"),
  "professional services report revenue decline as not applicable",
)
for (const finding of servicesResult.findings) {
  assert.ok(
    finding.ruleId.startsWith("data_quality."),
    "professional services findings stay limited to data-quality rules for unmapped monetary fields",
  )
}
assertFiniteNumbers(servicesResult)
assertDeterministic(servicesRows)

// --- Generic business: only rules supported by mapped fields ----------------

const genericRows: RiskDataRow[] = [
  { date: "2026-01-04", revenue: 3000, cost: 1200 },
  { date: "2026-02-04", revenue: 3200, cost: 1400 },
  { date: "2026-03-04", revenue: 3100, cost: 1450 },
]
const genericResult = runFixture(genericRows, { name: "generic_business_fixture" })
assert.ok(genericResult, "generic fixture produces risk intelligence")
assert.ok(genericResult.metrics.revenueGrowthPct.available, "generic revenue columns drive revenue rules")
assert.ok(
  !genericResult.notApplicableRules.some((rule) => rule.ruleId === "financial.revenue_decline.v1"),
  "generic revenue decline stays applicable",
)
assert.ok(
  genericResult.notApplicableRules.some((rule) => rule.ruleId === "inventory.dead_stock_ratio.v1"),
  "dead stock is not applicable without inventory columns",
)
assertFiniteNumbers(genericResult)
assertDeterministic(genericRows)

// --- Severity threshold stability -------------------------------------------

const declineBoundaryRows: RiskDataRow[] = [
  { date: "2026-01-05", revenue: 1000, cost: 300 },
  { date: "2026-02-05", revenue: 951, cost: 300 },
]
assert.equal(
  runFixture(declineBoundaryRows)?.findings.find((finding) => finding.ruleId === "financial.revenue_decline.v1")?.severity,
  undefined,
  "revenue decline stays silent above the -5 percent boundary",
)
const declineBoundaryTriggerRows: RiskDataRow[] = [
  { date: "2026-01-05", revenue: 1000, cost: 300 },
  { date: "2026-02-05", revenue: 950, cost: 300 },
]
assert.equal(
  runFixture(declineBoundaryTriggerRows)?.findings.find((finding) => finding.ruleId === "financial.revenue_decline.v1")?.severity,
  "medium",
  "revenue decline reaches medium exactly at the -5 percent boundary",
)
const runwayBoundaryRows: RiskDataRow[] = [
  { cash_balance: 120000, burn: 10000 },
]
assert.equal(
  runFixture(runwayBoundaryRows)?.findings.find((finding) => finding.ruleId === "cash_flow.low_runway.v1")?.severity,
  "medium",
  "runway reaches medium exactly at 12 months",
)

// --- Overall-score aggregation stays normalized -----------------------------

const aggregationFixture = runFixture([
  { product: "A", category: "Core", customer_id: "C1", revenue: 700, cost: 200, stock: 5, units_sold: 9 },
  { product: "B", category: "Core", customer_id: "C2", revenue: 200, cost: 80, stock: 5, units_sold: 4 },
  { product: "C", category: "Other", customer_id: "C3", revenue: 100, cost: 45, stock: 5, units_sold: 2 },
], { name: "aggregation_fixture" })
assert.ok(aggregationFixture, "aggregation fixture produces a result")
assertExpectedOverallScore(aggregationFixture)
assertFiniteNumbers(aggregationFixture)

