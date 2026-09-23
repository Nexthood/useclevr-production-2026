import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import Papa from "papaparse"
import * as XLSX from "xlsx"

import { parseCanonicalDate } from "../../src/lib/data/canonical-date"
import {
  aggregateWorldMapRegions,
  detectGeographicLocationColumn,
  detectGeographicCustomerMetric,
  detectGeographicOrderMetric,
  type WorldMapRegion,
} from "../../src/lib/data/geographic-metric-semantics"
import {
  analyzeBusinessData,
  detectBusinessColumns,
  profitDefinitionLabel,
  type BusinessKPIs,
} from "../../src/lib/business/business-columns"

const fixtureRoot = "test-fixtures/business-models"

function loadFixture(base: string): Record<string, unknown>[] {
  const workbook = XLSX.read(readFileSync(`${fixtureRoot}/${base}`), { type: "buffer" })
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]])
}

function loadCsv(base: string): Record<string, unknown>[] {
  const parsed = Papa.parse<Record<string, unknown>>(readFileSync(`${fixtureRoot}/${base}`, "utf-8"), {
    header: true,
    skipEmptyLines: true,
  })
  return parsed.data
}

function analyze(rows: Record<string, unknown>[]): { detected: ReturnType<typeof detectBusinessColumns>; kpis: BusinessKPIs } {
  const detected = detectBusinessColumns(rows)
  return { detected, kpis: analyzeBusinessData(rows, detected).kpis }
}

function mappedCountries(rows: Record<string, unknown>[], locationColumn: string | null): { mapped: number; unmapped: number } {
  if (!locationColumn) return { mapped: 0, unmapped: 0 }
  const names = new Set(rows.map((row) => String(row[locationColumn] ?? "").trim()).filter(Boolean))
  const regions: WorldMapRegion[] = Array.from(names).map((name) => ({ name, revenue: 1, orders: null, customers: null }))
  const aggregated = aggregateWorldMapRegions(regions)
  return { mapped: aggregated.mapped.length, unmapped: aggregated.unmapped }
}

function main() {
  // ---------------------------------------------------------------------------
  // Canonical geographic location resolver: token matching, never substrings
  // ---------------------------------------------------------------------------
  const geoRows = [
    { country: "Germany", region: "Bavaria", marketing_spend: 10, market_share: 0.2, marketplace_revenue: 5, market: "DACH", store_count: 3 },
    { country: "France", region: "Ile-de-France", marketing_spend: 700, market: "EU", store_count: 4 },
  ]
  const geoColumns = Object.keys(geoRows[0])
  assert.deepEqual(
    detectGeographicLocationColumn(geoColumns, geoRows, { scope: "country" }),
    { column: "country", scope: "country" },
    "country tier wins for country scope",
  )
  assert.deepEqual(
    detectGeographicLocationColumn(geoColumns, geoRows, { scope: "regional" }),
    { column: "region", scope: "regional" },
    "region resolves as a regional location",
  )
  assert.deepEqual(
    detectGeographicLocationColumn(geoColumns, geoRows),
    { column: "country", scope: "country" },
    "country tier wins by default so Dashboard and Analyzer share one location column",
  )

  // Substring look-alikes never become geography.
  const decoyColumns = ["marketing_spend", "market_share", "marketplace_revenue", "revenue", "time_zone", "unit_price"]
  assert.equal(detectGeographicLocationColumn(decoyColumns, []), null, "measure-like columns are never location columns")

  // Compound country columns resolve.
  assert.equal(
    detectGeographicLocationColumn(["ship_to_country", "revenue"], [])?.column,
    "ship_to_country",
    "ship_to_country resolves as country geography",
  )
  assert.equal(
    detectGeographicLocationColumn(["country_code", "revenue"], [])?.column,
    "country_code",
    "country_code resolves as country geography",
  )

  // Numeric values never qualify a location column.
  assert.equal(detectGeographicLocationColumn(["market"], [{ market: 12.5 }, { market: 13.5 }]), null, "numeric market values are not locations")

  // ---------------------------------------------------------------------------
  // Fake-date prevention: identifiers, decimals, and money columns are not dates
  // Bare four-digit numbers stay canonical years at the parser level; the
  // business-column detector applies the plausible-year rule (1900-2100) when
  // it elects a date column, so money values like 2555 never become a time axis
  // (pinned by the local-retail fixture assertions below).
  // ---------------------------------------------------------------------------
  for (const value of ["ORD-00001", "CUS-0001", "PC-001", "35.5", "5/12"]) {
    assert.equal(parseCanonicalDate(value), null, `${value} must never parse as a date`)
  }
  for (const value of ["2026-01-01", "2026-01-01T10:00:00Z", "01/15/2026", "15-01-2026", "20260101", "2026-04", "Jan 5, 2026"]) {
    assert.notEqual(parseCanonicalDate(value), null, `${value} remains a supported canonical date`)
  }

  // ---------------------------------------------------------------------------
  // Regression fixture 02_ecommerce.xlsx: geography, metrics, and parity
  // ---------------------------------------------------------------------------
  const ecommerceRows = loadFixture("02_ecommerce.xlsx")
  const ecommerceCsvRows = loadCsv("02_ecommerce.csv")
  const ecommerceDetected = detectBusinessColumns(ecommerceRows)
  const ecommerceKpis = analyzeBusinessData(ecommerceRows, ecommerceDetected).kpis

  // Regression fingerprint of the shared ecommerce fixture (tests only).
  assert.equal(ecommerceRows.length, 220, "fixture loads all 220 rows")
  assert.equal(
    detectGeographicOrderMetric(Object.keys(ecommerceRows[0]), ecommerceRows)?.column,
    "order_id",
    "orders resolve from order_id",
  )
  assert.equal(
    detectGeographicCustomerMetric(Object.keys(ecommerceRows[0]), ecommerceRows)?.column,
    "customer_id",
    "customers resolve from customer_id",
  )

  // Geography: the canonical location column is country-level, matching the
  // Dashboard, and every location value normalizes to a mapped country.
  assert.equal(ecommerceDetected.regionColumn, "country", "ecommerce geography resolves to the country column")
  assert.equal(ecommerceDetected.fallbackRegionColumn, "country", "fallback carries the same canonical column")
  const ecommerceMap = mappedCountries(ecommerceRows, ecommerceDetected.regionColumn)
  assert.equal(ecommerceMap.mapped, 5, "every fixture country maps through country normalization")
  assert.equal(ecommerceMap.unmapped, 0, "no unmapped ecommerce locations")

  // CSV and XLSX variants of the same semantic dataset resolve identically.
  const ecommerceCsvDetected = detectBusinessColumns(ecommerceCsvRows)
  assert.equal(ecommerceCsvDetected.regionColumn, ecommerceDetected.regionColumn, "csv and xlsx variants share the location column")
  assert.equal(ecommerceCsvDetected.dateColumn, ecommerceDetected.dateColumn, "csv and xlsx variants share the date column")

  // Metric provenance.
  assert.equal(ecommerceKpis.profitDefinition, "cost_component_profit", "ecommerce profit follows recognized cost components")
  assert.ok(ecommerceKpis.totalProfit !== null && ecommerceKpis.totalProfit < (ecommerceKpis.totalRevenue ?? 0), "profit stays below revenue")
  assert.equal(ecommerceKpis.profitReliability, "verified", "recognized cost components count as verified provenance")
  assert.ok(ecommerceKpis.profitSourceColumns.includes("revenue"), "profit provenance names the revenue input")
  assert.equal(ecommerceKpis.avgRevenueBasis, "order", "average revenue uses the distinct order denominator")
  assert.equal(ecommerceDetected.dateColumn, "order_date", "the real date column is used, not order_id")
  assert.equal(ecommerceKpis.growthValid, true, "growth is computed from real dates")
  assert.deepEqual(
    ecommerceKpis.dateRange,
    { start: "2026-01-01", end: "2026-04-30" },
    "date range comes from the canonical date column",
  )

  // Geography parity: the KPI engine's region buckets must all normalize to
  // mapped countries, matching the map aggregation for the same rows.
  const analyzerRegionEntries = Object.keys(analyzeBusinessData(ecommerceRows, ecommerceDetected).breakdowns.revenueByRegion)
  const analyzerMap = aggregateWorldMapRegions(
    analyzerRegionEntries.map((name) => ({ name, revenue: 1, orders: null, customers: null })),
  )
  assert.equal(analyzerMap.unmapped, 0, "analyzer region buckets are all mappable countries")
  assert.equal(analyzerMap.mapped.length, ecommerceMap.mapped, "analyzer buckets and map aggregation agree on mapped countries")

  // ---------------------------------------------------------------------------
  // Profit provenance: source profit column is authoritative, never ignored
  // ---------------------------------------------------------------------------
  const sourceProfitRows = [
    { order_id: "O-1", revenue: 100, profit: 30, country: "Germany", shipping_cost: 5 },
    { order_id: "O-2", revenue: 200, profit: 60, country: "Germany", shipping_cost: 5 },
  ]
  const sourceProfitDetected = detectBusinessColumns(sourceProfitRows)
  const sourceProfitKpis = analyzeBusinessData(sourceProfitRows, sourceProfitDetected).kpis
  assert.equal(sourceProfitKpis.totalProfit, 90, "source profit column is summed, not revenue-minus-costs")
  assert.equal(sourceProfitKpis.profitDefinition, "source_profit", "source profit definition is reported")
  assert.deepEqual(sourceProfitKpis.profitSourceColumns, ["profit"], "profit provenance names the source field")

  // Missing profit evidence is labeled estimated, never fabricated.
  const noProfitRows = [
    { order_id: "O-1", revenue: 100, country: "Germany" },
    { order_id: "O-2", revenue: 200, country: "France" },
  ]
  const noProfitKpis = analyzeBusinessData(noProfitRows, detectBusinessColumns(noProfitRows)).kpis
  assert.equal(noProfitKpis.profitDefinition, "estimated_margin_profit", "margin-based profit is labeled as estimated")
  assert.equal(noProfitKpis.profitReliability, "derived", "estimated profit reports derived reliability")

  // Genuine zero stays zero; a dataset without profit evidence stays unavailable.
  const zeroProfitRows = [
    { order_id: "O-1", revenue: 100, profit: 0, country: "Germany" },
    { order_id: "O-2", revenue: 200, profit: 0, country: "France" },
  ]
  const zeroProfitKpis = analyzeBusinessData(zeroProfitRows, detectBusinessColumns(zeroProfitRows)).kpis
  assert.equal(zeroProfitKpis.totalProfit, 0, "a genuine zero profit column stays zero")

  const mrrRows = [
    { month: "2026-01", customer_id: "C-1", mrr: 99, country: "Germany" },
    { month: "2026-02", customer_id: "C-2", mrr: 120, country: "France" },
  ]
  const mrrKpis = analyzeBusinessData(mrrRows, detectBusinessColumns(mrrRows)).kpis
  assert.equal(mrrKpis.totalRevenue, null, "MRR-only data has no fabricated revenue")
  assert.equal(mrrKpis.totalProfit, null, "MRR-only data has no fabricated profit")
  assert.equal(mrrKpis.profitDefinition, "unavailable", "profit stays unavailable without evidence")

  // Margin columns are ratios and never become additive profit sources.
  const marginRows = [
    { client_id: "c1", revenue: 1000, gross_margin: 49.6, consultant_cost: 400 },
    { client_id: "c2", revenue: 1200, gross_margin: 52.1, consultant_cost: 450 },
  ]
  const marginKpis = analyzeBusinessData(marginRows, detectBusinessColumns(marginRows)).kpis
  assert.notEqual(marginKpis.profitDefinition, "source_profit", "margin percentages never become a profit source field")
  assert.notEqual(
    marginKpis.totalProfit,
    marginRows.reduce((sum, row) => sum + (row.gross_margin as number), 0),
    "margin percentages are never summed as profit",
  )

  // ---------------------------------------------------------------------------
  // Cross-dataset regression matrix over the shared fixtures
  // ---------------------------------------------------------------------------
  const localRetailRows = loadFixture("01_local_retail.xlsx")
  const localRetailDetected = detectBusinessColumns(localRetailRows)
  const localRetailKpis = analyzeBusinessData(localRetailRows, localRetailDetected).kpis
  assert.equal(localRetailDetected.regionColumn, "location", "retail store locations resolve as geography")
  assert.equal(localRetailDetected.revenueColumn, "revenue", "retail revenue resolves")
  assert.equal(localRetailDetected.dateColumn, null, "single-period inventory snapshots expose no time axis")
  assert.equal(localRetailKpis.profitDefinition, "cost_component_profit", "retail profit follows recognized unit costs")
  assert.equal(localRetailKpis.avgRevenueBasis, "row", "retail rows without order identity average per row")

  const saasRows = loadFixture("03_saas_startup.xlsx")
  const saasDetected = detectBusinessColumns(saasRows)
  const saasKpis = analyzeBusinessData(saasRows, saasDetected).kpis
  assert.equal(saasDetected.dateColumn, "month", "SaaS monthly periods resolve")
  assert.equal(saasKpis.totalRevenue, null, "MRR movements do not fabricate generic revenue")
  assert.equal(saasKpis.totalProfit, null, "SaaS movements do not fabricate profit")

  const marketplaceRows = loadFixture("04_marketplace_startup.xlsx")
  const marketplaceDetected = detectBusinessColumns(marketplaceRows)
  const marketplaceKpis = analyzeBusinessData(marketplaceRows, marketplaceDetected).kpis
  assert.equal(marketplaceDetected.revenueColumn, null, "marketplace GMV never becomes company revenue")
  assert.equal(marketplaceDetected.productColumn, null, "GMV never becomes a product field")
  assert.equal(marketplaceDetected.regionColumn, "country", "marketplace country column resolves")
  assert.equal(marketplaceKpis.totalRevenue, null, "refund amounts never fabricate marketplace revenue")
  assert.equal(marketplaceKpis.totalProfit, null, "marketplace refunds never fabricate profit")
  const marketplaceMap = mappedCountries(marketplaceRows, marketplaceDetected.regionColumn)
  assert.equal(marketplaceMap.unmapped, 0, "marketplace country codes map through country normalization")

  const investorRows = loadFixture("investor-portfolio.xlsx")
  const investorDetected = detectBusinessColumns(investorRows)
  const investorKpis = analyzeBusinessData(investorRows, investorDetected).kpis
  assert.equal(investorDetected.regionColumn, "country", "investor portfolio geography resolves from country")
  assert.equal(investorDetected.dateColumn, null, "valuation percentages never become a time axis")
  assert.equal(investorKpis.avgRevenueBasis, "row", "investor records without order identity average per row")

  // Generic business dataset: honest unavailability and per-row averages.
  const genericRows = [
    { date: "2026-01-15", department: "sales", revenue: 1200 },
    { date: "2026-02-15", department: "ops", revenue: 800 },
  ]
  const genericDetected = detectBusinessColumns(genericRows)
  assert.equal(genericDetected.dateColumn, "date", "generic business dates resolve")
  assert.equal(genericDetected.regionColumn, null, "a dataset without location columns is non-geographic")
  const genericKpis = analyzeBusinessData(genericRows, genericDetected).kpis
  assert.equal(genericKpis.profitDefinition, "estimated_margin_profit", "generic profit is estimated and labeled")

  // ---------------------------------------------------------------------------
  // Row scope: KPI totals always cover every row passed in (no hidden limits)
  // ---------------------------------------------------------------------------
  const scopeRows = Array.from({ length: 500 }, (_, index) => ({
    order_id: `O-${index + 1}`,
    order_date: "2026-03-15",
    customer_id: `C-${(index % 50) + 1}`,
    country: "Germany",
    revenue: 10,
  }))
  const scopeKpis = analyzeBusinessData(scopeRows, detectBusinessColumns(scopeRows)).kpis
  assert.equal(scopeKpis.totalRevenue, 5000, "revenue sums every provided row")
  assert.equal(scopeKpis.avgRevenueBasis, "order", "order identity drives the average basis")

  // ---------------------------------------------------------------------------
  // Shared-implementation invariants (Dashboard, Dataset Analyzer, detector)
  // ---------------------------------------------------------------------------
  const analyzerSource = readFileSync("src/components/dataset/dataset-analyzer.tsx", "utf-8")
  const dashboardSource = readFileSync("src/app/(auth)/app/page.tsx", "utf-8")
  const detectorSource = readFileSync("src/lib/business/business-columns.ts", "utf-8")

  assert.ok(
    analyzerSource.includes("detectGeographicLocationColumn"),
    "Dataset Analyzer resolves geography through the canonical location resolver",
  )
  assert.ok(
    analyzerSource.includes("detected?.regionColumn || detected?.fallbackRegionColumn"),
    "Dataset Analyzer geography capability accepts the canonical country fallback",
  )
  assert.ok(
    !analyzerSource.includes("data.revenue * 0.3"),
    "Dataset Analyzer map never fabricates profit from revenue",
  )
  assert.ok(
    !analyzerSource.includes("GEOGRAPHIC_COLUMNS"),
    "the legacy substring geography detector is removed from the Dataset Analyzer",
  )
  assert.ok(
    dashboardSource.includes("detectGeographicLocationColumn"),
    "Dashboard region resolution shares the canonical location resolver",
  )
  assert.ok(
    detectorSource.includes("detectGeographicLocationColumn"),
    "business column detection shares the canonical location resolver",
  )
  assert.ok(
    detectorSource.includes("parseCanonicalDate"),
    "date column detection uses the canonical date parser",
  )
  assert.ok(
    detectorSource.includes("REVENUE_RESERVED_PATTERN") && detectorSource.includes("gross_merchandise"),
    "refund and GMV fields never become revenue in the KPI engine",
  )

  // The analyze route stays owner-scoped (dataset isolation preserved).
  const analyzeRouteSource = readFileSync("src/app/api/datasets/[id]/analyze/route.ts", "utf-8")
  assert.ok(
    analyzeRouteSource.includes("eq(datasets.userId, userId)"),
    "analyze route reads datasets owner-scoped",
  )
  assert.ok(
    analyzeRouteSource.includes("parseCanonicalDate"),
    "analyze route classifies date columns with the canonical parser",
  )

  // Profit definition labels are defined for every resolved concept.
  for (const definition of ["source_profit", "cost_component_profit", "estimated_margin_profit", "unavailable"] as const) {
    assert.equal(typeof profitDefinitionLabel(definition), "string", `definition label exists for ${definition}`)
  }

  console.log("Dataset Analyzer semantics verification passed: canonical geography, profit provenance, canonical dates, and row scope hold across the cross-dataset matrix.")
}

main()
