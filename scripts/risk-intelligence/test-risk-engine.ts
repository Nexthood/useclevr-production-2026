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
assert.ok(batchDeleteButtonSource.includes('fetch("/api/datasets"'), "bulk delete sends one request to the collection endpoint")
assert.ok(batchDeleteButtonSource.includes("body: JSON.stringify({ datasetIds: idsToDelete })"), "bulk delete sends immutable dataset IDs in one request body")
assert.equal((batchDeleteButtonSource.match(/fetch\("/g) || []).length, 1, "bulk delete button contains one fetch call and avoids sequential item delete requests")
assert.ok(batchDeleteButtonSource.includes("deleteResult.failed.length > 0"), "bulk delete reports partial failures")
assert.ok(batchDeleteButtonSource.includes("onResetSelection?.()"), "bulk delete clears selection only after complete success")
assert.ok(datasetApiSource.includes("export async function DELETE(request: Request)"), "dataset API exposes one bulk delete handler")
assert.ok(datasetApiSource.includes("sanitizeDatasetIds(rawDatasetIds)"), "bulk delete API sanitizes immutable dataset IDs")
assert.ok(datasetApiSource.includes("status: result.failed.length > 0 ? 207 : 200"), "bulk delete API returns partial-failure status")
assert.ok(deleteDatasetButtonSource.includes('fetch(`/api/datasets/${encodeURIComponent(datasetId)}`'), "single dataset delete still uses the item endpoint")
assert.ok(assistantWorkspaceSource.includes("ACTIVE_DATASET_ID_KEY"), "assistant persists active dataset selection")
assert.ok(assistantWorkspaceSource.includes("nextActiveDatasetId"), "assistant selects another available dataset when the stored active dataset disappears")
assert.ok(assistantWorkspaceSource.includes("setMessages([buildDatasetContextMessage(selectedDatasetId, datasets)])"), "assistant clears prior dataset-specific messages when the active dataset changes")
assert.ok(assistantWorkspaceSource.includes("body: JSON.stringify({"), "assistant sends one request body per active dataset question")
assert.ok(assistantWorkspaceSource.includes("datasetId: selectedDatasetId || undefined"), "assistant request uses the current selected dataset ID only")
assert.ok(prebookkeepingPageSource.includes("scope=prebookkeeping"), "pre-bookkeeping review links risk intelligence with pre-bookkeeping scope")
assert.ok(accountancyUploadSource.includes("useclevr_active_prebookkeeping_dataset_id"), "successful pre-bookkeeping upload persists active dataset ID")

console.log("Risk Intelligence engine tests passed.")
