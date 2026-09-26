import { NextResponse } from "next/server";

import { uploadCSV } from "@/app/actions/upload";
import { auth } from "@/lib/auth/auth";
import { requireBuiltinUserRecord } from "@/lib/auth/builtin-user-store";
import { MAX_UPLOAD_ROWS } from "@/lib/upload/upload-security";
import { debugError } from "@/lib/utils/debug";
import {
  clevrSyncAccessErrorPayload,
  requireClevrSyncAccess,
} from "@/services/clevrsync/access";
import {
  createClevrSyncRun,
  GoogleSheetsProviderError,
  getOwnedClevrSyncConnector,
  googleSheetPreviewToCsvFile,
  parseGoogleSpreadsheetId,
  previewGoogleSheet,
  updateClevrSyncConnector,
} from "@/services/clevrsync";
import { getGoogleSheetsAccessToken } from "@/services/clevrsync/google-auth-store";

export const dynamic = "force-dynamic";

function getDatasetDashboardRedirect(datasetId?: string | null) {
  return datasetId ? `/app/dashboard?datasetId=${encodeURIComponent(datasetId)}` : null;
}

function buildClevrSyncSyncResponse({
  run,
  uploadResult,
  datasetId,
}: {
  run: Awaited<ReturnType<typeof createClevrSyncRun>>;
  uploadResult: Awaited<ReturnType<typeof uploadCSV>>;
  datasetId?: string | null;
}) {
  const redirectUrl =
    uploadResult.redirectTo ||
    uploadResult.redirectUrl ||
    getDatasetDashboardRedirect(datasetId);

  return {
    sync: run,
    upload: uploadResult,
    datasetId,
    redirectUrl,
    redirectTo: redirectUrl,
  };
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireBuiltinUserRecord(session.user.id);
    await requireClevrSyncAccess(session.user);
    return syncGoogleSheets(request, session.user);
  } catch (error) {
    const accessError = clevrSyncAccessErrorPayload(error);
    if (accessError) {
      return NextResponse.json(accessError, { status: accessError.status });
    }
    debugError("[ClevrSync] Sync failed:", error);
    return NextResponse.json({ error: "Unable to sync Google Sheet" }, { status: 500 });
  }
}

async function syncGoogleSheets(
  request: Request,
  user: { id: string; email?: string | null; role?: string | null },
) {
  const body = await request.json().catch(() => null);
  const connectorId = String(body?.connectorId || "").trim();
  if (!connectorId) {
    return NextResponse.json({ error: "Connector is required" }, { status: 400 });
  }

  const connector = await getOwnedClevrSyncConnector(user.id, connectorId);
  if (!connector || connector.type !== "google_sheets") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sourceMeta = connector.sourceMeta as Record<string, unknown>;
  const spreadsheetId = parseGoogleSpreadsheetId(
    String(body?.spreadsheetId || sourceMeta.spreadsheetId || ""),
  );
  const worksheetName =
    typeof body?.worksheetName === "string"
      ? body.worksheetName
      : typeof sourceMeta.worksheetName === "string"
        ? sourceMeta.worksheetName
        : null;
  const token = await getGoogleSheetsAccessToken({ userId: user.id, connectorId });
  if (!token) {
    return NextResponse.json({ error: "Reconnect Google Sheets" }, { status: 401 });
  }

  try {
    await updateClevrSyncConnector({ userId: user.id, connectorId, status: "syncing" });
    const preview = await previewGoogleSheet({
      accessToken: token.accessToken,
      spreadsheetId,
      worksheetName,
      previewRowLimit: MAX_UPLOAD_ROWS,
    });
    const existingDatasetId =
      typeof sourceMeta.datasetId === "string" ? sourceMeta.datasetId : null;
    const uploadFormData = new FormData();
    uploadFormData.set("file", googleSheetPreviewToCsvFile(preview));
    uploadFormData.set("uploadMode", "standard");
    uploadFormData.set("dataset_type", "standard");
    uploadFormData.set("uploadSource", "clevrsync");
    uploadFormData.set("clevrsync_connector_type", connector.type);
    uploadFormData.set("business_model", "generic");
    if (existingDatasetId) {
      uploadFormData.set("clevrsync_dataset_id", existingDatasetId);
    }

    const uploadResult = await uploadCSV(uploadFormData, {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
    const datasetId = uploadResult.datasetId ?? existingDatasetId;
    const nextSourceMeta = {
      ...sourceMeta,
      spreadsheetId,
      spreadsheetName: preview.googleSheets?.spreadsheetName,
      worksheetName: preview.googleSheets?.worksheetName,
      datasetId,
      lastSuccessfulSync: uploadResult.success
        ? new Date().toISOString()
        : sourceMeta.lastSuccessfulSync,
      lastError: uploadResult.success ? null : uploadResult.error,
    };
    await updateClevrSyncConnector({
      userId: user.id,
      connectorId,
      status: uploadResult.success ? "connected" : "error",
      displayName: `Google Sheets: ${preview.googleSheets?.spreadsheetName || "Spreadsheet"}`,
      sourceMeta: nextSourceMeta,
    });
    const run = await createClevrSyncRun({
      userId: user.id,
      connectorId,
      preview,
      status: uploadResult.success ? "completed" : "failed",
      datasetId,
      error: uploadResult.error ?? null,
    });

    return NextResponse.json(
      buildClevrSyncSyncResponse({ run, uploadResult, datasetId }),
      { status: uploadResult.success ? 200 : 422 },
    );
  } catch (error) {
    if (error instanceof GoogleSheetsProviderError) {
      await updateClevrSyncConnector({
        userId: user.id,
        connectorId,
        status: error.connectorStatus,
        sourceMeta: { ...sourceMeta, lastError: error.message },
      });
      return NextResponse.json(
        { error: error.message },
        { status: error.connectorStatus === "reconnect_required" ? 401 : 422 },
      );
    }
    throw error;
  }
}
