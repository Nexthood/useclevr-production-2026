import { auth } from "@/lib/auth/auth"
import { deleteDatasetsForUser } from "@/lib/data/delete-datasets"
import { db } from "@/lib/db"
import { datasetRows, datasets } from "@/lib/db/schema"
import { debugError } from "@/lib/utils/debug"
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

    // Parse pagination from query params
    const url = new URL(request.url)
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1)
    const pageSize = Math.min(1000, Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "100", 10) || 100))
    const offset = (page - 1) * pageSize

    const rows = await db.query.datasetRows.findMany({
      where: eq(datasetRows.datasetId, id),
      columns: { data: true },
      orderBy: (rows, { asc }) => [asc(rows.rowIndex)],
      offset,
      limit: pageSize,
    })

    const data = rows.map((r) => r.data)
    const columns = (dataset.columns as string[]) || []
    const totalRows = dataset.rowCount ?? 0
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
    const precomputedMetrics = (dataset.precomputedMetrics as Record<string, unknown>) || null
    const precomputedAnalysis = (dataset.analysis as Record<string, unknown>) || null

    return NextResponse.json({ 
      dataset,
      rows: data,
      columns,
      totalRows,
      page,
      pageSize,
      totalPages,
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

    const result = await deleteDatasetsForUser({
      datasetIds: [id],
      userId: session.user.id,
      userEmail: session.user.email,
      role: session.user.role,
    })

    if (result.deletedIds.length === 0) {
      return NextResponse.json({
        ok: false,
        error: "Dataset not found or access denied.",
        deletedIds: [],
        failed: result.failed,
      }, { status: 404 })
    }

    return NextResponse.json({
      ok: true,
      success: true,
      deletedIds: result.deletedIds,
      failed: result.failed,
      deletedCount: result.deletedIds.length,
      cleanup: result.cleanup,
      deletedReports: result.deletedReports,
      storage: result.storage,
      message: "Dataset deleted successfully.",
    })
  } catch (error) {
    debugError("Error deleting dataset:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
