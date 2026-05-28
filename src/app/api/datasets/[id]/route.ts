import { auth } from "@/lib/auth"
import { recordActivity } from "@/lib/activity/activity-store"
import { db } from "@/lib/db"
import { datasetRows, datasets } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get dataset with precomputed metrics
    const dataset = await db.query.datasets.findFirst({
      where: and(
        eq(datasets.id, id),
        eq(datasets.userId, session.user.id)
      ),
      columns: {
        id: true,
        name: true,
        createdAt: true,
        columns: true,
        rowCount: true,
        precomputedMetrics: true,
        analysis: true,
      },
    })

    if (!dataset) {
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 })
    }

    // Get first 100 rows for preview
    const rows = await db.query.datasetRows.findMany({
      where: eq(datasetRows.datasetId, id),
      columns: { data: true },
      orderBy: (rows, { asc }) => [asc(rows.rowIndex)],
      limit: 100,
    })

    const data = rows.map((r) => r.data)
    const columns = (dataset.columns as string[]) || []
    const precomputedMetrics = (dataset.precomputedMetrics as Record<string, unknown>) || null
    const precomputedAnalysis = (dataset.analysis as Record<string, unknown>) || null

    return NextResponse.json({ 
      dataset,
      rows: data,
      columns,
      totalRows: dataset.rowCount,
      precomputedMetrics,
      precomputedAnalysis,
    })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const dataset = await db.query.datasets.findFirst({
      where: and(
        eq(datasets.id, id),
        eq(datasets.userId, session.user.id)
      ),
      columns: {
        name: true,
        rowCount: true,
      },
    })

    // Delete dataset (rows will be deleted due to cascade)
    await db.delete(datasets).where(
      and(
        eq(datasets.id, id),
        eq(datasets.userId, session.user.id)
      )
    )

    if (dataset) {
      await recordActivity({
        userId: session.user.id,
        userEmail: session.user.email,
        type: "dataset_deleted",
        feature: "datasets",
        title: "Dataset deleted",
        description: `${dataset.name} was removed.`,
        metadata: {
          datasetId: id,
          rowCount: dataset.rowCount,
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
