import { getDb } from "@/lib/db"
import { datasetRows, datasets } from "@/lib/db/schema"
import { debugLog } from "@/lib/utils/debug"
import { and, eq } from "drizzle-orm"

export type DatasetAccessResult = {
  dataset: typeof datasets.$inferSelect | null
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
  _role?: string | null,
): Promise<DatasetAccessResult> {
  const db = getDb()
  if (!db) return { dataset: null, dbUnavailable: true }

  const dataset = await db.query.datasets.findFirst({
    where: customerDatasetAccessWhere(datasetId, userId),
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
      createdAt: true,
      updatedAt: true,
    },
  })

  return { dataset: dataset ?? null, dbUnavailable: false }
}

export async function loadDatasetData(datasetId: string, dataset: typeof datasets.$inferSelect) {
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
