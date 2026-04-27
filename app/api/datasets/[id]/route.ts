import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { datasets, datasetRows } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
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

    // Get dataset
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

    return NextResponse.json({ 
      dataset,
      rows: data,
      columns,
      totalRows: dataset.rowCount,
    })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Delete dataset (rows will be deleted due to cascade)
    await db.delete(datasets).where(
      and(
        eq(datasets.id, id),
        eq(datasets.userId, session.user.id)
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
