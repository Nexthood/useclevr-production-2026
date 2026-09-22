import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import {
  aggregateWorldMapRegions,
  collectAvailableGeographicMetrics,
  detectGeographicCustomerMetric,
  detectGeographicOrderMetric,
  mergeGeographicMetricValues,
  readSummedGeographicMetric,
  sumMeasuredGeographicValues,
  type WorldMapRegion,
} from "../../src/lib/data/geographic-metric-semantics"

function main() {
  // ---------------------------------------------------------------------------
  // mergeGeographicMetricValues: null is never coerced into a numeric zero
  // ---------------------------------------------------------------------------
  assert.equal(mergeGeographicMetricValues(null, null), null, "unavailable + unavailable stays unavailable")
  assert.equal(mergeGeographicMetricValues(null, undefined), null, "unavailable + undefined stays unavailable")
  assert.equal(mergeGeographicMetricValues(null, 0), 0, "measured zero wins over unavailable")
  assert.equal(mergeGeographicMetricValues(0, null), 0, "unavailable never overwrites measured zero")
  assert.equal(mergeGeographicMetricValues(5, null), 5, "measured value survives unavailable addition")
  assert.equal(mergeGeographicMetricValues(2, 3), 5, "measured values add numerically")

  // ---------------------------------------------------------------------------
  // Totals preserve null: a metric with no measured value has no total.
  // ---------------------------------------------------------------------------
  assert.equal(sumMeasuredGeographicValues([null, null, null]), null, "all-unavailable totals stay null")
  assert.equal(sumMeasuredGeographicValues([null, 0, 2]), 2, "measured zeros participate in totals")
  assert.equal(sumMeasuredGeographicValues([NaN, Infinity, 3]), 3, "NaN/Infinity never reach totals")

  // ---------------------------------------------------------------------------
  // Semantic detection: ecommerce-style order and customer identities resolve,
  // but investor portfolio records never become orders or customers.
  // ---------------------------------------------------------------------------
  const ecommerceRows = [
    { order_id: "A-1", customer_id: "C-1", country: "Germany", revenue: 10 },
    { order_id: "A-2", customer_id: "C-1", country: "Germany", revenue: 20 },
    { order_id: "A-1", customer_id: "C-2", country: "France", revenue: 5 },
  ]
  assert.deepEqual(
    detectGeographicOrderMetric(["order_id", "customer_id", "country", "revenue"], ecommerceRows),
    { column: "order_id", mode: "distinct" },
    "recognized order id fields map to distinct order counts",
  )
  assert.deepEqual(
    detectGeographicCustomerMetric(["order_id", "customer_id", "country"], ecommerceRows),
    { column: "customer_id" },
    "recognized customer id fields map to the customer metric",
  )

  // ---------------------------------------------------------------------------
  // Investor portfolio schema: company identifiers, portfolio company names,
  // invested amounts, and valuations never create order or customer metrics.
  // ---------------------------------------------------------------------------
  const investorColumns = ["company_id", "company_name", "sector", "stage", "country", "invested_amount", "latest_valuation", "revenue"]
  const investorRows = [
    { company_id: "co_1", company_name: "Northwind", sector: "Software", stage: "Seed", country: "Germany", invested_amount: 1000, latest_valuation: 5000, revenue: 4261.3 },
  ]
  assert.equal(detectGeographicOrderMetric(investorColumns, investorRows), null, "company ids never become orders")
  assert.equal(detectGeographicCustomerMetric(investorColumns, investorRows), null, "portfolio company records never become customers")

  // Generic identifiers and monetary fields are not order or customer concepts.
  assert.equal(detectGeographicOrderMetric(["id", "name", "amount", "country"], investorRows), null, "generic ids never become orders")
  assert.equal(detectGeographicCustomerMetric(["id", "name", "amount", "country"], investorRows), null, "generic ids never become customers")

  // ---------------------------------------------------------------------------
  // Cross-dataset semantics: each business dataset family resolves metrics
  // only when semantic evidence supports them.
  // ---------------------------------------------------------------------------
  type DatasetCase = { label: string; columns: string[]; rows: Record<string, unknown>[]; orders: "measured" | "unavailable"; customers: "measured" | "unavailable" }
  const datasetCases: DatasetCase[] = [
    {
      label: "retail: units and stock never fabricate orders or customers",
      columns: ["date", "store_id", "product_id", "category", "units_sold", "revenue", "unit_cost", "stock_on_hand", "reorder_point", "supplier", "location"],
      rows: [{ date: "2025-01-01", store_id: "s1", product_id: "p1", category: "coffee", units_sold: 3, revenue: 45.5, unit_cost: 12, stock_on_hand: 30, reorder_point: 10, supplier: "acme", location: "Amsterdam" }],
      orders: "unavailable",
      customers: "unavailable",
    },
    {
      label: "ecommerce order and customer identities resolve",
      columns: ["order_id", "order_date", "customer_id", "country", "region", "product_id", "quantity", "unit_price", "revenue", "shipping_cost", "return_status", "channel"],
      rows: [{ order_id: "A-1", order_date: "2025-01-01", customer_id: "C-1", country: "Germany", region: "EU", product_id: "p1", quantity: 2, unit_price: 10, revenue: 20, shipping_cost: 1, return_status: "", channel: "web" }],
      orders: "measured",
      customers: "measured",
    },
    {
      label: "saas customers resolve without order records",
      columns: ["month", "customer_id", "company_name", "country", "plan", "mrr", "arr", "new_customer", "churned"],
      rows: [{ month: "2025-01", customer_id: "C-1", company_name: "Northwind", country: "Germany", plan: "pro", mrr: 99, arr: 1188, new_customer: "yes", churned: "no" }],
      orders: "unavailable",
      customers: "measured",
    },
    {
      label: "investor portfolio company records never become orders or customers",
      columns: ["company_id", "company_name", "sector", "stage", "country", "invested_amount", "ownership_percent", "latest_valuation", "revenue", "growth_rate", "runway_months"],
      rows: [{ company_id: "co_001", company_name: "Northwind AI", sector: "Software", stage: "Series A", country: "Germany", invested_amount: 420000, ownership_percent: 6.0, latest_valuation: 4800000, revenue: 320000, growth_rate: 0.31, runway_months: 14 }],
      orders: "unavailable",
      customers: "unavailable",
    },
    {
      label: "profitability pnl has no order or customer semantics",
      columns: ["month", "department", "revenue", "cogs", "operating_expenses", "interest_expense", "tax_expense"],
      rows: [{ month: "2025-01", department: "sales", revenue: 5000, cogs: 2000, operating_expenses: 800, interest_expense: 50, tax_expense: 300 }],
      orders: "unavailable",
      customers: "unavailable",
    },
    {
      label: "accountancy ledger has no order or customer semantics",
      columns: ["journal_date", "account", "account_name", "description", "debit", "credit"],
      rows: [{ journal_date: "2025-01-01", account: "1000", account_name: "Bank", description: "deposit", debit: 500, credit: 0 }],
      orders: "unavailable",
      customers: "unavailable",
    },
    {
      label: "generic business data exposes no order or customer metrics",
      columns: ["name", "status", "owner"],
      rows: [{ name: "workspace item", status: "open", owner: "team" }],
      orders: "unavailable",
      customers: "unavailable",
    },
  ]
  for (const datasetCase of datasetCases) {
    const orderMetricResult = detectGeographicOrderMetric(datasetCase.columns, datasetCase.rows)
    const customerMetricResult = detectGeographicCustomerMetric(datasetCase.columns, datasetCase.rows)
    assert.equal(orderMetricResult !== null, datasetCase.orders === "measured", `orders semantics for case: ${datasetCase.label}`)
    assert.equal(customerMetricResult !== null, datasetCase.customers === "measured", `customers semantics for case: ${datasetCase.label}`)
  }

  // Marketplace transaction records map to measured orders and buyer identities
  // to measured customers, while seller records never become customers.
  const marketplaceColumns = ["date", "transaction_id", "buyer_id", "seller_id", "country", "category", "gross_merchandise_value", "platform_fee", "seller_payout", "refund_amount", "completed"]
  const marketplaceRows = [{ date: "2025-01-01", transaction_id: "T-1", buyer_id: "B-1", seller_id: "S-1", country: "Germany", category: "home", gross_merchandise_value: 100, platform_fee: 10, seller_payout: 85, refund_amount: 0, completed: "yes" }]
  assert.equal(detectGeographicOrderMetric(marketplaceColumns, marketplaceRows)?.column, "transaction_id", "marketplace transaction ids map to measured orders")
  assert.equal(detectGeographicCustomerMetric(marketplaceColumns, marketplaceRows)?.column, "buyer_id", "marketplace buyers map to measured customers")

  // ---------------------------------------------------------------------------
  // The dashboard aggregation reproduces the observed World Map numbers:
  // Germany revenue 4261.3 with orders/customers unavailable, datasets real.
  // ---------------------------------------------------------------------------
  const observed: WorldMapRegion[] = [
    { name: "Germany", revenue: 4261.3, orders: null, customers: null, datasets: 1 },
    { name: "France", revenue: 1800.5, orders: null, customers: null, datasets: 1 },
  ]
  const aggregated = aggregateWorldMapRegions(observed)
  assert.equal(aggregated.mapped.length, 2)
  assert.equal(aggregated.unmapped, 0)
  const germany = aggregated.mapped.find((region) => region.countryName === "Germany")
  assert.ok(germany)
  assert.equal(germany.revenue, 4261.3, "revenue keeps its measured value")
  assert.equal(germany.orders, null, "orders without an order concept stay unavailable, not 0")
  assert.equal(germany.customers, null, "customers without a customer concept stay unavailable, not 0")
  assert.equal(germany.datasets, 1, "datasets stay a real count")
  assert.deepEqual(
    collectAvailableGeographicMetrics(aggregated.mapped).sort(),
    ["datasets", "revenue"],
    "only supported metrics report availability",
  )

  // ---------------------------------------------------------------------------
  // Genuine measured zeros stay exactly 0 through the whole pipeline.
  // ---------------------------------------------------------------------------
  const measured: WorldMapRegion[] = [{ name: "Germany", revenue: 4261.3, orders: 0, customers: 0, datasets: 1 }]
  const measuredAggregated = aggregateWorldMapRegions(measured)
  assert.equal(measuredAggregated.mapped[0].orders, 0, "measured zero orders stay 0")
  assert.equal(measuredAggregated.mapped[0].customers, 0, "measured zero customers stay 0")
  assert.deepEqual(
    collectAvailableGeographicMetrics(measuredAggregated.mapped).sort(),
    ["customers", "datasets", "orders", "revenue"],
    "measured zeros still report availability",
  )

  // ---------------------------------------------------------------------------
  // null and 0 never merge into each other.
  // ---------------------------------------------------------------------------
  const mixedRegions: WorldMapRegion[] = [
    { name: "Germany", revenue: 100, orders: 0, customers: null, datasets: 1 },
    { name: "France", revenue: 50, orders: 3, customers: null, datasets: 1 },
  ]
  const mixedAggregated = aggregateWorldMapRegions(mixedRegions)
  const mixedGermany = mixedAggregated.mapped.find((region) => region.countryName === "Germany")
  const mixedFrance = mixedAggregated.mapped.find((region) => region.countryName === "France")
  assert.ok(mixedGermany)
  assert.ok(mixedFrance)
  assert.equal(mixedGermany.orders, 0, "measured zero orders stay 0 in their own country")
  assert.equal(mixedFrance.orders, 3, "measured orders keep their measured value per country")
  assert.equal(mixedGermany.customers, null, "unavailable customers never become 0 in their own country")
  assert.equal(mixedFrance.customers, null, "unavailable customers never become 0 through aggregation")
  assert.equal(sumMeasuredGeographicValues(mixedAggregated.mapped.map((region) => region.orders)), 3, "totals never turn unavailable metrics into 0")

  // ---------------------------------------------------------------------------
  // No NaN or Infinity reaches any aggregated value.
  // ---------------------------------------------------------------------------
  const dirtyRegions: WorldMapRegion[] = [
    { name: "Germany", revenue: Number.NaN, orders: Number.POSITIVE_INFINITY, customers: Number.NaN, datasets: 2 },
  ]
  const dirtyAggregated = aggregateWorldMapRegions(dirtyRegions)
  for (const region of dirtyAggregated.mapped) {
    for (const value of [region.revenue, region.orders, region.customers, region.datasets]) {
      assert.ok(value === null || Number.isFinite(value), `no NaN/Infinity reaches the map: ${String(value)}`)
    }
  }
  assert.equal(readSummedGeographicMetric([{ orders: Number.NaN }], "orders"), 0, "NaN values are excluded from measured sums")

  // ---------------------------------------------------------------------------
  // Source contract: the map renders unavailable metrics as N/A and never
  // coerces them through `?? 0` / `|| 0`.
  // ---------------------------------------------------------------------------
  const mapSource = readFileSync("src/components/dashboard/geographic-revenue-map.tsx", "utf8")
  const tooltipSource = readFileSync("src/components/dashboard/geographic-map-tooltip.tsx", "utf8")
  const wrapperSource = readFileSync("src/components/ui/world-map-revenue.tsx", "utf8")
  assert.ok(mapSource.includes("formatMetricOrUnavailable"), "country detail popup renders unavailable metrics as N/A")
  assert.ok(tooltipSource.includes("formatMetricOrUnavailable"), "hover tooltip renders unavailable metrics as N/A")
  assert.ok(wrapperSource.includes("availableMetrics"), "world map wrapper forwards metric availability")
  assert.ok(!/\|\|\s*0/.test(wrapperSource), "wrapper no longer fabricates zeros with `|| 0`")

  console.log("World map metric semantics verification passed: unavailable metrics stay null, measured zeros stay 0.")
}

main()
