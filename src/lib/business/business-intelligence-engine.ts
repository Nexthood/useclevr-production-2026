import { debugWarn } from "@/lib/utils/debug"

export type BusinessIntelligencePriority = "High" | "Medium" | "Low"

export type BusinessIntelligenceAction = {
  priority: BusinessIntelligencePriority
  action: string
  reason: string
  expectedBusinessImpact: string
  confidence: number
}

export type BusinessIntelligenceSignal = {
  title: string
  description: string
  severity?: BusinessIntelligencePriority
  confidence: number
}

export type BusinessIntelligenceResult = {
  generatedAt: string
  engineVersion: "phase-1"
  profile: {
    rowCount: number
    columnCount: number
    columns: {
      name: string
      type: "number" | "date" | "boolean" | "text"
      missingValues: number
      missingRate: number
      uniqueValues: number
      invalidValues: number
      sampleValues: string[]
    }[]
    duplicateRows: number
    invalidValues: Record<string, number>
    missingValues: Record<string, number>
  }
  detectedKpis: {
    revenue: string | null
    profit: string | null
    cost: string | null
    margin: string | null
    inventory: string | null
    customers: string | null
    orders: string | null
    products: string | null
    time: string | null
  }
  healthScore: {
    overall: number
    dataQuality: number
    kpiCompleteness: number
    trendStability: number
    riskScore: number
  }
  risks: BusinessIntelligenceSignal[]
  opportunities: BusinessIntelligenceSignal[]
  executiveSummary: string
  recommendedActions: BusinessIntelligenceAction[]
  aiNarrative?: {
    providerName: string
    modelName: string
    fallbackUsed: boolean
    source: "user-provider" | "default-cloud"
    summary?: string
    actions?: BusinessIntelligenceAction[]
  }
}

type Row = Record<string, unknown>
type ColumnProfile = BusinessIntelligenceResult["profile"]["columns"][number]

const KPI_PATTERNS = {
  revenue: [/revenue/i, /\bsales?\b/i, /turnover/i, /amount/i, /net[_\s-]?sales/i],
  profit: [/profit/i, /gross[_\s-]?profit/i, /net[_\s-]?income/i, /earnings/i],
  cost: [/\bcost\b/i, /expense/i, /cogs/i, /unit[_\s-]?cost/i, /shipping/i],
  margin: [/margin/i, /markup/i],
  inventory: [/inventory/i, /stock/i, /on[_\s-]?hand/i, /reorder/i],
  customers: [/customer/i, /client/i, /account/i, /buyer/i],
  orders: [/order/i, /invoice/i, /transaction/i, /purchase/i],
  products: [/product/i, /sku/i, /item/i, /category/i],
  time: [/date/i, /time/i, /month/i, /year/i, /period/i, /quarter/i],
} satisfies Record<string, RegExp[]>

export async function generateBusinessIntelligence(input: {
  rows: Row[]
  columns?: string[]
  datasetId?: string
  datasetName?: string
  userId?: string
  enableAi?: boolean
}): Promise<BusinessIntelligenceResult> {
  const rows = input.rows.filter(Boolean)
  const columns = normalizeColumns(input.columns, rows)
  const profiles = columns.map((column) => profileColumn(rows, column))
  const detectedKpis = detectKpis(columns, profiles)
  const duplicateRows = countDuplicates(rows)
  const missingValues = Object.fromEntries(profiles.map((column) => [column.name, column.missingValues]))
  const invalidValues = Object.fromEntries(profiles.map((column) => [column.name, column.invalidValues]))
  const deterministic = calculateDeterministicSignals(rows, profiles, detectedKpis)
  const healthScore = calculateHealthScore({
    rows,
    profiles,
    detectedKpis,
    duplicateRows,
    riskCount: deterministic.risks.length,
    trendStability: deterministic.trendStability,
  })
  const fallbackSummary = buildExecutiveSummary(healthScore.overall, deterministic.risks, deterministic.opportunities, detectedKpis)
  const fallbackActions = buildRecommendedActions(deterministic.risks, deterministic.opportunities, healthScore)

  const result: BusinessIntelligenceResult = {
    generatedAt: new Date().toISOString(),
    engineVersion: "phase-1",
    profile: {
      rowCount: rows.length,
      columnCount: columns.length,
      columns: profiles,
      duplicateRows,
      invalidValues,
      missingValues,
    },
    detectedKpis,
    healthScore,
    risks: deterministic.risks,
    opportunities: deterministic.opportunities,
    executiveSummary: fallbackSummary,
    recommendedActions: fallbackActions,
  }

  if (input.enableAi !== false) {
    const aiNarrative = await generateAiNarrative({
      userId: input.userId,
      datasetId: input.datasetId,
      datasetName: input.datasetName,
      deterministic: result,
    })
    if (aiNarrative) {
      result.aiNarrative = aiNarrative
      if (aiNarrative.summary) result.executiveSummary = aiNarrative.summary
      if (aiNarrative.actions?.length) result.recommendedActions = aiNarrative.actions
    }
  }

  return result
}

function normalizeColumns(columns: string[] | undefined, rows: Row[]) {
  const fromRows = rows[0] ? Object.keys(rows[0]) : []
  return Array.from(new Set([...(columns || []), ...fromRows])).filter(Boolean)
}

function profileColumn(rows: Row[], column: string): ColumnProfile {
  const values = rows.map((row) => row[column])
  const empty = values.filter((value) => value === null || value === undefined || value === "").length
  const nonEmpty = values.filter((value) => value !== null && value !== undefined && value !== "")
  const type = detectType(nonEmpty)
  const invalidValues = countInvalidValues(nonEmpty, type)
  const sampleValues = Array.from(new Set(nonEmpty.map((value) => String(value)))).slice(0, 5)

  return {
    name: column,
    type,
    missingValues: empty,
    missingRate: rows.length > 0 ? round((empty / rows.length) * 100) : 0,
    uniqueValues: new Set(nonEmpty.map((value) => String(value))).size,
    invalidValues,
    sampleValues,
  }
}

function detectType(values: unknown[]): ColumnProfile["type"] {
  if (values.length === 0) return "text"
  const sample = values.slice(0, 100)
  const numeric = sample.filter((value) => Number.isFinite(toNumber(value))).length / sample.length
  const dates = sample.filter((value) => isValidDate(value)).length / sample.length
  const booleans = sample.filter((value) => ["true", "false", "yes", "no", "0", "1"].includes(String(value).toLowerCase())).length / sample.length
  if (numeric >= 0.8) return "number"
  if (dates >= 0.8) return "date"
  if (booleans >= 0.9) return "boolean"
  return "text"
}

function countInvalidValues(values: unknown[], type: ColumnProfile["type"]) {
  if (type === "number") return values.filter((value) => !Number.isFinite(toNumber(value))).length
  if (type === "date") return values.filter((value) => !isValidDate(value)).length
  return 0
}

function detectKpis(columns: string[], profiles: ColumnProfile[]): BusinessIntelligenceResult["detectedKpis"] {
  const byName = (key: keyof typeof KPI_PATTERNS, requireNumeric = false) =>
    columns.find((column) => {
      const profile = profiles.find((item) => item.name === column)
      if (requireNumeric && profile?.type !== "number") return false
      return KPI_PATTERNS[key].some((pattern) => pattern.test(column))
    }) || null

  return {
    revenue: byName("revenue", true),
    profit: byName("profit", true),
    cost: byName("cost", true),
    margin: byName("margin", true),
    inventory: byName("inventory", true),
    customers: byName("customers"),
    orders: byName("orders"),
    products: byName("products"),
    time: byName("time"),
  }
}

function calculateDeterministicSignals(
  rows: Row[],
  profiles: ColumnProfile[],
  detected: BusinessIntelligenceResult["detectedKpis"],
) {
  const risks: BusinessIntelligenceSignal[] = []
  const opportunities: BusinessIntelligenceSignal[] = []
  const revenueTrend = trendFor(rows, detected.time, detected.revenue)
  const marginTrend = trendFor(rows, detected.time, detected.margin || detected.profit)
  const stockColumn = detected.inventory

  if (revenueTrend.changePercent !== null && revenueTrend.changePercent < -5) {
    risks.push({
      title: "Declining revenue",
      description: `Revenue declined by ${Math.abs(revenueTrend.changePercent).toFixed(1)}% across the detected time periods.`,
      severity: "High",
      confidence: revenueTrend.confidence,
    })
  }
  if (marginTrend.changePercent !== null && marginTrend.changePercent < -3) {
    risks.push({
      title: "Falling margins",
      description: `Margin or profit trend declined by ${Math.abs(marginTrend.changePercent).toFixed(1)}%.`,
      severity: "High",
      confidence: marginTrend.confidence,
    })
  }
  if (stockColumn) {
    const lowStock = rows.filter((row) => {
      const value = toNumber(row[stockColumn])
      return Number.isFinite(value) && value >= 0 && value <= 5
    }).length
    if (lowStock > 0) {
      risks.push({
        title: "Low stock exposure",
        description: `${lowStock} rows show inventory at or below 5 units.`,
        severity: lowStock > rows.length * 0.1 ? "High" : "Medium",
        confidence: 0.78,
      })
    }
  }
  if (detected.customers) {
    const values = rows.map((row) => row[detected.customers!]).filter(Boolean).map(String)
    const unique = new Set(values).size
    if (values.length > 0 && unique / values.length < 0.35) {
      risks.push({
        title: "Customer concentration",
        description: "Revenue or activity appears concentrated in a smaller customer base.",
        severity: "Medium",
        confidence: 0.68,
      })
    }
  }
  risks.push(...detectOutliers(rows, profiles))
  risks.push(...detectSeasonalAnomalies(rows, detected.time, detected.revenue))

  const topProduct = topGrouped(rows, detected.products, detected.revenue || detected.profit)
  if (topProduct) {
    opportunities.push({
      title: "High-performing product",
      description: `${topProduct.name} leads with ${formatNumber(topProduct.value)} in detected value.`,
      severity: "High",
      confidence: 0.82,
    })
  }
  if (revenueTrend.changePercent !== null && revenueTrend.changePercent > 5) {
    opportunities.push({
      title: "Growth opportunity",
      description: `Detected revenue trend increased by ${revenueTrend.changePercent.toFixed(1)}%.`,
      severity: "High",
      confidence: revenueTrend.confidence,
    })
  }
  if (detected.customers && detected.revenue) {
    opportunities.push({
      title: "Upselling opportunity",
      description: "Customer and revenue fields are available for identifying expansion targets.",
      severity: "Medium",
      confidence: 0.64,
    })
  }
  if (detected.inventory) {
    opportunities.push({
      title: "Inventory optimization",
      description: "Inventory fields are available for reorder, stockout, and slow-moving item analysis.",
      severity: "Medium",
      confidence: 0.74,
    })
  }
  if (detected.cost) {
    opportunities.push({
      title: "Cost savings",
      description: "Cost fields are available for expense concentration and margin improvement review.",
      severity: "Medium",
      confidence: 0.72,
    })
  }

  return {
    risks: risks.slice(0, 8),
    opportunities: opportunities.slice(0, 8),
    trendStability: trendStabilityScore(revenueTrend.changePercent, marginTrend.changePercent),
  }
}

function calculateHealthScore(input: {
  rows: Row[]
  profiles: ColumnProfile[]
  detectedKpis: BusinessIntelligenceResult["detectedKpis"]
  duplicateRows: number
  riskCount: number
  trendStability: number
}) {
  const totalCells = Math.max(1, input.rows.length * Math.max(1, input.profiles.length))
  const missing = input.profiles.reduce((sum, column) => sum + column.missingValues, 0)
  const invalid = input.profiles.reduce((sum, column) => sum + column.invalidValues, 0)
  const dataQuality = clamp(100 - ((missing + invalid) / totalCells) * 100 - (input.duplicateRows / Math.max(1, input.rows.length)) * 20)
  const presentKpis = Object.values(input.detectedKpis).filter(Boolean).length
  const kpiCompleteness = clamp((presentKpis / Object.keys(input.detectedKpis).length) * 100)
  const trendStability = input.trendStability
  const riskScore = clamp(100 - input.riskCount * 12)
  const overall = clamp(dataQuality * 0.35 + kpiCompleteness * 0.25 + trendStability * 0.2 + riskScore * 0.2)

  return {
    overall: Math.round(overall),
    dataQuality: Math.round(dataQuality),
    kpiCompleteness: Math.round(kpiCompleteness),
    trendStability: Math.round(trendStability),
    riskScore: Math.round(riskScore),
  }
}

function buildExecutiveSummary(
  score: number,
  risks: BusinessIntelligenceSignal[],
  opportunities: BusinessIntelligenceSignal[],
  detected: BusinessIntelligenceResult["detectedKpis"],
) {
  const kpiNames = Object.entries(detected)
    .filter(([, value]) => Boolean(value))
    .map(([key]) => key)
  const riskText = risks[0]?.title ? ` Main risk: ${risks[0].title.toLowerCase()}.` : ""
  const opportunityText = opportunities[0]?.title ? ` Main opportunity: ${opportunities[0].title.toLowerCase()}.` : ""
  return `Business health score is ${score}/100 based on data quality, KPI coverage, trend stability, and detected risks. Detected KPI families: ${kpiNames.length ? kpiNames.join(", ") : "limited KPI coverage"}.${riskText}${opportunityText}`
}

function buildRecommendedActions(
  risks: BusinessIntelligenceSignal[],
  opportunities: BusinessIntelligenceSignal[],
  healthScore: BusinessIntelligenceResult["healthScore"],
): BusinessIntelligenceAction[] {
  const actions: BusinessIntelligenceAction[] = []
  for (const risk of risks.slice(0, 3)) {
    actions.push({
      priority: risk.severity || "Medium",
      action: `Address ${risk.title.toLowerCase()}`,
      reason: risk.description,
      expectedBusinessImpact: "Reduces business risk and improves confidence in management decisions.",
      confidence: risk.confidence,
    })
  }
  for (const opportunity of opportunities.slice(0, 3)) {
    actions.push({
      priority: opportunity.severity || "Medium",
      action: `Pursue ${opportunity.title.toLowerCase()}`,
      reason: opportunity.description,
      expectedBusinessImpact: "Improves revenue, margin, retention, or operational efficiency.",
      confidence: opportunity.confidence,
    })
  }
  if (healthScore.kpiCompleteness < 50) {
    actions.push({
      priority: "Medium",
      action: "Add missing KPI columns",
      reason: "KPI completeness is below 50%, limiting automated business analysis.",
      expectedBusinessImpact: "Improves reporting accuracy and unlocks more specific recommendations.",
      confidence: 0.9,
    })
  }
  return actions.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority)).slice(0, 8)
}

async function generateAiNarrative(input: {
  userId?: string
  datasetId?: string
  datasetName?: string
  deterministic: BusinessIntelligenceResult
}): Promise<BusinessIntelligenceResult["aiNarrative"] | null> {
  const { generateServerAiText } = await import("@/lib/ai/server-ai-text")
  const prompt = `UseClevr Business Intelligence Engine Phase 1.
You must not calculate new metrics. Use only the deterministic facts below.
Write a concise executive summary and prioritize the given actions.
Return strict JSON with this shape:
{"summary":"2-3 concise management sentences","actions":[{"priority":"High|Medium|Low","action":"...","reason":"...","expectedBusinessImpact":"...","confidence":0.0}]}

Dataset: ${input.datasetName || input.datasetId || "uploaded dataset"}
Facts:
${JSON.stringify({
    healthScore: input.deterministic.healthScore,
    detectedKpis: input.deterministic.detectedKpis,
    risks: input.deterministic.risks,
    opportunities: input.deterministic.opportunities,
    recommendedActions: input.deterministic.recommendedActions,
  }).slice(0, 12000)}`

  const ai = await generateServerAiText(prompt, {
    userId: input.userId,
    datasetId: input.datasetId,
    context: "BUSINESS_INTELLIGENCE_ENGINE",
    purpose: "dataset_analysis",
  })
  if (!ai) return null

  const parsed = parseAiJson(ai.text)
  return {
    providerName: ai.providerName,
    modelName: ai.modelName,
    fallbackUsed: ai.fallbackUsed,
    source: ai.source,
    summary: typeof parsed?.summary === "string" ? parsed.summary : ai.text.slice(0, 600),
    actions: Array.isArray(parsed?.actions)
      ? parsed.actions.map(normalizeAiAction).filter(Boolean).slice(0, 8) as BusinessIntelligenceAction[]
      : undefined,
  }
}

function parseAiJson(text: string): { summary?: unknown; actions?: unknown } | null {
  try {
    const json = text.match(/\{[\s\S]*\}/)?.[0] || text
    return JSON.parse(json)
  } catch (error) {
    debugWarn("[BI_ENGINE] AI narrative was not valid JSON; using text summary", {
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

function normalizeAiAction(action: unknown): BusinessIntelligenceAction | null {
  if (!action || typeof action !== "object") return null
  const source = action as Partial<BusinessIntelligenceAction>
  return {
    priority: normalizePriority(source.priority),
    action: String(source.action || "").slice(0, 180),
    reason: String(source.reason || "").slice(0, 260),
    expectedBusinessImpact: String(source.expectedBusinessImpact || "").slice(0, 260),
    confidence: clamp(Number(source.confidence) * (Number(source.confidence) <= 1 ? 1 : 0.01), 0, 1),
  }
}

function trendFor(rows: Row[], timeColumn: string | null, metricColumn: string | null) {
  if (!timeColumn || !metricColumn) return { changePercent: null as number | null, confidence: 0.35 }
  const periods = new Map<string, number>()
  for (const row of rows) {
    const date = toDate(row[timeColumn])
    const value = toNumber(row[metricColumn])
    if (!date || !Number.isFinite(value)) continue
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    periods.set(key, (periods.get(key) || 0) + value)
  }
  const sorted = Array.from(periods.entries()).sort(([a], [b]) => a.localeCompare(b))
  if (sorted.length < 2) return { changePercent: null as number | null, confidence: 0.45 }
  const first = sorted[0][1]
  const last = sorted[sorted.length - 1][1]
  if (!Number.isFinite(first) || first === 0) return { changePercent: null as number | null, confidence: 0.45 }
  return { changePercent: round(((last - first) / Math.abs(first)) * 100), confidence: sorted.length >= 4 ? 0.82 : 0.68 }
}

function detectOutliers(rows: Row[], profiles: ColumnProfile[]): BusinessIntelligenceSignal[] {
  const risks: BusinessIntelligenceSignal[] = []
  for (const profile of profiles.filter((column) => column.type === "number").slice(0, 5)) {
    const values = rows.map((row) => toNumber(row[profile.name])).filter(Number.isFinite)
    if (values.length < 10) continue
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
    const stdDev = Math.sqrt(variance)
    if (stdDev === 0) continue
    const outliers = values.filter((value) => Math.abs(value - mean) > stdDev * 3).length
    if (outliers > 0) {
      risks.push({
        title: "Outliers detected",
        description: `${profile.name} contains ${outliers} statistically unusual values.`,
        severity: outliers > values.length * 0.05 ? "High" : "Medium",
        confidence: 0.76,
      })
    }
  }
  return risks
}

function detectSeasonalAnomalies(rows: Row[], timeColumn: string | null, metricColumn: string | null): BusinessIntelligenceSignal[] {
  if (!timeColumn || !metricColumn) return []
  const monthly = new Map<string, number>()
  for (const row of rows) {
    const date = toDate(row[timeColumn])
    const value = toNumber(row[metricColumn])
    if (!date || !Number.isFinite(value)) continue
    const key = String(date.getMonth() + 1).padStart(2, "0")
    monthly.set(key, (monthly.get(key) || 0) + value)
  }
  const values = Array.from(monthly.values())
  if (values.length < 4) return []
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  if (mean === 0) return []
  const maxDeviation = Math.max(...values.map((value) => Math.abs(value - mean) / Math.abs(mean)))
  if (maxDeviation < 0.5) return []
  return [{
    title: "Seasonal anomaly",
    description: `Monthly ${metricColumn} varies by more than 50% from the average in at least one period.`,
    severity: "Medium",
    confidence: 0.66,
  }]
}

function topGrouped(rows: Row[], groupColumn: string | null, metricColumn: string | null) {
  if (!groupColumn || !metricColumn) return null
  const grouped = new Map<string, number>()
  for (const row of rows) {
    const group = String(row[groupColumn] || "Unknown")
    const value = toNumber(row[metricColumn])
    if (!Number.isFinite(value)) continue
    grouped.set(group, (grouped.get(group) || 0) + value)
  }
  const [name, value] = Array.from(grouped.entries()).sort((a, b) => b[1] - a[1])[0] || []
  return name ? { name, value } : null
}

function countDuplicates(rows: Row[]) {
  return rows.length - new Set(rows.map((row) => JSON.stringify(row))).size
}

function trendStabilityScore(...changes: Array<number | null>) {
  const valid = changes.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
  if (valid.length === 0) return 60
  const worstDecline = Math.min(...valid)
  if (worstDecline < -20) return 35
  if (worstDecline < -10) return 55
  if (worstDecline < -3) return 72
  return 88
}

function toNumber(value: unknown) {
  if (typeof value === "number") return value
  if (typeof value === "string") return Number(value.replace(/[^0-9.-]/g, ""))
  return Number.NaN
}

function isValidDate(value: unknown) {
  return Boolean(toDate(value))
}

function toDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value !== "string" && typeof value !== "number") return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function clamp(value: number, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function round(value: number) {
  return Math.round(value * 100) / 100
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(value)
}

function normalizePriority(value: unknown): BusinessIntelligencePriority {
  return value === "High" || value === "Medium" || value === "Low" ? value : "Medium"
}

function priorityRank(priority: BusinessIntelligencePriority) {
  return priority === "High" ? 0 : priority === "Medium" ? 1 : 2
}
