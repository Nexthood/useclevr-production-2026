import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth/auth";
import { requireBuiltinUserRecord } from "@/lib/auth/builtin-user-store";
import { debugError } from "@/lib/utils/debug";
import {
  clevrSyncAccessErrorPayload,
  requireClevrSyncAccess,
} from "@/services/clevrsync/access";
import {
  listSharePointDrives,
  MicrosoftGraphError,
  requiresSharePointSitesScope,
  updateClevrSyncConnector,
} from "@/services/clevrsync";
import {
  getMicrosoftAccessToken,
  resolveOwnedMicrosoftConnector,
} from "@/services/clevrsync/microsoft-auth-store";

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
    const siteId = (searchParams.get("siteId") || "").trim();
    if (!siteId) {
      return NextResponse.json({ error: "SharePoint site is required" }, { status: 400 });
    }

    const connector = await resolveOwnedMicrosoftConnector(
      session.user.id,
      searchParams.get("connectorId"),
      "sharepoint",
    );
    if (!connector) {
      return NextResponse.json(
        { error: "Connect Microsoft first.", code: "microsoft_not_connected" },
        { status: 401 },
      );
    }

    const sourceMeta = connector.sourceMeta as Record<string, unknown>;
    if (requiresSharePointSitesScope(typeof sourceMeta.scope === "string" ? sourceMeta.scope : null)) {
      return NextResponse.json(
        {
          error: "SharePoint document library discovery needs an additional Microsoft permission. Reconnect Microsoft to continue.",
          code: "additional_permission_required",
          scopeUpgradeRequired: true,
        },
        { status: 401 },
      );
    }

    const token = await getMicrosoftAccessToken({ userId: session.user.id, connectorId: connector.id });
    if (!token) {
      return NextResponse.json(
        { error: "Reconnect Microsoft to browse SharePoint document libraries.", code: "reconnect_required" },
        { status: 401 },
      );
    }

    try {
      const result = await listSharePointDrives({ accessToken: token.accessToken, siteId });
      return NextResponse.json({
        connectorId: connector.id,
        connectorStatus: connector.status,
        drives: result.drives,
      });
    } catch (error) {
      if (error instanceof MicrosoftGraphError) {
        await updateClevrSyncConnector({
          userId: session.user.id,
          connectorId: connector.id,
          status: error.connectorStatus,
          sourceMeta: { ...sourceMeta, lastError: error.message },
        });
        const status = error.connectorStatus === "reconnect_required" ? 401 : error.code === "not_found" ? 404 : 502;
        return NextResponse.json(
          {
            error: error.message,
            code: error.code ?? (error.connectorStatus === "reconnect_required" ? "reconnect_required" : "drive_list_failed"),
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
    debugError("[ClevrSync] SharePoint drive listing failed:", error);
    return NextResponse.json({ error: "Unable to list SharePoint document libraries" }, { status: 500 });
  }
}
