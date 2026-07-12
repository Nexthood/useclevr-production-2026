import { debugError } from "@/lib/utils/debug"

import { DatasetsClient, type DatasetListItem } from "@/components/dataset/datasets-client"
import { auth } from "@/lib/auth/auth"
import { getDatasetCategoryDestinationLabel, resolveDatasetType } from "@/lib/data/dataset-category"
import { db } from "@/lib/db"
import { datasets } from "@/lib/db/schema"
import { desc, eq } from "drizzle-orm"
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
      analysis: datasets.analysis,
      createdAt: datasets.createdAt,
      columns: datasets.columns,
    })
    .from(datasets)
    .where(eq(datasets.userId, session.user.id))
    .orderBy(desc(datasets.createdAt))
    .limit(20)

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
        destinationModule: getDatasetCategoryDestinationLabel(datasetType),
      columns: Array.isArray(dataset.columns)
        ? dataset.columns.filter((column): column is string => typeof column === "string")
        : [],
      }
    })
  } catch (e) {
    debugError("[DATASETS] Query error:", e)
    datasetsList = []
  }

  return <DatasetsClient initialDatasets={datasetsList} />
}
