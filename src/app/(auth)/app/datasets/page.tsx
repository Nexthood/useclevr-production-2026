import { debugError } from "@/lib/utils/debug"

import { DatasetsClient, type DatasetListItem } from "@/components/dataset/datasets-client"
import { auth } from "@/lib/auth/auth"
import {
  HISTORICAL_DATA_SAFE_MESSAGE,
  isDatasetLockedByHistoricalState,
  loadHistoricalAccessState,
} from "@/lib/billing/historical-unlock"
import { getDatasetCategoryDestinationLabel, resolveDatasetType } from "@/lib/data/dataset-category"
import { db } from "@/lib/db"
import { datasets } from "@/lib/db/schema"
import { and, desc, eq, isNull, ne, or } from "drizzle-orm"
import { redirect } from "next/navigation"

export const metadata = {
  title: "Datasets - UseClevr",
  description: "Manage your datasets",
}

export default async function DatasetsPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login")
  }

  let datasetsList: DatasetListItem[] = []
  // Datasets created before the subscription ended form the preserved
  // historical data set. State resolution failing open keeps the library up.
  const historicalState = await loadHistoricalAccessState(session.user.id)
  const historicalBanner = historicalState.historicalDatasetsLocked
    ? `${HISTORICAL_DATA_SAFE_MESSAGE} Your historical datasets are locked read-only. Reactivate your subscription at any time or permanently unlock access with a one-time payment in subscription settings.`
    : historicalState.historicalDataUnlocked
      ? `${HISTORICAL_DATA_SAFE_MESSAGE} Your historical data is permanently unlocked.`
      : null

  try {
    const data = await db.select({
      id: datasets.id,
      name: datasets.name,
      fileName: datasets.fileName,
      rowCount: datasets.rowCount,
      columnCount: datasets.columnCount,
      status: datasets.status,
      analysisStatus: datasets.analysisStatus,
      datasetType: datasets.datasetType,
      source: datasets.source,
      analysis: datasets.analysis,
      columnMapping: datasets.columnMapping,
      createdAt: datasets.createdAt,
      columns: datasets.columns,
    })
    .from(datasets)
    .where(and(
      eq(datasets.userId, session.user.id),
      // SQL `!=` excludes NULL datasetType rows; keep rows persisted without a
      // datasetType visible in the library (they resolve to "standard").
      or(isNull(datasets.datasetType), ne(datasets.datasetType, "prebookkeeping")),
    ))
    .orderBy(desc(datasets.createdAt))
    .limit(100)

    if (data.length === 0) {
      console.warn("[DATASET_LIBRARY] empty_result", {
        userId: session.user.id,
        reason: "query_returned_zero_rows",
      })
    }

    datasetsList = data.map((dataset) => {
      const datasetType = resolveDatasetType(dataset.datasetType, dataset.analysis)
      const analysis = dataset.analysis && typeof dataset.analysis === "object"
        ? dataset.analysis as Record<string, unknown>
        : {}
      const uploadSource = typeof analysis.uploadSource === "string" ? analysis.uploadSource : datasetType

      return {
        ...dataset,
        datasetType,
        uploadSource,
        source: dataset.source,
        columnMapping: dataset.columnMapping,
        destinationModule: getDatasetCategoryDestinationLabel(datasetType),
        historicalDataLocked: isDatasetLockedByHistoricalState(historicalState, dataset.createdAt),
      columns: Array.isArray(dataset.columns)
        ? dataset.columns.filter((column): column is string => typeof column === "string")
        : [],
      }
    })
  } catch (e) {
    console.warn("[DATASET_LIBRARY] query_failed", {
      userId: session.user.id,
      error: e instanceof Error ? e.message : String(e),
    })
    debugError("[DATASETS] Query error:", e)
    datasetsList = []
  }

  return <DatasetsClient initialDatasets={datasetsList} historicalBanner={historicalBanner} />
}
