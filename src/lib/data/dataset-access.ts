import { getDb } from "@/lib/db"
import { datasetRows, datasets } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"

export type DatasetAccessResult = {
  dataset: typeof datasets.$inferSelect | null
  dbUnavailable: boolean
}

export function canAccessAllDatasets(role?: string | null) {
  return role === "superadmin" || role === "admin"
}

export async function findAccessibleDataset(
  datasetId: string,
  userId: string,
  role?: string | null,
): Promise<DatasetAccessResult> {
  const db = getDb()
  if (!db) return { dataset: null, dbUnavailable: true }

  const dataset = await db.query.datasets.findFirst({
    where: canAccessAllDatasets(role)
      ? eq(datasets.id, datasetId)
      : and(eq(datasets.id, datasetId), eq(datasets.userId, userId)),
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
  if (storedData.length > 0) return storedData

  const db = getDb()
  if (!db) return []

  const rows = await db.query.datasetRows.findMany({
    where: eq(datasetRows.datasetId, datasetId),
    columns: { data: true },
    orderBy: (row, { asc }) => [asc(row.rowIndex)],
  })

  return rows.map((row) => row.data as Record<string, unknown>)
}
