import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/auth";
import { requireBuiltinUserRecord } from "@/lib/auth/builtin-user-store";
import { uploadValidationErrorPayload } from "@/lib/upload/upload-security";
import { debugError } from "@/lib/utils/debug";
import {
  GoogleSheetsProviderError,
  getOwnedClevrSyncConnector,
  parseExcelWorkbook,
  parseGoogleSpreadsheetId,
  previewGoogleSheet,
  toDatasetPayload,
  updateClevrSyncConnector,
} from "@/services/clevrsync";
import { getGoogleSheetsAccessToken } from "@/services/clevrsync/google-auth-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireBuiltinUserRecord(session.user.id);
    if (request.headers.get("content-type")?.includes("application/json")) {
      return previewGoogleSheets(request, session.user.id);
    }

    const formData = await request.formData();
    const connectorId = String(formData.get("connectorId") || "").trim();
    const file = formData.get("file");

    if (connectorId) {
      const connector = await getOwnedClevrSyncConnector(session.user.id, connectorId);
      if (!connector) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "XLSX file is required" }, { status: 400 });
    }

    const preview = parseExcelWorkbook({
      fileBuffer: await file.arrayBuffer(),
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    });
    const dataset = toDatasetPayload(preview);

    return NextResponse.json({
      preview,
      dataset: {
        name: dataset.name,
        fileName: dataset.fileName,
        columns: dataset.columns,
        rowCount: preview.rowCount,
        columnTypes: dataset.columnTypes,
        datasetType: dataset.datasetType,
        source: dataset.source,
      },
    });
  } catch (error) {
    debugError("[ClevrSync] Preview failed:", error);
    const payload = uploadValidationErrorPayload(error, "CLEVRSYNC_PREVIEW_FAILED");
    return NextResponse.json(
      { error: payload.message, code: payload.code },
      { status: payload.status },
    );
  }
}

async function previewGoogleSheets(request: Request, userId: string) {
  const body = await request.json().catch(() => null);
  const connectorId = String(body?.connectorId || "").trim();
  const spreadsheetId = parseGoogleSpreadsheetId(String(body?.spreadsheetId || ""));
  const worksheetName = typeof body?.worksheetName === "string" ? body.worksheetName : null;

  if (!connectorId) {
    return NextResponse.json({ error: "Connector is required" }, { status: 400 });
  }

  const token = await getGoogleSheetsAccessToken({ userId, connectorId });
  if (!token) {
    return NextResponse.json({ error: "Reconnect Google Sheets" }, { status: 401 });
  }

  try {
    const preview = await previewGoogleSheet({
      accessToken: token.accessToken,
      spreadsheetId,
      worksheetName,
    });
    await updateClevrSyncConnector({
      userId,
      connectorId,
      status: "connected",
      displayName: `Google Sheets: ${preview.googleSheets?.spreadsheetName || "Spreadsheet"}`,
      sourceMeta: {
        spreadsheetId,
        spreadsheetName: preview.googleSheets?.spreadsheetName,
        worksheetName: preview.googleSheets?.worksheetName,
      },
    });

    return NextResponse.json({
      preview,
      dataset: {
        name: preview.fileName.replace(/\.csv$/i, ""),
        fileName: preview.fileName,
        columns: preview.columns.map((column) => column.name),
        rowCount: preview.rowCount,
        columnTypes: Object.fromEntries(
          preview.columns.map((column) => [column.name, column.type]),
        ),
        datasetType: "standard",
        source: "clevrsync",
      },
    });
  } catch (error) {
    if (error instanceof GoogleSheetsProviderError) {
      await updateClevrSyncConnector({
        userId,
        connectorId,
        status: error.connectorStatus,
        sourceMeta: {
          ...(token.connector.sourceMeta as Record<string, unknown>),
          lastError: error.message,
        },
      });
      const status = error.connectorStatus === "reconnect_required" ? 401 : 422;
      return NextResponse.json({ error: error.message }, { status });
    }
    throw error;
  }
}
