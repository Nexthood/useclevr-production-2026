import { createHash, randomUUID } from "node:crypto"

import { generateServerAiText } from "@/lib/ai/server-ai-text"
import { getDashboardDataFingerprint, loadDashboardDatasetAggregation, normalizeDashboardColumnName } from "@/lib/data/dashboard-dataset-aggregation"
import { db } from "@/lib/db"
import { executiveDailyHealthChecks, profiles } from "@/lib/db/schema"
import { debugWarn } from "@/lib/utils/debug"
import { and, desc, eq } from "drizzle-orm"

type Priority = "Critical" | "High" | "Medium" | "Low"
type DataRow = Record<string, unknown>

export type ExecutiveDailyRecommendation = {
  priority: Priority
  estimatedImpact: string
  confidence: number
  reason: string
  suggestedAction: string
}

export type ExecutiveDailyAlert = {
  type: "low_stock" | "dead_stock" | "revenue_drop" | "missing_uploads" | "dataset_outdated" | "margin_pressure"
  severity: "critical" | "warning"
  title: string
  message: string
}

export type ExecutiveDailyBrief = {
  id: string
  userId: string
  workspaceId: string | null
  workspaceKey: string
  date: string
  score: number
  aiConfidence: number
  executiveSummary: string
  topOpportunities: string[]
  criticalRisks: string[]
  anomalies: string[]
  todaysPriorities: string[]
  recommendedActions: ExecutiveDailyRecommendation[]
  forecast: string
  estimatedBusinessImpact: string
  alerts: ExecutiveDailyAlert[]
  generatedBy: string
  modelName: string | null
  createdAt: Date
  updatedAt: Date
}

type DailyHealthSource = {
  userId: string
  workspaceId: string | null
  workspaceKey: string
  date: string
  profileComplete: boolean
  hasBusinessProfile: boolean
  datasets: {
    id: string
    name: string
    datasetType: string
    rowCount: number
    columnCount: number
    createdAt: Date
    columns: string[]
    rows: DataRow[]
    analysisStatus: string | null
    analysis: unknown
    aiInsights: unknown
  }[]
}

type ColumnMap = {
  revenue?: string
  profit?: string
  cost?: string
  date?: string
  product?: string
  sku?: string
  quantity?: string
  stock?: string
  category?: string
}

export type HealthSignal = {
  id: string
  label: string
  score: number
  confidence: number
  summary: string
  alerts?: ExecutiveDailyAlert[]
  recommendations?: ExecutiveDailyRecommendation[]
}

export type HealthSignalProvider = {
  id: string
  collect: (source: DailyHealthSource, metrics: DailyHealthMetrics) => HealthSignal
}

type DailyHealthMetrics = {
  rowCount: number
  latestUploadAgeDays: number | null
  totalRevenue: number | null
  previousRevenue: number | null
  revenueChangePct: number | null
  totalProfit: number | null
  profitMargin: number | null
  lowStockCount: number | null
  deadStockCount: number | null
  inventoryHealth: number | null
  forecastReliability: number
  missingDataCount: number
  aiInsightCount: number
  columns: ColumnMap
}

const DEFAULT_WORKSPACE_ID = null

export async function getOrCreateDailyHealthBrief(input: {
  userId: string
  workspaceId?: string | null
  force?: boolean
}): Promise<ExecutiveDailyBrief | null> {
  const workspaceId = input.workspaceId ?? DEFAULT_WORKSPACE_ID
  const workspaceKey = getWorkspaceKey(input.userId, workspaceId)
  const date = getUtcDateKey(new Date())
  const source = await loadDailyHealthSource(input.userId, workspaceId, workspaceKey, date)
  const sourceHash = hashDailyHealthSource(source)

  if (!input.force) {
    const existing = await readStoredBrief(workspaceKey, date, sourceHash)
    if (existing) return existing
  }

  const generated = await generateDailyHealthBrief(source)
  return storeDailyHealthBrief(generated, sourceHash)
}

export async function listDailyHealthBriefs(input: {
  userId: string
  workspaceId?: string | null
  limit?: number
}): Promise<ExecutiveDailyBrief[]> {
  const workspaceKey = getWorkspaceKey(input.userId, input.workspaceId ?? DEFAULT_WORKSPACE_ID)
  try {
    const records = await db.query.executiveDailyHealthChecks.findMany({
      where: and(
        eq(executiveDailyHealthChecks.userId, input.userId),
        eq(executiveDailyHealthChecks.workspaceKey, workspaceKey),
      ),
      orderBy: [desc(executiveDailyHealthChecks.date)],
      limit: input.limit ?? 30,
    })
    return records.map(recordToBrief).filter((brief): brief is ExecutiveDailyBrief => Boolean(brief))
  } catch (error) {
    debugWarn("[Daily Health] Failed to list daily briefs", error)
    return []
  }
}

async function readStoredBrief(workspaceKey: string, date: string, sourceHash: string) {
  try {
    const record = await db.query.executiveDailyHealthChecks.findFirst({
      where: and(
        eq(executiveDailyHealthChecks.workspaceKey, workspaceKey),
        eq(executiveDailyHealthChecks.date, date),
      ),
    })
    if (record && record.sourceHash !== sourceHash) return null
    return record ? recordToBrief(record) : null
  } catch (error) {
    debugWarn("[Daily Health] Stored brief lookup failed; generating uncached brief", error)
    return null
  }
}

async function loadDailyHealthSource(userId: string, workspaceId: string | null, workspaceKey: string, date: string): Promise<DailyHealthSource> {
  const [profile, dashboardData] = await Promise.all([
    db.query.profiles.findFirst({
      where: eq(profiles.userId, userId),
      columns: { firstName: true, businessName: true, companyName: true, industry: true, location: true },
    }),
    loadDashboardDatasetAggregation(userId),
  ])

  return {
    userId,
    workspaceId,
    workspaceKey,
    date,
    profileComplete: Boolean(profile?.firstName && (profile.businessName || profile.companyName)),
    hasBusinessProfile: Boolean(profile?.businessName || profile?.companyName || profile?.industry || profile?.location),
    datasets: dashboardData.datasets.map((dataset) => ({
      id: dataset.id,
      name: dataset.name,
      datasetType: dataset.datasetType || "standard",
      rowCount: dataset.rowCount || 0,
      columnCount: dataset.columnCount || 0,
      createdAt: dataset.createdAt || new Date(),
      columns: Array.isArray(dataset.columns) ? dataset.columns : [],
      rows: Array.isArray(dataset.data) ? (dataset.data as DataRow[]).filter(isRecord) : [],
      analysisStatus: dataset.analysisStatus,
      analysis: dataset.analysis,
      aiInsights: dataset.aiInsights,
    })),
  }
}

async function generateDailyHealthBrief(source: DailyHealthSource): Promise<ExecutiveDailyBrief> {
  const metrics = calculateMetrics(source)
  const signals = healthSignalProviders.map((provider) => provider.collect(source, metrics))
  const deterministic = buildDeterministicBrief(source, metrics, signals)
  const aiBrief = await generateAiBrief(source, metrics, deterministic)

  return {
    ...deterministic,
    ...(aiBrief || {}),
    id: `edh_${randomUUID().replaceAll("-", "").slice(0, 20)}`,
    userId: source.userId,
    workspaceId: source.workspaceId,
    workspaceKey: source.workspaceKey,
    date: source.date,
    score: deterministic.score,
    aiConfidence: aiBrief?.aiConfidence ?? deterministic.aiConfidence,
    alerts: deterministic.alerts,
    generatedBy: aiBrief ? "ai" : "deterministic",
    modelName: aiBrief?.modelName ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

async function generateAiBrief(
  source: DailyHealthSource,
  metrics: DailyHealthMetrics,
  deterministic: Omit<ExecutiveDailyBrief, "id" | "userId" | "workspaceId" | "workspaceKey" | "date" | "generatedBy" | "modelName" | "createdAt" | "updatedAt">,
): Promise<Partial<ExecutiveDailyBrief> & { modelName: string } | null> {
  const prompt = [
    "You are UseClevr's Executive Daily Health Check engine.",
    "Write concise, board-ready JSON only. Do not invent metrics that are not present.",
    "Use the deterministic metrics as facts and turn them into a professional CEO morning brief.",
    "",
    JSON.stringify({
      date: source.date,
      datasetCount: source.datasets.length,
      datasetTypes: source.datasets.map((dataset) => dataset.datasetType),
      metrics,
      deterministic,
    }),
    "",
    "Return JSON with: executiveSummary string, topOpportunities string[], criticalRisks string[], anomalies string[], todaysPriorities string[], forecast string, estimatedBusinessImpact string, recommendedActions array with priority, estimatedImpact, confidence, reason, suggestedAction.",
  ].join("\n")

  const result = await generateServerAiText(prompt, {
    userId: source.userId,
    context: "Executive Daily Health Check",
    purpose: "recommendation",
  })
  if (!result?.text) return null

  const parsed = parseJsonObject(result.text)
  if (!parsed) return null

  return {
    executiveSummary: readString(parsed.executiveSummary, deterministic.executiveSummary),
    topOpportunities: readStringList(parsed.topOpportunities, deterministic.topOpportunities),
    criticalRisks: readStringList(parsed.criticalRisks, deterministic.criticalRisks),
    anomalies: readStringList(parsed.anomalies, deterministic.anomalies),
    todaysPriorities: readStringList(parsed.todaysPriorities, deterministic.todaysPriorities),
    recommendedActions: readRecommendations(parsed.recommendedActions, deterministic.recommendedActions),
    forecast: readString(parsed.forecast, deterministic.forecast),
    estimatedBusinessImpact: readString(parsed.estimatedBusinessImpact, deterministic.estimatedBusinessImpact),
    aiConfidence: Math.max(deterministic.aiConfidence, result.source === "user-provider" ? 82 : 76),
    modelName: result.modelName,
  }
}

async function storeDailyHealthBrief(brief: ExecutiveDailyBrief, sourceHash: string): Promise<ExecutiveDailyBrief> {
  try {
    const [record] = await db
      .insert(executiveDailyHealthChecks)
      .values({
        id: brief.id,
        userId: brief.userId,
        workspaceId: brief.workspaceId,
        workspaceKey: brief.workspaceKey,
        date: brief.date,
        score: brief.score,
        aiConfidence: brief.aiConfidence,
        brief: briefToJson(brief),
        alerts: brief.alerts,
        sourceHash,
        generatedBy: brief.generatedBy,
        modelName: brief.modelName,
        createdAt: brief.createdAt,
        updatedAt: brief.updatedAt,
      })
      .onConflictDoUpdate({
        target: [executiveDailyHealthChecks.workspaceKey, executiveDailyHealthChecks.date],
        set: {
          score: brief.score,
          aiConfidence: brief.aiConfidence,
          brief: briefToJson(brief),
          alerts: brief.alerts,
          sourceHash,
          generatedBy: brief.generatedBy,
          modelName: brief.modelName,
          updatedAt: new Date(),
        },
      })
      .returning()
    return recordToBrief(record) || brief
  } catch (error) {
    debugWarn("[Daily Health] Failed to store daily brief; returning uncached brief", error)
    return brief
  }
}

function hashDailyHealthSource(source: DailyHealthSource) {
  const dashboardFingerprint = getDashboardDataFingerprint({
    datasetCount: source.datasets.length,
    activeDatasetCount: source.datasets.filter((dataset) => dataset.rowCount >= 0).length,
    totalRows: source.datasets.reduce((total, dataset) => total + dataset.rowCount, 0),
    latestUpload: source.datasets[0]
      ? {
          ...source.datasets[0],
          fileName: source.datasets[0].name,
          fileSize: null,
          data: source.datasets[0].rows,
          status: "ready",
          updatedAt: source.datasets[0].createdAt,
          precomputedMetrics: null,
          detectedColumns: null,
        }
      : null,
    fileTypeCounts: { csv: 0, excel: 0, snowflake: 0, api: 0, other: 0 },
    detectedColumns: {},
    allColumns: Array.from(new Set(source.datasets.flatMap((dataset) => dataset.columns))),
    datasets: [],
  })
  return createHash("sha256").update(dashboardFingerprint).digest("hex")
}

export const healthSignalProviders: HealthSignalProvider[] = [
  {
    id: "dataset_freshness",
    collect: (_source, metrics) => {
      const age = metrics.latestUploadAgeDays
      const score = age === null ? 18 : age <= 7 ? 94 : age <= 30 ? 72 : age <= 90 ? 48 : 26
      const stale = age !== null && age > 30
      return {
        id: "dataset_freshness",
        label: "Dataset freshness",
        score,
        confidence: age === null ? 35 : 84,
        summary: age === null ? "No uploads are available." : `Latest upload is ${age} day${age === 1 ? "" : "s"} old.`,
        alerts: stale ? [{
          type: "dataset_outdated",
          severity: age > 90 ? "critical" : "warning",
          title: "Dataset freshness needs attention",
          message: `The newest dataset is ${age} days old.`,
        }] : [],
      }
    },
  },
  {
    id: "profile_readiness",
    collect: (source) => ({
      id: "profile_readiness",
      label: "Business profile",
      score: source.profileComplete ? 96 : source.hasBusinessProfile ? 68 : 32,
      confidence: 88,
      summary: source.profileComplete ? "Business profile is ready for contextual analysis." : "Business profile context is incomplete.",
    }),
  },
  {
    id: "inventory_health",
    collect: (_source, metrics) => {
      const score = metrics.inventoryHealth ?? 58
      const alerts: ExecutiveDailyAlert[] = []
      if ((metrics.lowStockCount ?? 0) > 0) {
        alerts.push({
          type: "low_stock",
          severity: (metrics.lowStockCount ?? 0) > 5 ? "critical" : "warning",
          title: "Low stock detected",
          message: `${metrics.lowStockCount} product line${metrics.lowStockCount === 1 ? "" : "s"} sit at the low end of inventory.`,
        })
      }
      if ((metrics.deadStockCount ?? 0) > 0) {
        alerts.push({
          type: "dead_stock",
          severity: "warning",
          title: "Dead stock detected",
          message: `${metrics.deadStockCount} product line${metrics.deadStockCount === 1 ? "" : "s"} show stock with no detected movement.`,
        })
      }
      return {
        id: "inventory_health",
        label: "Inventory health",
        score,
        confidence: metrics.inventoryHealth === null ? 42 : 78,
        summary: metrics.inventoryHealth === null ? "Inventory columns are not available." : `Inventory health score is ${score}/100.`,
        alerts,
      }
    },
  },
  {
    id: "profitability",
    collect: (_source, metrics) => {
      const margin = metrics.profitMargin
      const score = margin === null ? 52 : margin >= 30 ? 92 : margin >= 15 ? 70 : margin >= 0 ? 48 : 22
      return {
        id: "profitability",
        label: "Profitability",
        score,
        confidence: margin === null ? 38 : 78,
        summary: margin === null ? "Profitability columns are not available." : `Detected profit margin is ${margin.toFixed(1)}%.`,
        alerts: margin !== null && margin < 15 ? [{
          type: "margin_pressure",
          severity: margin < 0 ? "critical" : "warning",
          title: "Margin pressure",
          message: `Detected profit margin is ${margin.toFixed(1)}%.`,
        }] : [],
      }
    },
  },
  {
    id: "forecast_reliability",
    collect: (_source, metrics) => ({
      id: "forecast_reliability",
      label: "Forecast reliability",
      score: metrics.forecastReliability,
      confidence: metrics.forecastReliability >= 60 ? 72 : 44,
      summary: metrics.forecastReliability >= 60 ? "Dated data supports a directional forecast." : "More dated rows improve forecast reliability.",
    }),
  },
]

function calculateMetrics(source: DailyHealthSource): DailyHealthMetrics {
  const rows = source.datasets.flatMap((dataset) => dataset.rows)
  const columns = detectColumns(source.datasets.flatMap((dataset) => dataset.columns), rows)
  const latestUploadAgeDays = source.datasets[0] ? daysBetween(source.datasets[0].createdAt, new Date()) : null
  const revenueRows = rows.map((row) => getNumber(row, columns.revenue)).filter(isNumber)
  const costRows = rows.map((row) => getNumber(row, columns.cost)).filter(isNumber)
  const profitRows = rows.map((row) => getNumber(row, columns.profit)).filter(isNumber)
  const totalRevenue = columns.revenue ? sum(revenueRows) : null
  const totalCost = columns.cost ? sum(costRows) : null
  const explicitProfit = columns.profit ? sum(profitRows) : null
  const totalProfit = explicitProfit ?? (totalRevenue !== null && totalCost !== null ? totalRevenue - totalCost : null)
  const profitMargin = totalRevenue && totalProfit !== null ? (totalProfit / totalRevenue) * 100 : null
  const revenueSeries = buildSeries(rows, columns.date, columns.revenue)
  const revenueChangePct = revenueSeries.length >= 2 && revenueSeries[revenueSeries.length - 2].value !== 0
    ? ((revenueSeries[revenueSeries.length - 1].value - revenueSeries[revenueSeries.length - 2].value) / Math.abs(revenueSeries[revenueSeries.length - 2].value)) * 100
    : null
  const lowStockCount = columns.stock ? countLowStock(rows, columns) : null
  const deadStockCount = columns.stock && (columns.quantity || columns.revenue) ? countDeadStock(rows, columns) : null
  const inventoryHealth = lowStockCount === null && deadStockCount === null
    ? null
    : clamp(90 - (lowStockCount || 0) * 5 - (deadStockCount || 0) * 6, 10, 98)
  const missingDataCount = [
    !columns.revenue,
    !columns.profit && !(columns.revenue && columns.cost),
    !columns.date,
    !columns.product && !columns.sku,
    !source.hasBusinessProfile,
  ].filter(Boolean).length

  return {
    rowCount: source.datasets.reduce((total, dataset) => total + dataset.rowCount, 0),
    latestUploadAgeDays,
    totalRevenue,
    previousRevenue: revenueSeries.at(-2)?.value ?? null,
    revenueChangePct,
    totalProfit,
    profitMargin,
    lowStockCount,
    deadStockCount,
    inventoryHealth,
    forecastReliability: columns.date && revenueSeries.length >= 3 ? 82 : columns.date ? 58 : 32,
    missingDataCount,
    aiInsightCount: source.datasets.reduce((total, dataset) => total + countInsights(dataset.analysis) + countInsights(dataset.aiInsights), 0),
    columns,
  }
}

function buildDeterministicBrief(source: DailyHealthSource, metrics: DailyHealthMetrics, signals: HealthSignal[]) {
  const weightedScore = Math.round(signals.reduce((total, signal) => total + signal.score, 0) / Math.max(signals.length, 1))
  const score = clamp(weightedScore - metrics.missingDataCount * 3, 0, 100)
  const aiConfidence = clamp(Math.round(signals.reduce((total, signal) => total + signal.confidence, 0) / Math.max(signals.length, 1)) + Math.min(10, metrics.aiInsightCount), 0, 100)
  const alerts = signals.flatMap((signal) => signal.alerts || [])
  const criticalRisks = [
    ...alerts.map((alert) => alert.message),
    ...(metrics.revenueChangePct !== null && metrics.revenueChangePct < -20 ? [`Revenue dropped ${Math.abs(metrics.revenueChangePct).toFixed(1)}% versus the previous detected period.`] : []),
    ...(metrics.latestUploadAgeDays === null ? ["No uploaded datasets are available for executive analysis."] : []),
  ].slice(0, 5)
  const topOpportunities = [
    metrics.profitMargin !== null ? "Protect or expand the highest-margin products and segments." : "Add profit or cost columns to unlock margin opportunities.",
    metrics.lowStockCount !== null ? "Prioritize stock coverage for products with the lowest detected inventory." : "Add stock columns to unlock inventory optimisation.",
    source.hasBusinessProfile ? "Use the business profile context to sharpen AI recommendations." : "Complete the Business Profile to improve executive recommendations.",
  ]
  const todaysPriorities = [
    alerts[0]?.title || "Review the latest uploaded dataset",
    metrics.forecastReliability < 60 ? "Upload dated rows to improve forecast confidence" : "Review forecast trend and revenue movement",
    metrics.missingDataCount > 0 ? "Close missing-data gaps for stronger KPI coverage" : "Turn daily insights into owner actions",
  ]
  const recommendedActions: ExecutiveDailyRecommendation[] = [
    ...signals.flatMap((signal) => signal.recommendations || []),
    {
      priority: (alerts.some((alert) => alert.severity === "critical") ? "Critical" : "High") as Priority,
      estimatedImpact: metrics.totalRevenue !== null ? `Protect performance across ${formatCurrency(metrics.totalRevenue)} detected revenue.` : "Improves daily executive visibility.",
      confidence: aiConfidence,
      reason: signals.map((signal) => signal.summary).slice(0, 2).join(" "),
      suggestedAction: todaysPriorities[0] || "Review the latest dataset and follow the priority actions.",
    },
  ].slice(0, 6)

  return {
    score,
    aiConfidence,
    executiveSummary: source.datasets.length === 0
      ? "No uploaded datasets are available yet. Upload business data to activate the Daily Executive Health Check."
      : `Today's health score is ${score}/100 across ${source.datasets.length} dataset${source.datasets.length === 1 ? "" : "s"} and ${formatNumber(metrics.rowCount)} processed rows.`,
    topOpportunities,
    criticalRisks,
    anomalies: buildAnomalies(metrics),
    todaysPriorities,
    recommendedActions,
    forecast: metrics.forecastReliability >= 60
      ? "Available dated data supports a directional forecast. Review revenue movement and margin pressure before committing operating decisions."
      : "Forecast confidence is limited until more dated revenue, order, or inventory rows are uploaded.",
    estimatedBusinessImpact: metrics.totalProfit !== null
      ? `Current detected profit is ${formatCurrency(metrics.totalProfit)} with ${metrics.profitMargin !== null ? `${metrics.profitMargin.toFixed(1)}% margin` : "limited margin context"}.`
      : "Business impact estimation improves when revenue, cost, and profit columns are available.",
    alerts,
  }
}

function buildAnomalies(metrics: DailyHealthMetrics) {
  const anomalies: string[] = []
  if (metrics.revenueChangePct !== null && Math.abs(metrics.revenueChangePct) >= 20) {
    anomalies.push(`Revenue moved ${metrics.revenueChangePct >= 0 ? "+" : ""}${metrics.revenueChangePct.toFixed(1)}% versus the previous detected period.`)
  }
  if ((metrics.lowStockCount || 0) > 0) anomalies.push(`${metrics.lowStockCount} low-stock line${metrics.lowStockCount === 1 ? "" : "s"} detected.`)
  if ((metrics.deadStockCount || 0) > 0) anomalies.push(`${metrics.deadStockCount} dead-stock line${metrics.deadStockCount === 1 ? "" : "s"} detected.`)
  if (metrics.latestUploadAgeDays !== null && metrics.latestUploadAgeDays > 30) anomalies.push(`Newest dataset is ${metrics.latestUploadAgeDays} days old.`)
  return anomalies.length > 0 ? anomalies : ["No critical anomaly was detected from the available uploaded data."]
}

function detectColumns(columns: string[], rows: DataRow[]): ColumnMap {
  const allColumns = Array.from(new Set([...columns, ...rows.slice(0, 20).flatMap((row) => Object.keys(row))]))
  return {
    revenue: findColumn(allColumns, [/revenue/, /^sales$/, /sales_amount/, /net_sales/, /turnover/, /total_revenue/, /amount/]),
    profit: findColumn(allColumns, [/profit/, /net_profit/, /gross_profit/, /operating_profit/, /gross_margin/, /earnings/, /contribution/]),
    cost: findColumn(allColumns, [/^cost$/, /costs/, /cogs/, /expense/, /operating_costs/, /spend/]),
    date: findColumn(allColumns, [/date/, /order_date/, /sale_date/, /transaction_date/, /month/, /period/, /created/, /year/]),
    product: findColumn(allColumns, [/product/, /product_name/, /^sku$/, /^item$/, /item_name/, /title/, /name/]),
    sku: findColumn(allColumns, [/sku/, /barcode/, /variant/]),
    quantity: findColumn(allColumns, [/quantity/, /^qty$/, /units/, /sold/, /count/]),
    stock: findColumn(allColumns, [/stock/, /inventory/, /inventory_level/, /quantity_on_hand/, /units_in_stock/, /on_hand/, /available/]),
    category: findColumn(allColumns, [/category/, /department/, /segment/, /type/]),
  }
}

function buildSeries(rows: DataRow[], dateColumn: string | undefined, valueColumn: string | undefined) {
  if (!dateColumn || !valueColumn) return []
  const buckets = new Map<string, number>()
  for (const row of rows) {
    const date = parseDate(row[dateColumn])
    const value = getNumber(row, valueColumn)
    if (!date || value === null) continue
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`
    buckets.set(key, (buckets.get(key) || 0) + value)
  }
  return Array.from(buckets.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => a.label.localeCompare(b.label)).slice(-8)
}

function countLowStock(rows: DataRow[], columns: ColumnMap) {
  if (!columns.stock) return 0
  const values = rows.map((row) => getNumber(row, columns.stock)).filter(isNumber).sort((a, b) => a - b)
  if (values.length === 0) return 0
  const threshold = values[Math.max(0, Math.floor(values.length * 0.15) - 1)]
  return values.filter((value) => value <= threshold).length
}

function countDeadStock(rows: DataRow[], columns: ColumnMap) {
  const productColumn = columns.product || columns.sku
  if (!productColumn || !columns.stock || !(columns.quantity || columns.revenue)) return 0
  const grouped = new Map<string, { stock: number; movement: number }>()
  for (const row of rows) {
    const key = String(row[productColumn] || "").trim()
    if (!key) continue
    const current = grouped.get(key) || { stock: 0, movement: 0 }
    current.stock += getNumber(row, columns.stock) || 0
    current.movement += getNumber(row, columns.quantity || columns.revenue) || 0
    grouped.set(key, current)
  }
  return Array.from(grouped.values()).filter((value) => value.stock > 0 && value.movement <= 0).length
}

function briefToJson(brief: ExecutiveDailyBrief): Record<string, unknown> {
  return {
    executiveSummary: brief.executiveSummary,
    topOpportunities: brief.topOpportunities,
    criticalRisks: brief.criticalRisks,
    anomalies: brief.anomalies,
    todaysPriorities: brief.todaysPriorities,
    recommendedActions: brief.recommendedActions,
    forecast: brief.forecast,
    estimatedBusinessImpact: brief.estimatedBusinessImpact,
  }
}

function recordToBrief(record: typeof executiveDailyHealthChecks.$inferSelect): ExecutiveDailyBrief | null {
  const brief = isRecord(record.brief) ? record.brief : {}
  return {
    id: record.id,
    userId: record.userId,
    workspaceId: record.workspaceId,
    workspaceKey: record.workspaceKey,
    date: record.date,
    score: record.score,
    aiConfidence: record.aiConfidence,
    executiveSummary: readString(brief.executiveSummary, "Daily Executive Health Check is available."),
    topOpportunities: readStringList(brief.topOpportunities, []),
    criticalRisks: readStringList(brief.criticalRisks, []),
    anomalies: readStringList(brief.anomalies, []),
    todaysPriorities: readStringList(brief.todaysPriorities, []),
    recommendedActions: readRecommendations(brief.recommendedActions, []),
    forecast: readString(brief.forecast, "Forecast unavailable until dated data is uploaded."),
    estimatedBusinessImpact: readString(brief.estimatedBusinessImpact, "Business impact estimation is limited by available data."),
    alerts: Array.isArray(record.alerts) ? record.alerts.filter(isExecutiveAlert) : [],
    generatedBy: record.generatedBy,
    modelName: record.modelName,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

function parseJsonObject(value: string) {
  const trimmed = value.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim()
  try {
    const parsed = JSON.parse(trimmed)
    return isRecord(parsed) ? parsed : null
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      const parsed = JSON.parse(match[0])
      return isRecord(parsed) ? parsed : null
    } catch {
      return null
    }
  }
}

function readString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback
}

function readStringList(value: unknown, fallback: string[]) {
  return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 8) : fallback
}

function readRecommendations(value: unknown, fallback: ExecutiveDailyRecommendation[]) {
  if (!Array.isArray(value)) return fallback
  return value.filter(isRecord).map((item) => ({
    priority: normalizePriority(item.priority),
    estimatedImpact: readString(item.estimatedImpact, "Improves executive decision quality."),
    confidence: clamp(Number(item.confidence || 70), 0, 100),
    reason: readString(item.reason, "Detected from uploaded business data."),
    suggestedAction: readString(item.suggestedAction, "Review this item in the dashboard."),
  })).slice(0, 8)
}

function normalizePriority(value: unknown): Priority {
  const normalized = String(value || "").toLowerCase()
  if (normalized.includes("critical")) return "Critical"
  if (normalized.includes("high")) return "High"
  if (normalized.includes("low")) return "Low"
  return "Medium"
}

function isExecutiveAlert(value: unknown): value is ExecutiveDailyAlert {
  return isRecord(value) && typeof value.title === "string" && typeof value.message === "string"
}

function findColumn(columns: string[], patterns: RegExp[]) {
  return columns.find((column) => {
    const lower = column.toLowerCase().trim()
    const normalized = normalizeDashboardColumnName(column)
    return patterns.some((pattern) => pattern.test(lower) || pattern.test(normalized))
  })
}

function getNumber(row: DataRow, column: string | undefined): number | null {
  if (!column) return null
  const value = row[column]
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value !== "string") return null
  const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : null
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value
  if (typeof value !== "string" && typeof value !== "number") return null
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) ? parsed : null
}

function countInsights(value: unknown): number {
  if (!isRecord(value)) return 0
  return [value.insights, value.recommendations, value.risks, value.opportunities, value.recommendedActions]
    .reduce<number>((total, entry) => total + (Array.isArray(entry) ? entry.length : 0), 0)
}

function getUtcDateKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`
}

function getWorkspaceKey(userId: string, workspaceId: string | null) {
  return workspaceId ? `workspace:${workspaceId}` : `user:${userId}`
}

function daysBetween(start: Date, end: Date) {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86_400_000))
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0)
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)
}
