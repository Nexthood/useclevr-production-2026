import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/auth";
import { requireBuiltinUserRecord } from "@/lib/auth/builtin-user-store";
import { debugError } from "@/lib/utils/debug";
import {
  clevrSyncAccessErrorPayload,
  requireClevrSyncAccess,
} from "@/services/clevrsync/access";
import {
  GoogleSheetsProviderError,
  parseGoogleSpreadsheetId,
  previewGoogleSheet,
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
    await requireClevrSyncAccess(session.user);
    return previewGoogleSheets(request, session.user.id);
  } catch (error) {
    const accessError = clevrSyncAccessErrorPayload(error);
    if (accessError) {
      return NextResponse.json(accessError, { status: accessError.status });
    }
    debugError("[ClevrSync] Preview failed:", error);
    return NextResponse.json({ error: "Unable to preview Google Sheet" }, { status: 500 });
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
