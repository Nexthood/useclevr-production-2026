import { debugError } from "@/lib/utils/debug"

import { v4 as uuidv4 } from "uuid"
import { auth } from "@/lib/auth/auth"
import { requireBuiltinUserRecord } from "@/lib/auth/builtin-user-store"
import { recordActivity } from "@/lib/activity/activity-store"
import { db } from "@/lib/db"
import { datasetRows, datasets } from "@/lib/db/schema"
import { consumeAnalystCredit, requireAnalystCredit } from "@/lib/usage/analyst-credits"
import { datasetCreateSchema, validateOrError } from "@/lib/validation"
import { getDatasetLimitInfo, getDatasetLimitError } from "@/lib/usage/dataset-limits"
import { and, eq, inArray } from "drizzle-orm"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database is not configured" }, { status: 503 })
    }

    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await requireBuiltinUserRecord(session.user.id)

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

    await requireBuiltinUserRecord(session.user.id)

    const body = await request.json()
    const validation = validateOrError(datasetCreateSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const { name, fileName, fileSize, columns, rows } = validation.data

    const currentUsage = await requireAnalystCredit(session.user.id, session.user.role, session.user.email)
    if (!currentUsage.canAnalyze) {
      return NextResponse.json({
        error: "Analyst credit limit reached",
        message: "You have used your included AI credits for this plan. Upgrade to continue uploading another dataset.",
        usage: currentUsage,
      }, { status: 402 })
    }

    const limitInfo = await getDatasetLimitInfo(session.user.id, session.user.role, session.user.email)
    const limitError = getDatasetLimitError(limitInfo)
    if (limitError) {
      return NextResponse.json({
        error: "Dataset limit reached",
        message: limitError,
        limitInfo,
      }, { status: 403 })
    }

    // Create dataset record
    const datasetId = `ds_${uuidv4()}`
    const now = new Date()
    
    await db.insert(datasets).values({
      id: datasetId,
      userId: session.user.id,
      name: name || fileName,
      fileName: fileName || "",
      fileSize: fileSize || null,
      columnCount: columns?.length || 0,
      columns: columns || [],
      rowCount: rows?.length || 0,
      createdAt: now,
      updatedAt: now,
    })

    // Insert rows if provided
    if (rows?.length > 0) {
      await db.insert(datasetRows).values(
        rows.map((row: Record<string, unknown>, index: number) => ({
          id: `row_${uuidv4()}`,
          datasetId,
          rowIndex: index,
          data: row,
        }))
      )
    }

    const usage = await consumeAnalystCredit(session.user.id, session.user.role, session.user.email)
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
        createdAt: now,
      },
      usage,
    })
  } catch (error) {
    debugError("Error creating dataset:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { datasetIds } = body
    
    if (!Array.isArray(datasetIds) || datasetIds.length === 0) {
      return NextResponse.json({ error: "Dataset IDs array is required" }, { status: 400 })
    }

    // Verify all datasets belong to the user before deleting
    const datasetsToDelete = await db
      .select({ id: datasets.id })
      .from(datasets)
      .where(
        and(
          eq(datasets.userId, session.user.id),
          inArray(datasets.id, datasetIds)
        )
      )

    if (datasetsToDelete.length === 0) {
      return NextResponse.json({ error: "No datasets found or access denied" }, { status: 404 })
    }

    // Delete datasets (rows will be deleted due to cascade)
    await db.delete(datasets).where(
      and(
        eq(datasets.userId, session.user.id),
        inArray(datasets.id, datasetIds)
      )
    )

    // Record activity for bulk deletion
    await recordActivity({
      userId: session.user.id,
      userEmail: session.user.email,
      type: "dataset_deleted",
      feature: "datasets",
      title: "Bulk dataset deletion",
      description: `${datasetsToDelete.length} datasets were removed.`,
      metadata: {
        datasetIds: datasetsToDelete.map(d => d.id),
        count: datasetsToDelete.length,
      },
    })

    return NextResponse.json({ 
      success: true, 
      deletedCount: datasetsToDelete.length 
    })
  } catch (error) {
    debugError("Error bulk deleting datasets:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
