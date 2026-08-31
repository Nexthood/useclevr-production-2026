import assert from "node:assert/strict"

import {
  buildBusinessSemanticProfile,
  buildBusinessSemanticPromptBlock,
  combineBusinessSemanticProfiles,
  conceptColumn,
  metricStatus,
} from "../../src/lib/data/business-semantics"
import { buildDashboard } from "../../src/lib/data/dashboard-builder"

function main() {
  const ambiguousAmount = buildBusinessSemanticProfile({
    datasetId: "semantic_ambiguous_amount",
    datasetType: "standard",
    columns: ["date", "amount", "category"],
    rows: [
      { date: "2026-01-01", amount: 100, category: "Sales" },
      { date: "2026-01-02", amount: 50, category: "Refund" },
    ],
  })
  assert.equal(conceptColumn(ambiguousAmount, "revenue"), null, "generic amount must not map to revenue")
  assert.equal(metricStatus(ambiguousAmount, "Revenue"), "BLOCKED", "revenue KPI must be blocked without revenue evidence")
  assert.ok(ambiguousAmount.ambiguities.some((item) => item.sourceColumn === "amount"), "amount ambiguity must be explicit")

  const dashboard = buildDashboard("dashboard_ambiguous_amount", [
    { date: "2026-01-01", amount: 100, category: "Sales" },
    { date: "2026-01-02", amount: 50, category: "Refund" },
  ])
  assert.ok(!dashboard.kpis.some((kpi) => /revenue/i.test(kpi.title)), "legacy dashboard must not turn amount into revenue")
  assert.equal(dashboard.metadata.businessSemanticProfile.blockedMetrics.some((metric) => metric.metric === "Revenue"), true)

  const ledger = buildBusinessSemanticProfile({
    datasetId: "semantic_ledger",
    datasetType: "standard",
    columns: ["transaction_date", "journal_id", "account_code", "account_name", "debit", "credit"],
    rows: [
      { transaction_date: "2026-01-01", journal_id: "J-1", account_code: "4000", account_name: "Sales", debit: 0, credit: 1000 },
    ],
  })
  assert.equal(ledger.datasetType, "accountancy")
  assert.equal(metricStatus(ledger, "Net Movement"), "AVAILABLE")
  assert.equal(metricStatus(ledger, "Net Profit"), "NOT_APPLICABLE", "ledger must not expose P&L net profit")

  const marketplace = buildBusinessSemanticProfile({
    datasetId: "semantic_marketplace",
    datasetType: "marketplace",
    columns: ["transaction_id", "gmv", "platform_fee", "seller_payout", "refund_amount", "buyer_id", "seller_id"],
    rows: [
      { transaction_id: "T-1", gmv: 1000, platform_fee: 120, seller_payout: 860, refund_amount: 20, buyer_id: "B-1", seller_id: "S-1" },
    ],
  })
  assert.equal(conceptColumn(marketplace, "gmv"), "gmv")
  assert.equal(conceptColumn(marketplace, "marketplace_revenue"), "platform_fee")
  assert.equal(conceptColumn(marketplace, "revenue"), null, "marketplace GMV must not become company revenue")
  assert.equal(metricStatus(marketplace, "GMV"), "AVAILABLE")
  assert.equal(metricStatus(marketplace, "Marketplace Revenue"), "AVAILABLE")
  assert.equal(metricStatus(marketplace, "Revenue"), "NOT_APPLICABLE")

  const saas = buildBusinessSemanticProfile({
    datasetId: "semantic_saas",
    datasetType: "saas",
    columns: ["billing_month", "customer_id", "mrr", "cash_balance", "burn"],
    rows: [
      { billing_month: "2026-01", customer_id: "C-1", mrr: 100, cash_balance: 10000, burn: 2000 },
      { billing_month: "2026-02", customer_id: "C-1", mrr: 120, cash_balance: 9000, burn: 1800 },
    ],
  })
  assert.equal(metricStatus(saas, "MRR"), "AVAILABLE")
  assert.equal(metricStatus(saas, "ARR"), "AVAILABLE")
  assert.equal(metricStatus(saas, "Runway"), "AVAILABLE")
  assert.equal(saas.lineage.find((lineage) => lineage.concept === "mrr")?.rowScope, "latest_period")

  const incompatibleMerge = combineBusinessSemanticProfiles([
    {
      datasetId: "semantic_merge",
      datasetType: "profitability",
      fileName: "revenue.csv",
      columns: ["date", "revenue", "currency"],
      rows: [{ date: "2026-01-01", revenue: 1000, currency: "USD" }],
    },
    {
      datasetId: "semantic_merge",
      datasetType: "marketplace",
      fileName: "marketplace.csv",
      columns: ["date", "gmv", "currency"],
      rows: [{ date: "2026-01-01", gmv: 1200, currency: "EUR" }],
    },
  ])
  assert.ok(incompatibleMerge.contradictions.some((issue) => issue.code === "INCOMPATIBLE_DATASET_TYPES"))
  assert.ok(incompatibleMerge.contradictions.some((issue) => issue.code === "POSSIBLE_INCOMPATIBLE_CURRENCIES"))

  const promptBlock = buildBusinessSemanticPromptBlock(ambiguousAmount)
  assert.match(promptBlock, /No semantic evidence/i)
  assert.match(promptBlock, /Blocked metrics/i)

  process.stdout.write("Business semantics engine tests passed.\n")
}

main()
