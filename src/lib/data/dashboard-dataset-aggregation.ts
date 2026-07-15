import { db } from "@/lib/db"
import { datasets } from "@/lib/db/schema"
import { resolveBusinessModel, type BusinessModel } from "@/lib/data/business-model"
import { and, desc, eq } from "drizzle-orm"

export type DashboardDataRow = Record<string, unknown>

export type DashboardAggregatedDataset = {
  id: string
  name: string
  fileName: string
  fileSize: number | null
  rowCount: number
  columnCount: number
  columns: string[]
  data: DashboardDataRow[]
  datasetType: string
  businessModel: BusinessModel
  analysisStatus: string | null
  status: string
  createdAt: Date
  updatedAt: Date
  analysis: unknown
  aiInsights: unknown
  precomputedMetrics: unknown
  detectedColumns: unknown
}

export type DashboardDatasetChoice = {
  id: string
  name: string
  fileName: string
  rowCount: number
  columnCount: number
  datasetType: string
  businessModel: BusinessModel
  analysisStatus: string | null
  status: string
  createdAt: Date
}

export type NormalizedDashboardData = {
  datasetCount: number
  activeDatasetCount: number
  totalRows: number
  latestUpload: DashboardAggregatedDataset | null
  fileTypeCounts: {
    csv: number
    excel: number
    snowflake: number
    api: number
    other: number
  }
  detectedColumns: {
    revenue?: string
    profit?: string
    cost?: string
    product?: string
    stock?: string
    date?: string
    region?: string
  }
  businessModelCounts: Record<BusinessModel, number>
  dominantBusinessModel: BusinessModel
  allColumns: string[]
  datasets: DashboardAggregatedDataset[]
}

const COLUMN_ALIASES = {
  revenue: ["revenue", "sales", "sales_amount", "net_sales", "turnover", "total_revenue", "gross_sales", "amount"],
  profit: ["profit", "net_profit", "gross_profit", "operating_profit", "gross_margin", "earnings"],
  cost: ["cost", "costs", "cogs", "expenses", "operating_costs", "expense", "spend", "unit_cost"],
  product: ["product", "product_name", "sku", "item", "item_name", "title"],
  stock: ["stock", "inventory", "inventory_level", "quantity_on_hand", "units_in_stock", "on_hand", "available"],
  date: ["date", "order_date", "sale_date", "transaction_date", "month", "period", "created_at"],
  region: ["country", "city", "region", "market", "location", "state", "territory"],
} satisfies Record<string, string[]>

export async function listDashboardDatasetChoices(userId: string | null): Promise<DashboardDatasetChoice[]> {
  if (!userId) return []

  const rows = await db.query.datasets.findMany({
    where: eq(datasets.userId, userId),
    orderBy: [desc(datasets.createdAt)],
    limit: 100,
    columns: {
      id: true,
      name: true,
      fileName: true,
      rowCount: true,
      columnCount: true,
      columns: true,
      datasetType: true,
      businessModel: true,
      analysisStatus: true,
      status: true,
      createdAt: true,
      analysis: true,
    },
  })

  return rows.map((dataset) => {
    const columns = Array.isArray(dataset.columns) ? dataset.columns : []
    const analysis = dataset.analysis
    return {
      id: dataset.id,
      name: dataset.name,
      fileName: dataset.fileName,
      rowCount: dataset.rowCount || 0,
      columnCount: dataset.columnCount || 0,
      datasetType: dataset.datasetType || "standard",
      businessModel: resolveBusinessModel({
        explicit: dataset.businessModel,
        uploadSource: isRecord(analysis) ? String(analysis.uploadSource || "") : "",
        datasetType: dataset.datasetType,
        columns,
        datasetName: dataset.name,
        analysis,
      }),
      analysisStatus: dataset.analysisStatus,
      status: dataset.status || "ready",
      createdAt: dataset.createdAt || new Date(),
    }
  })
}

export async function loadDashboardDatasetAggregation(
  userId: string | null,
  options: { datasetId?: string | null } = {},
): Promise<NormalizedDashboardData> {
  if (!userId) return emptyDashboardData()
  if (!options.datasetId) return emptyDashboardData()

  const rows = await db.query.datasets.findMany({
    where: options.datasetId
      ? and(eq(datasets.userId, userId), eq(datasets.id, options.datasetId))
      : eq(datasets.userId, userId),
    orderBy: [desc(datasets.createdAt)],
    limit: options.datasetId ? 1 : 500,
    columns: {
      id: true,
      name: true,
      fileName: true,
      fileSize: true,
      rowCount: true,
      columnCount: true,
      columns: true,
      data: true,
      datasetType: true,
      businessModel: true,
      analysisStatus: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      analysis: true,
      aiInsights: true,
      precomputedMetrics: true,
      detectedColumns: true,
    },
  })

  const normalizedDatasets = rows.map((dataset) => {
    const columns = Array.isArray(dataset.columns) ? dataset.columns : []
    const analysis = dataset.analysis
    return {
      id: dataset.id,
      name: dataset.name,
      fileName: dataset.fileName,
      fileSize: dataset.fileSize,
      rowCount: dataset.rowCount || 0,
      columnCount: dataset.columnCount || 0,
      columns,
      data: Array.isArray(dataset.data) ? (dataset.data as DashboardDataRow[]).filter(isRecord) : [],
      datasetType: dataset.datasetType || "standard",
      businessModel: resolveBusinessModel({
        explicit: dataset.businessModel,
        uploadSource: isRecord(analysis) ? String(analysis.uploadSource || "") : "",
        datasetType: dataset.datasetType,
        columns,
        datasetName: dataset.name,
        analysis,
      }),
      analysisStatus: dataset.analysisStatus,
      status: dataset.status || "ready",
      createdAt: dataset.createdAt || new Date(),
      updatedAt: dataset.updatedAt || dataset.createdAt || new Date(),
      analysis,
      aiInsights: dataset.aiInsights,
      precomputedMetrics: dataset.precomputedMetrics,
      detectedColumns: dataset.detectedColumns,
    }
  })

  const allColumns = unique([
    ...normalizedDatasets.flatMap((dataset) => dataset.columns),
    ...normalizedDatasets.flatMap((dataset) => dataset.data.slice(0, 20).flatMap((row) => Object.keys(row))),
  ])
  const fileTypeCounts = normalizedDatasets.reduce<NormalizedDashboardData["fileTypeCounts"]>((counts, dataset) => {
    const fileName = dataset.fileName.toLowerCase()
    if (fileName.endsWith(".csv")) counts.csv += 1
    else if (/\.(xlsx|xls)$/i.test(fileName)) counts.excel += 1
    else if (dataset.datasetType === "snowflake") counts.snowflake += 1
    else if (dataset.datasetType === "api") counts.api += 1
    else counts.other += 1
    return counts
  }, { csv: 0, excel: 0, snowflake: 0, api: 0, other: 0 })

  return {
    datasetCount: normalizedDatasets.length,
    activeDatasetCount: normalizedDatasets.filter((dataset) => dataset.status !== "deleted").length,
    totalRows: normalizedDatasets.reduce((total, dataset) => total + dataset.rowCount, 0),
    latestUpload: normalizedDatasets[0] || null,
    fileTypeCounts,
    detectedColumns: detectColumnAliases(allColumns),
    businessModelCounts: countBusinessModels(normalizedDatasets),
    dominantBusinessModel: findDominantBusinessModel(normalizedDatasets),
    allColumns,
    datasets: normalizedDatasets,
  }
}

export function getDashboardDataFingerprint(data: NormalizedDashboardData) {
  return [
    data.datasetCount,
    data.activeDatasetCount,
    data.totalRows,
    data.latestUpload?.id || "none",
    data.latestUpload?.updatedAt.toISOString() || "none",
    data.allColumns.join("|"),
  ].join(":")
}

export function normalizeDashboardColumnName(column: string) {
  return column.toLowerCase().trim().replace(/[\s-]+/g, "_").replace(/[^a-z0-9_]/g, "")
}

function detectColumnAliases(columns: string[]): NormalizedDashboardData["detectedColumns"] {
  return {
    revenue: findAlias(columns, COLUMN_ALIASES.revenue),
    profit: findAlias(columns, COLUMN_ALIASES.profit),
    cost: findAlias(columns, COLUMN_ALIASES.cost),
    product: findAlias(columns, COLUMN_ALIASES.product),
    stock: findAlias(columns, COLUMN_ALIASES.stock),
    date: findAlias(columns, COLUMN_ALIASES.date),
    region: findAlias(columns, COLUMN_ALIASES.region),
  }
}

function findAlias(columns: string[], aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeDashboardColumnName)
  return columns.find((column) => {
    const normalized = normalizeDashboardColumnName(column)
    return normalizedAliases.some((alias) => normalized === alias || normalized.includes(alias))
  })
}

function emptyDashboardData(): NormalizedDashboardData {
  return {
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
  }
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function isRecord(value: unknown): value is DashboardDataRow {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function countBusinessModels(datasetList: DashboardAggregatedDataset[]) {
  return datasetList.reduce<Record<BusinessModel, number>>(
    (counts, dataset) => {
      counts[dataset.businessModel] += 1
      return counts
    },
    {
      local_retail: 0,
      ecommerce: 0,
      saas: 0,
      startup: 0,
      investor: 0,
      marketplace: 0,
      generic: 0,
    },
  )
}

function findDominantBusinessModel(datasetList: DashboardAggregatedDataset[]): BusinessModel {
  if (datasetList.length === 0) return "generic"
  const counts = countBusinessModels(datasetList)
  const latest = datasetList[0]?.businessModel || "generic"
  const dominant = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])[0]?.[0] as BusinessModel | undefined
  return dominant || latest
}
