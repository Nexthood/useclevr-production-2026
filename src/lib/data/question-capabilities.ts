/**
 * Universal question capability model.
 *
 * Suggested questions are derived from what UseClevr actually knows about the
 * ACTIVE dataset, not from dataset names or file names. Each question in the
 * registry declares the capabilities it requires; a question is only suggested
 * when every required capability is supported by the active dataset.
 *
 * Capability sources, in priority order:
 * 1. Canonical Profitability analysis context (`resolveCanonicalFinancialMetrics`
 *    plus the stored Profitability payload) for datasets whose authoritative
 *    totals live in precomputed canonical metrics instead of row-level data.
 * 2. Semantic schema field mappings (`buildSemanticSchema`) for row-level
 *    datasets, reusing the existing semantic capability detection.
 *
 * The model never fabricates capabilities: a metric is supported only when the
 * canonical resolver or a validated semantic mapping provides it, and missing
 * metrics are exposed only as explanatory capabilities when the deterministic
 * provenance records why the metric is unavailable.
 */

import {
  resolveCanonicalFinancialMetrics,
  resolveCanonicalProfitabilityPayload,
  type CanonicalFinancialMetrics,
} from "@/lib/data/canonical-financial-metrics";
import {
  buildSemanticSchema,
  findExpenseTypeColumn,
} from "@/lib/data/semantic-schema";

export type QuestionCapabilityId =
  // Canonical financial metrics
  | "financial.revenue"
  | "financial.expenses"
  | "financial.cogs"
  | "financial.grossProfit"
  | "financial.grossMargin"
  | "financial.operatingProfit"
  | "financial.operatingMargin"
  | "financial.netProfit"
  | "financial.netMargin"
  | "financial.revenueExpenseRatio"
  | "financial.revenueGrowth"
  // Dataset composition capabilities
  | "expense.categories"
  | "expense.concentration"
  | "expense.vendor"
  | "revenue.composition"
  | "revenue.product"
  | "revenue.category"
  | "revenue.customer"
  | "revenue.region"
  | "revenue.timeseries"
  // Structural capabilities
  | "time.period"
  | "data.gapAnalysis";

export type MissingCapabilityExplanation = {
  capability: QuestionCapabilityId
  label: string
  reason: string
  explainable: boolean
}

export type QuestionCapabilityContext = {
  datasetId: string
  datasetName: string
  datasetType: string
  canonicalMetrics: CanonicalFinancialMetrics | null
  profitabilityPayload: Record<string, unknown> | null
  semanticMappings: Partial<Record<string, { field: string; column: string }>> | null
  hasExpenseTypeColumn: boolean
  hasRows: boolean
}

export type DerivedQuestionCapabilities = {
  supported: Partial<Record<QuestionCapabilityId, string[]>>
  missing: Partial<Record<QuestionCapabilityId, MissingCapabilityExplanation>>
}

export type SuggestedQuestionDefinition = {
  id: string
  question: string
  requires: QuestionCapabilityId[]
  /** When set, the question may be suggested only if this missing capability has a deterministic explanation. */
  explainsMissing?: QuestionCapabilityId
  domain: "financial" | "expense" | "revenue" | "data-quality"
}

const CAPABILITY_LABELS: Record<QuestionCapabilityId, string> = {
  "financial.revenue": "Revenue",
  "financial.expenses": "Operating expenses",
  "financial.cogs": "Cost of goods sold (COGS)",
  "financial.grossProfit": "Gross profit",
  "financial.grossMargin": "Gross margin",
  "financial.operatingProfit": "Operating profit",
  "financial.operatingMargin": "Operating margin",
  "financial.netProfit": "Net profit",
  "financial.netMargin": "Net margin",
  "financial.revenueExpenseRatio": "Revenue-to-expense ratio",
  "financial.revenueGrowth": "Revenue growth",
  "expense.categories": "Expense categories",
  "expense.concentration": "Expense concentration",
  "expense.vendor": "Expense vendors",
  "revenue.composition": "Revenue composition",
  "revenue.product": "Revenue by product",
  "revenue.category": "Revenue by category",
  "revenue.customer": "Revenue by customer",
  "revenue.region": "Revenue by region",
  "revenue.timeseries": "Revenue over time",
  "time.period": "Reporting periods",
  "data.gapAnalysis": "Recorded data gaps",
}

export const QUESTION_CAPABILITY_LABELS: Readonly<Record<QuestionCapabilityId, string>> = CAPABILITY_LABELS

/**
 * Registry order communicates usefulness: insight questions first, recorded
 * value questions next. Missing-data explanatory questions sit between so a
 * dataset with genuinely unavailable important metrics still surfaces them
 * within the 5-8 question budget.
 */
export const SUGGESTED_QUESTION_REGISTRY: readonly SuggestedQuestionDefinition[] = [
  { id: "operating-profit-drivers", question: "What is driving my operating profit?", requires: ["financial.operatingProfit", "financial.revenue", "financial.expenses"], domain: "financial" },
  { id: "expense-concentration", question: "Which expense categories have the biggest impact?", requires: ["expense.categories", "financial.expenses"], domain: "expense" },
  { id: "expense-reduction", question: "Where could I reduce costs?", requires: ["financial.expenses", "expense.categories"], domain: "expense" },
  { id: "top-revenue-source", question: "Which revenue source contributes the most?", requires: ["financial.revenue", "revenue.composition"], domain: "revenue" },
  { id: "revenue-expense-ratio", question: "What is my revenue-to-expense ratio?", requires: ["financial.revenueExpenseRatio"], domain: "financial" },
  { id: "gross-profit-unavailable", question: "Why is gross profit unavailable?", requires: [], explainsMissing: "financial.grossProfit", domain: "data-quality" },
  { id: "data-gap-analysis", question: "What additional data would make this analysis more complete?", requires: ["data.gapAnalysis"], domain: "data-quality" },
  { id: "financial-total-revenue", question: "What is my total revenue?", requires: ["financial.revenue"], domain: "financial" },
  { id: "financial-operating-profit", question: "What is my operating profit?", requires: ["financial.operatingProfit"], domain: "financial" },
  { id: "financial-operating-margin", question: "What is my operating margin?", requires: ["financial.operatingMargin"], domain: "financial" },
  { id: "financial-gross-margin", question: "What is my gross margin?", requires: ["financial.grossMargin"], domain: "financial" },
  { id: "revenue-timeseries", question: "How does my revenue change over time?", requires: ["revenue.timeseries"], domain: "revenue" },
  { id: "revenue-growth", question: "How has my revenue grown?", requires: ["financial.revenueGrowth"], domain: "revenue" },
  { id: "financial-net-profit", question: "What is my net profit?", requires: ["financial.netProfit"], domain: "financial" },
]

type CanonicalDatasetInput = {
  id?: string | null
  name?: string | null
  datasetType?: string | null
  analysis?: unknown
  precomputedMetrics?: unknown
}

export type QuestionCapabilityInput = {
  datasetId: string
  datasetName: string
  datasetType: string
  columns: string[]
  rows: Record<string, unknown>[]
  dataset?: CanonicalDatasetInput | null
}

/** Build the capability context for the active dataset only. */
export function deriveQuestionCapabilityContext(input: QuestionCapabilityInput): QuestionCapabilityContext {
  const dataset = input.dataset ?? null
  const canonicalMetrics = dataset ? resolveCanonicalFinancialMetrics(dataset) : null
  const profitabilityPayload = canonicalMetrics ? resolveCanonicalProfitabilityPayload(dataset) : null

  if (canonicalMetrics) {
    return {
      datasetId: input.datasetId,
      datasetName: input.datasetName,
      datasetType: input.datasetType,
      canonicalMetrics,
      profitabilityPayload,
      semanticMappings: null,
      hasExpenseTypeColumn: false,
      hasRows: input.rows.length > 0,
    }
  }

  const schema = buildSemanticSchema({
    datasetId: input.datasetId,
    datasetType: input.datasetType,
    columns: input.columns,
    rows: input.rows,
  })
  return {
    datasetId: input.datasetId,
    datasetName: input.datasetName,
    datasetType: input.datasetType,
    canonicalMetrics: null,
    profitabilityPayload: null,
    semanticMappings: schema.mappings as QuestionCapabilityContext["semanticMappings"],
    hasExpenseTypeColumn: findExpenseTypeColumn(input.rows, input.columns) !== null,
    hasRows: input.rows.length > 0,
  }
}

/**
 * Derive supported and explainable-missing capabilities from canonical or
 * semantic evidence. Deterministic only: no inference from labels alone.
 */
export function deriveQuestionCapabilities(context: QuestionCapabilityContext): DerivedQuestionCapabilities {
  if (context.canonicalMetrics) return deriveCanonicalCapabilities(context)
  return deriveSemanticCapabilities(context)
}

function deriveCanonicalCapabilities(context: QuestionCapabilityContext): DerivedQuestionCapabilities {
  const metrics = context.canonicalMetrics!
  const payload = context.profitabilityPayload
  const supported: Partial<Record<QuestionCapabilityId, string[]>> = {}
  const missing: Partial<Record<QuestionCapabilityId, MissingCapabilityExplanation>> = {}

  const financialCapabilities: Array<[QuestionCapabilityId, keyof CanonicalFinancialMetrics]> = [
    ["financial.revenue", "revenue"],
    ["financial.expenses", "operatingExpenses"],
    ["financial.cogs", "cogs"],
    ["financial.grossProfit", "grossProfit"],
    ["financial.grossMargin", "grossMargin"],
    ["financial.operatingProfit", "operatingProfit"],
    ["financial.operatingMargin", "operatingMargin"],
    ["financial.netProfit", "netProfit"],
    ["financial.netMargin", "netMargin"],
  ]
  for (const [capabilityId, metricKey] of financialCapabilities) {
    const value = metrics[metricKey]
    if (typeof value === "number" && Number.isFinite(value)) {
      supported[capabilityId] = [`Canonical ${metricKey} is available from the Profitability analysis.`]
    }
  }

  const expenseCategories = payloadTupleEntries(payload, "expenseCategories")
  if (expenseCategories.length > 0) {
    supported["expense.categories"] = [`${expenseCategories.length} recorded expense categories are available.`]
    if (expenseCategories.length >= 2) {
      supported["expense.concentration"] = ["Expense concentration is computable from recorded expense categories."]
    }
  }
  const expenseVendors = payloadTupleEntries(payload, "expensesByVendor")
  if (expenseVendors.length > 0) {
    supported["expense.vendor"] = [`${expenseVendors.length} recorded expense vendors are available.`]
  }

  const compositionSources: Array<[QuestionCapabilityId, string]> = [
    ["revenue.product", "revenueByProduct"],
    ["revenue.category", "revenueByCategory"],
    ["revenue.customer", "revenueByCustomer"],
    ["revenue.region", "revenueByRegion"],
  ]
  for (const [capabilityId, payloadKey] of compositionSources) {
    const entries = payloadTupleEntries(payload, payloadKey)
    if (entries.length > 0) supported[capabilityId] = [`${entries.length} recorded ${payloadKey} entries are available.`]
  }
  if (compositionSources.some(([capabilityId]) => supported[capabilityId])) {
    supported["revenue.composition"] = ["Recorded revenue composition by source is available."]
  }

  const periodTrends = payloadArrayEntries(payload, "periodTrends")
  if (periodTrends.length >= 2) {
    supported["revenue.timeseries"] = [`${periodTrends.length} recorded reporting periods are available.`]
    supported["time.period"] = [`${periodTrends.length} recorded reporting periods are available.`]
  } else if (Object.keys(payloadRecord(payload, "revenueByMonth")).length >= 2) {
    supported["revenue.timeseries"] = ["Monthly revenue buckets are available."]
    supported["time.period"] = ["Monthly revenue periods are available."]
  }

  const revenueExpenseRatio = payloadNumber(payload, "revenueExpenseRatio") ?? ratio(metrics.revenue, payloadNumber(payload, "totalExpenses") ?? metrics.operatingExpenses)
  if (revenueExpenseRatio !== null) {
    supported["financial.revenueExpenseRatio"] = ["Revenue and expense totals are recorded for the ratio."]
  }
  const revenueGrowth = payloadNumber(payload, "revenueGrowth")
  if (revenueGrowth !== null) {
    supported["financial.revenueGrowth"] = ["Canonical revenue growth is recorded for this analysis."]
  }

  const metricSources = payloadRecord(payload, "metricSources")
  const missingColumns = payloadStringList(payload, "missingColumns")
  const dataQualityNotes = payloadStringList(payload, "dataQualityNotes")
  if (missingColumns.length > 0 || dataQualityNotes.length > 0 || metricSources && hasUnavailableMetricSource(metricSources)) {
    supported["data.gapAnalysis"] = ["Recorded data gaps and provenance notes are available."]
  }

  for (const [capabilityId, metricKey] of financialCapabilities) {
    if (supported[capabilityId]) continue
    missing[capabilityId] = canonicalMissingExplanation({
      capability: capabilityId,
      label: CAPABILITY_LABELS[capabilityId],
      metricKey: String(metricKey),
      metrics,
      metricSources,
    })
  }

  return { supported, missing }
}

function hasUnavailableMetricSource(metricSources: Record<string, unknown>) {
  return Object.values(metricSources).some((entry) => entry && typeof entry === "object" && (entry as Record<string, unknown>).kind === "unavailable")
}

function deriveSemanticCapabilities(context: QuestionCapabilityContext): DerivedQuestionCapabilities {
  const supported: Partial<Record<QuestionCapabilityId, string[]>> = {}
  const mapping = context.semanticMappings ?? {}
  const evidence = (field: string) => {
    const column = mapping[field]?.column
    return column ? [`Field "${column}" maps to the ${field} concept.`] : []
  }

  const fieldCapabilities: Array<[QuestionCapabilityId, string]> = [
    ["financial.revenue", "revenue"],
    ["financial.cogs", "cogs"],
    ["financial.expenses", "expenses"],
    ["financial.grossProfit", "gross_profit"],
    ["financial.grossMargin", "gross_margin"],
    ["financial.netProfit", "net_profit"],
    ["financial.netMargin", "net_margin"],
    ["time.period", "date"],
  ]
  for (const [capabilityId, field] of fieldCapabilities) {
    const columnEvidence = evidence(field)
    if (columnEvidence.length > 0) supported[capabilityId] = columnEvidence
  }

  if (context.hasExpenseTypeColumn && (supported["financial.cogs"] || supported["financial.expenses"])) {
    supported["expense.categories"] = ["Validated expense classification and numeric expense amounts are available."]
    supported["expense.concentration"] = ["Expense concentration is computable from classified expense rows."]
  }

  const dimensionCapabilities: Array<[QuestionCapabilityId, string]> = [
    ["revenue.product", "product"],
    ["revenue.category", "category"],
    ["revenue.customer", "customer"],
    ["revenue.region", "region"],
  ]
  for (const [capabilityId, field] of dimensionCapabilities) {
    if (mapping[field] && supported["financial.revenue"]) {
      supported[capabilityId] = [`Field "${mapping[field]!.column}" segments revenue rows.`]
      supported["revenue.composition"] = supported["revenue.composition"] ?? [`Revenue composition is available from "${mapping[field]!.column}".`]
    }
  }
  if (mapping.country && supported["financial.revenue"]) {
    supported["revenue.region"] = supported["revenue.region"] ?? [`Field "${mapping.country.column}" segments revenue rows.`]
    supported["revenue.composition"] = supported["revenue.composition"] ?? [`Revenue composition is available from "${mapping.country.column}".`]
  }
  if (supported["time.period"] && supported["financial.revenue"]) {
    supported["revenue.timeseries"] = ["Revenue rows carry validated period values."]
  }

  return { supported, missing: {} }
}

function canonicalMissingExplanation(input: {
  capability: QuestionCapabilityId
  label: string
  metricKey: string
  metrics: CanonicalFinancialMetrics
  metricSources: Record<string, unknown>
}): MissingCapabilityExplanation {
  const provenance = input.metricSources[input.metricKey]
  const provenanceRecord = provenance && typeof provenance === "object" && !Array.isArray(provenance) ? provenance as Record<string, unknown> : null
  const provenanceNote = typeof provenanceRecord?.note === "string" ? provenanceRecord.note : null
  const unavailableMarker = provenanceRecord?.kind === "unavailable"
  const nearCauses = nearCauseMetrics(input.metricKey)
    .filter((cause) => input.metrics.missingFields.includes(cause))
  if (unavailableMarker && provenanceNote) {
    return {
      capability: input.capability,
      label: input.label,
      reason: `${input.label} is unavailable: ${provenanceNote}`,
      explainable: true,
    }
  }
  if (nearCauses.length > 0) {
    return {
      capability: input.capability,
      label: input.label,
      reason: `${input.label} cannot be calculated because required source data is missing: ${nearCauses.map(causeLabel).join(", ")}.`,
      explainable: true,
    }
  }
  return {
    capability: input.capability,
    label: input.label,
    reason: `${input.label} is not available for this dataset.`,
    explainable: false,
  }
}

const NEAR_CAUSE_METRICS: Record<string, string[]> = {
  cogs: ["cogs"],
  grossProfit: ["cogs"],
  grossMargin: ["grossProfit"],
  operatingProfit: ["revenue", "operatingExpenses"],
  operatingMargin: ["operatingProfit", "revenue"],
  netProfit: ["operatingProfit"],
  netMargin: ["netProfit", "revenue"],
  operatingExpenses: ["operatingExpenses"],
  revenue: ["revenue"],
}

const CANONICAL_FIELD_LABELS: Record<string, string> = {
  revenue: "revenue source data",
  cogs: "cost of goods sold (COGS)",
  grossProfit: "gross profit",
  grossMargin: "gross margin",
  operatingProfit: "operating profit",
  operatingMargin: "operating margin",
  netProfit: "net profit",
  netMargin: "net margin",
  operatingExpenses: "operating expense source rows",
}

function nearCauseMetrics(metricKey: string): string[] {
  return NEAR_CAUSE_METRICS[metricKey] ?? [metricKey]
}

function causeLabel(metricField: string) {
  return CANONICAL_FIELD_LABELS[metricField] ?? metricField
}

export function capabilityLabel(capabilityId: QuestionCapabilityId) {
  return CAPABILITY_LABELS[capabilityId] ?? capabilityId
}

/**
 * Registry questions supported by the active dataset context, capped at the
 * 5-8 high-quality question budget. A question is returned only when every
 * required capability is available, or when the declared missing capability
 * has a deterministic explanation.
 */
export function buildCapabilitySuggestedQuestions(
  input: QuestionCapabilityInput | QuestionCapabilityContext,
): string[] {
  const context = isQuestionCapabilityContext(input) ? input : deriveQuestionCapabilityContext(input)
  const capabilities = deriveQuestionCapabilities(context)
  const questions: string[] = []
  for (const definition of SUGGESTED_QUESTION_REGISTRY) {
    if (questions.length >= 8) break
    if (definition.requires.some((requirement) => !capabilities.supported[requirement])) continue
    if (definition.explainsMissing) {
      const explanation = capabilities.missing[definition.explainsMissing]
      if (!explanation?.explainable) continue
    }
    questions.push(definition.question)
  }
  return questions
}

function isQuestionCapabilityContext(input: QuestionCapabilityInput | QuestionCapabilityContext): input is QuestionCapabilityContext {
  return "canonicalMetrics" in input && "semanticMappings" in input
}

export function payloadTupleEntries(payload: Record<string, unknown> | null, key: string): Array<[string, number]> {
  if (!payload) return []
  const value = payload[key]
  if (!Array.isArray(value)) return []
  return value
    .filter((entry): entry is [string, number] => Array.isArray(entry) && typeof entry[0] === "string" && typeof entry[1] === "number" && Number.isFinite(entry[1]))
}

export function payloadArrayEntries(payload: Record<string, unknown> | null, key: string): unknown[] {
  if (!payload) return []
  const value = payload[key]
  return Array.isArray(value) ? value : []
}

export function payloadRecord(payload: Record<string, unknown> | null, key: string): Record<string, unknown> {
  if (!payload) return {}
  const value = payload[key]
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export function payloadNumber(payload: Record<string, unknown> | null, key: string): number | null {
  if (!payload) return null
  const value = payload[key]
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

export function payloadStringList(payload: Record<string, unknown> | null, key: string): string[] {
  if (!payload) return []
  const value = payload[key]
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : []
}

function ratio(numerator: number | null, denominator: number | null): number | null {
  return numerator !== null && denominator !== null && denominator > 0
    ? Math.round((numerator / denominator) * 100) / 100
    : null
}
