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
  MicrosoftGraphError,
  microsoftPreviewToCsvFile,
  parseGoogleSpreadsheetId,
  parseMicrosoftConnectorType,
  previewGoogleSheet,
  previewMicrosoftWorksheet,
  updateClevrSyncConnector,
} from "@/services/clevrsync";
import { getGoogleSheetsAccessToken } from "@/services/clevrsync/google-auth-store";
import { getMicrosoftAccessToken } from "@/services/clevrsync/microsoft-auth-store";

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
    return syncClevrSync(request, session.user);
  } catch (error) {
    const accessError = clevrSyncAccessErrorPayload(error);
    if (accessError) {
      return NextResponse.json(accessError, { status: accessError.status });
    }
    debugError("[ClevrSync] Sync failed:", error);
    return NextResponse.json({ error: "Unable to sync source" }, { status: 500 });
  }
}

async function syncClevrSync(
  request: Request,
  user: { id: string; email?: string | null; role?: string | null },
) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const connectorId = String(body?.connectorId || "").trim();
  if (!connectorId) {
    return NextResponse.json({ error: "Connector is required" }, { status: 400 });
  }

  const connector = await getOwnedClevrSyncConnector(user.id, connectorId);
  if (!connector) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const microsoftConnectorType = parseMicrosoftConnectorType(connector.type);
  if (microsoftConnectorType) {
    return syncMicrosoftSource(body, user, connectorId, microsoftConnectorType);
  }
  if (connector.type !== "google_sheets") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return syncGoogleSheets(body, user, connectorId);
}

async function syncMicrosoftSource(
  body: Record<string, unknown> | null,
  user: { id: string; email?: string | null; role?: string | null },
  connectorId: string,
  connectorType: "onedrive" | "sharepoint",
) {
  const connector = await getOwnedClevrSyncConnector(user.id, connectorId);
  if (!connector || connector.type !== connectorType) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sourceMeta = connector.sourceMeta as Record<string, unknown>;
  // Sync now re-fetches the exact persisted source: site → library → item →
  // worksheet for SharePoint, drive → item → worksheet for OneDrive.
  const driveId =
    String(body?.driveId || "").trim() ||
    (typeof sourceMeta.driveId === "string" ? sourceMeta.driveId : "");
  const itemId =
    String(body?.itemId || "").trim() ||
    (typeof sourceMeta.itemId === "string" ? sourceMeta.itemId : "");
  const worksheetId =
    typeof body?.worksheetId === "string" && body.worksheetId.trim()
      ? body.worksheetId
      : typeof sourceMeta.worksheetId === "string"
        ? sourceMeta.worksheetId
        : null;
  const worksheetName =
    typeof body?.worksheetName === "string" && body.worksheetName.trim()
      ? body.worksheetName
      : typeof sourceMeta.worksheetName === "string"
        ? sourceMeta.worksheetName
        : null;
  const siteId =
    String(body?.siteId || "").trim() ||
    (typeof sourceMeta.siteId === "string" ? sourceMeta.siteId : "");
  const siteName =
    String(body?.siteName || "").trim() ||
    (typeof sourceMeta.siteName === "string" ? sourceMeta.siteName : "");
  const driveName =
    String(body?.driveName || "").trim() ||
    (typeof sourceMeta.driveName === "string" ? sourceMeta.driveName : "");

  if (!itemId) {
    return NextResponse.json(
      { error: "This connection has no linked workbook. Choose a workbook first." },
      { status: 400 },
    );
  }

  const token = await getMicrosoftAccessToken({ userId: user.id, connectorId });
  if (!token) {
    return NextResponse.json({ error: "Reconnect Microsoft" }, { status: 401 });
  }

  try {
    await updateClevrSyncConnector({ userId: user.id, connectorId, status: "syncing" });
    const preview = await previewMicrosoftWorksheet({
      accessToken: token.accessToken,
      connectorType,
      driveId: driveId || null,
      itemId,
      worksheetId,
      worksheetName,
      previewRowLimit: MAX_UPLOAD_ROWS,
    });
    const existingDatasetId =
      typeof sourceMeta.datasetId === "string" ? sourceMeta.datasetId : null;
    const uploadFormData = new FormData();
    uploadFormData.set("file", microsoftPreviewToCsvFile(preview));
    uploadFormData.set("uploadMode", "standard");
    uploadFormData.set("dataset_type", "standard");
    uploadFormData.set("uploadSource", "clevrsync");
    uploadFormData.set("clevrsync_connector_type", connectorType);
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
      driveId: driveId || null,
      itemId,
      workbookName: preview.microsoft?.workbookName,
      folderPath: preview.microsoft?.folderPath ?? null,
      worksheetId: preview.microsoft?.worksheetId ?? worksheetId,
      worksheetName: preview.microsoft?.worksheetName ?? worksheetName,
      siteId: siteId || null,
      siteName: siteName || null,
      driveName: driveName || null,
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
      displayName:
        connectorType === "onedrive"
          ? `OneDrive: ${preview.microsoft?.workbookName || "Workbook"}`
          : `SharePoint: ${preview.microsoft?.workbookName || "Workbook"}`,
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
    if (error instanceof MicrosoftGraphError) {
      await updateClevrSyncConnector({
        userId: user.id,
        connectorId,
        status: error.connectorStatus,
        sourceMeta: { ...sourceMeta, lastError: error.message },
      });
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.connectorStatus === "reconnect_required" ? 401 : 422 },
      );
    }
    throw error;
  }
}

async function syncGoogleSheets(
  body: Record<string, unknown> | null,
  user: { id: string; email?: string | null; role?: string | null },
  connectorId: string,
) {
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
