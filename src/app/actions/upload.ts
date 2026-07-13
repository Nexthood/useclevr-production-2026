"use server";

import { debugError, debugLog } from "@/lib/utils/debug";

import {
  parseCSVString,
  parseCSVStreaming,
  computePrecomputedMetrics,
  type AggregatedMetrics,
} from "@/lib/data/csvLoader";
const PREVIEW_ROW_COUNT = 100;
import { auth } from "@/lib/auth/auth";
import { normalizePublicAuthBaseUrl } from "@/lib/auth/redirect-origin";
import { isBuiltinUserId } from "@/lib/auth/builtin-users";
import { requireBuiltinUserRecord } from "@/lib/auth/builtin-user-store";
import { generateBusinessIntelligence } from "@/lib/business/business-intelligence-engine";
import {
  getDatasetCategoryFromUpload,
  getDatasetCategoryRedirect,
  getUploadCategoryCandidate,
} from "@/lib/data/dataset-category";
import { getDb } from "@/lib/db";
import { datasetRows, datasets } from "@/lib/db/schema";
import { checkDemoAccess, consumeDemoCredit, getDemoLimits } from "@/lib/billing/demo-access";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { v4 as uuidv4 } from "uuid";

interface CsvRow {
  [key: string]: string | number | boolean | null;
}

type UploadCSVResult = {
  success: boolean;
  error?: string;
  datasetId?: string;
  datasetName?: string;
  datasetType?: string;
  rowsProcessed?: number;
  columnsDetected?: number;
  analysisStatus?: string;
  redirectTo?: string;
  fileName?: string;
  preview?: { headers: string[]; rows: CsvRow[] };
  profitabilityResult?: any;
  usage?: {
    limitReached?: boolean;
    analysisCount?: number;
    total?: number;
    subscriptionTier?: string;
  };
  step?: string;
  demoCreditsRemaining?: number;
};

const UPLOAD_STAGES = {
  AUTH_CHECKED: "auth_checked",
  FORMDATA_VALIDATED: "formdata_validated",
  FILE_VALIDATED: "file_validated",
  FILE_PARSED: "file_parsed",
  DATASET_CREATED: "dataset_created",
  ROWS_PROCESSED: "rows_processed",
  ANALYSIS_CREATED_OR_QUEUED: "analysis_created_or_queued",
  CREDITS_DEDUCTED: "credits_deducted",
  REQUEST_RECEIVED: "request_received",
} as const;

async function executeWithRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = 3,
  delayMs: number = 2000,
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      debugLog(`[DB] ${operationName} - Attempt ${attempt}/${maxRetries}`);
      const result = await operation();
      debugLog(`[DB] ${operationName} - Success on attempt ${attempt}`);
      return result;
    } catch (error: any) {
      debugError(`[DB] ${operationName} - Attempt ${attempt} failed:`, error.message);

      if (attempt === maxRetries) {
        debugError(`[DB] ${operationName} - All ${maxRetries} attempts failed`);
        throw error;
      }

      debugLog(`[DB] ${operationName} - Retrying in ${delayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error(`${operationName} failed after ${maxRetries} attempts`);
}

function isDatabaseConnectionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /can't reach database|connection|connect|econnrefused|etimedout|timeout|fetch failed|socket|neon/i.test(
    message,
  );
}

/**
 * Upload CSV file and store in database
 */
export async function uploadCSV(formData: FormData): Promise<UploadCSVResult> {
  try {
    const fail = (
      step: string,
      error: string,
      extra: Partial<UploadCSVResult> = {},
    ): UploadCSVResult => ({
      success: false as const,
      step,
      error,
      ...extra,
    });

    const db = getDb();
    if (!db) {
      return fail(
        UPLOAD_STAGES.DATASET_CREATED,
        "DB_UNAVAILABLE|Database is not configured. Please set DATABASE_URL and try again.",
      );
    }

    // Check authentication
    let session;
    try {
      session = await auth();
    } catch (authError) {
      return fail(
        UPLOAD_STAGES.AUTH_CHECKED,
        `AUTH_CHECK_FAILED|${authError instanceof Error ? authError.message : "Unable to check your session."}`,
      );
    }
    const sessionUserId = session?.user?.id;
    const demoSessionToken = formData.get("demoSession") as string | null;

    if (!sessionUserId && !demoSessionToken) {
      return fail(
        UPLOAD_STAGES.AUTH_CHECKED,
        "Unauthorized|Please sign in before uploading a dataset.",
      );
    }

    if (!sessionUserId && demoSessionToken) {
      const demoCheck = await checkDemoAccess(demoSessionToken, "upload");
      if (!demoCheck.allowed) {
        return fail(
          UPLOAD_STAGES.CREDITS_DEDUCTED,
          `DEMO_LIMIT|${demoCheck.reason}|${demoCheck.upgradeMessage || ""}`,
        );
      }

      const limits = getDemoLimits();
      if (demoCheck.creditsRemaining !== undefined && demoCheck.creditsRemaining < limits.credits) {
        debugLog("[UPLOAD] Demo credits remaining:", demoCheck.creditsRemaining);
      }
    }

    const isDemoUser = !sessionUserId && !!demoSessionToken;

    debugLog(
      "[UPLOAD] Session:",
      session ? { userId: session.user?.id, email: session.user?.email } : null,
    );
    debugLog("[UPLOAD] FormData keys:", Array.from(formData.keys()));

    const envDemoMode = process.env.DEMO_MODE === "true";

    debugLog("[UPLOAD] ========== DEBUG MODE CHECK ==========");
    debugLog("[UPLOAD] process.env.DEMO_MODE:", process.env.DEMO_MODE);
    debugLog("[UPLOAD] envDemoMode (process.env.DEMO_MODE === 'true'):", envDemoMode);
    debugLog("[UPLOAD] sessionUserId:", sessionUserId);
    debugLog("[UPLOAD] ======================================");

    const fileType = getUploadCategoryCandidate(formData);
    const uploadCategory = getDatasetCategoryFromUpload(fileType);
    const isProfitabilityUpload = uploadCategory === "profitability";
    debugLog("[UPLOAD] fileType:", fileType);
    debugLog("[UPLOAD] dataset category:", uploadCategory);
    debugLog("[UPLOAD] isProfitabilityUpload:", isProfitabilityUpload);
    debugLog("[UPLOAD] file received:", formData.get("file") instanceof File);

    // Explicit demo mode may bypass persistence only for non-built-in profitability uploads.
    const shouldUseDemoMode =
      envDemoMode && !isBuiltinUserId(sessionUserId) && isProfitabilityUpload;

    if (shouldUseDemoMode) {
      debugLog("[UPLOAD] === DEMO MODE - Using non-persistent profitability flow ===");
      const file = formData.get("file") as File | null;
      if (file) {
        const fileName = file.name.toLowerCase();
        const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");
        debugLog("[UPLOAD] file received:", {
          name: file.name,
          size: file.size,
          type: file.type,
          isExcel,
        });

        if (isExcel) {
          const arrayBuffer = await file.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          const workbook = require("xlsx").read(uint8Array, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json = require("xlsx").utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          const headers = (json[0] || []) as string[];
          debugLog("[UPLOAD] Excel parsed");
          debugLog("[UPLOAD] columns detected:", headers);
          debugLog("[UPLOAD] row count detected:", json.length - 1);
        } else {
          const text = await file.text();
          const parsed = parseCSVString(text);
          const headers = parsed.columns;
          debugLog("[UPLOAD] CSV parsed");
          debugLog("[UPLOAD] columns detected:", headers);
          debugLog("[UPLOAD] row count detected:", parsed.rowCount);
        }
      }
      debugLog("[UPLOAD] profitability analysis started");

      const profitabilityDataStr = formData.get("profitabilityData") as string;
      let profitabilityData = null;
      if (profitabilityDataStr) {
        try {
          profitabilityData = JSON.parse(profitabilityDataStr);
          debugLog("[UPLOAD] profitability metrics calculated:", {
            hasRevenue: profitabilityData?.hasRevenue,
            hasExpenses: profitabilityData?.hasExpenses,
            totalRevenue: profitabilityData?.totalRevenue,
            totalExpenses: profitabilityData?.totalExpenses,
          });
        } catch (e) {
          debugLog("[UPLOAD] Could not parse profitabilityData:", e);
        }
      }

      debugLog("[UPLOAD] AI/explanation layer called: false");
      debugLog("[UPLOAD] result saved: non-persistent demo profitability result");
      debugLog("[UPLOAD] Demo mode - returning demo result (no DB insert)");
      return {
        success: true,
        datasetId: `demo_${Date.now()}`,
        redirectTo: `/app/upload`, // Stay on same page, component handles result
        profitabilityResult: profitabilityData, // Return actual result data
        preview: {
          headers: ["Revenue", "Expenses", "Profit", "Margin"],
          rows: [
            {
              Revenue: profitabilityData?.totalRevenue || 0,
              Expenses: profitabilityData?.totalExpenses || 0,
              Profit: profitabilityData?.profit || 0,
              Margin: profitabilityData?.margin || 0,
            },
          ],
        },
      };
    }

    // For standard uploads (non-profitability), proceed with normal database insert
    // Even in demo mode, standard uploads should create actual dataset records
    debugLog("[UPLOAD] Standard upload mode - proceeding with database insert");

    let effectiveUserId = sessionUserId;
    debugLog("[UPLOAD] Authenticated user:", effectiveUserId);

    await requireBuiltinUserRecord(effectiveUserId);

    debugLog("[UPLOAD] FINAL effectiveUserId:", effectiveUserId);

    if (effectiveUserId) {
      debugLog("[UPLOAD] CHOSEN PATH: real-db-insert");
      debugLog("[UPLOAD] FINAL USER ID IS REAL - proceeding with Dataset insert");
    }

    if (!effectiveUserId) {
      return fail(UPLOAD_STAGES.AUTH_CHECKED, "User ID not found. Please sign in again.");
    }

    const uploadUsage = {
      limitReached: false,
      analysisCount: 0,
      total: Number.MAX_SAFE_INTEGER,
      subscriptionTier: "upload",
    };

    const file = formData.get("file") as File | null;
    if (!file) {
      return fail(UPLOAD_STAGES.FILE_VALIDATED, "No file provided");
    }

    // Validate file type (CSV or Excel)
    const fileName = file.name.toLowerCase();
    const isCsv = fileName.endsWith(".csv") || file.type.includes("csv");
    const isExcel =
      fileName.endsWith(".xlsx") ||
      fileName.endsWith(".xls") ||
      file.type.includes("spreadsheet") ||
      file.type.includes("excel") ||
      file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.type === "application/vnd.ms-excel";
    if (!isCsv && !isExcel) {
      return fail(
        UPLOAD_STAGES.FILE_VALIDATED,
        "File must be a CSV or Excel file (.csv, .xlsx, .xls)",
      );
    }

    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return fail(UPLOAD_STAGES.FILE_VALIDATED, "File size must be less than 50MB");
    }

    if (isDemoUser) {
      const demoLimits = getDemoLimits();
      if (file.size > demoLimits.maxFileSizeMb * 1024 * 1024) {
        return fail(
          UPLOAD_STAGES.FILE_VALIDATED,
          `DEMO_LIMIT|Demo file size limit is ${demoLimits.maxFileSizeMb}MB. Upgrade to continue with larger files.`,
        );
      }
    }

    const rowLimit = Number.MAX_SAFE_INTEGER;
    debugLog("[UPLOAD] Row limit for user:", rowLimit);

    // Use streaming parser to handle large files efficiently
    // For small files within limit, we still get full data
    // For files exceeding limit, we get preview rows + aggregated metrics
    let parseResult;
    try {
      parseResult = await parseCSVStreaming(file, rowLimit);
    } catch (parseError) {
      debugError("[UPLOAD] File parsing failed:", parseError);
      return fail(
        UPLOAD_STAGES.FILE_PARSED,
        "FILE_PROCESSING_ERROR|Unable to parse this CSV or Excel file. Check that it has a header row and at least one data row, then try again.",
      );
    }

    if (parseResult.columns.length === 0) {
      return fail(UPLOAD_STAGES.FILE_PARSED, "File contains no data or has invalid format");
    }

    const headers = parseResult.columns;
    const totalRowCount = parseResult.rowCount;

    debugLog("[UPLOAD] File parsed");
    debugLog("[UPLOAD] columns detected:", headers);
    debugLog("[UPLOAD] row count detected:", totalRowCount);
    debugLog("[UPLOAD] exceeds limit:", parseResult.exceedsLimit);

    if (isDemoUser) {
      const demoLimits = getDemoLimits();
      if (totalRowCount > demoLimits.maxRowsPerDataset) {
        return fail(
          UPLOAD_STAGES.ROWS_PROCESSED,
          `DEMO_LIMIT|Demo row limit is ${demoLimits.maxRowsPerDataset.toLocaleString()} rows. Your file has ${totalRowCount.toLocaleString()} rows.`,
        );
      }
    }

    // Determine storage mode:
    // - profitability: store only summary
    // - streaming mode (large file within limit): store preview rows + aggregated metrics
    // - regular: store full data
    const useStreamingMode = rowLimit > 0 && totalRowCount > rowLimit / 2;

    // For streaming mode, we have all rows within limit
    // For regular mode, we also have all rows
    // The streaming parser returns allRows when within limit
    const streamedRows = parseResult.previewRows;
    let previewRows: CsvRow[] = [];
    let aggregatedMetrics: AggregatedMetrics | null = parseResult.aggregatedMetrics;
    let allRows: CsvRow[] = [];

    if (useStreamingMode) {
      // Large file within limit - store preview + aggregated metrics
      previewRows = streamedRows.slice(0, PREVIEW_ROW_COUNT) as CsvRow[];
      debugLog("[UPLOAD] Using streaming mode - storing preview rows + metrics");
    } else {
      // Small/medium file - store all rows
      allRows = streamedRows as CsvRow[];
      previewRows = streamedRows.slice(0, PREVIEW_ROW_COUNT) as CsvRow[];
    }

    // Compute aggregated metrics if not already computed
    if (!aggregatedMetrics && allRows.length > 0) {
      aggregatedMetrics = computePrecomputedMetrics(allRows, headers);
    }

    // Generate dataset ID
    const datasetId = `ds_${Date.now()}_${uuidv4().slice(0, 8)}`;
    const datasetName = file.name.replace(/\.csv$/i, "");

    debugLog("[UPLOAD] Creating dataset:", datasetId, "for user:", effectiveUserId);
    debugLog("[UPLOAD] Total rows:", totalRowCount);

    // Get profitability data if present
    const profitabilityDataStr = formData.get("profitabilityData") as string;

    let profitabilityData = null;
    if (profitabilityDataStr) {
      try {
        profitabilityData = JSON.parse(profitabilityDataStr);
      } catch (e) {
        debugLog("[UPLOAD] Could not parse profitabilityData:", e);
      }
    }

    debugLog("[UPLOAD] profitabilityData:", profitabilityData ? "present" : "none");

    // Check if this is a profitability analysis (has profitability data)
    const isProfitabilityAnalysis = !!profitabilityData;
    const datasetCategory = isProfitabilityAnalysis
      ? "profitability"
      : getDatasetCategoryFromUpload(fileType);
    const datasetType = datasetCategory;
    const baseAnalysis = {
      dataset_type: datasetCategory,
      datasetCategory,
      datasetType: datasetCategory,
      uploadSource: fileType || datasetCategory,
    };
    if (isProfitabilityAnalysis) {
      debugLog("[UPLOAD] profitability analysis started");
      debugLog("[UPLOAD] profitability metrics calculated:", {
        hasRevenue: profitabilityData?.hasRevenue,
        hasExpenses: profitabilityData?.hasExpenses,
        totalRevenue: profitabilityData?.totalRevenue,
        totalExpenses: profitabilityData?.totalExpenses,
      });
      debugLog("[UPLOAD] AI/explanation layer called: false");
    }

    // Determine storage mode:
    // - profitability: store only summary
    // - streaming mode (large file within limit): store preview rows + aggregated metrics
    // - regular: store full data
    const useStreamingStorage =
      useStreamingMode && !isProfitabilityAnalysis && aggregatedMetrics !== null;

    // Create dataset
    try {
      const now = new Date();

      // Insert dataset record
      debugLog("[UPLOAD] Inserting dataset...");
      debugLog(
        "[UPLOAD] Storage mode:",
        useStreamingStorage
          ? "streaming (preview + metrics)"
          : isProfitabilityAnalysis
            ? "profitability"
            : "full data",
      );

      // For profitability: store only metadata + summary
      // For streaming mode: store preview rows + aggregated metrics
      // For regular: store full data
      const initialAnalysisStatus = {
        analysisStatus: "processing",
        analysisProgress: 25,
        analysisMessage: "Analysis is still being prepared...",
        analysisError: null,
      };

      const insertData = isProfitabilityAnalysis
        ? {
            id: datasetId,
            userId: effectiveUserId,
            name: datasetName,
            fileName: file.name,
            fileSize: file.size,
            rowCount: totalRowCount,
            columnCount: headers.length,
            columns: headers,
            data: [],
            columnTypes: {},
            datasetType,
            status: "ready",
            ...initialAnalysisStatus,
            analysis: { ...baseAnalysis, profitability: profitabilityData },
            precomputedMetrics: profitabilityData
              ? {
                  totalRevenue: profitabilityData.totalRevenue,
                  totalExpenses: profitabilityData.totalExpenses,
                  profit: profitabilityData.profit,
                  margin: profitabilityData.margin,
                  hasBothFiles: profitabilityData.hasBothFiles,
                }
              : null,
            createdAt: now,
            updatedAt: now,
          }
        : useStreamingStorage
          ? {
              // Streaming mode - store preview rows + aggregated metrics
              id: datasetId,
              userId: effectiveUserId,
              name: datasetName,
              fileName: file.name,
              fileSize: file.size,
              rowCount: totalRowCount,
              columnCount: headers.length,
              columns: headers,
              data: previewRows, // Store only preview rows
              columnTypes: {},
              datasetType,
              status: "ready",
              ...initialAnalysisStatus,
              analysis: { ...baseAnalysis, streamingMode: true },
              precomputedMetrics: aggregatedMetrics,
              createdAt: now,
              updatedAt: now,
            }
          : {
              // Regular dataset - store full data
              id: datasetId,
              userId: effectiveUserId,
              name: datasetName,
              fileName: file.name,
              fileSize: file.size,
              rowCount: totalRowCount,
              columnCount: headers.length,
              columns: headers,
              data: allRows,
              columnTypes: {},
              datasetType,
              status: "ready",
              ...initialAnalysisStatus,
              analysis: baseAnalysis,
              precomputedMetrics: aggregatedMetrics,
              createdAt: now,
              updatedAt: now,
            };

      debugLog("[UPLOAD] Insert values (data length):", insertData.data?.length || 0);

      // PROOF LOGGING: Log exact userId being used for insert
      debugLog("[UPLOAD] ========== PROOF ==========");
      debugLog("[UPLOAD] persistentUpload:", !shouldUseDemoMode);
      debugLog("[UPLOAD] effectiveUserId being used:", effectiveUserId);
      debugLog("[UPLOAD] isProfitabilityAnalysis:", isProfitabilityAnalysis);
      debugLog("[UPLOAD] Will insert into Dataset with userId:", effectiveUserId);
      debugLog("[UPLOAD] ============================");

      try {
        await executeWithRetry(
          () => (db as any).insert(datasets).values(insertData),
          "Insert dataset",
        );
        debugLog("[UPLOAD] Dataset created with", totalRowCount, "rows");
        debugLog("[UPLOAD] dataset saved:", datasetId);
        if (isProfitabilityAnalysis) {
          debugLog("[UPLOAD] result saved:", datasetId);
        }
      } catch (insertErr) {
        debugError("[UPLOAD] DATASET INSERT FAILED:", insertErr);
        debugError(
          "[UPLOAD] DATASET INSERT ERROR:",
          insertErr instanceof Error ? insertErr.message : String(insertErr),
        );
        return fail(
          UPLOAD_STAGES.DATASET_CREATED,
          isDatabaseConnectionError(insertErr)
            ? "DB_UNAVAILABLE|Database connection failed while saving the dataset. Please try again."
            : isProfitabilityAnalysis
              ? "DATABASE_INSERT_ERROR|Could not save profitability analysis. Please try again."
              : "DATABASE_INSERT_ERROR|Could not save dataset. Please try again.",
        );
      }

      // Also write rows to datasetRows so the detail page can paginate them
      // Skip this for streaming mode (preview rows stored in dataset.data) and profitability
      try {
        if (!isProfitabilityAnalysis && !useStreamingStorage && allRows.length > 0) {
          const BATCH_SIZE = 100;
          for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
            const batch = allRows.slice(i, i + BATCH_SIZE);
            const rowValues = batch.map((row: Record<string, unknown>, j: number) => ({
              id: `${datasetId}-row-${i + j}`,
              datasetId,
              rowIndex: i + j,
              data: row,
            }));
            await executeWithRetry(
              () => (db as any).insert(datasetRows).values(rowValues),
              `Insert datasetRows batch ${i / BATCH_SIZE + 1}`,
            );
          }
          debugLog("[UPLOAD] Wrote", allRows.length, "rows to datasetRows");
        } else if (useStreamingStorage) {
          debugLog(
            "[UPLOAD] Streaming mode - preview rows stored in dataset.data, skipping datasetRows",
          );
        }
      } catch (rowErr) {
        debugError("[UPLOAD] ROW INSERT FAILED:", rowErr);
        debugError(
          "[UPLOAD] ROW INSERT ERROR:",
          rowErr instanceof Error ? rowErr.message : String(rowErr),
        );
        return fail(
          UPLOAD_STAGES.ROWS_PROCESSED,
          isDatabaseConnectionError(rowErr)
            ? "DB_UNAVAILABLE|Database connection failed while processing dataset rows. Please try again."
            : "DATABASE_INSERT_ERROR|Could not process dataset rows. Please try again.",
        );
      }

      try {
        const rowsForBusinessIntelligence = (
          isProfitabilityAnalysis ? previewRows : useStreamingStorage ? previewRows : allRows
        ) as Record<string, unknown>[];
        if (rowsForBusinessIntelligence.length > 0) {
          try {
            debugLog("[UPLOAD] Running Business Intelligence Engine Phase 1:", datasetId);
            const businessIntelligence = await generateBusinessIntelligence({
              rows: rowsForBusinessIntelligence,
              columns: headers,
              datasetId,
              datasetName,
              userId: effectiveUserId,
            });
            const existingAnalysis = (insertData.analysis || {}) as Record<string, unknown>;
            await executeWithRetry(
              () =>
                (db as any)
                  .update(datasets)
                  .set({
                    analysis: {
                      ...existingAnalysis,
                      business_intelligence: businessIntelligence,
                    },
                    aiInsights: businessIntelligence,
                    analysisStatus: "ready",
                    analysisProgress: 100,
                    analysisMessage: "Analysis is ready.",
                    analysisError: null,
                    updatedAt: new Date(),
                  })
                  .where(eq(datasets.id, datasetId)),
              "Save Business Intelligence Engine output",
            );
            debugLog("[UPLOAD] Business Intelligence Engine completed:", {
              datasetId,
              healthScore: businessIntelligence.healthScore.overall,
              risks: businessIntelligence.risks.length,
              opportunities: businessIntelligence.opportunities.length,
            });
          } catch (biError) {
            debugError("[UPLOAD] Business Intelligence Engine failed:", biError);
            await executeWithRetry(
              () =>
                (db as any)
                  .update(datasets)
                  .set({
                    analysisStatus: "ready",
                    analysisProgress: 100,
                    analysisMessage:
                      "Dataset uploaded. Automatic insights can be refreshed from the analysis page.",
                    analysisError:
                      biError instanceof Error
                        ? biError.message.slice(0, 500)
                        : "Business Intelligence Engine failed.",
                    updatedAt: new Date(),
                  })
                  .where(eq(datasets.id, datasetId)),
              "Save Business Intelligence Engine failure status",
            ).catch(() => {});
          }
        } else {
          await executeWithRetry(
            () =>
              (db as any)
                .update(datasets)
                .set({
                  analysisStatus: "ready",
                  analysisProgress: 100,
                  analysisMessage: "Dataset uploaded. Analysis is ready.",
                  analysisError: null,
                  updatedAt: new Date(),
                })
                .where(eq(datasets.id, datasetId)),
            "Save dataset ready status",
          ).catch(() => {});
        }
      } catch (analysisErr) {
        debugError("[UPLOAD] ANALYSIS STATUS UPDATE FAILED:", analysisErr);
        await executeWithRetry(
          () =>
            (db as any)
              .update(datasets)
              .set({
                analysisStatus: "ready",
                analysisProgress: 100,
                analysisMessage:
                  "Dataset uploaded. Automatic insights can be refreshed from the analysis page.",
                analysisError:
                  analysisErr instanceof Error
                    ? analysisErr.message.slice(0, 500)
                    : "AI analysis pending.",
                updatedAt: new Date(),
              })
              .where(eq(datasets.id, datasetId)),
          "Save fallback analysis status",
        ).catch(() => {});
      }
    } catch (err) {
      debugError("[UPLOAD] Database error:", err);
      debugError("[UPLOAD] Error stack:", err instanceof Error ? err.stack : "No stack");
      debugError("[UPLOAD] Error message:", err instanceof Error ? err.message : String(err));

      // Return sanitized error - never expose internal details
      return fail(
        UPLOAD_STAGES.DATASET_CREATED,
        isDatabaseConnectionError(err)
          ? "DB_UNAVAILABLE|Database connection failed while creating the dataset. Please try again."
          : "DATASET_CREATE_ERROR|Could not create the dataset. Please try again.",
      );
    }

    // Revalidate datasets page and module pages
    revalidatePath("/app/datasets");
    revalidatePath("/app/retail");
    revalidatePath("/app/accountancy");
    revalidatePath("/app/profitability");
    revalidatePath("/app/prebookkeeping");

    // Fire suggestion regeneration (best-effort, non-blocking)
    try {
      const origin = normalizePublicAuthBaseUrl(
        process.env.AUTH_URL ||
          process.env.NEXTAUTH_URL ||
          process.env.NEXT_PUBLIC_APP_URL ||
          "http://localhost:8080",
      );
      fetch(`${origin}/api/suggestions/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasetId }),
      }).catch(() => {});
    } catch {
      // Suggestion refresh is best-effort
    }

    debugLog("[UPLOAD] Dataset created successfully:", datasetId);

    const previewRowsToReturn = useStreamingStorage ? previewRows : allRows.slice(0, 5);

    let demoCreditsRemaining: number | undefined;
    if (isDemoUser && demoSessionToken) {
      const consumeResult = await consumeDemoCredit(demoSessionToken, "upload", 1);
      demoCreditsRemaining = consumeResult.remainingCredits;
    }

    return {
      success: true,
      datasetId: datasetId,
      datasetName: datasetName || file.name,
      datasetType: datasetCategory,
      rowsProcessed: totalRowCount,
      columnsDetected: headers.length,
      analysisStatus: "ready",
      redirectTo: getDatasetCategoryRedirect(datasetCategory, datasetId),
      fileName: file.name,
      preview: {
        headers,
        rows: previewRowsToReturn,
      },
      profitabilityResult: profitabilityData || undefined,
      usage: uploadUsage,
      demoCreditsRemaining,
    };
  } catch (error) {
    debugError("Upload error:", error);
    debugError("Error stack:", error instanceof Error ? error.stack : "No stack");

    const errorMessage = error instanceof Error ? error.message : "Failed to upload file";
    debugError("Error message:", errorMessage);

    if (errorMessage.includes("Can't reach database") || errorMessage.includes("ECONNREFUSED")) {
      return {
        success: false,
        step: UPLOAD_STAGES.DATASET_CREATED,
        error: "DB_UNAVAILABLE|Database connection failed. Please try again.",
      };
    }

    if (
      errorMessage.includes("FileReaderSync") ||
      errorMessage.includes("FileReader") ||
      errorMessage.includes("xlsx")
    ) {
      debugError("[UPLOAD] File processing error (internal):", errorMessage);
      return {
        success: false,
        step: UPLOAD_STAGES.FILE_PARSED,
        error:
          "FILE_PROCESSING_ERROR|Unable to process the uploaded file. Please try again with a different file format.",
      };
    }

    return {
      success: false,
      step: UPLOAD_STAGES.REQUEST_RECEIVED,
      error: `UNEXPECTED_UPLOAD_ERROR|Unexpected upload failure. Check server logs for the detailed error.`,
    };
  }
}

/**
 * Get dataset by ID with preview data
 */
export async function getDataset(datasetId: string) {
  try {
    const db = getDb();
    if (!db) {
      return { error: "Database connection is unavailable" };
    }

    const session = await auth();
    if (!session?.user?.id) {
      return { error: "Unauthorized" };
    }

    const dataset = await db.query.datasets.findFirst({
      where: and(eq(datasets.id, datasetId), eq(datasets.userId, session.user.id)),
    });

    if (!dataset) {
      return { error: "Dataset not found" };
    }

    return dataset;
  } catch (error) {
    debugError("Error fetching dataset:", error);
    return { error: "Failed to fetch dataset" };
  }
}
