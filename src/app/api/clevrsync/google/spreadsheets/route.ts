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
  listGoogleSpreadsheets,
  requiresSpreadsheetListingScope,
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
    if (connector.status === "reconnect_required") {
      return NextResponse.json(
        { error: "Reconnect Google Sheets to browse your spreadsheets.", code: "reconnect_required" },
        { status: 401 },
      );
    }

    const sourceMeta = connector.sourceMeta as Record<string, unknown>;
    if (requiresSpreadsheetListingScope(typeof sourceMeta.scope === "string" ? sourceMeta.scope : null)) {
      return NextResponse.json(
        {
          error: "Reconnect Google Sheets to allow spreadsheet discovery.",
          code: "reconnect_required",
          scopeUpgradeRequired: true,
        },
        { status: 401 },
      );
    }

    const token = await getGoogleSheetsAccessToken({ userId: session.user.id, connectorId: connector.id });
    if (!token) {
      return NextResponse.json(
        { error: "Reconnect Google Sheets to browse your spreadsheets.", code: "reconnect_required" },
        { status: 401 },
      );
    }

    const requestedPageSize = Number(searchParams.get("pageSize") || "");
    try {
      const result = await listGoogleSpreadsheets({
        accessToken: token.accessToken,
        search: searchParams.get("search"),
        pageSize: Number.isFinite(requestedPageSize) ? requestedPageSize : undefined,
        pageToken: searchParams.get("pageToken"),
      });
      return NextResponse.json({
        connectorId: connector.id,
        connectorStatus: connector.status,
        spreadsheets: result.spreadsheets,
        nextPageToken: result.nextPageToken,
      });
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
        const status = error.connectorStatus === "reconnect_required" ? 401 : 502;
        return NextResponse.json(
          {
            error: error.message,
            code: error.connectorStatus === "reconnect_required" ? "reconnect_required" : "listing_failed",
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
    debugError("[ClevrSync] Spreadsheet listing failed:", error);
    return NextResponse.json({ error: "Unable to list spreadsheets" }, { status: 500 });
  }
}
