import { recordActivity } from "@/lib/activity/activity-store"
import { canAccessAllDatasets } from "@/lib/data/dataset-access"
import { deleteFile } from "@/lib/data/upload-handler"
import { db } from "@/lib/db"
import {
  accuracyIngestionJobs,
  aiCostLogs,
  aiInteractionTraces,
  aiRequestAuditLogs,
  datasetRows,
  datasets,
  mcpAuditLogs,
  retrievalDocuments,
  userActivities,
} from "@/lib/db/schema"
import { deleteReportsForDatasets } from "@/lib/reports/report-generator"
import { debugError, debugLog } from "@/lib/utils/debug"
import { and, eq, inArray, sql } from "drizzle-orm"

export type DeleteDatasetFailure = {
  datasetId: string
  reason: string
}

export type DeleteDatasetsResult = {
  ok: boolean
  deletedIds: string[]
  failed: DeleteDatasetFailure[]
  cleanup: {
    accuracyDocuments: number
    accuracyJobs: number
  }
  deletedReports: string[]
  storage: {
    deleted: string[]
    missingOrFailed: { datasetId: string; storageKey: string; reason: string }[]
  }
}

type DeleteDatasetsInput = {
  datasetIds: string[]
  userId: string
  userEmail?: string | null
  role?: string | null
}

export const MAX_DELETE_BATCH_SIZE = 100

export function sanitizeDatasetIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.filter((id): id is string => typeof id === "string").map((id) => id.trim()).filter(Boolean))).slice(0, MAX_DELETE_BATCH_SIZE)
}

export async function deleteDatasetsForUser({
  datasetIds,
  userId,
  userEmail,
  role,
}: DeleteDatasetsInput): Promise<DeleteDatasetsResult> {
  const requestedIds = sanitizeDatasetIds(datasetIds)
  if (requestedIds.length === 0) {
    return {
      ok: false,
      deletedIds: [],
      failed: [],
      cleanup: { accuracyDocuments: 0, accuracyJobs: 0 },
      deletedReports: [],
      storage: { deleted: [], missingOrFailed: [] },
    }
  }

  const canDeleteAcrossUsers = canAccessAllDatasets(role)

  const accessibleDatasets = await db.query.datasets.findMany({
    where: canDeleteAcrossUsers
      ? inArray(datasets.id, requestedIds)
      : and(eq(datasets.userId, userId), inArray(datasets.id, requestedIds)),
    columns: {
      id: true,
      userId: true,
      name: true,
      rowCount: true,
      datasetType: true,
      storageKey: true,
    },
  })

  const accessibleIds = accessibleDatasets.map((dataset) => dataset.id)
  const accessibleIdSet = new Set(accessibleIds)
  const failed = requestedIds
    .filter((datasetId) => !accessibleIdSet.has(datasetId))
    .map((datasetId) => ({
      datasetId,
      reason: "Dataset not found or access denied.",
    }))

  if (accessibleIds.length === 0) {
    return {
      ok: false,
      deletedIds: [],
      failed,
      cleanup: { accuracyDocuments: 0, accuracyJobs: 0 },
      deletedReports: [],
      storage: { deleted: [], missingOrFailed: [] },
    }
  }

  const cleanup = { accuracyDocuments: 0, accuracyJobs: 0 }
  await db.transaction(async (tx) => {
    const accuracyCleanup = await deleteAccuracyRecordsIfTablesExist(tx, accessibleIds)
    cleanup.accuracyDocuments = accuracyCleanup.documents
    cleanup.accuracyJobs = accuracyCleanup.jobs
    if (await tableExists(tx, "AiInteractionTrace")) {
      await tx.delete(aiInteractionTraces).where(inArray(aiInteractionTraces.datasetId, accessibleIds))
    }
    if (await tableExists(tx, "AiRequestAuditLog")) {
      await tx.delete(aiRequestAuditLogs).where(inArray(aiRequestAuditLogs.datasetId, accessibleIds))
    }
    if (await tableExists(tx, "AICostLog")) {
      await tx.delete(aiCostLogs).where(inArray(aiCostLogs.datasetId, accessibleIds))
    }
    if (await tableExists(tx, "MCPAuditLog")) {
      await tx.delete(mcpAuditLogs).where(inArray(mcpAuditLogs.datasetId, accessibleIds))
    }
    if (await tableExists(tx, "UserActivity")) {
      for (const datasetId of accessibleIds) {
        await tx.delete(userActivities).where(sql`
          ${userActivities.metadata}->>'datasetId' = ${datasetId}
          OR COALESCE(${userActivities.metadata}->'datasetIds', '[]'::jsonb) @> ${JSON.stringify([datasetId])}::jsonb
        `)
      }
    }
    await tx.delete(datasetRows).where(inArray(datasetRows.datasetId, accessibleIds))
    await tx.delete(datasets).where(inArray(datasets.id, accessibleIds))
  })

  const storage: DeleteDatasetsResult["storage"] = { deleted: [], missingOrFailed: [] }
  for (const dataset of accessibleDatasets) {
    if (!dataset.storageKey) continue
    try {
      const removed = await deleteFile(dataset.storageKey)
      if (removed) {
        storage.deleted.push(dataset.storageKey)
      } else {
        storage.missingOrFailed.push({
          datasetId: dataset.id,
          storageKey: dataset.storageKey,
          reason: "Storage object missing or provider cleanup failed.",
        })
      }
    } catch (error) {
      storage.missingOrFailed.push({
        datasetId: dataset.id,
        storageKey: dataset.storageKey,
        reason: error instanceof Error ? error.message : "Storage cleanup failed.",
      })
    }
  }

  const reportCleanup = await deleteReportsForDatasets(accessibleIds)
  if (reportCleanup.failed.length > 0) {
    debugError("[DATASETS DELETE] Report file cleanup failed:", reportCleanup.failed)
  }
  if (storage.deleted.length > 0 || storage.missingOrFailed.length > 0) {
    debugLog("[DATASETS DELETE] Storage cleanup result:", {
      deleted: storage.deleted.length,
      missingOrFailed: storage.missingOrFailed.length,
    })
  }

  await recordActivity({
    userId,
    userEmail,
    type: "dataset_deleted",
    feature: "datasets",
    title: accessibleIds.length === 1 ? "Dataset deleted" : "Datasets deleted",
    description: accessibleIds.length === 1
      ? `${accessibleDatasets[0]?.name || "Dataset"} was removed.`
      : `${accessibleIds.length} datasets were removed.`,
    metadata: {
      datasetIds: accessibleIds,
      count: accessibleIds.length,
      datasetTypes: accessibleDatasets.map((dataset) => dataset.datasetType || "standard"),
      rowCount: accessibleDatasets.reduce((total, dataset) => total + (dataset.rowCount || 0), 0),
      accuracyDocumentsDeleted: cleanup.accuracyDocuments,
      accuracyJobsDeleted: cleanup.accuracyJobs,
      storageDeleted: storage.deleted.length,
      storageMissingOrFailed: storage.missingOrFailed.length,
      deletedReports: reportCleanup.deletedReportIds.length,
    },
  })

  return {
    ok: failed.length === 0,
    deletedIds: accessibleIds,
    failed,
    cleanup,
    deletedReports: reportCleanup.deletedReportIds,
    storage,
  }
}

async function deleteAccuracyRecordsIfTablesExist(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  datasetIds: string[],
) {
  const documentsTableExists = await tableExists(tx, "RetrievalDocument")
  const jobsTableExists = await tableExists(tx, "AccuracyIngestionJob")
  let documents = 0
  let jobs = 0

  if (documentsTableExists) {
    const deleted = await tx.delete(retrievalDocuments)
      .where(inArray(retrievalDocuments.datasetId, datasetIds))
      .returning()
    documents = deleted.length
  }

  if (jobsTableExists) {
    const deleted = await tx.delete(accuracyIngestionJobs)
      .where(inArray(accuracyIngestionJobs.datasetId, datasetIds))
      .returning()
    jobs = deleted.length
  }

  return { documents, jobs }
}

async function tableExists(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], tableName: string) {
  const result = await tx.execute(sql`
    SELECT to_regclass(${`"${tableName}"`}) IS NOT NULL AS "exists"
  `)
  return extractRows(result).some((row) => row.exists === true || row.exists === "t")
}

function extractRows(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) return result as Array<Record<string, unknown>>
  if (result && typeof result === "object" && "rows" in result && Array.isArray((result as { rows: unknown }).rows)) {
    return (result as { rows: Array<Record<string, unknown>> }).rows
  }
  return []
}
