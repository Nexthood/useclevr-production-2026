import { db } from "@/lib/db"
import { datasets } from "@/lib/db/schema"
import { combineBusinessSemanticProfiles, type MultiFileSemanticInput } from "@/lib/data/business-semantics"
import { resolveBusinessModel, type BusinessModel } from "@/lib/data/business-model"
import {
  deriveDatasetSource,
  type DatasetSource,
} from "@/lib/data/dataset-source"
import { and, desc, eq, or, isNull, ne } from "drizzle-orm"

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
  source: DatasetSource
  analysisStatus: string | null
  status: string
  createdAt: Date
  updatedAt: Date
  analysis: unknown
  aiInsights: unknown
  precomputedMetrics: unknown
  detectedColumns: unknown
}

export type NormalizedDashboardData = {
  datasetCount: number
  activeDatasetCount: number
  totalRows: number
  latestUpload: DashboardAggregatedDataset | null
  fileTypeCounts: {
    csv: number
    excel: number
    google_sheets: number
    onedrive: number
    sharepoint: number
    snowflake: number
    api: number
    clevrsync: number
    accountancy_document: number
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

export async function loadDashboardDatasetAggregation(
  userId: string | null,
  options: { datasetId?: string | null; includeCompatibleDatasets?: boolean } = {},
): Promise<NormalizedDashboardData> {
  if (!userId) return emptyDashboardData()

  const loadCompatibleScope = Boolean(options.datasetId && options.includeCompatibleDatasets)
  const rows = await db.query.datasets.findMany({
    where: options.datasetId && !loadCompatibleScope
      ? and(eq(datasets.userId, userId), eq(datasets.id, options.datasetId))
      : or(isNull(datasets.datasetType), ne(datasets.datasetType, "prebookkeeping")),
    orderBy: [desc(datasets.createdAt)],
    limit: options.datasetId && !loadCompatibleScope ? 1 : 500,
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
      source: true,
      mimeType: true,
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
      source: deriveDatasetSource({
        source: dataset.source,
        uploadSource: isRecord(analysis) ? String(analysis.uploadSource || "") : null,
        datasetType: dataset.datasetType,
        fileName: dataset.fileName,
        mimeType: dataset.mimeType,
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

  const activeDatasets = options.datasetId && options.includeCompatibleDatasets
    ? filterDashboardDatasetsBySemanticCompatibility(normalizedDatasets, options.datasetId)
    : normalizedDatasets.filter((dataset) => dataset.status !== "deleted")

  const allColumns = unique([
    ...activeDatasets.flatMap((dataset) => dataset.columns),
    ...activeDatasets.flatMap((dataset) => dataset.data.slice(0, 20).flatMap((row) => Object.keys(row))),
  ])
  const fileTypeCounts = activeDatasets.reduce<NormalizedDashboardData["fileTypeCounts"]>((counts, dataset) => {
    switch (dataset.source) {
      case "csv":
        counts.csv += 1
        break
      case "excel":
        counts.excel += 1
        break
      case "google_sheets":
      case "onedrive":
      case "sharepoint":
        counts[dataset.source] += 1
        break
      case "snowflake":
        counts.snowflake += 1
        break
      case "api":
        counts.api += 1
        break
      case "clevrsync":
        counts.clevrsync += 1
        break
      case "accountancy_document":
        counts.accountancy_document += 1
        break
      default:
        counts.other += 1
    }
    return counts
  }, emptyFileTypeCounts())

  return {
    datasetCount: activeDatasets.length,
    activeDatasetCount: activeDatasets.length,
    totalRows: activeDatasets.reduce((total, dataset) => total + dataset.rowCount, 0),
    latestUpload: activeDatasets[0] || null,
    fileTypeCounts,
    detectedColumns: detectColumnAliases(allColumns),
    businessModelCounts: countBusinessModels(activeDatasets),
    dominantBusinessModel: findDominantBusinessModel(activeDatasets),
    allColumns,
    datasets: activeDatasets,
  }
}

export function filterDashboardDatasetsBySemanticCompatibility(
  datasetList: DashboardAggregatedDataset[],
  selectedDatasetId: string,
): DashboardAggregatedDataset[] {
  const activeDatasets = datasetList.filter((dataset) => dataset.status !== "deleted")
  const selectedDataset = activeDatasets.find((dataset) => dataset.id === selectedDatasetId)
  if (!selectedDataset) return []

  const selectedInput = toSemanticInput(selectedDataset)
  const compatibleDatasets = activeDatasets.filter((dataset) => {
    if (dataset.id === selectedDataset.id) return true
    const combined = combineBusinessSemanticProfiles([selectedInput, toSemanticInput(dataset)])
    return !combined.contradictions.some((issue) => issue.severity === "BLOCKING")
  })

  return [
    selectedDataset,
    ...compatibleDatasets.filter((dataset) => dataset.id !== selectedDataset.id),
  ]
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

function toSemanticInput(dataset: DashboardAggregatedDataset): MultiFileSemanticInput {
  return {
    datasetId: dataset.id,
    datasetType: dataset.datasetType,
    businessModel: dataset.businessModel,
    fileName: dataset.fileName,
    datasetName: dataset.name,
    columns: dataset.columns,
    rows: dataset.data,
  }
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

export function emptyDashboardData(): NormalizedDashboardData {
  return {
    datasetCount: 0,
    activeDatasetCount: 0,
    totalRows: 0,
    latestUpload: null,
    fileTypeCounts: emptyFileTypeCounts(),
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

function emptyFileTypeCounts(): NormalizedDashboardData["fileTypeCounts"] {
  return {
    csv: 0,
    excel: 0,
    google_sheets: 0,
    onedrive: 0,
    sharepoint: 0,
    snowflake: 0,
    api: 0,
    clevrsync: 0,
    accountancy_document: 0,
    other: 0,
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
