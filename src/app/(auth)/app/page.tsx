import { WorldMapRevenue, type RegionData } from "@/components/ui/world-map-revenue"
import { Card } from "@/components/ui/card"
import { ExecutiveDashboardTabs } from "@/components/dashboard/executive-dashboard-tabs"
import { GenerateReportAction } from "@/components/dashboard/generate-report-action"
import { auth } from "@/lib/auth/auth"
import { resolveDashboardAnalysisScope } from "@/lib/data/analysis-scope"
import {
  getBusinessModelKpiNames,
  getBusinessModelLabel,
  shouldRenderWorldMapForBusinessModel,
  type BusinessModel,
} from "@/lib/data/business-model"
import {
  listDashboardDatasetChoices,
  loadDashboardDatasetAggregation,
  normalizeDashboardColumnName,
  type DashboardAggregatedDataset,
  type DashboardDatasetChoice,
  type NormalizedDashboardData,
} from "@/lib/data/dashboard-dataset-aggregation"
import { db } from "@/lib/db"
import { aiInteractionTraces, profiles } from "@/lib/db/schema"
import { type ExecutiveDailyBrief } from "@/lib/executive/daily-health"
import { listAllReports } from "@/lib/reports/report-generator"
import { count, desc, eq } from "drizzle-orm"
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Brain,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Database,
  FileSpreadsheet,
  Globe2,
  Package,
  PieChart,
  Sparkles,
  TrendingUp,
  Warehouse,
} from "lucide-react"
import Link from "next/link"
import type React from "react"

export const metadata = {
  title: "Dashboard - UseClevr",
  description: "Executive analytics dashboard",
}

type Tone = "cyan" | "violet" | "emerald" | "amber" | "rose" | "slate"
type RangeKey = "7d" | "30d" | "90d" | "12m"
type DashboardTab = "overview" | "financial" | "inventory" | "geography" | "ai"
type DataRow = Record<string, unknown>

type DashboardDataset = DashboardAggregatedDataset

type ColumnMap = {
  revenue?: string
  profit?: string
  cost?: string
  expense?: string
  date?: string
  product?: string
  sku?: string
  quantity?: string
  stock?: string
  price?: string
  category?: string
  region?: string
  customer?: string
  order?: string
  supplier?: string
  latitude?: string
  longitude?: string
}

type SeriesPoint = { label: string; value: number }
type RankedItem = { name: string; value: number; detail?: string }
type ExecutiveRecommendation = {
  title: string
  priority: "High" | "Medium" | "Low"
  confidence: number
  impact: string
  action: string
  source: string
}

type DashboardStats = {
  datasets: number
  analyses: number
  reports: number
  aiTraceCount: number
  dashboardData: NormalizedDashboardData
  hasProfile: boolean
  hasBusiness: boolean
  profile: {
    firstName: string | null
    fullName: string | null
    email: string | null
    businessName: string | null
    companyName: string | null
  } | null
  allDatasets: DashboardDataset[]
  latestDataset: DashboardDataset | null
  reportsList: { id: string; summary?: string; datasetName?: string; createdAt?: string; datasetId: string }[]
  latestAiTraces: { id: string; prompt: string; response: string; providerName: string; createdAt: Date }[]
}

type ExecutiveMetrics = {
  columns: ColumnMap
  rowCount: number
  loadedRowCount: number
  totalRevenue: number | null
  totalProfit: number | null
  totalCost: number | null
  profitMargin: number | null
  activeDatasets: number
  products: number | null
  inventoryValue: number | null
  deadStock: number | null
  aiInsightsGenerated: number
  revenueTrend: SeriesPoint[]
  profitTrend: SeriesPoint[]
  inventoryTrend: SeriesPoint[]
  ordersTrend: SeriesPoint[]
  uploadTrend: SeriesPoint[]
  topProducts: RankedItem[]
  worstProducts: RankedItem[]
  lowStock: RankedItem[]
  deadStockItems: RankedItem[]
  overstock: RankedItem[]
  categoryDistribution: RankedItem[]
  regions: RegionData[]
  recommendations: ExecutiveRecommendation[]
  businessModel: BusinessModel
  supportedKpis: string[]
  businessHealth: {
    health: number
    aiConfidence: number
    readiness: number
    forecastConfidence: number
    growthScore: number
  }
}

const RANGE_LABELS: Record<RangeKey, string> = {
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  "12m": "12 months",
}

async function getStats(userId: string | null, selectedDatasetId?: string | null): Promise<DashboardStats> {
  if (!userId) return emptyStats()
  if (!selectedDatasetId) return emptyStats()

  const dashboardData = await loadDashboardDatasetAggregation(userId, { datasetId: selectedDatasetId })

  try {
    const [aiTraceCount, profile, latestAiTraces] = await Promise.all([
      db.select({ value: count() }).from(aiInteractionTraces).where(eq(aiInteractionTraces.userId, userId)).catch(() => [{ value: 0 }]),
      db.query.profiles.findFirst({
        where: eq(profiles.userId, userId),
        columns: { id: true, firstName: true, fullName: true, email: true, businessName: true, companyName: true },
      }).catch(() => null),
      db.query.aiInteractionTraces.findMany({
        where: eq(aiInteractionTraces.userId, userId),
        orderBy: [desc(aiInteractionTraces.createdAt)],
        limit: 6,
        columns: { id: true, prompt: true, response: true, providerName: true, createdAt: true },
      }).catch(() => []),
    ])

    const allDatasets = dashboardData.datasets
    const datasetIds = new Set(allDatasets.map((dataset) => dataset.id))
    const reportsList = listAllReports()
      .filter((report) => datasetIds.has(report.datasetId))
      .slice(0, 8)
      .map((report) => ({
        id: report.id,
        summary: report.summary,
        datasetName: report.datasetName,
        createdAt: report.createdAt,
        datasetId: report.datasetId,
      }))

    return {
      datasets: dashboardData.datasetCount,
      analyses: allDatasets.filter((dataset) => dataset.analysisStatus === "completed" || hasAnalysisSignals(dataset)).length,
      reports: reportsList.length,
      aiTraceCount: Number(aiTraceCount[0]?.value || 0),
      dashboardData,
      hasProfile: Boolean(profile),
      hasBusiness: Boolean(profile?.businessName || profile?.companyName),
      profile: profile
        ? {
            firstName: profile.firstName,
            fullName: profile.fullName,
            email: profile.email,
            businessName: profile.businessName,
            companyName: profile.companyName,
          }
        : null,
      allDatasets,
      latestDataset: allDatasets[0] || null,
      reportsList,
      latestAiTraces: latestAiTraces.map((trace) => ({
        ...trace,
        createdAt: trace.createdAt || new Date(),
      })),
    }
  } catch {
    return {
      ...emptyStats(),
      datasets: dashboardData.datasetCount,
      dashboardData,
      allDatasets: dashboardData.datasets,
      latestDataset: dashboardData.latestUpload,
    }
  }
}

function emptyStats(): DashboardStats {
  return {
    datasets: 0,
    analyses: 0,
    reports: 0,
    aiTraceCount: 0,
    dashboardData: {
      datasetCount: 0,
      activeDatasetCount: 0,
      totalRows: 0,
      latestUpload: null,
      fileTypeCounts: { csv: 0, excel: 0, snowflake: 0, api: 0, other: 0 },
      detectedColumns: {},
      businessModelCounts: {
        local_retail: 0,
        ecommerce: 0,
        saas: 0,
        startup: 0,
        investor: 0,
        marketplace: 0,
        generic: 0,
      },
      dominantBusinessModel: "generic",
      allColumns: [],
      datasets: [],
    },
    hasProfile: false,
    hasBusiness: false,
    profile: null,
    allDatasets: [],
    latestDataset: null,
    reportsList: [],
    latestAiTraces: [],
  }
}

function buildExecutiveMetrics(stats: DashboardStats, range: RangeKey): ExecutiveMetrics {
  const businessModel = stats.dashboardData.dominantBusinessModel
  const rows = stats.allDatasets.flatMap((dataset) =>
    dataset.data.map((row) => ({
      row,
      dataset,
    })),
  )
  const columns = detectColumns(stats.allDatasets, rows.map((entry) => entry.row))
  const filteredRows = filterRowsByRange(rows, columns.date, range)
  const activeRows = filteredRows.length > 0 || columns.date ? filteredRows : rows

  const revenueValues = activeRows.map(({ row }) => getNumber(row, columns.revenue))
  const costValues = activeRows.map(({ row }) => getNumber(row, columns.cost || columns.expense))
  const profitValues = activeRows.map(({ row }) => getNumber(row, columns.profit))

  const totalRevenue = columns.revenue ? sum(revenueValues) : null
  const explicitProfit = columns.profit ? sum(profitValues) : null
  const totalCost = columns.cost || columns.expense ? sum(costValues) : null
  const totalProfit = explicitProfit ?? (totalRevenue !== null && totalCost !== null ? totalRevenue - totalCost : null)
  const profitMargin = totalRevenue && totalProfit !== null ? (totalProfit / totalRevenue) * 100 : null
  const products = columns.product || columns.sku ? uniqueCount(activeRows.map(({ row }) => String(row[columns.product || columns.sku || ""] || "").trim()).filter(Boolean)) : null
  const inventoryValue = columns.stock && (columns.price || columns.cost)
    ? activeRows.reduce((total, { row }) => total + (getNumber(row, columns.stock) || 0) * (getNumber(row, columns.price || columns.cost) || 0), 0)
    : null
  const deadStockItems = buildDeadStock(activeRows.map((entry) => entry.row), columns)
  const lowStock = buildStockList(activeRows.map((entry) => entry.row), columns, "low")
  const overstock = buildStockList(activeRows.map((entry) => entry.row), columns, "high")
  const topProducts = buildRanked(activeRows.map((entry) => entry.row), columns.product || columns.sku, columns.revenue || columns.profit || columns.quantity)
  const worstProducts = [...topProducts].reverse().slice(0, 6)
  const categoryDistribution = buildRanked(activeRows.map((entry) => entry.row), columns.category, columns.revenue || columns.profit || columns.quantity).slice(0, 7)

  const revenueTrend = buildSeries(activeRows, columns.date, columns.revenue, range)
  const profitTrend = buildSeries(activeRows, columns.date, columns.profit, range, totalRevenue !== null && totalCost !== null ? columns.revenue : undefined, columns.cost || columns.expense)
  const inventoryTrend = buildSeries(activeRows, columns.date, columns.stock, range)
  const ordersTrend = columns.order
    ? buildCountSeries(activeRows, columns.date, columns.order, range)
    : buildSeries(activeRows, columns.date, columns.quantity, range)
  const uploadTrend = buildUploadSeries(stats.allDatasets, range)
  const regions = buildRegions(activeRows, columns)
  const aiInsightsGenerated = countAiInsights(stats.allDatasets) + stats.aiTraceCount
  const recommendations = buildRecommendations({
    stats,
    columns,
    profitMargin,
    lowStock,
    deadStockItems,
    overstock,
    topProducts,
    aiInsightsGenerated,
  })

  const readiness = score([
    stats.hasProfile,
    stats.hasBusiness,
    stats.datasets > 0,
    rows.length > 0,
    Boolean(columns.revenue || columns.profit || columns.stock),
  ])
  const aiConfidence = Math.min(96, 34 + stats.analyses * 10 + aiInsightsGenerated * 2 + (rows.length > 0 ? 20 : 0) + (stats.hasBusiness ? 12 : 0))
  const forecastConfidence = score([Boolean(columns.date), revenueTrend.length >= 3 || profitTrend.length >= 3, stats.datasets > 0, stats.analyses > 0])
  const growthScore = revenueTrend.length >= 2 ? trendScore(revenueTrend) : readiness

  return {
    columns,
    rowCount: stats.dashboardData.totalRows,
    loadedRowCount: rows.length,
    totalRevenue,
    totalProfit,
    totalCost,
    profitMargin,
    activeDatasets: stats.dashboardData.activeDatasetCount,
    products,
    inventoryValue,
    deadStock: columns.stock ? deadStockItems.length : null,
    aiInsightsGenerated,
    revenueTrend,
    profitTrend,
    inventoryTrend,
    ordersTrend,
    uploadTrend,
    topProducts,
    worstProducts,
    lowStock,
    deadStockItems,
    overstock,
    categoryDistribution,
    regions,
    recommendations,
    businessModel,
    supportedKpis: getBusinessModelKpiNames(businessModel),
    businessHealth: {
      health: Math.round((readiness + aiConfidence + forecastConfidence + growthScore) / 4),
      aiConfidence,
      readiness,
      forecastConfidence,
      growthScore,
    },
  }
}

function detectColumns(datasetsToInspect: DashboardDataset[], rows: DataRow[]): ColumnMap {
  const detected = datasetsToInspect.map((dataset) => dataset.detectedColumns).find(isRecord) as Record<string, unknown> | undefined
  const allColumns = unique([
    ...datasetsToInspect.flatMap((dataset) => dataset.columns),
    ...rows.slice(0, 20).flatMap((row) => Object.keys(row)),
  ])
  const fromDetected = (keys: string[]) => keys.map((key) => detected?.[key]).find((value): value is string => typeof value === "string")

  return {
    revenue: fromDetected(["revenueColumn", "revenue"]) || findColumn(allColumns, [/revenue/, /^sales$/, /sales_amount/, /net_sales/, /gross_sales/, /amount/, /turnover/, /total_revenue/]),
    profit: fromDetected(["profitColumn", "profit"]) || findColumn(allColumns, [/profit/, /net_profit/, /gross_profit/, /operating_profit/, /gross_margin/, /contribution/, /earnings/]),
    cost: fromDetected(["costColumn", "cost"]) || findColumn(allColumns, [/^cost$/, /costs/, /cogs/, /expense/, /operating_costs/, /unit_cost/, /purchase_price/]),
    expense: findColumn(allColumns, [/expense/, /expenses/, /opex/, /spend/]),
    date: fromDetected(["dateColumn", "date"]) || findColumn(allColumns, [/date/, /order_date/, /sale_date/, /transaction_date/, /month/, /period/, /created/, /year/]),
    product: fromDetected(["productColumn", "product"]) || findColumn(allColumns, [/product/, /product_name/, /^sku$/, /^item$/, /item_name/, /title/, /name/]),
    sku: findColumn(allColumns, [/sku/, /barcode/, /variant/]),
    quantity: fromDetected(["quantityColumn", "quantity"]) || findColumn(allColumns, [/quantity/, /^qty$/, /units/, /sold/, /count/]),
    stock: findColumn(allColumns, [/stock/, /inventory/, /inventory_level/, /quantity_on_hand/, /units_in_stock/, /on_hand/, /available/]),
    price: findColumn(allColumns, [/price/, /unit_price/, /sale_price/, /retail_price/]),
    category: findColumn(allColumns, [/category/, /department/, /segment/, /type/]),
    region: fromDetected(["regionColumn", "fallbackRegionColumn", "region"]) || findColumn(allColumns, [/country/, /region/, /city/, /state/, /territory/, /market/, /location/]),
    customer: findColumn(allColumns, [/customer/, /client/, /account/, /company/]),
    order: findColumn(allColumns, [/order id/, /^order$/, /invoice/, /transaction/]),
    supplier: findColumn(allColumns, [/supplier/, /vendor/, /brand/]),
    latitude: findColumn(allColumns, [/^lat$/, /latitude/]),
    longitude: findColumn(allColumns, [/^lon$/, /^lng$/, /longitude/]),
  }
}

function findColumn(columns: string[], patterns: RegExp[]) {
  return columns.find((column) => {
    const lower = column.toLowerCase().trim()
    const normalized = normalizeDashboardColumnName(column)
    return patterns.some((pattern) => pattern.test(lower) || pattern.test(normalized))
  })
}

function filterRowsByRange(rows: { row: DataRow; dataset: DashboardDataset }[], dateColumn: string | undefined, range: RangeKey) {
  if (!dateColumn) return rows
  const dated = rows
    .map((entry) => ({ ...entry, date: parseDate(entry.row[dateColumn]) }))
    .filter((entry) => entry.date)
  if (dated.length === 0) return rows
  const latest = new Date(Math.max(...dated.map((entry) => entry.date!.getTime())))
  const since = new Date(latest)
  if (range === "12m") since.setMonth(since.getMonth() - 12)
  else since.setDate(since.getDate() - Number(range.replace("d", "")))
  return dated.filter((entry) => entry.date! >= since).map(({ date: _date, ...entry }) => entry)
}

function buildSeries(
  rows: { row: DataRow; dataset: DashboardDataset }[],
  dateColumn: string | undefined,
  valueColumn: string | undefined,
  range: RangeKey,
  revenueColumn?: string,
  costColumn?: string,
): SeriesPoint[] {
  if (!valueColumn && !(revenueColumn && costColumn)) return []
  const aggregate = new Map<string, number>()
  for (const { row, dataset } of rows) {
    const key = dateColumn ? formatBucket(parseDate(row[dateColumn]), range) : formatBucket(dataset.createdAt, range)
    if (!key) continue
    const value = revenueColumn && costColumn
      ? (getNumber(row, revenueColumn) || 0) - (getNumber(row, costColumn) || 0)
      : getNumber(row, valueColumn)
    if (value === null) continue
    aggregate.set(key, (aggregate.get(key) || 0) + value)
  }
  return Array.from(aggregate.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => a.label.localeCompare(b.label)).slice(-16)
}

function buildCountSeries(rows: { row: DataRow; dataset: DashboardDataset }[], dateColumn: string | undefined, orderColumn: string, range: RangeKey): SeriesPoint[] {
  const aggregate = new Map<string, Set<string>>()
  for (const { row, dataset } of rows) {
    const key = dateColumn ? formatBucket(parseDate(row[dateColumn]), range) : formatBucket(dataset.createdAt, range)
    const orderId = String(row[orderColumn] || "").trim()
    if (!key || !orderId) continue
    if (!aggregate.has(key)) aggregate.set(key, new Set())
    aggregate.get(key)!.add(orderId)
  }
  return Array.from(aggregate.entries()).map(([label, value]) => ({ label, value: value.size })).sort((a, b) => a.label.localeCompare(b.label)).slice(-16)
}

function buildUploadSeries(datasetList: DashboardDataset[], range: RangeKey): SeriesPoint[] {
  const aggregate = new Map<string, number>()
  for (const dataset of datasetList) {
    const key = formatBucket(dataset.createdAt, range)
    if (!key) continue
    aggregate.set(key, (aggregate.get(key) || 0) + dataset.rowCount)
  }
  return Array.from(aggregate.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => a.label.localeCompare(b.label)).slice(-16)
}

function buildRanked(rows: DataRow[], nameColumn: string | undefined, valueColumn: string | undefined): RankedItem[] {
  if (!nameColumn || !valueColumn) return []
  const aggregate = new Map<string, number>()
  for (const row of rows) {
    const name = String(row[nameColumn] || "").trim()
    const value = getNumber(row, valueColumn)
    if (!name || value === null) continue
    aggregate.set(name, (aggregate.get(name) || 0) + value)
  }
  return Array.from(aggregate.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8)
}

function buildStockList(rows: DataRow[], columns: ColumnMap, mode: "low" | "high"): RankedItem[] {
  const nameColumn = columns.product || columns.sku
  if (!nameColumn || !columns.stock) return []
  const stockByProduct = new Map<string, number>()
  for (const row of rows) {
    const name = String(row[nameColumn] || "").trim()
    const stock = getNumber(row, columns.stock)
    if (!name || stock === null) continue
    stockByProduct.set(name, (stockByProduct.get(name) || 0) + stock)
  }
  const sorted = Array.from(stockByProduct.entries()).map(([name, value]) => ({ name, value }))
  return (mode === "low" ? sorted.sort((a, b) => a.value - b.value) : sorted.sort((a, b) => b.value - a.value)).slice(0, 6)
}

function buildDeadStock(rows: DataRow[], columns: ColumnMap): RankedItem[] {
  const nameColumn = columns.product || columns.sku
  if (!nameColumn || !columns.stock || !(columns.quantity || columns.revenue)) return []
  const byProduct = new Map<string, { stock: number; movement: number }>()
  for (const row of rows) {
    const name = String(row[nameColumn] || "").trim()
    if (!name) continue
    const current = byProduct.get(name) || { stock: 0, movement: 0 }
    current.stock += getNumber(row, columns.stock) || 0
    current.movement += getNumber(row, columns.quantity || columns.revenue) || 0
    byProduct.set(name, current)
  }
  return Array.from(byProduct.entries())
    .filter(([, value]) => value.stock > 0 && value.movement <= 0)
    .map(([name, value]) => ({ name, value: value.stock, detail: "Stock with no detected movement" }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
}

function buildRegions(rows: { row: DataRow; dataset: DashboardDataset }[], columns: ColumnMap): RegionData[] {
  if (!columns.region) return []
  const aggregate = new Map<string, { revenue: number; profit: number; orders: number; datasets: Set<string>; products: Map<string, number>; categories: Map<string, number>; latitude: number | null; longitude: number | null }>()
  for (const { row, dataset } of rows) {
    const name = String(row[columns.region] || "").trim()
    if (!name) continue
    const current = aggregate.get(name) || { revenue: 0, profit: 0, orders: 0, datasets: new Set(), products: new Map(), categories: new Map(), latitude: null, longitude: null }
    const revenue = getNumber(row, columns.revenue) || 0
    current.revenue += revenue
    current.profit += getNumber(row, columns.profit) || (columns.cost ? revenue - (getNumber(row, columns.cost) || 0) : 0)
    current.orders += columns.order ? (String(row[columns.order] || "").trim() ? 1 : 0) : getNumber(row, columns.quantity) || 0
    current.datasets.add(dataset.id)
    const latitude = getNumber(row, columns.latitude)
    const longitude = getNumber(row, columns.longitude)
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      current.latitude = latitude
      current.longitude = longitude
    }
    addGroupedValue(current.products, String(row[columns.product || ""] || ""), revenue)
    addGroupedValue(current.categories, String(row[columns.category || ""] || ""), revenue)
    aggregate.set(name, current)
  }
  return Array.from(aggregate.entries())
    .map(([name, value]) => ({
      name,
      latitude: value.latitude ?? undefined,
      longitude: value.longitude ?? undefined,
      revenue: value.revenue,
      profit: value.profit,
      orders: value.orders,
      datasets: value.datasets.size,
      margin: value.revenue > 0 ? (value.profit / value.revenue) * 100 : null,
      growth: null,
      topProduct: topMapEntry(value.products),
      topCategory: topMapEntry(value.categories),
    }))
    .filter((region) => region.revenue > 0 || region.orders > 0)
    .sort((a, b) => b.revenue - a.revenue)
}

function buildRecommendations(input: {
  stats: DashboardStats
  columns: ColumnMap
  profitMargin: number | null
  lowStock: RankedItem[]
  deadStockItems: RankedItem[]
  overstock: RankedItem[]
  topProducts: RankedItem[]
  aiInsightsGenerated: number
}): ExecutiveRecommendation[] {
  const aiRecommendations = input.stats.allDatasets.flatMap(extractStoredRecommendations).slice(0, 5)
  const computed: ExecutiveRecommendation[] = []

  if (input.profitMargin !== null && input.profitMargin < 20) {
    computed.push({
      title: "Margin improvement",
      priority: "High",
      confidence: 82,
      impact: `${formatPercent(input.profitMargin)} gross margin detected from uploaded data.`,
      action: "Review pricing, cost, discount, and COGS columns for the lowest-margin products.",
      source: "Uploaded financial columns",
    })
  }
  if (input.lowStock.length > 0) {
    computed.push({
      title: "Inventory optimisation",
      priority: "High",
      confidence: 78,
      impact: `${input.lowStock.length} product${input.lowStock.length === 1 ? "" : "s"} sit at the low end of detected stock.`,
      action: "Review reorder quantities for the lowest-stock SKUs before the next buying cycle.",
      source: "Uploaded stock columns",
    })
  }
  if (input.deadStockItems.length > 0) {
    computed.push({
      title: "Dead stock risk",
      priority: "Medium",
      confidence: 74,
      impact: `${input.deadStockItems.length} stock line${input.deadStockItems.length === 1 ? "" : "s"} have inventory with no detected movement.`,
      action: "Bundle, discount, or return stagnant inventory after confirming sales movement.",
      source: "Uploaded stock and movement columns",
    })
  }
  if (input.topProducts.length > 0) {
    computed.push({
      title: "Top opportunity",
      priority: "Medium",
      confidence: 76,
      impact: `${input.topProducts[0].name} leads the detected product ranking.`,
      action: "Protect availability and margin on the highest-performing products.",
      source: "Uploaded product performance",
    })
  }

  if (aiRecommendations.length > 0) return aiRecommendations.concat(computed).slice(0, 8)
  return computed.slice(0, 8)
}

function extractStoredRecommendations(dataset: DashboardDataset): ExecutiveRecommendation[] {
  const analysis = isRecord(dataset.analysis) ? dataset.analysis : {}
  const intelligence = isRecord(analysis.business_intelligence) ? analysis.business_intelligence : isRecord(dataset.aiInsights) ? dataset.aiInsights : {}
  const actions = Array.isArray(intelligence.recommendedActions) ? intelligence.recommendedActions : []
  const opportunities = Array.isArray(intelligence.opportunities) ? intelligence.opportunities : []
  const risks = Array.isArray(intelligence.risks) ? intelligence.risks : []

  return [...actions, ...opportunities, ...risks].filter(isRecord).map((item, index) => ({
    title: String(item.title || item.action || item.name || `AI recommendation ${index + 1}`),
    priority: normalizePriority(item.priority || item.severity),
    confidence: clamp(Number(item.confidence || item.confidenceScore || 72), 45, 98),
    impact: String(item.impact || item.description || item.businessImpact || "Stored AI analysis identifies an executive review item."),
    action: String(item.action || item.recommendedAction || item.description || "Open the dataset analysis to review the recommendation."),
    source: dataset.name,
  }))
}

function countAiInsights(datasetList: DashboardDataset[]) {
  return datasetList.reduce((total, dataset) => total + extractInsightCount(dataset.analysis) + extractInsightCount(dataset.aiInsights), 0)
}

function extractInsightCount(value: unknown): number {
  if (!isRecord(value)) return 0
  const business = isRecord(value.business_analysis) ? value.business_analysis : {}
  const intelligence = isRecord(value.business_intelligence) ? value.business_intelligence : value
  const insightGroups: unknown[] = [
    business.insights,
    business.recommendations,
    intelligence.risks,
    intelligence.opportunities,
    intelligence.recommendedActions,
  ]
  return insightGroups.reduce<number>((total, entry) => total + (Array.isArray(entry) ? entry.length : 0), 0)
}

function hasAnalysisSignals(dataset: DashboardDataset) {
  return extractInsightCount(dataset.analysis) > 0 || extractInsightCount(dataset.aiInsights) > 0
}

function selectDashboardDataset(stats: DashboardStats, datasetId: string | null): { stats: DashboardStats; selectedDataset: DashboardDataset | null; missing: boolean } {
  if (!datasetId) return { stats, selectedDataset: null, missing: false }

  const selectedDataset = stats.allDatasets.find((dataset) => dataset.id === datasetId) || null
  if (!selectedDataset) return { stats, selectedDataset: null, missing: true }

  const allColumns = unique([
    ...selectedDataset.columns,
    ...selectedDataset.data.slice(0, 20).flatMap((row) => Object.keys(row)),
  ])
  const fileTypeCounts: NormalizedDashboardData["fileTypeCounts"] = {
    csv: 0,
    excel: 0,
    snowflake: 0,
    api: 0,
    other: 0,
  }
  const fileName = selectedDataset.fileName.toLowerCase()
  if (fileName.endsWith(".csv")) fileTypeCounts.csv = 1
  else if (/\.(xlsx|xls)$/i.test(fileName)) fileTypeCounts.excel = 1
  else if (selectedDataset.datasetType === "snowflake") fileTypeCounts.snowflake = 1
  else if (selectedDataset.datasetType === "api") fileTypeCounts.api = 1
  else fileTypeCounts.other = 1

  const detected = detectColumns([selectedDataset], selectedDataset.data)
  const businessModelCounts = {
    local_retail: 0,
    ecommerce: 0,
    saas: 0,
    startup: 0,
    investor: 0,
    marketplace: 0,
    generic: 0,
  } satisfies Record<BusinessModel, number>
  businessModelCounts[selectedDataset.businessModel] = 1

  const dashboardData: NormalizedDashboardData = {
    datasetCount: 1,
    activeDatasetCount: selectedDataset.status === "deleted" ? 0 : 1,
    totalRows: selectedDataset.rowCount,
    latestUpload: selectedDataset,
    fileTypeCounts,
    detectedColumns: {
      revenue: detected.revenue,
      profit: detected.profit,
      cost: detected.cost || detected.expense,
      product: detected.product || detected.sku,
      stock: detected.stock,
      date: detected.date,
      region: detected.region,
    },
    businessModelCounts,
    dominantBusinessModel: selectedDataset.businessModel,
    allColumns,
    datasets: [selectedDataset],
  }

  const scopedStats: DashboardStats = {
    ...stats,
    datasets: 1,
    analyses: hasAnalysisSignals(selectedDataset) || selectedDataset.analysisStatus === "completed" || selectedDataset.analysisStatus === "ready" ? 1 : 0,
    reports: stats.reportsList.filter((report) => report.datasetId === selectedDataset.id).length,
    dashboardData,
    allDatasets: [selectedDataset],
    latestDataset: selectedDataset,
    reportsList: stats.reportsList.filter((report) => report.datasetId === selectedDataset.id),
  }

  return { stats: scopedStats, selectedDataset, missing: false }
}

type DashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function AppDashboard({ searchParams }: DashboardPageProps) {
  const params = (await searchParams) || {}
  const range = parseRange(params.range)
  const tab = parseTab(params.tab)
  const analysisScope = resolveDashboardAnalysisScope({
    datasetId: parseDatasetId(params.datasetId),
    groupId: parseDatasetId(params.groupId),
    portfolioId: parseDatasetId(params.portfolioId),
  })
  const selectedDatasetId = analysisScope?.scope === "single_dataset" ? analysisScope.datasetId || null : null
  const session = await auth()
  const userId = session?.user?.id ?? null
  const [stats, datasetChoices, dailyBrief] = await Promise.all([
    getStats(userId, selectedDatasetId),
    selectedDatasetId ? Promise.resolve([]) : listDashboardDatasetChoices(userId),
    Promise.resolve(null),
  ])
  const selected = selectDashboardDataset(stats, selectedDatasetId)
  const dashboardStats = selected.stats
  const metrics = buildExecutiveMetrics(dashboardStats, range)
  const hasSelectedDataset = Boolean(selected.selectedDataset)
  const companyName = dashboardStats.profile?.businessName || dashboardStats.profile?.companyName || "UseClevr"
  const hasRows = metrics.loadedRowCount > 0
  const canRenderWorldMap = shouldRenderWorldMapForBusinessModel({
    businessModel: metrics.businessModel,
    mappedLocations: metrics.regions,
  })

  const kpis = buildBusinessModelKpis(metrics)
  const topRecommendations = metrics.recommendations.slice(0, 3)

  return (
    <div className="flex-1 bg-background">
      <div className="mx-auto w-full max-w-[1600px] space-y-5 px-4 pb-8 pt-2 sm:px-6 lg:px-8 xl:px-10">
        <section className="relative overflow-hidden rounded-lg border border-border bg-card/95 p-5 shadow-sm sm:p-7">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-100">
                <Sparkles className="h-3.5 w-3.5" />
                {hasSelectedDataset ? getBusinessModelLabel(metrics.businessModel) : "Dataset"} command center
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                {companyName} Dashboard
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
                {selected.selectedDataset
                  ? `Live ${getBusinessModelLabel(metrics.businessModel).toLowerCase()} analytics for ${selected.selectedDataset.name}.`
                  : "Select one dataset to load isolated KPIs, charts, geography, reports, and recommendations."}
              </p>
              {selected.missing && (
                <p className="mt-3 max-w-3xl rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-100">
                  The selected dataset is unavailable or you do not have access to it.
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {selectedDatasetId && (
                <>
                  <Link
                    href={`/app/datasets/${encodeURIComponent(selectedDatasetId)}/rows`}
                    className="rounded-lg border border-border bg-background/60 px-3 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary/35 hover:text-foreground"
                  >
                    View rows
                  </Link>
                  <GenerateReportAction datasetId={selectedDatasetId} />
                </>
              )}
              {(Object.keys(RANGE_LABELS) as RangeKey[]).map((key) => (
                <Link
                  key={key}
                  href={buildDashboardHref({ range: key, datasetId: selectedDatasetId })}
                  className={[
                    "rounded-lg border px-3 py-2 text-sm font-medium transition",
                    range === key
                      ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-700 dark:text-cyan-100"
                      : "border-border bg-background/60 text-muted-foreground hover:border-primary/35 hover:text-foreground",
                  ].join(" ")}
                >
                  {RANGE_LABELS[key]}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {!hasSelectedDataset ? (
          <DatasetSelectionPanel datasets={datasetChoices} />
        ) : (
          <>
            {dailyBrief && <ExecutiveDailyHealthSection brief={dailyBrief} />}

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              {kpis.map((item) => (
                <ExecutiveKpiCard key={item.label} item={item} />
              ))}
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
              <TrendPanel title="Revenue Trend" metricLabel="Revenue" data={metrics.revenueTrend} format="currency" emptyLabel="Missing revenue/date columns." />
              <TrendPanel title="Profit Trend" metricLabel="Profit" data={metrics.profitTrend} format="currency" emptyLabel="Missing profit or revenue/cost columns." />
            </section>

            <DashboardSection icon={Brain} title="Top AI Recommendations" action={<DataCoverageNote metrics={metrics} />} compact>
              {topRecommendations.length > 0 ? (
                <div className="grid gap-3 lg:grid-cols-3">
                  {topRecommendations.map((recommendation) => (
                    <RecommendationCard key={`${recommendation.title}-${recommendation.source}`} recommendation={recommendation} />
                  ))}
                </div>
              ) : (
                <CompactEmpty label="Recommendations appear when uploaded columns expose revenue, margin, inventory, product, or AI analysis signals." />
              )}
            </DashboardSection>

            <ExecutiveDashboardTabs
              initialActive={tab}
              range={range}
              panels={{
                overview: (
                  <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                    <DashboardSection icon={FileSpreadsheet} title="Dataset Analytics" compact>
                      <Card className="p-5">
                        <PanelHeader title="Upload History" detail={`${formatNumber(dashboardStats.dashboardData.totalRows)} rows processed across ${formatNumber(dashboardStats.dashboardData.datasetCount)} dataset${dashboardStats.dashboardData.datasetCount === 1 ? "" : "s"}.`} />
                        <div className="mt-5 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
                          <SourceMix dashboardData={dashboardStats.dashboardData} />
                          <LatestDatasets datasets={dashboardStats.allDatasets.slice(0, 6)} />
                        </div>
                      </Card>
                    </DashboardSection>

                    <DashboardSection icon={CheckCircle2} title="Business Health" compact>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <HealthCard label="Business Health Score" value={metrics.businessHealth.health} tone="cyan" />
                        <HealthCard label="AI Confidence" value={metrics.businessHealth.aiConfidence} tone="violet" />
                        <HealthCard label="Readiness" value={metrics.businessHealth.readiness} tone="emerald" />
                        <HealthCard label="Forecast Confidence" value={metrics.businessHealth.forecastConfidence} tone="amber" />
                      </div>
                    </DashboardSection>
                  </section>
                ),
                financial: <FinancialDetail metrics={metrics} />,
                inventory: <InventoryDetail metrics={metrics} />,
                geography: (
                  <DashboardSection icon={Globe2} title="World Map" compact>
                    {canRenderWorldMap ? (
                      <WorldMapRevenue regions={metrics.regions} />
                    ) : (
                      <CompactEmpty label={`${getBusinessModelLabel(metrics.businessModel)} data does not expose valid mapped locations for a world map.`} />
                    )}
                  </DashboardSection>
                ),
                ai: (
                  <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                    <DashboardSection icon={Activity} title="AI Activity" compact>
                      <Card className="p-5">
                        <PanelHeader title="Recent Analyses and Reports" detail="Latest AI traces, reports, and executive outputs." />
                        <div className="mt-5 space-y-4">
                          <ActivityList stats={dashboardStats} />
                        </div>
                      </Card>
                    </DashboardSection>
                    <DashboardSection icon={Bell} title="Executive Activity" compact>
                      <div className="grid gap-4">
                        <BottomPanel title="Recent Activity" items={recentActivity(dashboardStats, metrics)} />
                        <BottomPanel title="Notifications" items={notifications(dashboardStats, metrics)} />
                      </div>
                    </DashboardSection>
                  </section>
                ),
              }}
            />
          </>
        )}

        {hasSelectedDataset && !hasRows && (
          <EmptyState
            title="Upload business data to activate the full executive dashboard"
            detail="CSV and Excel uploads with revenue, profit, inventory, product, date, or region columns unlock the KPI cards, charts, map, and recommendations."
            href="/app/datasets"
          />
        )}
      </div>
    </div>
  )
}

type KpiDisplay = {
  label: string
  value: number | null
  format: "currency" | "number" | "percent"
  trend: SeriesPoint[]
  available: boolean
  detail: string
  icon: React.ComponentType<{ className?: string }>
  tone: Tone
}

function DatasetSelectionPanel({ datasets: datasetChoices }: { datasets: DashboardDatasetChoice[] }) {
  return (
    <DashboardSection icon={Database} title="Select Dataset" compact>
      <Card className="p-5">
        <PanelHeader
          title="Choose one dataset"
          detail="Dashboard KPIs, charts, geography, recommendations, and report context load for one selected dataset at a time."
        />
        {datasetChoices.length > 0 ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {datasetChoices.map((dataset) => (
              <Link
                key={dataset.id}
                href={`/app/dashboard?datasetId=${encodeURIComponent(dataset.id)}`}
                className="group rounded-lg border border-border bg-background/70 p-4 transition hover:border-primary/40 hover:bg-primary/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{dataset.name}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{dataset.fileName}</p>
                  </div>
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span>{formatNumber(dataset.rowCount)} rows</span>
                  <span>{formatNumber(dataset.columnCount)} columns</span>
                  <span>{getBusinessModelLabel(dataset.businessModel)}</span>
                  <span>{dataset.analysisStatus || dataset.status}</span>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">Uploaded {formatDate(dataset.createdAt)}</p>
              </Link>
            ))}
          </div>
        ) : (
          <CompactEmpty label="Upload a dataset to activate isolated dashboard analytics." />
        )}
      </Card>
    </DashboardSection>
  )
}

function buildBusinessModelKpis(metrics: ExecutiveMetrics): KpiDisplay[] {
  const common = [
    kpi("Revenue", metrics.totalRevenue, "currency", metrics.revenueTrend, metrics.columns.revenue, "Revenue column", CircleDollarSign, "cyan"),
    kpi("Active Datasets", metrics.activeDatasets, "number", metrics.uploadTrend, true, "Uploaded files", Database, "slate"),
  ]

  switch (metrics.businessModel) {
    case "local_retail":
      return [
        common[0],
        kpi("Store Performance", metrics.regions.length, "number", metrics.ordersTrend, metrics.regions.length > 0, "Store or branch locations", Warehouse, "emerald"),
        kpi("Inventory Value", metrics.inventoryValue, "currency", metrics.inventoryTrend, metrics.inventoryValue !== null, "Stock and price/cost columns", Warehouse, "cyan"),
        kpi("Low Stock", metrics.lowStock.length, "number", metrics.lowStock.map((item) => ({ label: item.name, value: item.value })), metrics.lowStock.length > 0, "Stock columns", AlertTriangle, "rose"),
        kpi("Dead Stock", metrics.deadStock, "number", metrics.deadStockItems.map((item) => ({ label: item.name, value: item.value })), metrics.deadStock !== null, "Stock and movement columns", Package, "amber"),
        kpi("Products/SKUs", metrics.products, "number", metrics.topProducts.map((item) => ({ label: item.name, value: item.value })), metrics.products !== null, "Product or SKU column", Package, "violet"),
      ]
    case "ecommerce":
      return [
        common[0],
        kpi("Orders", sum(metrics.ordersTrend.map((item) => item.value)), "number", metrics.ordersTrend, metrics.ordersTrend.length > 0, "Order or quantity columns", Package, "emerald"),
        kpi("Average Order Value", averageOrderValue(metrics.totalRevenue, metrics.ordersTrend), "currency", metrics.revenueTrend, metrics.totalRevenue !== null && metrics.ordersTrend.length > 0, "Revenue and order columns", CircleDollarSign, "violet"),
        kpi("Customers", null, "number", [], Boolean(metrics.columns.customer), "Customer column", Database, "slate"),
        kpi("Channels", metrics.categoryDistribution.length, "number", metrics.categoryDistribution.map((item) => ({ label: item.name, value: item.value })), metrics.categoryDistribution.length > 0, "Channel or category columns", PieChart, "amber"),
        common[1],
      ]
    case "saas":
      return [
        kpi("MRR/ARR", metrics.totalRevenue, "currency", metrics.revenueTrend, metrics.columns.revenue, "Recurring revenue columns", CircleDollarSign, "cyan"),
        kpi("Churn", null, "percent", [], false, "Churn column", TrendingUp, "rose"),
        kpi("CAC", metrics.totalCost, "currency", metrics.profitTrend, metrics.totalCost !== null, "Acquisition cost columns", PieChart, "amber"),
        kpi("LTV", metrics.totalProfit, "currency", metrics.profitTrend, metrics.totalProfit !== null, "Revenue and profit columns", TrendingUp, "emerald"),
        kpi("Active Users", null, "number", [], Boolean(metrics.columns.customer), "User or account column", Database, "violet"),
        common[1],
      ]
    case "startup":
      return [
        common[0],
        kpi("Burn Rate", metrics.totalCost, "currency", metrics.profitTrend, metrics.totalCost !== null, "Cost or expense columns", TrendingUp, "rose"),
        kpi("Runway Inputs", metrics.totalProfit, "currency", metrics.profitTrend, metrics.totalProfit !== null, "Revenue and cost columns", CircleDollarSign, "amber"),
        kpi("Active Users", null, "number", [], Boolean(metrics.columns.customer), "User or customer column", Database, "violet"),
        kpi("Growth Score", metrics.businessHealth.growthScore, "number", metrics.revenueTrend, metrics.revenueTrend.length > 1, "Trend columns", ArrowUpRight, "emerald"),
        common[1],
      ]
    case "investor":
      return [
        kpi("Portfolio Companies", metrics.products, "number", metrics.topProducts.map((item) => ({ label: item.name, value: item.value })), metrics.products !== null, "Company or portfolio column", Database, "cyan"),
        kpi("Invested Capital", metrics.totalCost ?? metrics.totalRevenue, "currency", metrics.profitTrend, metrics.totalCost !== null || metrics.totalRevenue !== null, "Investment or valuation columns", CircleDollarSign, "emerald"),
        kpi("Valuation", metrics.totalRevenue, "currency", metrics.revenueTrend, metrics.totalRevenue !== null, "Valuation columns", TrendingUp, "violet"),
        kpi("Sectors", metrics.categoryDistribution.length, "number", metrics.categoryDistribution.map((item) => ({ label: item.name, value: item.value })), metrics.categoryDistribution.length > 0, "Sector column", PieChart, "amber"),
        common[1],
      ]
    case "marketplace":
      return [
        kpi("GMV", metrics.totalRevenue, "currency", metrics.revenueTrend, metrics.columns.revenue, "GMV or revenue columns", CircleDollarSign, "cyan"),
        kpi("Orders", sum(metrics.ordersTrend.map((item) => item.value)), "number", metrics.ordersTrend, metrics.ordersTrend.length > 0, "Order or transaction columns", Package, "emerald"),
        kpi("Take Rate Inputs", metrics.totalProfit, "currency", metrics.profitTrend, metrics.totalProfit !== null, "Commission or profit columns", PieChart, "violet"),
        kpi("Sellers/Buyers", null, "number", [], Boolean(metrics.columns.customer), "Seller or buyer columns", Database, "amber"),
        common[1],
      ]
    default:
      return [
        common[0],
        kpi("Profit", metrics.totalProfit, "currency", metrics.profitTrend, metrics.columns.profit || (metrics.columns.revenue && metrics.columns.cost), "Profit or revenue/cost columns", TrendingUp, "emerald"),
        kpi("Profit Margin", metrics.profitMargin, "percent", metrics.profitTrend, metrics.profitMargin !== null, "Revenue and profit columns", PieChart, "violet"),
        common[1],
      ]
  }
}

function ExecutiveDailyHealthSection({ brief }: { brief: ExecutiveDailyBrief }) {
  const priorities = brief.todaysPriorities.slice(0, 3)
  const recommendations = brief.recommendedActions.slice(0, 3)
  const criticalAlerts = brief.alerts.filter((alert) => alert.severity === "critical")
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-300/20 bg-emerald-400/10 text-emerald-700 dark:text-emerald-200">
            <CalendarDays className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">Executive Daily Health</h2>
            <p className="mt-1 text-sm text-muted-foreground">Generated once per day for this workspace.</p>
          </div>
        </div>
        <Link href="/app/daily-health" className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-700 transition hover:border-cyan-300/45 hover:bg-cyan-300/15 dark:text-cyan-100">
          View Full Daily Brief
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {criticalAlerts.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-3">
          {criticalAlerts.slice(0, 3).map((alert) => (
            <div key={`${alert.type}-${alert.title}`} className="rounded-lg border border-rose-500/25 bg-rose-500/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-200" />
                <div>
                  <p className="font-semibold text-foreground">{alert.title}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{alert.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Card className="overflow-hidden p-0">
        <div className="grid gap-0 xl:grid-cols-[330px_minmax(0,1fr)_380px]">
          <div className="border-b border-border bg-background/60 p-5 xl:border-b-0 xl:border-r">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Today's score</p>
            <div className="mt-5 flex items-center gap-5">
              <ScoreRing value={brief.score} tone={brief.score >= 75 ? "emerald" : brief.score >= 50 ? "amber" : "rose"} />
              <div>
                <p className="text-sm font-medium text-muted-foreground">AI confidence</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{brief.aiConfidence}/100</p>
                <p className="mt-2 text-xs text-muted-foreground">{brief.generatedBy === "ai" ? "AI-generated brief" : "Deterministic brief"}</p>
              </div>
            </div>
          </div>

          <div className="border-b border-border p-5 xl:border-b-0 xl:border-r">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Executive summary</p>
            <p className="mt-3 text-base leading-7 text-foreground">{brief.executiveSummary}</p>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {priorities.map((priority, index) => (
                <div key={priority} className="rounded-lg border border-border bg-background/60 p-3">
                  <p className="text-xs font-semibold text-cyan-700 dark:text-cyan-100">Priority {index + 1}</p>
                  <p className="mt-2 text-sm leading-6 text-foreground">{priority}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Latest recommendations</p>
            <div className="mt-3 space-y-3">
              {recommendations.length === 0 ? (
                <CompactEmpty label="Recommendations appear after the daily brief analyzes uploaded data." />
              ) : (
                recommendations.map((recommendation) => (
                  <div key={`${recommendation.priority}-${recommendation.suggestedAction}`} className="rounded-lg border border-border bg-background/60 p-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className={dailyPriorityClass(recommendation.priority)}>{recommendation.priority}</span>
                      <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">{recommendation.confidence}%</span>
                    </div>
                    <p className="text-sm leading-6 text-foreground">{recommendation.suggestedAction}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{recommendation.estimatedImpact}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </Card>
    </section>
  )
}

function ScoreRing({ value, tone }: { value: number; tone: Tone }) {
  const circumference = 2 * Math.PI * 40
  const offset = circumference - (value / 100) * circumference
  return (
    <svg className="h-28 w-28 shrink-0" viewBox="0 0 100 100" role="img" aria-label={`Daily health score: ${value} out of 100`}>
      <circle cx="50" cy="50" r="40" fill="none" className="stroke-muted" strokeWidth="10" />
      <circle cx="50" cy="50" r="40" fill="none" stroke={toneHex(tone)} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" strokeWidth="10" transform="rotate(-90 50 50)" />
      <text x="50" y="56" fill="currentColor" textAnchor="middle" className="text-2xl font-bold text-foreground">{value}</text>
    </svg>
  )
}

function kpi(
  label: string,
  value: number | null,
  format: "currency" | "number" | "percent",
  trend: SeriesPoint[],
  available: unknown,
  detail: string,
  icon: React.ComponentType<{ className?: string }>,
  tone: Tone,
): KpiDisplay {
  return { label, value, format, trend, available: Boolean(available), detail, icon, tone }
}

function ExecutiveKpiCard({ item }: { item: KpiDisplay }) {
  const Icon = item.icon
  const change = percentChange(item.trend)
  const positive = change === null || change >= 0
  return (
    <Card className="min-h-[190px] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{item.available ? formatNullable(item.value, item.format) : "No data"}</p>
        </div>
        <span className={["flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", toneBgClass(item.tone)].join(" ")}>
          <Icon className={["h-4 w-4", toneTextClass(item.tone)].join(" ")} />
        </span>
      </div>
      <div className="mt-4 h-12">
        <Sparkline data={item.trend} tone={item.tone} />
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs text-muted-foreground">{item.available ? item.detail : item.detail}</span>
        <span className={["inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold", positive ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-200" : "bg-rose-500/10 text-rose-700 dark:text-rose-200"].join(" ")}>
          {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {change === null ? "No prior" : `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`}
        </span>
      </div>
    </Card>
  )
}

function DashboardSection({ icon: Icon, title, children, action, compact = false }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode; action?: React.ReactNode; compact?: boolean }) {
  return (
    <section className={compact ? "space-y-4" : "space-y-5"}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-cyan-700 dark:text-cyan-100">
            <Icon className="h-5 w-5" />
          </span>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function FinancialDetail({ metrics }: { metrics: ExecutiveMetrics }) {
  return (
    <DashboardSection icon={CircleDollarSign} title="Financial Analytics" compact>
      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="p-5">
          <PanelHeader title="Revenue vs Costs" detail="Financial totals are calculated only from detected financial columns." />
          <div className="mt-5 space-y-4">
            <FinancialBar label="Revenue" value={metrics.totalRevenue} max={Math.max(metrics.totalRevenue || 0, metrics.totalCost || 0, 1)} tone="cyan" />
            <FinancialBar label="Costs" value={metrics.totalCost} max={Math.max(metrics.totalRevenue || 0, metrics.totalCost || 0, 1)} tone="rose" />
            <FinancialBar label="Profitability" value={metrics.totalProfit} max={Math.max(Math.abs(metrics.totalProfit || 0), metrics.totalRevenue || 0, 1)} tone="emerald" />
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricTile label="Gross margin" value={formatNullable(metrics.profitMargin, "percent")} />
              <MetricTile label="Net margin" value={formatNullable(metrics.profitMargin, "percent")} />
            </div>
          </div>
        </Card>
        <TrendPanel title="Monthly Comparison" metricLabel="Revenue" data={metrics.revenueTrend.length > 0 ? metrics.revenueTrend : metrics.uploadTrend} format={metrics.revenueTrend.length > 0 ? "currency" : "number"} emptyLabel="Missing dated financial data." />
      </div>
    </DashboardSection>
  )
}

function InventoryDetail({ metrics }: { metrics: ExecutiveMetrics }) {
  return (
    <DashboardSection icon={Warehouse} title="Inventory Analytics" compact>
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-5">
          <PanelHeader title="Product Performance" detail="Top and lowest product rankings from uploaded rows." />
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <RankedList title="Top Products" items={metrics.topProducts} format="currency" empty="Missing product and value columns." />
            <RankedList title="Worst Products" items={metrics.worstProducts} format="currency" empty="Missing product and value columns." />
          </div>
        </Card>
        <Card className="p-5">
          <PanelHeader title="Stock Control" detail="Low stock, dead stock, overstock, turnover, ABC, and categories." />
          <div className="mt-5 space-y-5">
            <MiniList title="Low Stock" items={metrics.lowStock} empty="Missing stock column." />
            <MiniList title="Dead Stock" items={metrics.deadStockItems} empty="Missing stock and movement columns." />
            <MiniList title="Overstock" items={metrics.overstock} empty="Missing stock column." />
            <RankedList title="ABC / Category Distribution" items={metrics.categoryDistribution} format="currency" empty="Missing category data." compact />
          </div>
        </Card>
      </div>
    </DashboardSection>
  )
}

function TrendPanel({ title, metricLabel, data, format, emptyLabel }: { title: string; metricLabel: string; data: SeriesPoint[]; format: "currency" | "number"; emptyLabel: string }) {
  const total = data.reduce((value, point) => value + point.value, 0)
  return (
    <Card className="p-5">
      <PanelHeader title={title} detail={data.length > 0 ? `${metricLabel}: ${formatNullable(total, format)}` : emptyLabel} />
      <div className={data.length > 0 ? "mt-5 min-h-[220px]" : "mt-4"}>
        {data.length > 0 ? <AreaChart data={data} format={format} /> : <CompactEmpty label={emptyLabel} />}
      </div>
    </Card>
  )
}

function AreaChart({ data, format }: { data: SeriesPoint[]; format: "currency" | "number" }) {
  const max = Math.max(...data.map((point) => point.value), 1)
  const width = 560
  const height = 210
  const points = data.map((point, index) => {
    const x = data.length === 1 ? width / 2 : (index / (data.length - 1)) * width
    const y = height - (point.value / max) * (height - 24) - 12
    return { ...point, x, y }
  })
  const line = points.map((point) => `${point.x},${point.y}`).join(" ")
  const area = `0,${height} ${line} ${width},${height}`
  return (
    <div>
      <svg className="h-[220px] w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Trend chart">
        <defs>
          <linearGradient id="executiveAreaFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((lineY) => (
          <line key={lineY} x1="0" x2={width} y1={height * lineY} y2={height * lineY} className="stroke-border" strokeWidth="1" />
        ))}
        <polygon points={area} fill="url(#executiveAreaFill)" />
        <polyline points={line} fill="none" stroke="#22d3ee" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
        {points.map((point) => (
          <circle key={`${point.label}-${point.value}`} cx={point.x} cy={point.y} r="3.5" fill="#22d3ee" />
        ))}
      </svg>
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>{data[0]?.label}</span>
        <span>{formatNullable(data[data.length - 1]?.value ?? null, format)}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  )
}

function Sparkline({ data, tone }: { data: SeriesPoint[]; tone: Tone }) {
  if (data.length === 0) {
    return (
      <svg className="h-full w-full" viewBox="0 0 120 42" role="img" aria-label="No trend data">
        <line x1="0" x2="120" y1="28" y2="28" className="stroke-border" strokeDasharray="4 5" strokeWidth="2" />
      </svg>
    )
  }
  const max = Math.max(...data.map((point) => point.value), 1)
  const min = Math.min(...data.map((point) => point.value), 0)
  const range = Math.max(max - min, 1)
  const points = data.map((point, index) => {
    const x = data.length === 1 ? 60 : (index / (data.length - 1)) * 120
    const y = 36 - ((point.value - min) / range) * 28
    return `${x},${y}`
  }).join(" ")
  return (
    <svg className="h-full w-full overflow-visible" viewBox="0 0 120 42" role="img" aria-label="KPI trend">
      <polyline points={points} fill="none" stroke={toneHex(tone)} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
    </svg>
  )
}

function RecommendationCard({ recommendation }: { recommendation: ExecutiveRecommendation }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className={priorityClass(recommendation.priority)}>{recommendation.priority} priority</span>
        <span className="rounded-full border border-border bg-background/70 px-2.5 py-1 text-xs font-semibold text-muted-foreground">{recommendation.confidence}% confidence</span>
      </div>
      <h3 className="text-lg font-semibold text-foreground">{recommendation.title}</h3>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{recommendation.impact}</p>
      <p className="mt-4 rounded-lg border border-border bg-background/70 p-3 text-sm leading-6 text-foreground">{recommendation.action}</p>
      <p className="mt-3 text-xs text-muted-foreground">Source: {recommendation.source}</p>
    </Card>
  )
}

function PanelHeader({ title, detail }: { title: string; detail: string }) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{detail}</p>
    </div>
  )
}

function RankedList({ title, items, format, empty, compact = false }: { title: string; items: RankedItem[]; format: "currency" | "number"; empty: string; compact?: boolean }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      <div className={["mt-3 space-y-3", compact ? "text-sm" : ""].join(" ")}>
        {items.length === 0 ? <CompactEmpty label={empty} /> : items.map((item) => <RankedRow key={item.name} item={item} max={items[0]?.value || 1} format={format} />)}
      </div>
    </div>
  )
}

function RankedRow({ item, max, format }: { item: RankedItem; max: number; format: "currency" | "number" }) {
  const pct = Math.max(5, Math.min(100, (item.value / Math.max(max, 1)) * 100))
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
        <span className="min-w-0 truncate font-medium text-foreground">{item.name}</span>
        <span className="shrink-0 text-muted-foreground">{formatNullable(item.value, format)}</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div className="h-full rounded-full bg-cyan-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function MiniList({ title, items, empty }: { title: string; items: RankedItem[]; empty: string }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      <div className="mt-2 space-y-2">
        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">{empty}</p>
        ) : (
          items.slice(0, 4).map((item) => (
            <div key={item.name} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm">
              <span className="min-w-0 truncate text-foreground">{item.name}</span>
              <span className="shrink-0 font-medium text-muted-foreground">{formatNumber(item.value)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function FinancialBar({ label, value, max, tone }: { label: string; value: number | null; max: number; tone: Tone }) {
  const width = value === null ? 0 : Math.max(4, Math.min(100, (Math.abs(value) / max) * 100))
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">{formatNullable(value, "currency")}</span>
      </div>
      <div className="h-3 rounded-full bg-muted">
        <div className={["h-full rounded-full", toneBarClass(tone)].join(" ")} style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/60 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold text-foreground">{value}</p>
    </div>
  )
}

function SourceMix({ dashboardData }: { dashboardData: NormalizedDashboardData }) {
  const sourceCounts = [
    { label: "CSV", value: dashboardData.fileTypeCounts.csv },
    { label: "Excel", value: dashboardData.fileTypeCounts.excel },
    { label: "Snowflake", value: dashboardData.fileTypeCounts.snowflake },
    { label: "API", value: dashboardData.fileTypeCounts.api },
  ]
  return (
    <div className="space-y-3">
      {sourceCounts.map((item) => (
        <div key={item.label} className="rounded-lg border border-border bg-background/60 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">{item.label}</span>
            <span className="text-sm text-muted-foreground">{item.value}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function LatestDatasets({ datasets: datasetList }: { datasets: DashboardDataset[] }) {
  if (datasetList.length === 0) return <CompactEmpty label="No uploaded datasets yet." />
  return (
    <div className="space-y-2">
      {datasetList.map((dataset) => (
        <Link key={dataset.id} href={`/app/datasets/${dataset.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/60 px-3 py-3 transition hover:border-primary/35 hover:bg-primary/5">
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">{dataset.name}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{formatNumber(dataset.rowCount)} rows · {dataset.datasetType || "standard"}</span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>
      ))}
    </div>
  )
}

function ActivityList({ stats }: { stats: DashboardStats }) {
  const items = [
    ...stats.latestAiTraces.map((trace) => ({ label: trace.prompt.slice(0, 72), detail: `${trace.providerName} · ${formatDate(trace.createdAt)}`, href: "/app/assistant" })),
    ...stats.reportsList.map((report) => ({ label: report.summary || report.datasetName || "Executive report", detail: report.createdAt ? formatDate(new Date(report.createdAt)) : "Report", href: `/report/${report.id}` })),
  ].slice(0, 6)
  if (items.length === 0) return <CompactEmpty label="AI analyses and reports appear here after generation." />
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <Link key={`${item.href}-${item.label}`} href={item.href} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/60 px-3 py-3 transition hover:border-primary/35 hover:bg-primary/5">
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">{item.label}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{item.detail}</span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>
      ))}
    </div>
  )
}

function HealthCard({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  const circumference = 2 * Math.PI * 34
  const offset = circumference - (value / 100) * circumference
  return (
    <Card className="p-5">
      <div className="flex items-center gap-4">
        <svg className="h-20 w-20 shrink-0" viewBox="0 0 80 80" role="img" aria-label={`${label}: ${value} out of 100`}>
          <circle cx="40" cy="40" r="34" fill="none" className="stroke-muted" strokeWidth="8" />
          <circle cx="40" cy="40" r="34" fill="none" stroke={toneHex(tone)} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" strokeWidth="8" transform="rotate(-90 40 40)" />
          <text x="40" y="45" fill="currentColor" textAnchor="middle" className="text-lg font-bold text-foreground">{value}</text>
        </svg>
        <div>
          <p className="font-semibold text-foreground">{label}</p>
          <p className="mt-1 text-sm text-muted-foreground">{value >= 75 ? "Strong" : value >= 50 ? "Developing" : "Needs data"}</p>
        </div>
      </div>
    </Card>
  )
}

function BottomPanel({ title, items }: { title: string; items: { label: string; detail: string; href?: string }[] }) {
  return (
    <Card className="p-5">
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <div className="mt-4 space-y-2">
        {items.length === 0 ? <CompactEmpty label="No items available." /> : items.map((item) => {
          const content = (
            <>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-foreground">{item.label}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{item.detail}</span>
              </span>
              {item.href && <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
            </>
          )
          return item.href ? (
            <Link key={`${item.label}-${item.detail}`} href={item.href} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/60 px-3 py-3 transition hover:border-primary/35 hover:bg-primary/5">{content}</Link>
          ) : (
            <div key={`${item.label}-${item.detail}`} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/60 px-3 py-3">{content}</div>
          )
        })}
      </div>
    </Card>
  )
}

function EmptyState({ title, detail, href }: { title: string; detail: string; href: string }) {
  return (
    <Card className="border-dashed p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-cyan-700 dark:text-cyan-100">
        <Database className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{detail}</p>
      <Link href={href} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90">
        <FileSpreadsheet className="h-4 w-4" />
        Upload dataset
      </Link>
    </Card>
  )
}

function CompactEmpty({ label }: { label: string }) {
  return <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed border-border bg-background/40 p-4 text-center text-sm text-muted-foreground">{label}</div>
}

function DataCoverageNote({ metrics }: { metrics: ExecutiveMetrics }) {
  const detected = Object.entries(metrics.columns).filter(([, value]) => Boolean(value)).length
  return <span className="rounded-lg border border-border bg-background/60 px-3 py-2 text-xs font-medium text-muted-foreground">{getBusinessModelLabel(metrics.businessModel)} · {detected} detected business columns · {formatNumber(metrics.loadedRowCount)} preview rows</span>
}

function recentActivity(stats: DashboardStats, metrics: ExecutiveMetrics) {
  return [
    ...stats.allDatasets.slice(0, 3).map((dataset) => ({ label: dataset.name, detail: `${formatNumber(dataset.rowCount)} rows uploaded ${formatDate(dataset.createdAt)}`, href: `/app/dashboard?datasetId=${encodeURIComponent(dataset.id)}` })),
    ...(metrics.recommendations[0] ? [{ label: metrics.recommendations[0].title, detail: metrics.recommendations[0].impact, href: "/app/datasets" }] : []),
  ]
}

function notifications(stats: DashboardStats, metrics: ExecutiveMetrics) {
  const items: { label: string; detail: string; href?: string }[] = []
  if (stats.datasets === 0) items.push({ label: "Dataset upload needed", detail: "Upload CSV or Excel data to activate dashboard analytics.", href: "/app/datasets" })
  if (!stats.hasBusiness) items.push({ label: "Business profile incomplete", detail: "Business context improves AI recommendations.", href: "/app/business/setup" })
  if (metrics.columns.date && metrics.revenueTrend.length < 2) items.push({ label: "Trend depth is limited", detail: "More dated rows improve forecast confidence." })
  if (metrics.deadStockItems.length > 0) items.push({ label: "Dead stock detected", detail: `${metrics.deadStockItems.length} product lines need review.`, href: "/app/retail" })
  return items
}

function parseRange(value: string | string[] | undefined): RangeKey {
  const range = Array.isArray(value) ? value[0] : value
  return range === "7d" || range === "90d" || range === "12m" ? range : "30d"
}

function parseTab(value: string | string[] | undefined): DashboardTab {
  const tab = Array.isArray(value) ? value[0] : value
  if (tab === "financial" || tab === "inventory" || tab === "geography" || tab === "ai") return tab
  return "overview"
}

function parseDatasetId(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null
}

function buildDashboardHref(input: { range: RangeKey; datasetId: string | null }) {
  const query = new URLSearchParams({ range: input.range })
  if (input.datasetId) query.set("datasetId", input.datasetId)
  return `/app?${query.toString()}`
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

function formatBucket(date: Date | null, range: RangeKey) {
  if (!date) return null
  if (range === "12m") return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`
}

function percentChange(data: SeriesPoint[]) {
  if (data.length < 2) return null
  const previous = data[data.length - 2].value
  const current = data[data.length - 1].value
  if (previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

function formatNullable(value: number | null, format: "currency" | "number" | "percent") {
  if (value === null || !Number.isFinite(value)) return "No data"
  if (format === "currency") return formatCurrency(value)
  if (format === "percent") return formatPercent(value)
  return formatNumber(value)
}

function formatCurrency(value: number) {
  const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: Math.abs(value) >= 1000 ? 0 : 2 })
  return formatter.format(value)
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date)
}

function sum(values: (number | null)[]) {
  return values.reduce<number>((total, value) => total + (value || 0), 0)
}

function averageOrderValue(totalRevenue: number | null, ordersTrend: SeriesPoint[]) {
  const orderCount = sum(ordersTrend.map((item) => item.value))
  if (!totalRevenue || orderCount <= 0) return null
  return totalRevenue / orderCount
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function uniqueCount(values: string[]) {
  return new Set(values).size
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function addGroupedValue(map: Map<string, number>, key: string, value: number) {
  const cleanKey = key.trim()
  if (!cleanKey) return
  map.set(cleanKey, (map.get(cleanKey) || 0) + value)
}

function topMapEntry(map: Map<string, number>) {
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1])[0]?.[0]
}

function normalizePriority(value: unknown): ExecutiveRecommendation["priority"] {
  const priority = String(value || "").toLowerCase()
  if (priority.includes("high") || priority.includes("critical")) return "High"
  if (priority.includes("low")) return "Low"
  return "Medium"
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function score(signals: boolean[]) {
  if (signals.length === 0) return 0
  return Math.round((signals.filter(Boolean).length / signals.length) * 100)
}

function trendScore(data: SeriesPoint[]) {
  const change = percentChange(data)
  if (change === null) return 55
  return clamp(Math.round(55 + change), 10, 98)
}

function toneHex(tone: Tone) {
  if (tone === "violet") return "#a78bfa"
  if (tone === "emerald") return "#34d399"
  if (tone === "amber") return "#f59e0b"
  if (tone === "rose") return "#fb7185"
  if (tone === "slate") return "#94a3b8"
  return "#22d3ee"
}

function toneTextClass(tone: Tone) {
  if (tone === "violet") return "text-primary"
  if (tone === "emerald") return "text-emerald-700 dark:text-emerald-200"
  if (tone === "amber") return "text-amber-700 dark:text-amber-200"
  if (tone === "rose") return "text-rose-700 dark:text-rose-200"
  if (tone === "slate") return "text-muted-foreground"
  return "text-cyan-700 dark:text-cyan-100"
}

function toneBgClass(tone: Tone) {
  if (tone === "violet") return "bg-primary/10"
  if (tone === "emerald") return "bg-emerald-500/10"
  if (tone === "amber") return "bg-amber-500/10"
  if (tone === "rose") return "bg-rose-500/10"
  if (tone === "slate") return "bg-muted"
  return "bg-cyan-300/10"
}

function toneBarClass(tone: Tone) {
  if (tone === "emerald") return "bg-emerald-400"
  if (tone === "rose") return "bg-rose-400"
  return "bg-cyan-300"
}

function priorityClass(priority: ExecutiveRecommendation["priority"]) {
  if (priority === "High") return "rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:text-rose-200"
  if (priority === "Low") return "rounded-full bg-slate-500/10 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200"
  return "rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-200"
}

function dailyPriorityClass(priority: ExecutiveDailyBrief["recommendedActions"][number]["priority"]) {
  if (priority === "Critical") return "rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:text-rose-200"
  if (priority === "High") return "rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-200"
  if (priority === "Low") return "rounded-full bg-slate-500/10 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
  return "rounded-full bg-cyan-300/10 px-2 py-0.5 text-xs font-semibold text-cyan-700 dark:text-cyan-100"
}
