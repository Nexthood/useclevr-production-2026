import type { GeographicMetric, MetricKey } from "@/components/dashboard/geographic-revenue-map"
import { normalizeCountry } from "@/lib/geo/normalize-country"

export type GeographicMetricValue = number | null

export type GeographicOrderMetric = {
  column: string
  mode: "distinct" | "sum"
}

export const UNAVAILABLE_METRIC_LABEL = "N/A"

// Entity fields that must never become order or customer metrics: investor
// portfolio records, company identifiers, and other business objects.
const RESERVED_ENTITY_PATTERN =
  /company|portfolio|invest|fund|stake|ownership|equity|valuation|supplier|vendor|employee|store|warehouse|product|item|sku|brand|channel|campaign|region|country|city|state|market|date|month|year|currency|status|category|sector|stage|plan|name|email|address|phone/

const ORDER_ID_FIELDS = new Set([
  "order_id",
  "orderid",
  "order_number",
  "order_no",
  "order_ref",
  "order_reference",
  "order_code",
  "transaction_id",
  "transaction_number",
  "transaction_ref",
  "transaction_reference",
  "invoice_id",
  "invoice_number",
  "invoice_no",
  "receipt_id",
  "receipt_number",
])

const ORDER_COUNT_FIELDS = new Set([
  "order",
  "orders",
  "order_count",
  "orders_count",
  "number_of_orders",
  "transaction",
  "transactions",
  "invoice",
  "invoices",
])

const CUSTOMER_ID_FIELDS = new Set([
  "customer_id",
  "customerid",
  "customer",
  "customer_number",
  "customer_no",
  "customer_code",
  "client_id",
  "client",
  "client_number",
  "buyer_id",
  "buyer",
])

const NUMERIC_TEXT_PATTERN = /^[+-]?(\d+(\.\d*)?|\.\d+)$/

export function normalizeGeographicColumnName(column: string) {
  return column
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
}

export function readGeographicNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!NUMERIC_TEXT_PATTERN.test(trimmed)) return null
  const parsed = Number.parseFloat(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

// Orders require an explicit order/transaction/invoice identity or count field.
// Row counts, revenue, generic identifiers, and company identifiers never
// become orders.
export function detectGeographicOrderMetric(
  columns: string[],
  rows: Record<string, unknown>[] = [],
): GeographicOrderMetric | null {
  const normalizedColumns = columns
    .map((column) => ({ column, normalized: normalizeGeographicColumnName(column) }))
    .filter((entry) => !RESERVED_ENTITY_PATTERN.test(entry.normalized))

  const idField = normalizedColumns.find((entry) => ORDER_ID_FIELDS.has(entry.normalized))
  if (idField) return { column: idField.column, mode: "distinct" }

  const countField = normalizedColumns.find((entry) => ORDER_COUNT_FIELDS.has(entry.normalized))
  if (!countField) return null
  if (rows.length === 0) return { column: countField.column, mode: "distinct" }
  return isMostlyNumericColumn(rows, countField.column)
    ? { column: countField.column, mode: "sum" }
    : { column: countField.column, mode: "distinct" }
}

// Customers require an explicit customer/client/buyer identity field.
// company_id, portfolio_company, and investor records never become customers.
export function detectGeographicCustomerMetric(
  columns: string[],
  rows: Record<string, unknown>[] = [],
): { column: string } | null {
  const normalizedColumns = columns
    .map((column) => ({ column, normalized: normalizeGeographicColumnName(column) }))
    .filter((entry) => !RESERVED_ENTITY_PATTERN.test(entry.normalized))

  const idField = normalizedColumns.find((entry) => CUSTOMER_ID_FIELDS.has(entry.normalized))
  if (!idField) return null
  if (rows.length === 0) return { column: idField.column }
  return columnHasRecognizedValues(rows, idField.column) ? { column: idField.column } : null
}

function isMostlyNumericColumn(rows: Record<string, unknown>[], column: string) {
  const values = rows
    .map((row) => row[column])
    .filter((value) => value !== null && value !== undefined && String(value).trim() !== "")
  if (values.length === 0) return false
  const numeric = values.filter((value) => readGeographicNumber(value) !== null).length
  return numeric / values.length >= 0.5
}

function columnHasRecognizedValues(rows: Record<string, unknown>[], column: string) {
  return rows.some((row) => String(row[column] ?? "").trim() !== "")
}

export function readDistinctGeographicEntities(rows: Record<string, unknown>[], column: string): number {
  const entities = new Set<string>()
  for (const row of rows) {
    const value = String(row[column] ?? "").trim()
    if (value) entities.add(value)
  }
  return entities.size
}

export function readSummedGeographicMetric(rows: Record<string, unknown>[], column: string): number {
  let total = 0
  for (const row of rows) {
    const value = readGeographicNumber(row[column])
    if (value !== null) total += value
  }
  return total
}

// null + null = null; null + n = n; n + null = n; n + m = n + m
export function mergeGeographicMetricValues(
  base: number | null | undefined,
  addition: number | null | undefined,
): number | null {
  if (addition === null || addition === undefined || !Number.isFinite(addition)) return base ?? null
  if (base === null || base === undefined || !Number.isFinite(base)) return addition
  return base + addition
}

// Sum measured values; null only when no measured value exists.
export function sumMeasuredGeographicValues(values: (number | null | undefined)[]): number | null {
  let total: number | null = null
  for (const value of values) {
    if (value === null || value === undefined || !Number.isFinite(value)) continue
    total = total === null ? value : total + value
  }
  return total
}

export function collectAvailableGeographicMetrics(regions: GeographicMetric[]): MetricKey[] {
  const available = new Set<MetricKey>(["datasets"])
  if (regions.some((region) => region.revenue !== null && region.revenue !== undefined)) available.add("revenue")
  if (regions.some((region) => region.orders !== null && region.orders !== undefined)) available.add("orders")
  if (regions.some((region) => region.customers !== null && region.customers !== undefined)) available.add("customers")
  return Array.from(available)
}

export type WorldMapRegion = {
  name: string
  countryCode?: string
  latitude?: number
  longitude?: number
  revenue: number | null
  orders: number | null
  customers?: number | null
  datasets?: number
  profit?: number
  margin?: number | null
  growth?: number | null
  topCategory?: string
  topProduct?: string
}

export type AggregateWorldMapRegionsResult = {
  mapped: GeographicMetric[]
  unmapped: number
  availableMetrics: MetricKey[]
}

// Aggregates per-country world map metrics with explicit availability:
// missing orders/customers stay null (unavailable) and measured zeros stay 0.
export function aggregateWorldMapRegions(regions: WorldMapRegion[]): AggregateWorldMapRegionsResult {
  const aggregate = new Map<string, GeographicMetric>()
  let unmappedCount = 0

  for (const region of regions || []) {
    const normalized = normalizeCountry(region.countryCode || region.name)
    const hasExplicitCoordinates = Number.isFinite(region.latitude) && Number.isFinite(region.longitude)

    if (!normalized && !hasExplicitCoordinates) {
      unmappedCount += 1
      if (process.env.NODE_ENV !== "production") {
        console.warn("[WorldMapRevenue] Unmapped geographic location excluded from map", region.name)
      }
      continue
    }

    const locationKey = normalized?.countryCode || region.name
    const existing = aggregate.get(locationKey) || {
      countryCode: locationKey,
      countryName: normalized?.countryName || region.name,
      latitude: (hasExplicitCoordinates ? Number(region.latitude) : normalized?.latitude) ?? 0,
      longitude: (hasExplicitCoordinates ? Number(region.longitude) : normalized?.longitude) ?? 0,
      revenue: null,
      orders: null,
      customers: null,
      datasets: 0,
    }

    existing.revenue = mergeGeographicMetricValues(existing.revenue, region.revenue ?? null)
    existing.orders = mergeGeographicMetricValues(existing.orders, region.orders ?? null)
    existing.customers = mergeGeographicMetricValues(existing.customers, region.customers ?? null)
    existing.datasets = (existing.datasets || 0) + (region.datasets || 0)
    aggregate.set(locationKey, existing)
  }

  const mapped = Array.from(aggregate.values())
  return {
    mapped,
    unmapped: unmappedCount,
    availableMetrics: collectAvailableGeographicMetrics(mapped),
  }
}
