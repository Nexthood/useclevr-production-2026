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
const prebookkeepingPageSource = readFileSync("src/app/(auth)/app/prebookkeeping/page.tsx", "utf8")
const accountancyUploadSource = readFileSync("src/components/accountancy/accountancy-upload.tsx", "utf8")
assert.ok(riskServiceSource.includes("scope ? eq(datasets.datasetType, scope)"), "risk dataset list filters by dataset_type scope")
assert.ok(riskServiceSource.includes("datasetId ? eq(datasets.id, datasetId)"), "risk dataset list filters by current dataset ID when supplied")
assert.ok(riskServiceSource.includes("dedupeByDatasetId"), "risk dataset list deduplicates by immutable dataset ID")
assert.ok(riskServiceSource.includes("isVisibleRiskDataset"), "risk dataset list hides test and seed records from production selectors")
assert.ok(riskPageSource.includes('params?.scope || "standard"'), "risk page defaults to standard scope instead of every user dataset")
assert.ok(riskPageSource.includes("datasetId: params?.datasetId || null"), "risk page scopes the selector to the supplied dataset ID")
assert.ok(prebookkeepingPageSource.includes("scope=prebookkeeping"), "pre-bookkeeping review links risk intelligence with pre-bookkeeping scope")
assert.ok(accountancyUploadSource.includes("useclevr_active_prebookkeeping_dataset_id"), "successful pre-bookkeeping upload persists active dataset ID")

console.log("Risk Intelligence engine tests passed.")
