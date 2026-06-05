import { debugError } from "@/lib/utils/debug"

import { DatasetsClient } from "@/components/dataset/datasets-client"
import { auth } from "@/lib/auth/auth"
import { db } from "@/lib/db"
import { datasets, users } from "@/lib/db/schema"
import { desc, eq } from "drizzle-orm"

export const metadata = {
  title: "Datasets - UseClevr",
  description: "Manage your datasets",
}

export default async function DatasetsPage() {
  const session = await auth()

  // Check for demo mode
  const isDemoMode = process.env.DEMO_MODE === "true" || !session?.user?.id
  
  let datasetsList: any[] = []
  let demoUserId: string | null = null

  // For demo mode, also fetch demo user datasets
  if (isDemoMode && !session?.user?.id) {
    try {
      const allUsers = await db.select().from(users).limit(1)
      if (allUsers.length > 0) {
        demoUserId = allUsers[0].id
      }
    } catch (dbError) {
      debugError("[DATASETS] Database error finding demo user:", dbError)
    }
  }

  if (session?.user?.id || demoUserId) {
    try {
      const userId = session?.user?.id || demoUserId!
      
      const data = await db.select({
        id: datasets.id,
        name: datasets.name,
        fileName: datasets.fileName,
        rowCount: datasets.rowCount,
        columnCount: datasets.columnCount,
        status: datasets.status,
        createdAt: datasets.createdAt,
        columns: datasets.columns,
      })
      .from(datasets)
      .where(eq(datasets.userId, userId))
      .orderBy(desc(datasets.createdAt))
      .limit(20)
      
      datasetsList = data
    } catch (e) {
      debugError("[DATASETS] Query error:", e)
      datasetsList = []
    }
  }

  return <DatasetsClient initialDatasets={datasetsList} />
}
