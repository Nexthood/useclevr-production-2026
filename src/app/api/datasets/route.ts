import { debugError } from "@/lib/utils/debug"

import { v4 as uuidv4 } from "uuid"
import { auth } from "@/lib/auth/auth"
import { requireBuiltinUserRecord } from "@/lib/auth/builtin-user-store"
import { recordActivity } from "@/lib/activity/activity-store"
import { deleteDatasetsForUser, MAX_DELETE_BATCH_SIZE, sanitizeDatasetIds } from "@/lib/data/delete-datasets"
import { db } from "@/lib/db"
import { datasetRows, datasets } from "@/lib/db/schema"
import { consumeAnalystCredit, requireAnalystCredit } from "@/lib/usage/analyst-credits"
import { datasetCreateSchema, validateOrError } from "@/lib/validation"
import { getDatasetLimitInfo, getDatasetLimitError } from "@/lib/usage/dataset-limits"
import { eq } from "drizzle-orm"
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

    const body = await request.json().catch(() => null)
    const rawDatasetIds = (body as { datasetIds?: unknown } | null)?.datasetIds
    const datasetIds = sanitizeDatasetIds(rawDatasetIds)
    
    if (!Array.isArray(rawDatasetIds) || datasetIds.length === 0) {
      return NextResponse.json({
        ok: false,
        error: "Dataset IDs array is required.",
        deletedIds: [],
        failed: [],
      }, { status: 400 })
    }

    if (rawDatasetIds.length > MAX_DELETE_BATCH_SIZE) {
      return NextResponse.json({
        ok: false,
        error: `Delete up to ${MAX_DELETE_BATCH_SIZE} datasets at a time.`,
        deletedIds: [],
        failed: [],
      }, { status: 400 })
    }

    const result = await deleteDatasetsForUser({
      datasetIds,
      userId: session.user.id,
      userEmail: session.user.email,
      role: session.user.role,
    })

    if (result.deletedIds.length === 0) {
      return NextResponse.json({
        ok: false,
        error: "No matching datasets found or access denied.",
        message: "No selected datasets could be deleted.",
        deletedIds: result.deletedIds,
        failed: result.failed,
      }, { status: 404 })
    }

    return NextResponse.json({
      ok: result.failed.length === 0,
      success: result.failed.length === 0,
      deletedIds: result.deletedIds,
      failed: result.failed,
      deletedCount: result.deletedIds.length,
      cleanup: result.cleanup,
      deletedReports: result.deletedReports,
      storage: result.storage,
      message: result.failed.length > 0
        ? `${result.deletedIds.length} dataset${result.deletedIds.length === 1 ? "" : "s"} deleted. ${result.failed.length} could not be deleted.`
        : `${result.deletedIds.length} dataset${result.deletedIds.length === 1 ? "" : "s"} deleted successfully.`,
    }, { status: result.failed.length > 0 ? 207 : 200 })
  } catch (error) {
    debugError("Error bulk deleting datasets:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
