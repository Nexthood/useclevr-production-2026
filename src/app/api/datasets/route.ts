import { debugError } from "@/lib/utils/debug"

import { v4 as uuidv4 } from "uuid"
import { auth } from "@/lib/auth/auth"
import { requireBuiltinUserRecord } from "@/lib/auth/builtin-user-store"
import { recordActivity } from "@/lib/activity/activity-store"
import { handleBulkDeleteDatasetsRequest } from "@/lib/data/delete-datasets-api"
import { db } from "@/lib/db"
import { datasetRows, datasets } from "@/lib/db/schema"
import { finalizeCredits, releaseCredits, reserveCredits } from "@/lib/billing/credit-engine"
import { checkSpendingLimits } from "@/lib/billing/credit-account-service"
import { buildUploadCreditLimitInlineMessage } from "@/lib/billing/upload-credit-messaging"
import { getAnalystCreditUsage } from "@/lib/usage/analyst-credits"
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
  let creditOperationId: string | null = null
  let creditReserved = false
  let creditFinalized = false
  let datasetId: string | null = null

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

    const currentUsage = await getAnalystCreditUsage(session.user.id, session.user.role, session.user.email)
    if (!currentUsage.unlimited && (currentUsage.availableCredits ?? 0) <= 0) {
      return NextResponse.json({
        error: "Upload credit limit reached",
        code: "UPLOAD_CREDITS_EXHAUSTED",
        title: "Free upload limit reached",
        message: buildUploadCreditLimitInlineMessage(currentUsage.total),
        used: currentUsage.usedCredits,
        limit: currentUsage.total,
        remaining: currentUsage.availableCredits,
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
    const createdDatasetId = `ds_${uuidv4()}`
    datasetId = createdDatasetId
    creditOperationId = `upload:${session.user.id}:${createdDatasetId}`
    const now = new Date()

    let usage = currentUsage
    if (!currentUsage.unlimited) {
      const spendingLimitCheck = await checkSpendingLimits(session.user.id)
      if (spendingLimitCheck.blocked) {
        return NextResponse.json({
          error: "Upload credit limit reached",
          code: "UPLOAD_SPENDING_LIMIT_REACHED",
          title: "Spending limit reached",
          message: spendingLimitCheck.reason || "Your spending limit has been reached.",
          used: usage.usedCredits,
          limit: usage.total,
          remaining: usage.availableCredits,
          usage,
        }, { status: 402 })
      }

      const reservation = await reserveCredits({
        userId: session.user.id,
        operationId: creditOperationId,
        idempotencyKey: creditOperationId,
        estimatedCredits: 1,
        feature: "dataset_upload",
        source: "api_dataset_create",
        role: session.user.role ?? null,
        email: session.user.email ?? null,
        metadata: {
          datasetId: createdDatasetId,
          fileName: fileName || name || "dataset",
          rowCount: rows?.length || 0,
          datasetType: "standard",
        },
      })

      if (!reservation.success) {
        const usage = await getAnalystCreditUsage(session.user.id, session.user.role, session.user.email)
        return NextResponse.json({
          error: "Upload credit limit reached",
          code: "UPLOAD_CREDITS_EXHAUSTED",
          title: "Free upload limit reached",
          message: buildUploadCreditLimitInlineMessage(usage.total),
          used: usage.usedCredits,
          limit: usage.total,
          remaining: usage.availableCredits,
          usage,
        }, { status: 402 })
      }

      creditReserved = true
    }
    
    await db.insert(datasets).values({
      id: createdDatasetId,
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
          datasetId: createdDatasetId,
          rowIndex: index,
          data: row,
        }))
      )
    }

    if (creditReserved && creditOperationId) {
      const finalized = await finalizeCredits({
        operationId: creditOperationId,
        actualCredits: 1,
        metadata: {
          datasetId: createdDatasetId,
          fileName: fileName || name || "dataset",
          rowCount: rows?.length || 0,
          datasetType: "standard",
        },
      })

      if (!finalized.success) {
        await db.transaction(async (tx) => {
          if (datasetId) {
            await tx.delete(datasetRows).where(eq(datasetRows.datasetId, createdDatasetId))
            await tx.delete(datasets).where(eq(datasets.id, createdDatasetId))
          }
        })
        await releaseCredits(creditOperationId, "dataset_api_credit_settlement_failed")
        return NextResponse.json({
          error: "Upload credit settlement failed",
          message: "The dataset could not be saved with a finalized upload credit. Please try again.",
        }, { status: 500 })
      }

      creditFinalized = true
      usage = await getAnalystCreditUsage(session.user.id, session.user.role, session.user.email)
    }

    await recordActivity({
      userId: session.user.id,
      userEmail: session.user.email,
      type: "dataset_uploaded",
      feature: "datasets",
      title: "Dataset uploaded",
      description: `${name || fileName || "Dataset"} was added with ${rows?.length || 0} rows.`,
      metadata: {
        datasetId: createdDatasetId,
        name: name || fileName,
        rowCount: rows?.length || 0,
        columnCount: columns?.length || 0,
      },
    })
 
    return NextResponse.json({
      dataset: {
        id: createdDatasetId,
        name: name || fileName,
        createdAt: now,
      },
      usage,
    })
  } catch (error) {
    if (creditReserved && creditOperationId && !creditFinalized) {
      await releaseCredits(creditOperationId, "dataset_api_create_failed").catch((releaseError) => {
        debugError("Error releasing reserved dataset upload credit:", releaseError)
      })
    }
    if (datasetId && !creditFinalized) {
      await db.transaction(async (tx) => {
        await tx.delete(datasetRows).where(eq(datasetRows.datasetId, datasetId!))
        await tx.delete(datasets).where(eq(datasets.id, datasetId!))
      }).catch((cleanupError) => {
        debugError("Error cleaning failed dataset create:", cleanupError)
      })
    }
    debugError("Error creating dataset:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  return handleBulkDeleteDatasetsRequest(request)
}
