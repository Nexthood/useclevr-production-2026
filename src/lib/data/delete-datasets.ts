import { recordActivity } from "@/lib/activity/activity-store"
import { deleteFile } from "@/lib/data/upload-handler"
import { db } from "@/lib/db"
import {
  accuracyIngestionJobs,
  aiCostLogs,
  aiGovernanceOverrides,
  aiInteractionTraces,
  aiRequestAuditLogs,
  datasetRows,
  datasets,
  mcpAuditLogs,
  prebookkeepingAuditEvents,
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
  requestedCount: number
  matchedCount: number
  deletedCount: number
  deletedIds: string[]
  failedIds: string[]
  failed: DeleteDatasetFailure[]
  cleanup: {
    accuracyDocuments: number
    accuracyJobs: number
    prebookkeepingAuditEvents: number
    aiGovernanceOverrides: number
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
const DELETE_CHUNK_SIZE = 50

export function sanitizeDatasetIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.filter((id): id is string => typeof id === "string").map((id) => id.trim()).filter(Boolean))).slice(0, MAX_DELETE_BATCH_SIZE)
}

export async function deleteDatasetsForUser({
  datasetIds,
  userId,
  userEmail,
  role: _role,
}: DeleteDatasetsInput): Promise<DeleteDatasetsResult> {
  const requestedIds = sanitizeDatasetIds(datasetIds)
  if (requestedIds.length === 0) {
    return {
      ok: false,
      requestedCount: 0,
      matchedCount: 0,
      deletedCount: 0,
      deletedIds: [],
      failedIds: [],
      failed: [],
      cleanup: { accuracyDocuments: 0, accuracyJobs: 0, prebookkeepingAuditEvents: 0, aiGovernanceOverrides: 0 },
      deletedReports: [],
      storage: { deleted: [], missingOrFailed: [] },
    }
  }

  const accessibleDatasets = await db.query.datasets.findMany({
    where: and(eq(datasets.userId, userId), inArray(datasets.id, requestedIds)),
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
      requestedCount: requestedIds.length,
      matchedCount: 0,
      deletedCount: 0,
      deletedIds: [],
      failedIds: failed.map((failure) => failure.datasetId),
      failed,
      cleanup: { accuracyDocuments: 0, accuracyJobs: 0, prebookkeepingAuditEvents: 0, aiGovernanceOverrides: 0 },
      deletedReports: [],
      storage: { deleted: [], missingOrFailed: [] },
    }
  }

  const cleanup = { accuracyDocuments: 0, accuracyJobs: 0, prebookkeepingAuditEvents: 0, aiGovernanceOverrides: 0 }
  const deletedIds = new Set<string>()
  await db.transaction(async (tx) => {
    const accuracyCleanup = await deleteAccuracyRecordsIfTablesExist(tx, accessibleIds)
    cleanup.accuracyDocuments = accuracyCleanup.documents
    cleanup.accuracyJobs = accuracyCleanup.jobs

    for (const chunk of chunkIds(accessibleIds)) {
      if (await tableExists(tx, "AiGovernanceOverride")) {
        const deleted = await tx.delete(aiGovernanceOverrides)
          .where(inArray(aiGovernanceOverrides.datasetId, chunk))
          .returning()
        cleanup.aiGovernanceOverrides += deleted.length
      }
      if (await tableExists(tx, "PrebookkeepingAuditEvent")) {
        const deleted = await tx.delete(prebookkeepingAuditEvents)
          .where(inArray(prebookkeepingAuditEvents.datasetId, chunk))
          .returning()
        cleanup.prebookkeepingAuditEvents += deleted.length
      }
      if (await tableExists(tx, "AiInteractionTrace")) {
        await tx.delete(aiInteractionTraces).where(inArray(aiInteractionTraces.datasetId, chunk))
      }
      if (await tableExists(tx, "AiRequestAuditLog")) {
        await tx.delete(aiRequestAuditLogs).where(inArray(aiRequestAuditLogs.datasetId, chunk))
      }
      if (await tableExists(tx, "AICostLog")) {
        await tx.delete(aiCostLogs).where(inArray(aiCostLogs.datasetId, chunk))
      }
      if (await tableExists(tx, "MCPAuditLog")) {
        await tx.delete(mcpAuditLogs).where(inArray(mcpAuditLogs.datasetId, chunk))
      }
      if (await tableExists(tx, "UserActivity")) {
        for (const datasetId of chunk) {
          await tx.delete(userActivities).where(sql`
            ${userActivities.metadata}->>'datasetId' = ${datasetId}
            OR COALESCE(${userActivities.metadata}->'datasetIds', '[]'::jsonb) @> ${JSON.stringify([datasetId])}::jsonb
          `)
        }
      }
      await tx.delete(datasetRows).where(inArray(datasetRows.datasetId, chunk))
      const deletedDatasets = await tx.delete(datasets)
        .where(inArray(datasets.id, chunk))
        .returning()
      for (const dataset of deletedDatasets) deletedIds.add(dataset.id)
    }
  })

  const remainingRows = await db.select({ id: datasets.id })
    .from(datasets)
    .where(inArray(datasets.id, accessibleIds))
  const remainingIds = new Set(remainingRows.map((row) => row.id))
  for (const datasetId of remainingIds) deletedIds.delete(datasetId)

  const confirmedDeletedIds = accessibleIds.filter((datasetId) => deletedIds.has(datasetId))
  const unconfirmedFailures = accessibleIds
    .filter((datasetId) => !deletedIds.has(datasetId))
    .map((datasetId) => ({
      datasetId,
      reason: remainingIds.has(datasetId)
        ? "Dataset deletion was not confirmed by the database."
        : "Dataset deletion did not return a deleted row.",
    }))
  const allFailed = [...failed, ...unconfirmedFailures]

  const storage: DeleteDatasetsResult["storage"] = { deleted: [], missingOrFailed: [] }
  for (const dataset of accessibleDatasets) {
    if (!deletedIds.has(dataset.id)) continue
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

  const reportCleanup = await deleteReportsForDatasets(confirmedDeletedIds)
  if (reportCleanup.failed.length > 0) {
    debugError("[DATASETS DELETE] Report file cleanup failed:", reportCleanup.failed)
  }
  if (storage.deleted.length > 0 || storage.missingOrFailed.length > 0) {
    debugLog("[DATASETS DELETE] Storage cleanup result:", {
      deleted: storage.deleted.length,
      missingOrFailed: storage.missingOrFailed.length,
    })
  }

  if (confirmedDeletedIds.length > 0) {
    const deletedDatasetRows = accessibleDatasets.filter((dataset) => deletedIds.has(dataset.id))
    await recordActivity({
      userId,
      userEmail,
      type: "dataset_deleted",
      feature: "datasets",
      title: confirmedDeletedIds.length === 1 ? "Dataset deleted" : "Datasets deleted",
      description: confirmedDeletedIds.length === 1
        ? `${deletedDatasetRows[0]?.name || "Dataset"} was removed.`
        : `${confirmedDeletedIds.length} datasets were removed.`,
      metadata: {
        datasetIds: confirmedDeletedIds,
        requestedCount: requestedIds.length,
        matchedCount: accessibleIds.length,
        deletedCount: confirmedDeletedIds.length,
        failedIds: allFailed.map((failure) => failure.datasetId),
        datasetTypes: deletedDatasetRows.map((dataset) => dataset.datasetType || "standard"),
        rowCount: deletedDatasetRows.reduce((total, dataset) => total + (dataset.rowCount || 0), 0),
        accuracyDocumentsDeleted: cleanup.accuracyDocuments,
        accuracyJobsDeleted: cleanup.accuracyJobs,
        prebookkeepingAuditEventsDeleted: cleanup.prebookkeepingAuditEvents,
        aiGovernanceOverridesDeleted: cleanup.aiGovernanceOverrides,
        storageDeleted: storage.deleted.length,
        storageMissingOrFailed: storage.missingOrFailed.length,
        deletedReports: reportCleanup.deletedReportIds.length,
      },
    })
  }

  return {
    ok: allFailed.length === 0,
    requestedCount: requestedIds.length,
    matchedCount: accessibleIds.length,
    deletedCount: confirmedDeletedIds.length,
    deletedIds: confirmedDeletedIds,
    failedIds: allFailed.map((failure) => failure.datasetId),
    failed: allFailed,
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

function chunkIds(datasetIds: string[]) {
  const chunks: string[][] = []
  for (let index = 0; index < datasetIds.length; index += DELETE_CHUNK_SIZE) {
    chunks.push(datasetIds.slice(index, index + DELETE_CHUNK_SIZE))
  }
  return chunks
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
