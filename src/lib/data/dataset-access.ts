import { getDb } from "@/lib/db"
import { isSuperadmin } from "@/lib/auth/builtin-users"
import { isHistoricalDatasetLocked } from "@/lib/billing/historical-unlock"
import { datasetRows, datasets } from "@/lib/db/schema"
import { debugLog } from "@/lib/utils/debug"
import { and, eq } from "drizzle-orm"

export type AccessibleDataset = typeof datasets.$inferSelect & {
  historicalDataLocked?: boolean
}

export type DatasetAccessResult = {
  dataset: AccessibleDataset | null
  dbUnavailable: boolean
}

export function customerDatasetAccessWhere(datasetId: string, userId: string) {
  return and(eq(datasets.id, datasetId), eq(datasets.userId, userId))
}

export function canAccessAllDatasets(_role?: string | null) {
  return false
}

export async function findAccessibleDataset(
  datasetId: string,
  userId: string,
  role?: string | null,
): Promise<DatasetAccessResult> {
  const db = getDb()
  if (!db) return { dataset: null, dbUnavailable: true }

  // Superadmin shares the canonical dataset routes with read-all privileges,
  // matching Risk Intelligence dataset visibility. Normal users stay strictly
  // owner-scoped, and superadmin keeps its unchanged historical behavior.
  const superadminAccess = isSuperadmin({ id: userId, role })
  const dataset = await db.query.datasets.findFirst({
    where: superadminAccess
      ? eq(datasets.id, datasetId)
      : customerDatasetAccessWhere(datasetId, userId),
    columns: {
      id: true,
      userId: true,
      name: true,
      fileName: true,
      fileSize: true,
      mimeType: true,
      storageKey: true,
      checksum: true,
      rowCount: true,
      columnCount: true,
      columns: true,
      data: true,
      columnTypes: true,
      previewRowCount: true,
      previewGenerated: true,
      fullAnalysisCompleted: true,
      analysisStatus: true,
      analysisProgress: true,
      analysisMessage: true,
      analysisError: true,
      invalidRowCount: true,
      missingValueCounts: true,
      precomputedMetrics: true,
      columnMapping: true,
      detectedColumns: true,
      aiInsights: true,
      status: true,
      analysis: true,
      datasetType: true,
      businessModel: true,
      source: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!dataset) return { dataset: null, dbUnavailable: false }

  // Preserved historical data is LOCKED READ-ONLY after a paid subscription
  // ends unless an active subscription, the permanent one-time unlock, or an
  // admin/superadmin entitlement grants access. Ownership is unchanged: the
  // historical dataset stays exactly where it is, never migrated or recreated.
  // While locked, stored row content and stored analysis stay sealed.
  const historicalDataLocked = superadminAccess
    ? false
    : await isHistoricalDatasetLocked(userId, dataset.createdAt)

  if (historicalDataLocked) {
    // Row content and stored analysis outputs stay sealed while locked.
    const sealed = { ...dataset, data: [], analysis: {}, aiInsights: null, precomputedMetrics: null }
    return { dataset: { ...sealed, historicalDataLocked: true }, dbUnavailable: false }
  }

  return { dataset: { ...dataset, historicalDataLocked }, dbUnavailable: false }
}

export async function loadDatasetData(datasetId: string, dataset: AccessibleDataset) {
  if (dataset.historicalDataLocked) {
    debugLog("[REPORT TRACE]", "loadDatasetData", {
      datasetId,
      filename: dataset.fileName,
      persistedRowCount: dataset.rowCount,
      loadedRowsLength: 0,
      source: "historical_data_locked",
    })
    return []
  }

  const storedData = Array.isArray(dataset.data) ? (dataset.data as Record<string, unknown>[]) : []
  const expectedRowCount = typeof dataset.rowCount === "number" ? dataset.rowCount : storedData.length
  if (storedData.length > 0 && storedData.length >= expectedRowCount) {
    debugLog("[REPORT TRACE]", "loadDatasetData", {
      datasetId,
      filename: dataset.fileName,
      persistedRowCount: expectedRowCount,
      loadedRowsLength: storedData.length,
      source: "dataset.data",
    })
    return storedData
  }

  const db = getDb()
  if (!db) {
    debugLog("[REPORT TRACE]", "loadDatasetData", {
      datasetId,
      filename: dataset.fileName,
      persistedRowCount: expectedRowCount,
      loadedRowsLength: storedData.length,
      source: "dataset.data",
      warning: "database unavailable for datasetRows fallback",
    })
    return storedData
  }

  const rows = await db.query.datasetRows.findMany({
    where: eq(datasetRows.datasetId, datasetId),
    columns: { data: true },
    orderBy: (row, { asc }) => [asc(row.rowIndex)],
  })

  const normalizedRows = rows.map((row) => row.data as Record<string, unknown>)
  const loadedRows = normalizedRows.length > 0 ? normalizedRows : storedData
  debugLog("[REPORT TRACE]", "loadDatasetData", {
    datasetId,
    filename: dataset.fileName,
    persistedRowCount: expectedRowCount,
    inlineRowsLength: storedData.length,
    datasetRowsLength: normalizedRows.length,
    loadedRowsLength: loadedRows.length,
    source: normalizedRows.length > 0 ? "datasetRows" : "dataset.data",
  })
  return loadedRows
}
