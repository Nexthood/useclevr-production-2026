import { recordActivity } from "@/lib/activity/activity-store"
import { deleteAccuracyDocumentsForDatasets } from "@/lib/accuracy/ingestion"
import { canAccessAllDatasets } from "@/lib/data/dataset-access"
import { deleteFile } from "@/lib/data/upload-handler"
import { db } from "@/lib/db"
import {
  aiCostLogs,
  aiInteractionTraces,
  aiRequestAuditLogs,
  creditLedger,
  datasetRows,
  datasets,
  mcpAuditLogs,
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
      deletedReports: [],
      storage: { deleted: [], missingOrFailed: [] },
    }
  }

  await db.transaction(async (tx) => {
    await tx.delete(aiInteractionTraces).where(inArray(aiInteractionTraces.datasetId, accessibleIds))
    await tx.delete(aiRequestAuditLogs).where(inArray(aiRequestAuditLogs.datasetId, accessibleIds))
    await tx.delete(aiCostLogs).where(inArray(aiCostLogs.datasetId, accessibleIds))
    await tx.delete(mcpAuditLogs).where(inArray(mcpAuditLogs.datasetId, accessibleIds))
    await tx.delete(creditLedger).where(inArray(creditLedger.relatedDatasetId, accessibleIds))
    for (const datasetId of accessibleIds) {
      await tx.delete(userActivities).where(sql`
        ${userActivities.metadata}->>'datasetId' = ${datasetId}
        OR COALESCE(${userActivities.metadata}->'datasetIds', '[]'::jsonb) @> ${JSON.stringify([datasetId])}::jsonb
      `)
    }
    await tx.delete(datasetRows).where(inArray(datasetRows.datasetId, accessibleIds))
    await tx.delete(datasets).where(inArray(datasets.id, accessibleIds))
  })

  await deleteAccuracyDocumentsForDatasets(accessibleIds).catch((error) => {
    debugError("[DATASETS DELETE] Accuracy retrieval cleanup failed:", {
      datasetIds: accessibleIds,
      error: error instanceof Error ? error.message : String(error),
    })
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
      storageDeleted: storage.deleted.length,
      storageMissingOrFailed: storage.missingOrFailed.length,
      deletedReports: reportCleanup.deletedReportIds.length,
    },
  })

  return {
    ok: failed.length === 0,
    deletedIds: accessibleIds,
    failed,
    deletedReports: reportCleanup.deletedReportIds,
    storage,
  }
}
