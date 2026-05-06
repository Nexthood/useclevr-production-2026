"use server"

import { debugLog, debugError, debugWarn } from "@/lib/debug"



import { db } from "@/lib/db"
import { datasets, datasetRows } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"

export async function deleteDataset(datasetId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: "Unauthorized" }
  }

  try {
    await db.delete(datasets).where(
      and(
        eq(datasets.id, datasetId),
        eq(datasets.userId, session.user.id)
      )
    )
    revalidatePath("/app/datasets")
    return { success: true }
  } catch (error) {
    debugError("Error deleting dataset:", error)
    return { error: "Failed to delete dataset" }
  }
}

export async function getUserDatasets() {
  const session = await auth()
  if (!session?.user?.id) {
    return []
  }

  try {
    const userDatasets = await db.query.datasets.findMany({
      where: eq(datasets.userId, session.user.id),
      orderBy: (datasets, { desc }) => [desc(datasets.createdAt)],
      with: {
        rows: true,
      },
    })

    // Map to include count like Prisma did
    return userDatasets.map(ds => ({
      ...ds,
      _count: {
        rows: typeof ds.rowCount === 'number' ? ds.rowCount : 0,
      },
    }))
  } catch (error) {
    debugError("Error fetching datasets:", error)
    return []
  }
}

export async function getDatasetById(datasetId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return null
  }

  try {
    const dataset = await db.query.datasets.findFirst({
      where: and(
        eq(datasets.id, datasetId),
        eq(datasets.userId, session.user.id)
      ),
    })
    return dataset
  } catch (error) {
    debugError("Error fetching dataset:", error)
    return null
  }
}

export async function getDatasetRows(datasetId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return []
  }

  try {
    // First, verify the dataset belongs to the user
    const dataset = await db.query.datasets.findFirst({
      where: and(
        eq(datasets.id, datasetId),
        eq(datasets.userId, session.user.id)
      ),
    })

    if (!dataset) {
      return []
    }

    const rows = await db.query.datasetRows.findMany({
      where: eq(datasetRows.datasetId, datasetId),
      limit: 100,
    })
    return rows
  } catch (error) {
    debugError("Error fetching dataset rows:", error)
    return []
  }
}
