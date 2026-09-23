import assert from "node:assert/strict"
import fs from "node:fs"

import {
  aggregateWorldMapRegions,
  detectGeographicCustomerMetric,
  detectGeographicOrderMetric,
  mergeGeographicMetricValues,
  sumMeasuredGeographicValues,
} from "../../src/lib/data/geographic-metric-semantics"
import { selectDashboardRegionRows } from "../../src/lib/data/dashboard-row-scope"
import { buildDashboardSemanticAnalysis } from "../../src/lib/data/dashboard-semantic-profile"

type Row = Record<string, unknown>

// Production fingerprint under audit: 220 rows spanning 2026-01-01..2026-04-30
// so the dashboard's default 30-day window isolates exactly 42 rows.
const FULL_ROWS = 220
const WINDOW_ROWS = 42
const FULL_CUSTOMERS = 113
const FULL_PRODUCTS = 50
const FULL_UNITS = 666
const FULL_REVENUE = 87420.2
const COUNTRIES = [
  "Germany",
  "France",
  "Netherlands",
  "Belgium",
  "Spain",
  "United Kingdom",
  "United States",
  "Canada",
  "Australia",
]

const rows = buildEcommerceRows()

async function main() {
  assertSemanticKpisUseEveryStoredRow()
  assertPreFixWindowFingerprint()
  await assertFixedRegionScopeMatchesSemanticKpis()
  assertRegionScopeRule()
  assertDashboardPageSourceInvariants()
  process.stdout.write("Dashboard World Map scope regression passed.\n")
}

// The KPI row is rendered from the semantic profile, which must aggregate
// every stored row of the active dataset: no date window, no preview slice.
async function assertSemanticKpisUseEveryStoredRow() {
  const analysis = await buildDashboardSemanticAnalysis(datasetInput({ id: "map-scope-dataset", rows }))
  const metric = (label: string) => analysis.metrics.find((item) => item.label === label)
  assert.equal(analysis.businessProfile, "ecommerce", "synthetic dataset must classify as ecommerce")
  assert.equal(round2(metric("Revenue")?.value ?? NaN), FULL_REVENUE, "semantic Revenue must sum every stored row")
  assert.equal(metric("Orders")?.value, FULL_ROWS, "semantic Orders must count distinct order IDs across every stored row")
  assert.equal(metric("Customers")?.value, FULL_CUSTOMERS, "semantic Customers must count distinct customer IDs across every stored row")
  assert.equal(metric("Units Sold")?.value, FULL_UNITS, "semantic Units Sold must sum quantity across every stored row")
  assert.equal(metric("Products")?.value, FULL_PRODUCTS, "semantic Products must count distinct products across every stored row")
  assert.equal(analysis.loadedRowCount, FULL_ROWS, "semantic analysis must load every stored row")
}

// The reported production bug: the default 30-day window isolates 42 of the
// 220 rows, which is exactly the row subset the World Map used to receive.
function assertPreFixWindowFingerprint() {
  const windowRows = filterRowsByRangeForTest(rows, "order_date", 30)
  assert.equal(windowRows.length, WINDOW_ROWS, "the default 30-day window must isolate the map-fingerprint subset")
  assert.equal(distinct(windowRows, "order_id"), WINDOW_ROWS, "the 30-day window must contain 42 distinct orders")
  assert.notEqual(distinct(windowRows, "order_id"), FULL_ROWS, "the 30-day window must not cover the full KPI order scope")
  assert.ok(
    sumColumn(windowRows, "revenue") < sumColumn(rows, "revenue"),
    "the 30-day window revenue must be a strict subset of the KPI revenue",
  )
}

// With the semantic profile driving the KPI row, the World Map must aggregate
// the same full row scope, so every map total equals its KPI counterpart.
async function assertFixedRegionScopeMatchesSemanticKpis() {
  const analysis = await buildDashboardSemanticAnalysis(datasetInput({ id: "map-scope-dataset", rows }))
  const regionRows = selectDashboardRegionRows({ rows, activeRows: filterRowsByRangeForTest(rows, "order_date", 30), semanticDrivesKpis: true })

  const mapped = aggregateWorldMapRegions(buildRegionAggregates(regionRows)).mapped
  const mapRevenue = sumMeasuredGeographicValues(mapped.map((region) => region.revenue ?? null))
  const mapOrders = sumMeasuredGeographicValues(mapped.map((region) => region.orders ?? null))
  const mapCustomers = sumMeasuredGeographicValues(mapped.map((region) => region.customers ?? null))

  assert.equal(round2(mapRevenue ?? NaN), round2(analysis.metrics.find((item) => item.label === "Revenue")?.value ?? NaN), "World Map revenue total must equal the semantic KPI revenue")
  assert.equal(mapOrders, analysis.metrics.find((item) => item.label === "Orders")?.value, "World Map orders total must equal the semantic KPI orders")
  assert.equal(mapCustomers, analysis.metrics.find((item) => item.label === "Customers")?.value, "World Map customers total must equal the semantic KPI customers")
  assert.equal(mapped.length, COUNTRIES.length, "every country with rows stays mapped on the full scope")
  const germany = mapped.find((region) => region.countryName === "Germany")
  assert.ok(germany, "Germany must be mapped")
  assert.equal(germany?.orders, rows.filter((row) => row.country === "Germany").length, "Germany orders must cover every German row")
}

// Fallback KPIs (no semantic metrics) keep the range-filtered scope on both
// sides, so the map still matches the KPI row it accompanies.
function assertRegionScopeRule() {
  const activeRows = filterRowsByRangeForTest(rows, "order_date", 30)
  assert.equal(
    selectDashboardRegionRows({ rows, activeRows, semanticDrivesKpis: true }),
    rows,
    "semantic KPI scope must hand the full row list to the World Map",
  )
  assert.equal(
    selectDashboardRegionRows({ rows, activeRows, semanticDrivesKpis: false }),
    activeRows,
    "fallback KPI scope must hand the range-filtered rows to the World Map",
  )
}

function assertDashboardPageSourceInvariants() {
  const source = fs.readFileSync("src/app/(auth)/app/page.tsx", "utf8")
  assert.match(
    source,
    /const semanticDrivesKpis = Boolean\(semanticAnalysis\?\.metrics\.length\)/,
    "the region scope flag must mirror the KPI row's semantic branch condition",
  )
  assert.match(
    source,
    /if \(metrics\.semanticAnalysis\?\.metrics\.length\) \{\s*return metrics\.semanticAnalysis\.metrics/,
    "the KPI row must keep rendering from the semantic metrics under the same condition",
  )
  assert.match(
    source,
    /const regionRows = selectDashboardRegionRows\(\{ rows, activeRows, semanticDrivesKpis \}\)/,
    "the World Map rows must flow through the shared scope selector",
  )
  assert.match(source, /const regions = buildRegions\(regionRows, columns\)/, "buildRegions must aggregate the selected scope")
  assert.doesNotMatch(source, /buildRegions\(activeRows/, "buildRegions must never silently fall back to the range-filtered scope")
}

// Mirrors page.tsx filterRowsByRange for range="30d".
function filterRowsByRangeForTest(rows: Row[], dateColumn: string, days: number): Row[] {
  const dated = rows
    .map((row) => ({ row, date: parseDate(row[dateColumn]) }))
    .filter((entry) => entry.date)
  if (dated.length === 0) return rows
  const latest = new Date(Math.max(...dated.map((entry) => entry.date!.getTime())))
  const since = new Date(latest)
  since.setDate(since.getDate() - days)
  return dated.filter((entry) => entry.date! >= since).map((entry) => entry.row)
}

// Mirrors page.tsx buildRegions aggregation for the audited columns, using the
// shared geographic semantic resolvers.
function buildRegionAggregates(regionRows: Row[]) {
  const columns = ["order_id", "order_date", "customer_id", "country", "region", "product_id", "quantity", "revenue"]
  const orderMetric = detectGeographicOrderMetric(columns, regionRows)
  const customerMetric = detectGeographicCustomerMetric(columns, regionRows)
  assert.ok(orderMetric && orderMetric.mode === "distinct", "order_id must resolve as a distinct order metric")
  assert.ok(customerMetric, "customer_id must resolve as a customer metric")
  const aggregate = new Map<string, { revenue: number | null; orderIds: Set<string>; customerIds: Set<string> }>()
  for (const row of regionRows) {
    const name = String(row["country"] || "").trim()
    if (!name) continue
    const current = aggregate.get(name) || { revenue: null, orderIds: new Set<string>(), customerIds: new Set<string>() }
    current.revenue = mergeGeographicMetricValues(current.revenue, typeof row["revenue"] === "number" ? row["revenue"] : null)
    const orderId = String(row[orderMetric.column] ?? "").trim()
    if (orderId) current.orderIds.add(orderId)
    const customerId = String(row[customerMetric.column] ?? "").trim()
    if (customerId) current.customerIds.add(customerId)
    aggregate.set(name, current)
  }
  return Array.from(aggregate.entries()).map(([name, value]) => ({
    name,
    revenue: value.revenue,
    orders: orderMetric ? value.orderIds.size : null,
    customers: customerMetric ? value.customerIds.size : null,
  }))
}

function buildEcommerceRows(): Row[] {
  const generated: Row[] = []
  const localIndexByCountry = new Map<string, number>()
  // 113 customers bound to exactly one country each: 5 countries carry 13
  // customers and 4 countries carry 12, so per-country distinct customer
  // counts sum to the global distinct count (the strongest observable form of
  // equal aggregation scope).
  const customersPerCountry = (countryIndex: number) => (countryIndex < 5 ? 13 : 12)
  for (let index = 0; index < FULL_ROWS; index += 1) {
    // First 178 rows spread over 2026-01-01..2026-03-30; the trailing 42 rows
    // land inside the last 30 days (2026-03-31..2026-04-30).
    const date = index < FULL_ROWS - WINDOW_ROWS
      ? new Date(Date.UTC(2026, 0, 1) + (index % 89) * 86400000)
      : new Date(Date.UTC(2026, 2, 31) + ((index - (FULL_ROWS - WINDOW_ROWS)) % 31) * 86400000)
    const countryIndex = index % COUNTRIES.length
    const country = COUNTRIES[countryIndex]
    const localIndex = localIndexByCountry.get(country) ?? 0
    localIndexByCountry.set(country, localIndex + 1)
    const quantity = index < 6 ? 4 : 3
    const revenue = 397.36 + (index === 0 ? 1 : 0)
    generated.push({
      order_id: `ORD-${String(index + 1).padStart(5, "0")}`,
      order_date: date.toISOString().slice(0, 10),
      customer_id: `C-${String(countryIndex + 1).padStart(2, "0")}-${String((localIndex % customersPerCountry(countryIndex)) + 1).padStart(3, "0")}`,
      country,
      region: countryIndex % 3 === 0 ? "Europe" : countryIndex % 3 === 1 ? "North America" : "Oceania",
      product_id: `P-${String((index % FULL_PRODUCTS) + 1).padStart(3, "0")}`,
      product_name: `Product ${(index % FULL_PRODUCTS) + 1}`,
      category: "Electronics",
      quantity,
      unit_price: Number((revenue / quantity).toFixed(2)),
      revenue,
      shipping_cost: 10,
      discount: 0,
      return_status: "Not returned",
      channel: "Amazon",
      payment_method: "Card",
    })
  }
  const customerTotal = COUNTRIES.reduce((total, _country, countryIndex) => total + customersPerCountry(countryIndex), 0)
  assert.equal(customerTotal, FULL_CUSTOMERS, "generator must allocate the audited customer cardinality")
  assert.equal(distinct(generated, "customer_id"), FULL_CUSTOMERS, "generator must produce the audited customer cardinality")
  assert.equal(distinct(generated, "product_id"), FULL_PRODUCTS, "generator must produce the audited product cardinality")
  assert.equal(sumColumn(generated, "quantity"), FULL_UNITS, "generator must produce the audited unit total")
  assert.equal(round2(sumColumn(generated, "revenue")), FULL_REVENUE, "generator must produce the audited revenue total")
  return generated
}

function datasetInput(input: { id: string; rows: Row[] }) {
  const columns = Object.keys(input.rows[0] ?? {})
  return {
    id: input.id,
    name: `Map scope dataset ${input.id}`,
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
    createdAt: new Date("2026-09-22T00:00:00.000Z"),
    updatedAt: new Date("2026-09-22T00:00:00.000Z"),
    analysis: { uploadSource: "standard" },
    aiInsights: null,
    precomputedMetrics: null,
    detectedColumns: null,
  }
}

function distinct(rows: Row[], column: string) {
  return new Set(rows.map((row) => String(row[column] ?? "").trim()).filter(Boolean)).size
}

function sumColumn(rows: Row[], column: string) {
  return rows.reduce((total, row) => total + (typeof row[column] === "number" ? row[column] as number : 0), 0)
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

function parseDate(value: unknown) {
  if (typeof value !== "string") return null
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) ? parsed : null
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
