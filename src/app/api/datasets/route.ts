import { debugError } from "@/lib/debug"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { datasets, datasetRows } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { consumeAnalystCredit } from "@/lib/usage/analyst-credits"

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
  } catch (error) {
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
