/**
 * Canonical deterministic financial metrics resolver.
 *
 * One authoritative normalizer for supported deterministic financial sources so
 * dashboard features never independently guess financial field names. The first
 * supported source is the Profitability analysis: authoritative totals are
 * stored on the dataset (precomputedMetrics, with the same payload nested under
 * analysis.profitability), not in row-level data.
 *
 * The resolver never fabricates metrics: COGS, gross profit, and gross margin
 * stay unavailable unless the source defines them, and operating expenses are
 * never reinterpreted as COGS.
 */

export type CanonicalFinancialSourceType = "profitability"

export type CanonicalFinancialMetrics = {
  sourceType: CanonicalFinancialSourceType
  sourceDatasetId: string | null
  revenue: number | null
  operatingExpenses: number | null
  cogs: number | null
  grossProfit: number | null
  operatingProfit: number | null
  netProfit: number | null
  grossMargin: number | null
  operatingMargin: number | null
  netMargin: number | null
  confidence: number | null
  availableFields: string[]
  missingFields: string[]
}

type CanonicalFinancialDatasetInput = {
  id?: string | null
  datasetType?: string | null
  analysis?: unknown
  precomputedMetrics?: unknown
}

const FINANCIAL_FIELD_KEYS = [
  "revenue",
  "operatingExpenses",
  "cogs",
  "grossProfit",
  "operatingProfit",
  "netProfit",
  "grossMargin",
  "operatingMargin",
  "netMargin",
] as const

const PROFITABILITY_MARKER_KEYS = [
  "profitabilityAnalysisId",
  "profitability_analysis_id",
  "hasRevenue",
  "hasExpenses",
  "hasBothFiles",
  "operatingExpenseCoverage",
  "profitabilityFileRole",
  "profitability_file_role",
] as const

/**
 * Stored Profitability payload accessor for consumers that need the canonical
 * aggregates recorded at upload time (expense categories, revenue composition,
 * provenance notes). Read-only: it never recomputes or fabricates metrics.
 */
export function resolveCanonicalProfitabilityPayload(
  dataset: CanonicalFinancialDatasetInput | null | undefined,
): Record<string, unknown> | null {
  if (!dataset) return null
  return profitabilityPayload(dataset)
}

export function resolveCanonicalFinancialMetrics(
  dataset: CanonicalFinancialDatasetInput | null | undefined,
): CanonicalFinancialMetrics | null {
  if (!dataset) return null
  const payload = profitabilityPayload(dataset)
  if (!payload) return null
  const revenue = canonicalNumber(payload.totalRevenue) ?? canonicalNumber(payload.revenue)
  const cogs = canonicalNumber(payload.cogs)
  const grossProfit = canonicalNumber(payload.grossProfit)
  const operatingExpenses =
    canonicalNumber(payload.operatingExpenses) ??
    // Legacy payloads may only carry totalExpenses; that value equals operating
    // expenses only when no COGS/interest/tax component is stored separately.
    (cogs === null &&
    canonicalNumber(payload.interestExpense) === null &&
    canonicalNumber(payload.taxExpense) === null
      ? canonicalNumber(payload.totalExpenses)
      : null)
  const operatingProfit =
    canonicalNumber(payload.operatingProfit) ??
    (revenue !== null && operatingExpenses !== null ? round2(revenue - operatingExpenses) : null)
  const netProfit = canonicalNumber(payload.netProfit) ?? canonicalNumber(payload.profit)
  const grossMargin = canonicalNumber(payload.grossMargin) ?? margin(grossProfit, revenue)
  const operatingMargin =
    canonicalNumber(payload.operatingMargin) ??
    canonicalNumber(payload.margin) ??
    margin(operatingProfit, revenue)
  const netMargin = canonicalNumber(payload.netMargin) ?? margin(netProfit, revenue)

  const values: Record<(typeof FINANCIAL_FIELD_KEYS)[number], number | null> = {
    revenue,
    operatingExpenses,
    cogs,
    grossProfit,
    operatingProfit,
    netProfit,
    grossMargin,
    operatingMargin,
    netMargin,
  }
  const availableFields = FINANCIAL_FIELD_KEYS.filter((key) => values[key] !== null)
  const missingFields = FINANCIAL_FIELD_KEYS.filter((key) => values[key] === null)

  return {
    sourceType: "profitability",
    sourceDatasetId: typeof dataset.id === "string" && dataset.id ? dataset.id : null,
    revenue,
    operatingExpenses,
    cogs,
    grossProfit,
    operatingProfit,
    netProfit,
    grossMargin,
    operatingMargin,
    netMargin,
    confidence: canonicalNumber(payload.dataConfidence),
    availableFields: [...availableFields],
    missingFields: [...missingFields],
  }
}

/**
 * Original input-file provenance for Profitability datasets. The paired upload
 * workflow serializes source files to CSV for transport, so the transport file
 * name must never overwrite the original source format. Returns the original
 * file names from immutable stored metadata when the dataset is profitability.
 */
export function profitabilityOriginalFileNames(dataset: {
  datasetType?: string | null
  analysis?: unknown
  precomputedMetrics?: unknown
  columnMapping?: unknown
}): string[] {
  if (!isProfitabilityDataset(dataset)) return []
  const names: string[] = []
  const payloads = [
    dataset.precomputedMetrics,
    dataset.analysis && isRecord(dataset.analysis) ? dataset.analysis.profitability : null,
    dataset.columnMapping,
  ]
  for (const payload of payloads) {
    if (!isRecord(payload) || !Array.isArray(payload.sourceFiles)) continue
    for (const sourceFile of payload.sourceFiles) {
      if (!isRecord(sourceFile)) continue
      const name = typeof sourceFile.name === "string" ? sourceFile.name.trim() : ""
      if (name) names.push(name)
    }
    if (names.length > 0) return names
  }
  return []
}

function profitabilityPayload(dataset: CanonicalFinancialDatasetInput): Record<string, unknown> | null {
  const nested = isRecord(dataset.analysis) && isRecord(dataset.analysis.profitability) ? dataset.analysis.profitability : null
  const precomputed = isRecord(dataset.precomputedMetrics) ? dataset.precomputedMetrics : null
  if (isProfitabilityDataset(dataset)) return precomputed ?? nested
  return null
}

function isProfitabilityDataset(dataset: CanonicalFinancialDatasetInput): boolean {
  if (typeof dataset.datasetType === "string" && dataset.datasetType.trim().toLowerCase() === "profitability") return true
  const payloads = [
    isRecord(dataset.analysis) && isRecord(dataset.analysis.profitability) ? dataset.analysis.profitability : null,
    isRecord(dataset.precomputedMetrics) ? dataset.precomputedMetrics : null,
  ]
  return payloads.some(
    (payload) =>
      Boolean(payload) &&
      PROFITABILITY_MARKER_KEYS.some((key) => Object.prototype.hasOwnProperty.call(payload, key)),
  )
}

function canonicalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function margin(profit: number | null, revenue: number | null): number | null {
  return profit !== null && revenue !== null && revenue !== 0 ? round2((profit / revenue) * 100) : null
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}
