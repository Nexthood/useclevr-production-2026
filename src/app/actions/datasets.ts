"use server"

import { debugError } from "@/lib/utils/debug"



import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { datasetRows, datasets } from "@/lib/db/schema"
import { failure, type Result, success } from "@/lib/result"
import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function deleteDataset(datasetId: string): Promise<Result<true>> {
  const session = await auth()
  if (!session?.user?.id) {
    return failure("Unauthorized")
  }

  try {
    await db.delete(datasets).where(
      and(
        eq(datasets.id, datasetId),
        eq(datasets.userId, session.user.id)
      )
    )
    revalidatePath("/app/datasets")
    return success(true)
  } catch (error) {
    debugError("Error deleting dataset:", error)
    return failure("Failed to delete dataset")
  }
}

export async function getUserDatasets(): Promise<Result<Array<Record<string, unknown>>>> {
  const session = await auth()
  if (!session?.user?.id) {
    return failure("Unauthorized")
  }

  try {
    const userDatasets = await db.query.datasets.findMany({
      where: eq(datasets.userId, session.user.id),
      orderBy: (datasets, { desc }) => [desc(datasets.createdAt)],
      with: {
        rows: true,
      },
    })

    const mapped = userDatasets.map(ds => ({
      ...ds,
      _count: {
        rows: typeof ds.rowCount === 'number' ? ds.rowCount : 0,
      },
    }))

    return success(mapped)
  } catch (error) {
    debugError("Error fetching datasets:", error)
    return failure("Failed to fetch datasets")
  }
}

export async function getDatasetById(datasetId: string): Promise<Result<unknown>> {
  const session = await auth()
  if (!session?.user?.id) {
    return failure("Unauthorized")
  }

  try {
    const dataset = await db.query.datasets.findFirst({
      where: and(
        eq(datasets.id, datasetId),
        eq(datasets.userId, session.user.id)
      ),
    })

    if (!dataset) {
      return failure("Dataset not found")
    }

    return success(dataset)
  } catch (error) {
    debugError("Error fetching dataset:", error)
    return failure("Failed to fetch dataset")
  }
}

export async function getDatasetRows(
  datasetId: string,
  options?: { offset?: number; limit?: number }
): Promise<Result<{ rows: unknown[]; total: number }>> {
  const session = await auth()
  if (!session?.user?.id) {
    return failure("Unauthorized")
  }

  try {
    const dataset = await db.query.datasets.findFirst({
      where: and(
        eq(datasets.id, datasetId),
        eq(datasets.userId, session.user.id)
      ),
      columns: { id: true, rowCount: true },
    })

    if (!dataset) {
      return failure("Dataset not found")
    }

    const offset = options?.offset ?? 0
    const limit = options?.limit ?? 100

    const rows = await db.query.datasetRows.findMany({
      where: eq(datasetRows.datasetId, datasetId),
      orderBy: (rows, { asc }) => [asc(rows.rowIndex)],
      offset,
      limit,
    })
    return success({ rows, total: dataset.rowCount ?? 0 })
  } catch (error) {
    debugError("Error fetching dataset rows:", error)
    return failure("Failed to fetch dataset rows")
  }
}
