import { auth } from "@/lib/auth/auth";
import { finalizeCredits, releaseCredits, reserveCredits } from "@/lib/billing/credit-engine";
import { parseCSVStreaming } from "@/lib/data/csvLoader";
import { getDb } from "@/lib/db";
import { datasetRows, datasets } from "@/lib/db/schema";
import { getAnalystCreditUsage } from "@/lib/usage/analyst-credits";
import { debugError, debugLog } from "@/lib/utils/debug";
import { and, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

const SIMPLE_PARSE_ROW_LIMIT = 1000;
const SIMPLE_ROW_INSERT_LIMIT = 1000;

function jsonError(
  status: number,
  stage: string,
  message: string,
  retryable = false,
  extra: Record<string, unknown> = {},
) {
  const requestId = typeof extra.requestId === "string" ? extra.requestId : createRequestId();
  return NextResponse.json(
    {
      ok: false,
      success: false,
      code: extra.code || "UPLOAD_PROCESSING_FAILED",
      stage,
      step: stage,
      message,
      error: message,
      requestId,
      retryable,
      ...extra,
    },
    { status, headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } },
  );
}

function serializeDatasetCreateError(error: unknown) {
  if (error instanceof Error) {
    const cause = "cause" in error ? (error as Error & { cause?: unknown }).cause : undefined;
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      cause:
        cause instanceof Error
          ? { name: cause.name, message: cause.message }
          : cause
            ? String(cause)
            : undefined,
    };
  }

  return { message: String(error) };
}

function isCsvOrExcel(file: File) {
  const fileName = file.name.toLowerCase();
  return (
    fileName.endsWith(".csv") ||
    fileName.endsWith(".xlsx") ||
    fileName.endsWith(".xls") ||
    file.type.includes("csv") ||
    file.type.includes("spreadsheet") ||
    file.type.includes("excel") ||
    file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.type === "application/vnd.ms-excel"
  );
}

function createRequestId() {
  return `upl_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

function createDatasetId(userId: string, requestKey: string) {
  const hash = createHash("sha256").update(`${userId}:${requestKey}`).digest("hex").slice(0, 24);
  return `ds_${hash}`;
}

function logStage(requestId: string, stage: string, details: Record<string, unknown> = {}) {
  debugLog("[SIMPLE_UPLOAD]", { requestId, stage, ...details });
}

function logStageError(requestId: string, stage: string, error: unknown, details: Record<string, unknown> = {}) {
  debugError("[SIMPLE_UPLOAD]", {
    requestId,
    stage,
    error: error instanceof Error ? { name: error.name, message: error.message } : String(error),
    ...details,
  });
}

async function getUsagePayload(userId: string, role?: string | null, email?: string | null) {
  const usage = await getAnalystCreditUsage(userId, role, email ?? null);
  return {
    limitReached: usage.limitReached,
    analysisCount: usage.usedCredits,
    total: usage.total,
    availableCredits: usage.availableCredits,
    reservedCredits: usage.reservedCredits,
    usedCredits: usage.usedCredits,
    remainingCredits: usage.remainingCredits,
    subscriptionTier: usage.subscriptionTier,
  };
}

async function cleanupDataset(db: ReturnType<typeof getDb>, datasetId: string, requestId: string) {
  if (!db) return;
  try {
    await db.transaction(async (tx) => {
      await tx.delete(datasetRows).where(eq(datasetRows.datasetId, datasetId));
      await tx.delete(datasets).where(eq(datasets.id, datasetId));
    });
    logStage(requestId, "cleanup_completed", { datasetId });
  } catch (error) {
    logStageError(requestId, "cleanup_failed", error, { datasetId });
  }
}

export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id") || createRequestId();
  let formData: FormData;
  let datasetId: string | null = null;
  let operationId: string | null = null;
  let creditReserved = false;
  let datasetCreated = false;
  let creditFinalized = false;
  let db: ReturnType<typeof getDb> = null;

  logStage(requestId, "request_received", {
    contentType: request.headers.get("content-type")?.split(";")[0] || "unknown",
  });

  try {
    formData = await request.formData();
  } catch (error) {
    logStageError(requestId, "formdata_validated", error);
    return jsonError(400, "formdata_validated", "Upload request could not be read.", false, {
      code: "UPLOAD_FORMDATA_INVALID",
      requestId,
    });
  }

  try {
    const receivedFields = Array.from(formData.keys());
    const file = formData.get("file");
    const datasetTypeValue = formData.get("dataset_type");
    const datasetType =
      typeof datasetTypeValue === "string" ? datasetTypeValue.trim().toLowerCase() : "";
    const missingFields: string[] = [];

    if (!(file instanceof File)) missingFields.push("file");
    if (!datasetType) missingFields.push("dataset_type");

    if (missingFields.length > 0) {
      return jsonError(
        400,
        "formdata_validated",
        `Upload request is missing required field${missingFields.length === 1 ? "" : "s"}: ${missingFields.join(", ")}.`,
        false,
        {
          code: "UPLOAD_FIELDS_MISSING",
          requestId,
          missingFields,
          receivedFields,
        },
      );
    }

    if (datasetType !== "standard") {
      return jsonError(
        400,
        "formdata_validated",
        "Simple upload only accepts dataset_type=standard.",
        false,
        {
          code: "UPLOAD_DATASET_TYPE_INVALID",
          requestId,
          receivedFields,
        },
      );
    }

    const uploadFile = file as File;
    logStage(requestId, "file_metadata_resolved", {
      fileName: uploadFile.name,
      fileSize: uploadFile.size,
      fileType: uploadFile.type || "unknown",
      datasetType,
    });

    let session;
    try {
      session = await auth();
    } catch (error) {
      logStageError(requestId, "auth_checked", error);
      return jsonError(401, "auth_checked", "Please sign in before uploading a dataset.", true, {
        code: "UPLOAD_AUTH_FAILED",
        requestId,
      });
    }

    const userId = session?.user?.id;
    if (!userId) {
      return jsonError(401, "auth_checked", "Please sign in before uploading a dataset.", true, {
        code: "UPLOAD_AUTH_REQUIRED",
        requestId,
      });
    }
    logStage(requestId, "authenticated_user_resolved", {
      userId,
      role: session?.user?.role ?? "user",
    });

    if (!isCsvOrExcel(uploadFile)) {
      return jsonError(
        422,
        "file_validated",
        "File must be a CSV or Excel file (.csv, .xlsx, .xls).",
        false,
        { code: "UPLOAD_FILE_TYPE_INVALID", requestId },
      );
    }

    let parsed;
    try {
      logStage(requestId, "parser_started", { fileName: uploadFile.name });
      parsed = await parseCSVStreaming(uploadFile, SIMPLE_PARSE_ROW_LIMIT);
      logStage(requestId, "parser_completed", {
        rowCount: parsed.rowCount,
        columnCount: parsed.columns.length,
        exceedsLimit: parsed.exceedsLimit,
      });
    } catch (error) {
      logStageError(requestId, "file_parsed", error);
      return jsonError(
        422,
        "file_parsed",
        "Unable to parse this CSV or Excel file. Check that it has a header row and at least one data row.",
        false,
        { code: "UPLOAD_PARSE_FAILED", requestId },
      );
    }

    if (parsed.columns.length === 0 || parsed.rowCount === 0) {
      return jsonError(
        422,
        "file_parsed",
        "File contains no rows or has an invalid header row.",
        false,
        { code: "UPLOAD_EMPTY_FILE", requestId },
      );
    }

    db = getDb();
    if (!db) {
      return jsonError(503, "dataset_created", "Database is unavailable. Please try again.", true, {
        code: "UPLOAD_DATABASE_UNAVAILABLE",
        requestId,
      });
    }

    const requestKey = request.headers.get("idempotency-key") || uuidv4();
    datasetId = createDatasetId(userId, requestKey);
    operationId = `upload:${userId}:${requestKey}`;
    const now = new Date();
    const parsedRows = (parsed.previewRows as Record<string, unknown>[]).slice(
      0,
      SIMPLE_ROW_INSERT_LIMIT,
    );
    const datasetName = uploadFile.name.replace(/\.(csv|xlsx|xls)$/i, "");

    const existingDataset = await db.query.datasets.findFirst({
      where: and(eq(datasets.id, datasetId), eq(datasets.userId, userId)),
    });
    if (existingDataset) {
      logStage(requestId, "idempotent_replay_completed", {
        datasetId,
        operationId,
      });
      return NextResponse.json(
        {
          ok: true,
          success: true,
          requestId,
          stage: "response_sent",
          datasetId,
          datasetName: existingDataset.name,
          datasetType: existingDataset.datasetType || "standard",
          dataset_type: existingDataset.datasetType || "standard",
          rowsProcessed: existingDataset.rowCount,
          columnsDetected: existingDataset.columnCount,
          status: existingDataset.status,
          analysisStatus: existingDataset.analysisStatus || "processing",
          redirectTo: "/app/datasets",
          message: "Dataset upload request was already completed.",
          fileName: existingDataset.fileName,
          preview: {
            headers: existingDataset.columns || [],
            rows: Array.isArray(existingDataset.data) ? existingDataset.data.slice(0, 5) : [],
          },
          usage: await getUsagePayload(userId, session?.user?.role, session?.user?.email).catch(
            (error) => {
              logStageError(requestId, "idempotent_usage_summary_failed", error, { datasetId });
              return null;
            },
          ),
        },
        { headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } },
      );
    }

    const datasetPayload = {
      id: datasetId,
      userId,
      name: datasetName || uploadFile.name,
      fileName: uploadFile.name,
      fileSize: uploadFile.size,
      rowCount: parsed.rowCount,
      columnCount: parsed.columns.length,
      columns: parsed.columns,
      data: parsedRows.slice(0, 100),
      columnTypes: {},
      precomputedMetrics: parsed.aggregatedMetrics,
      datasetType: "standard",
      status: "processing",
      analysisStatus: "processing",
      analysisProgress: 10,
      analysisMessage: "Analysis is still being prepared...",
      analysisError: null,
      analysis: {
        datasetCategory: "standard",
        datasetType: "standard",
        uploadSource: "simple_standard_upload",
        uploadRequestId: requestId,
        uploadIdempotencyKey: requestKey,
      },
      createdAt: now,
      updatedAt: now,
    };

    try {
      const usage = await getUsagePayload(userId, session?.user?.role, session?.user?.email);
      logStage(requestId, "credit_summary_resolved", {
        plan: usage.subscriptionTier,
        total: usage.total,
        used: usage.usedCredits,
        reserved: usage.reservedCredits,
        available: usage.availableCredits,
      });
    } catch (error) {
      logStageError(requestId, "credit_summary_failed", error);
    }

    let reservation;
    try {
      logStage(requestId, "credit_reservation_started", { operationId, datasetId });
      reservation = await reserveCredits({
        userId,
        operationId,
        idempotencyKey: operationId,
        estimatedCredits: 1,
        feature: "dataset_upload",
        source: "upload",
        role: session?.user?.role ?? null,
        email: session?.user?.email ?? null,
        metadata: {
          datasetId,
          fileName: uploadFile.name,
          rowCount: parsed.rowCount,
          datasetType: "standard",
        },
      });
      logStage(requestId, "credit_reservation_completed", {
        success: reservation.success,
        operationId: reservation.operationId,
        reservedCredits: reservation.reservedCredits,
        availableCredits: reservation.availableCredits,
      });
    } catch (error) {
      logStageError(requestId, "credit_reservation_failed", error, { operationId });
      return jsonError(500, "credits_deducted", "The dataset could not be processed.", true, {
        code: "UPLOAD_CREDIT_RESERVATION_FAILED",
        requestId,
      });
    }

    if (!reservation.success) {
      return jsonError(
        402,
        "credits_deducted",
        "You have used all included credits in your Free plan.",
        false,
        {
          code: "INSUFFICIENT_CREDITS",
          title: "No credits remaining",
          requestId,
          upgradeRequired: true,
          usage: await getUsagePayload(userId, session?.user?.role, session?.user?.email),
        },
      );
    }

    creditReserved = true;

    const uploadDatasetId = datasetId;

    try {
      logStage(requestId, "dataset_insert_started", { datasetId: uploadDatasetId });
      await db.transaction(async (tx) => {
        await tx.insert(datasets).values(datasetPayload);
        if (parsedRows.length > 0) {
          const rowValues = parsedRows.map((row, index) => ({
            id: `${uploadDatasetId}-row-${index}`,
            datasetId: uploadDatasetId,
            rowIndex: index,
            data: row,
          }));
          await tx.insert(datasetRows).values(rowValues);
        }
        await tx
          .update(datasets)
          .set({
            status: "ready",
            analysisStatus: "ready",
            analysisProgress: 100,
            analysisMessage: "Dataset uploaded. Analysis is ready.",
            analysisError: null,
            updatedAt: new Date(),
          })
          .where(and(eq(datasets.id, uploadDatasetId), eq(datasets.userId, userId)));
      });
      logStage(requestId, "dataset_insert_completed", {
        datasetId: uploadDatasetId,
        rowCount: parsed.rowCount,
        insertedRows: parsedRows.length,
      });
      datasetCreated = true;
    } catch (error) {
      const replayDataset = await db.query.datasets
        .findFirst({
          where: and(eq(datasets.id, datasetId), eq(datasets.userId, userId)),
        })
        .catch(() => null);
      if (replayDataset) {
        logStage(requestId, "idempotent_insert_conflict_completed", {
          datasetId,
          operationId,
        });
        return NextResponse.json(
          {
            ok: true,
            success: true,
            requestId,
            stage: "response_sent",
            datasetId,
            datasetName: replayDataset.name,
            datasetType: replayDataset.datasetType || "standard",
            dataset_type: replayDataset.datasetType || "standard",
            rowsProcessed: replayDataset.rowCount,
            columnsDetected: replayDataset.columnCount,
            status: replayDataset.status,
            analysisStatus: replayDataset.analysisStatus || "processing",
            redirectTo: "/app/datasets",
            message: "Dataset upload request was already completed.",
            fileName: replayDataset.fileName,
            preview: {
              headers: replayDataset.columns || [],
              rows: Array.isArray(replayDataset.data) ? replayDataset.data.slice(0, 5) : [],
            },
            usage: await getUsagePayload(userId, session?.user?.role, session?.user?.email).catch(
              (usageError) => {
                logStageError(requestId, "idempotent_conflict_usage_summary_failed", usageError, {
                  datasetId,
                });
                return null;
              },
            ),
          },
          { headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } },
        );
      }
      if (creditReserved) {
        await releaseCredits(operationId, "dataset_persistence_failed");
      }
      const serializedError = serializeDatasetCreateError(error);
      logStageError(requestId, "dataset_insert_failed", error, { datasetId });
      return jsonError(
        500,
        "dataset_create",
        "Could not create the dataset. Please try again.",
        true,
        {
          code: "UPLOAD_DATASET_INSERT_FAILED",
          requestId,
          model: "Dataset",
          error: process.env.NODE_ENV === "development" ? serializedError : "Dataset create failed.",
        },
      );
    }

    try {
      logStage(requestId, "credit_settlement_started", { operationId });
      const settlement = await finalizeCredits({
        operationId,
        actualCredits: 1,
        metadata: {
          datasetId,
          rowCount: parsed.rowCount,
          datasetType: "standard",
        },
      });
      logStage(requestId, "credit_settlement_completed", {
        success: settlement.success,
        creditsDeducted: settlement.creditsDeducted,
        remainingCredits: settlement.remainingCredits,
      });
      if (!settlement.success) {
        await cleanupDataset(db, datasetId, requestId);
        datasetCreated = false;
        await releaseCredits(operationId, "credit_settlement_failed");
        return jsonError(500, "credits_deducted", "The dataset could not be processed.", true, {
          code: "UPLOAD_CREDIT_SETTLEMENT_FAILED",
          requestId,
        });
      }
      creditFinalized = true;
    } catch (error) {
      logStageError(requestId, "credit_settlement_failed", error, { operationId, datasetId });
      await cleanupDataset(db, datasetId, requestId);
      datasetCreated = false;
      await releaseCredits(operationId, "credit_settlement_exception");
      return jsonError(500, "credits_deducted", "The dataset could not be processed.", true, {
        code: "UPLOAD_CREDIT_SETTLEMENT_FAILED",
        requestId,
      });
    }

    logStage(requestId, "final_response_started", { datasetId });
    const finalUsage = await getUsagePayload(userId, session?.user?.role, session?.user?.email).catch(
      (error) => {
        logStageError(requestId, "final_usage_summary_failed", error, { datasetId });
        return null;
      },
    );
    return NextResponse.json(
      {
        ok: true,
        success: true,
        requestId,
        stage: "response_sent",
        datasetId,
        datasetName: datasetName || uploadFile.name,
        datasetType: "standard",
        dataset_type: "standard",
        rowsProcessed: parsed.rowCount,
        columnsDetected: parsed.columns.length,
        status: "ready",
        analysisStatus: "ready",
        redirectTo: "/app/datasets",
        message: "Dataset uploaded successfully. Analysis is ready.",
        fileName: uploadFile.name,
        preview: {
          headers: parsed.columns,
          rows: parsedRows.slice(0, 5),
        },
        usage: finalUsage,
      },
      { headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } },
    );
  } catch (error) {
    logStageError(requestId, "unexpected_upload_failure", error, {
      datasetId: datasetId ?? undefined,
      operationId: operationId ?? undefined,
    });
    if (db && datasetId && datasetCreated && !creditFinalized) {
      await cleanupDataset(db, datasetId, requestId);
    }
    if (creditReserved && operationId) {
      await releaseCredits(operationId, "unexpected_upload_failure");
    }
    return jsonError(500, "request_received", "The dataset could not be processed.", true, {
      code: "UPLOAD_PROCESSING_FAILED",
      requestId,
    });
  }
}
