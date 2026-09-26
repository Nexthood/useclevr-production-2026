import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth/auth";
import { requireBuiltinUserRecord } from "@/lib/auth/builtin-user-store";
import { debugError } from "@/lib/utils/debug";
import {
  clevrSyncAccessErrorPayload,
  requireClevrSyncAccess,
} from "@/services/clevrsync/access";
import {
  getMicrosoftWorkbookMeta,
  MicrosoftGraphError,
  requiresMicrosoftFileScope,
  updateClevrSyncConnector,
} from "@/services/clevrsync";
import {
  getMicrosoftAccessToken,
  resolveOwnedMicrosoftConnector,
} from "@/services/clevrsync/microsoft-auth-store";

export const dynamic = "force-dynamic";

/**
 * Lists the worksheets of a selected Microsoft Excel workbook.
 * Works for OneDrive items (driveId omitted → /me/drive) and SharePoint
 * document library items (driveId provided).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireBuiltinUserRecord(session.user.id);
    await requireClevrSyncAccess(session.user);

    const searchParams = request.nextUrl.searchParams;
    const itemId = (searchParams.get("itemId") || "").trim();
    const driveId = (searchParams.get("driveId") || "").trim();
    if (!itemId) {
      return NextResponse.json({ error: "Workbook is required" }, { status: 400 });
    }

    const connectorType = searchParams.get("connectorType") === "sharepoint" ? "sharepoint" : "onedrive";
    const connector = await resolveOwnedMicrosoftConnector(
      session.user.id,
      searchParams.get("connectorId"),
      connectorType,
    );
    if (!connector) {
      return NextResponse.json(
        { error: "Connect Microsoft first.", code: "microsoft_not_connected" },
        { status: 401 },
      );
    }

    const sourceMeta = connector.sourceMeta as Record<string, unknown>;
    if (requiresMicrosoftFileScope(typeof sourceMeta.scope === "string" ? sourceMeta.scope : null)) {
      return NextResponse.json(
        {
          error: "Reconnect Microsoft to read workbook metadata.",
          code: "reconnect_required",
          scopeUpgradeRequired: true,
        },
        { status: 401 },
      );
    }

    const token = await getMicrosoftAccessToken({ userId: session.user.id, connectorId: connector.id });
    if (!token) {
      return NextResponse.json(
        { error: "Reconnect Microsoft to read workbook metadata.", code: "reconnect_required" },
        { status: 401 },
      );
    }

    try {
      const workbook = await getMicrosoftWorkbookMeta({
        accessToken: token.accessToken,
        driveId: driveId || null,
        itemId,
      });
      await updateClevrSyncConnector({
        userId: session.user.id,
        connectorId: connector.id,
        status: "connected",
        displayName:
          connectorType === "onedrive"
            ? `OneDrive: ${workbook.workbookName}`
            : `SharePoint: ${workbook.workbookName}`,
        sourceMeta: {
          ...sourceMeta,
          itemId: workbook.itemId,
          workbookName: workbook.workbookName,
          worksheets: workbook.worksheets,
        },
      });
      return NextResponse.json({
        itemId: workbook.itemId,
        workbookName: workbook.workbookName,
        worksheets: workbook.worksheets,
      });
    } catch (error) {
      if (error instanceof MicrosoftGraphError) {
        await updateClevrSyncConnector({
          userId: session.user.id,
          connectorId: connector.id,
          status: error.connectorStatus,
          sourceMeta: { ...sourceMeta, lastError: error.message },
        });
        const status = error.connectorStatus === "reconnect_required" ? 401 : error.code === "not_found" ? 404 : 422;
        return NextResponse.json(
          {
            error: error.message,
            code: error.code ?? (error.connectorStatus === "reconnect_required" ? "reconnect_required" : "worksheet_list_failed"),
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
    debugError("[ClevrSync] Microsoft worksheet listing failed:", error);
    return NextResponse.json({ error: "Unable to list worksheets" }, { status: 500 });
  }
}
