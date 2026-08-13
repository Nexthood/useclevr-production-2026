import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth/auth"
import { deleteDatasetsForUser, MAX_DELETE_BATCH_SIZE, sanitizeDatasetIds } from "@/lib/data/delete-datasets"
import { debugError } from "@/lib/utils/debug"

const NO_STORE_HEADERS = { "Cache-Control": "no-store" }

export async function handleBulkDeleteDatasetsRequest(request: Request) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE_HEADERS })
    }

    const body = await request.json().catch(() => null)
    const rawDatasetIds = (body as { datasetIds?: unknown } | null)?.datasetIds
    const datasetIds = sanitizeDatasetIds(rawDatasetIds)

    if (!Array.isArray(rawDatasetIds) || datasetIds.length === 0) {
      return NextResponse.json({
        ok: false,
        success: false,
        error: "Dataset IDs array is required.",
        requestedCount: 0,
        matchedCount: 0,
        deletedCount: 0,
        failedCount: 0,
        deletedIds: [],
        failedIds: [],
        failed: [],
      }, { status: 400, headers: NO_STORE_HEADERS })
    }

    if (rawDatasetIds.length > MAX_DELETE_BATCH_SIZE) {
      return NextResponse.json({
        ok: false,
        success: false,
        error: `Delete up to ${MAX_DELETE_BATCH_SIZE} datasets at a time.`,
        requestedCount: rawDatasetIds.length,
        matchedCount: 0,
        deletedCount: 0,
        failedCount: rawDatasetIds.length,
        deletedIds: [],
        failedIds: datasetIds,
        failed: datasetIds.map((datasetId) => ({
          datasetId,
          reason: `Delete up to ${MAX_DELETE_BATCH_SIZE} datasets at a time.`,
        })),
      }, { status: 400, headers: NO_STORE_HEADERS })
    }

    const result = await deleteDatasetsForUser({
      datasetIds,
      userId: session.user.id,
      userEmail: session.user.email,
      role: session.user.role,
    })

    if (result.deletedCount > 0) {
      revalidateDatasetViews(result.deletedIds)
    }

    const status = result.deletedCount === 0
      ? 404
      : result.failed.length > 0
        ? 207
        : 200

    return NextResponse.json({
      ok: result.ok,
      success: result.ok,
      requestedCount: result.requestedCount,
      matchedCount: result.matchedCount,
      deletedCount: result.deletedCount,
      failedCount: result.failed.length,
      deletedIds: result.deletedIds,
      failedIds: result.failedIds,
      failed: result.failed,
      cleanup: result.cleanup,
      deletedReports: result.deletedReports,
      storage: result.storage,
      message: buildBulkDeleteMessage(result),
      error: result.deletedCount === 0 ? "No selected datasets could be deleted." : undefined,
    }, { status, headers: NO_STORE_HEADERS })
  } catch (error) {
    debugError("Error bulk deleting datasets:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: NO_STORE_HEADERS })
  }
}

function buildBulkDeleteMessage(result: Awaited<ReturnType<typeof deleteDatasetsForUser>>) {
  if (result.deletedCount === 0) return "No selected datasets could be deleted."
  if (result.failed.length > 0) {
    return `${result.deletedCount} dataset${result.deletedCount === 1 ? "" : "s"} deleted. ${result.failed.length} could not be deleted.`
  }
  return `${result.deletedCount} dataset${result.deletedCount === 1 ? "" : "s"} deleted successfully.`
}

function revalidateDatasetViews(datasetIds: string[]) {
  revalidatePath("/app")
  revalidatePath("/app/datasets")
  revalidatePath("/app/risk-intelligence")
  revalidatePath("/app/dashboard")
  revalidatePath("/app/retail")
  revalidatePath("/app/profitability")
  revalidatePath("/app/accountancy")
  revalidatePath("/app/prebookkeeping")
  revalidatePath("/app/reports")
  for (const datasetId of datasetIds) {
    revalidatePath(`/app/datasets/${datasetId}`)
  }
}
