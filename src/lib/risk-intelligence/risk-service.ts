import { getDb } from "@/lib/db"
import { datasets } from "@/lib/db/schema"
import { isSuperadmin } from "@/lib/auth/builtin-users"
import { canAccessAllDatasets, loadDatasetData } from "@/lib/data/dataset-access"
import {
  calculateRiskIntelligence,
  getDatasetTypeLabel,
  isSupportedRiskDatasetType,
  type RiskIntelligenceResult,
} from "@/lib/risk-intelligence/risk-engine"
import { desc, eq } from "drizzle-orm"

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

export type RiskAccessResult =
  | { success: true; result: RiskIntelligenceResult }
  | { success: false; status: 400 | 403 | 404 | 503; error: string; code: string }

export function canAccessRiskDataset(user: RiskUserContext, datasetOwnerId: string) {
  return user.id === datasetOwnerId || canAccessAllDatasets(user.role) || isSuperadmin(user)
}

export async function listRiskIntelligenceDatasets(user: RiskUserContext): Promise<RiskDatasetSummary[]> {
  const db = getDb()
  if (!db) throw new Error("Database connection is unavailable.")

  const canReadAll = canAccessAllDatasets(user.role) || isSuperadmin(user)
  const rows = await db.query.datasets.findMany({
    where: canReadAll ? undefined : eq(datasets.userId, user.id),
    columns: {
      id: true,
      name: true,
      fileName: true,
      rowCount: true,
      columnCount: true,
      datasetType: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [desc(datasets.createdAt)],
    limit: 200,
  })

  return rows.map((dataset) => {
    const datasetType = dataset.datasetType || "standard"
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
}

export async function calculateRiskIntelligenceForDataset(
  datasetId: string,
  user: RiskUserContext,
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

  const dataset = await db.query.datasets.findFirst({
    where: eq(datasets.id, datasetId),
  })

  if (!dataset) {
    return { success: false, status: 404, error: "Dataset not found.", code: "dataset_not_found" }
  }

  if (!canAccessRiskDataset(user, dataset.userId)) {
    return { success: false, status: 403, error: "Dataset access denied.", code: "dataset_access_denied" }
  }

  if (!isSupportedRiskDatasetType(dataset.datasetType)) {
    return {
      success: false,
      status: 400,
      error: "Dataset type is not supported for Risk Intelligence.",
      code: "unsupported_dataset_type",
    }
  }

  const rows = await loadDatasetData(dataset.id, dataset)
  const result = calculateRiskIntelligence(dataset, rows)

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
