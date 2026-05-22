import { debugError } from "@/lib/utils/debug"

import { auth } from "@/lib/auth"
import { recordActivity } from "@/lib/activity/activity-store"
import { db } from "@/lib/db"
import { datasetRows, datasets } from "@/lib/db/schema"
import { consumeAnalystCredit, requireAnalystCredit } from "@/lib/usage/analyst-credits"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database is not configured" }, { status: 503 })
    }

    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userDatasets = await db.query.datasets.findMany({
      where: eq(datasets.userId, session.user.id),
      columns: {
        id: true,
        name: true,
        createdAt: true,
      },
      orderBy: (datasets, { desc }) => [desc(datasets.createdAt)],
    })

    return NextResponse.json({ datasets: userDatasets })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database is not configured" }, { status: 503 })
    }

    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, fileName, fileSize, columns, rows } = body

    const currentUsage = await requireAnalystCredit(session.user.id)
    if (!currentUsage.canAnalyze) {
      return NextResponse.json({
        error: "Analyst credit limit reached",
        message: "You have used your free dataset credits. Subscribe to Pro or top up to upload another dataset.",
        usage: currentUsage,
      }, { status: 402 })
    }

    // Create dataset record
    const datasetId = `ds_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    await db.insert(datasets).values({
      id: datasetId,
      userId: session.user.id,
      name: name || fileName,
      fileName: fileName || "",
      fileSize: fileSize || null,
      columnCount: columns?.length || 0,
      columns: columns || [],
      rowCount: rows?.length || 0,
    })

    // Insert rows if provided
    if (rows?.length > 0) {
      await db.insert(datasetRows).values(
        rows.map((row: Record<string, unknown>, index: number) => ({
          id: `row_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
          datasetId,
          rowIndex: index,
          data: row,
        }))
      )
    }

    const usage = await consumeAnalystCredit(session.user.id)
    await recordActivity({
      userId: session.user.id,
      userEmail: session.user.email,
      type: "dataset_uploaded",
      feature: "datasets",
      title: "Dataset uploaded",
      description: `${name || fileName || "Dataset"} was added with ${rows?.length || 0} rows.`,
      metadata: {
        datasetId,
        name: name || fileName,
        rowCount: rows?.length || 0,
        columnCount: columns?.length || 0,
      },
    })

    return NextResponse.json({
      dataset: {
        id: datasetId,
        name: name || fileName,
        createdAt: new Date(),
      },
      usage,
    })
  } catch (error) {
    debugError("Error creating dataset:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
