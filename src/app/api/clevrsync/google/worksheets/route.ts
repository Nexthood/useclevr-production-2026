import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth/auth";
import { requireBuiltinUserRecord } from "@/lib/auth/builtin-user-store";
import { debugError } from "@/lib/utils/debug";
import {
  clevrSyncAccessErrorPayload,
  requireClevrSyncAccess,
} from "@/services/clevrsync/access";
import {
  GoogleSheetsProviderError,
  getGoogleSpreadsheetWorksheets,
  parseGoogleSpreadsheetId,
  updateClevrSyncConnector,
} from "@/services/clevrsync";
import { getGoogleSheetsAccessToken, resolveOwnedGoogleSheetsConnector } from "@/services/clevrsync/google-auth-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireBuiltinUserRecord(session.user.id);
    await requireClevrSyncAccess(session.user);

    const searchParams = request.nextUrl.searchParams;
    const spreadsheetId = parseGoogleSpreadsheetId(
      searchParams.get("spreadsheetId") || searchParams.get("url") || "",
    );
    const connector = await resolveOwnedGoogleSheetsConnector(
      session.user.id,
      searchParams.get("connectorId"),
    );
    if (!connector) {
      return NextResponse.json(
        { error: "Connect Google Sheets first.", code: "google_not_connected" },
        { status: 401 },
      );
    }

    const sourceMeta = connector.sourceMeta as Record<string, unknown>;
    const token = await getGoogleSheetsAccessToken({ userId: session.user.id, connectorId: connector.id });
    if (!token) {
      return NextResponse.json(
        { error: "Reconnect Google Sheets", code: "reconnect_required" },
        { status: 401 },
      );
    }

    try {
      const spreadsheet = await getGoogleSpreadsheetWorksheets({
        accessToken: token.accessToken,
        spreadsheetId,
      });
      await updateClevrSyncConnector({
        userId: session.user.id,
        connectorId: connector.id,
        status: "connected",
        displayName: `Google Sheets: ${spreadsheet.spreadsheetName || "Spreadsheet"}`,
        sourceMeta: {
          ...sourceMeta,
          spreadsheetId: spreadsheet.spreadsheetId,
          spreadsheetName: spreadsheet.spreadsheetName,
        },
      });
      return NextResponse.json(spreadsheet);
    } catch (error) {
      if (error instanceof GoogleSheetsProviderError) {
        await updateClevrSyncConnector({
          userId: session.user.id,
          connectorId: connector.id,
          status: error.connectorStatus,
          sourceMeta: {
            ...sourceMeta,
            lastError: error.message,
          },
        });
        const status = error.connectorStatus === "reconnect_required" ? 401 : 422;
        return NextResponse.json(
          {
            error: error.message,
            code: error.connectorStatus === "reconnect_required" ? "reconnect_required" : "worksheet_list_failed",
          },
          { status },
        );
      }
      throw error;
    }
  } catch (error) {
    const accessError = clevrSyncAccessErrorPayload(error);
    if (accessError) {
      return NextResponse.json(accessError, { status: accessError.status });
    }
    debugError("[ClevrSync] Worksheet listing failed:", error);
    return NextResponse.json({ error: "Unable to list worksheets" }, { status: 500 });
  }
}
