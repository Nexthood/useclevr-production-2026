import { getDb } from "@/lib/db"
import { datasets } from "@/lib/db/schema"
import { isSuperadmin } from "@/lib/auth/builtin-users"
import { canAccessAllDatasets, loadDatasetData } from "@/lib/data/dataset-access"
import { normalizeDatasetCategory, resolveDatasetType, type DatasetCategory } from "@/lib/data/dataset-category"
import {
  calculateRiskIntelligence,
  getDatasetTypeLabel,
  isSupportedRiskDatasetType,
  type RiskIntelligenceResult,
} from "@/lib/risk-intelligence/risk-engine"
import { and, desc, eq, ne } from "drizzle-orm"

export type RiskUserContext = {
  id: string
  role?: string | null
  email?: string | null
}

export type RiskDatasetSummary = {
  id: string
  name: string
  fileName: string | null
  datasetType: string
  datasetTypeLabel: string
  rowCount: number
  columnCount: number
  createdAt: string
  updatedAt: string
  supported: boolean
}

export type RiskModuleScope = DatasetCategory

export type RiskDatasetListOptions = {
  scope?: string | null
  datasetId?: string | null
}

export type RiskCalculationOptions = {
  scope?: string | null
}

export type RiskAccessResult =
  | { success: true; result: RiskIntelligenceResult }
  | { success: false; status: 400 | 403 | 404 | 503; error: string; code: string }

export function canAccessRiskDataset(user: RiskUserContext, datasetOwnerId: string) {
  return user.id === datasetOwnerId || canAccessAllDatasets(user.role) || isSuperadmin(user)
}

export async function listRiskIntelligenceDatasets(
  user: RiskUserContext,
  options: RiskDatasetListOptions = {},
): Promise<RiskDatasetSummary[]> {
  const db = getDb()
  if (!db) throw new Error("Database connection is unavailable.")

  const canReadAll = canAccessAllDatasets(user.role) || isSuperadmin(user)
  const scope = normalizeRiskModuleScope(options.scope)
  const datasetId = normalizeId(options.datasetId)
  const whereConditions = [
    canReadAll ? undefined : eq(datasets.userId, user.id),
    datasetId ? eq(datasets.id, datasetId) : undefined,
    scope ? eq(datasets.datasetType, scope) : undefined,
    ne(datasets.status, "deleted"),
    ne(datasets.status, "archived"),
  ].filter(Boolean) as Parameters<typeof and>

  const rows = await db.query.datasets.findMany({
    where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
    columns: {
      id: true,
      name: true,
      fileName: true,
      rowCount: true,
      columnCount: true,
      datasetType: true,
      analysis: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [desc(datasets.createdAt)],
    limit: datasetId ? 1 : 50,
  })

  return dedupeByDatasetId(rows)
    .filter((dataset) => isVisibleRiskDataset(dataset.name, dataset.fileName, dataset.id))
    .map((dataset) => {
      const datasetType = resolveDatasetType(dataset.datasetType, dataset.analysis)
      return {
        id: dataset.id,
        name: dataset.name,
        fileName: dataset.fileName || null,
        datasetType,
        datasetTypeLabel: getDatasetTypeLabel(datasetType),
        rowCount: dataset.rowCount || 0,
        columnCount: dataset.columnCount || 0,
        createdAt: dataset.createdAt.toISOString(),
        updatedAt: dataset.updatedAt.toISOString(),
        supported: isSupportedRiskDatasetType(datasetType),
      }
    })
    .filter((dataset) => !scope || dataset.datasetType === scope)
}

export async function calculateRiskIntelligenceForDataset(
  datasetId: string,
  user: RiskUserContext,
  options: RiskCalculationOptions = {},
): Promise<RiskAccessResult> {
  const db = getDb()
  if (!db) {
    return {
      success: false,
      status: 503,
      error: "Database connection is unavailable.",
      code: "database_unavailable",
    }
  }

  const scope = normalizeRiskModuleScope(options.scope)
  const canReadAll = canAccessAllDatasets(user.role) || isSuperadmin(user)
  const whereConditions = [
    eq(datasets.id, datasetId),
    canReadAll ? undefined : eq(datasets.userId, user.id),
    ne(datasets.status, "deleted"),
    ne(datasets.status, "archived"),
  ].filter(Boolean) as Parameters<typeof and>
  const dataset = await db.query.datasets.findFirst({
    where: and(...whereConditions),
  })

  if (!dataset) {
    return { success: false, status: 404, error: "Dataset not found.", code: "dataset_not_found" }
  }

  if (!canAccessRiskDataset(user, dataset.userId)) {
    return { success: false, status: 403, error: "Dataset access denied.", code: "dataset_access_denied" }
  }

  const datasetType = resolveDatasetType(dataset.datasetType, dataset.analysis)
  if (scope && datasetType !== scope) {
    return {
      success: false,
      status: 404,
      error: `No ${getDatasetTypeLabel(scope)} dataset is available for this Risk Intelligence scope.`,
      code: "dataset_scope_mismatch",
    }
  }

  if (!isVisibleRiskDataset(dataset.name, dataset.fileName, dataset.id)) {
    return {
      success: false,
      status: 404,
      error: "Dataset not found.",
      code: "dataset_not_found",
    }
  }

  if (!isSupportedRiskDatasetType(datasetType)) {
    return {
      success: false,
      status: 400,
      error: "Dataset type is not supported for Risk Intelligence.",
      code: "unsupported_dataset_type",
    }
  }

  const rows = await loadDatasetData(dataset.id, dataset)
  const result = calculateRiskIntelligence({ ...dataset, datasetType }, rows)

  if (!result) {
    return {
      success: false,
      status: 400,
      error: "No supported business data is available yet. Upload or connect a dataset to generate risk intelligence.",
      code: "no_supported_business_data",
    }
  }

  return { success: true, result }
}

export function normalizeRiskModuleScope(value?: string | null): RiskModuleScope | null {
  return normalizeDatasetCategory(value)
}

export function riskScopeEmptyMessage(scope?: string | null) {
  const normalized = normalizeRiskModuleScope(scope)
  if (normalized === "prebookkeeping") return "No Pre-bookkeeping dataset available. Upload an accounting file first."
  if (normalized === "accountancy") return "No Accountancy dataset available. Upload an accounting file first."
  if (normalized === "retail") return "No Retail dataset available. Upload or connect retail data first."
  if (normalized === "profitability") return "No Profitability dataset available. Upload a profitability file first."
  if (normalized === "standard") return "No Standard dataset available. Upload a dataset first."
  return "No supported business data is available yet. Upload or connect a dataset to generate risk intelligence."
}

function normalizeId(value?: string | null) {
  const text = value?.trim()
  return text || null
}

function dedupeByDatasetId<T extends { id: string }>(rows: T[]) {
  const seen = new Set<string>()
  return rows.filter((row) => {
    if (seen.has(row.id)) return false
    seen.add(row.id)
    return true
  })
}

function isVisibleRiskDataset(name: string | null | undefined, fileName: string | null | undefined, id: string) {
  const text = [id, name, fileName].filter(Boolean).join(" ").toLowerCase()
  if (/\b(test|fixture|seed|demo|sample|codex)\b/.test(text)) return false
  if (text.includes("provider_path_dataset")) return false
  if (text.includes("codex-selected-dashboard-check")) return false
  return true
}
