import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth/auth";
import { requireBuiltinUserRecord } from "@/lib/auth/builtin-user-store";
import { debugError } from "@/lib/utils/debug";
import { requireClevrSyncAccess } from "@/services/clevrsync/access";
import {
  buildMicrosoftAuthorizationUrl,
  parseMicrosoftConnectorType,
} from "@/services/clevrsync/connectors/microsoft-graph";
import {
  microsoftConnectorCoversScope,
  resolveOwnedMicrosoftConnector,
} from "@/services/clevrsync/microsoft-auth-store";
import { createMicrosoftOAuthState } from "@/services/clevrsync/microsoft-oauth-state";
import {
  resolveClevrSyncBrowserOrigin,
  resolveClevrSyncMicrosoftRedirectUri,
} from "@/services/clevrsync/oauth-redirect";
import { upsertMicrosoftConnector } from "@/services/clevrsync/sync-engine";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const browserOrigin = resolveClevrSyncBrowserOrigin(request.nextUrl.origin);
  const returnTo = request.nextUrl.searchParams.get("returnTo");
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/auth/signin", browserOrigin));
  }

  try {
    await requireBuiltinUserRecord(session.user.id);
    await requireClevrSyncAccess(session.user);
    const connectorType = parseMicrosoftConnectorType(
      request.nextUrl.searchParams.get("connector"),
    );
    if (!connectorType) {
      throw new Error("Unsupported Microsoft connector type.");
    }

    const connectedUrl = () => {
      const url = new URL(safeReturnToPath(returnTo), browserOrigin);
      url.searchParams.set("microsoft", "connected");
      return url;
    };

    const existing = await resolveOwnedMicrosoftConnector(session.user.id, null, connectorType);
    if (
      existing &&
      existing.status === "connected" &&
      existing.refreshTokenEncrypted &&
      microsoftConnectorCoversScope(existing, connectorType)
    ) {
      return NextResponse.redirect(connectedUrl());
    }

    // One shared Microsoft connection: when the other Microsoft connector type
    // already holds tokens whose granted scopes cover the requested consent,
    // reuse them instead of sending the user through Microsoft again.
    if (!existing) {
      const siblingType = connectorType === "onedrive" ? "sharepoint" : "onedrive";
      const sibling = await resolveOwnedMicrosoftConnector(session.user.id, null, siblingType);
      if (
        sibling &&
        sibling.refreshTokenEncrypted &&
        sibling.accessTokenEncrypted &&
        microsoftConnectorCoversScope(sibling, connectorType)
      ) {
        const connector = await upsertMicrosoftConnector({
          userId: session.user.id,
          type: connectorType,
          displayName: connectorType === "onedrive" ? "OneDrive" : "SharePoint",
          sourceMeta: {
            ...(sibling.sourceMeta as Record<string, unknown>),
            scope:
              typeof sibling.sourceMeta.scope === "string" ? sibling.sourceMeta.scope : null,
            selectedByUser: true,
            linkedFrom: sibling.type,
          },
          accessTokenEncrypted: sibling.accessTokenEncrypted,
          refreshTokenEncrypted: sibling.refreshTokenEncrypted,
          tokenExpiresAt: sibling.tokenExpiresAt,
          providerAccountLabel: sibling.providerAccountLabel,
        });
        if (connector) {
          const url = connectedUrl();
          url.searchParams.set("connectorId", connector.id);
          return NextResponse.redirect(url);
        }
      }
    }

    const state = createMicrosoftOAuthState({
      userId: session.user.id,
      connectorType,
      returnTo,
    });
    const redirectUri = resolveClevrSyncMicrosoftRedirectUri(request.nextUrl.origin);
    return NextResponse.redirect(
      buildMicrosoftAuthorizationUrl({ state, redirectUri, connectorType }),
    );
  } catch (error) {
    debugError("[ClevrSync] Microsoft OAuth start failed:", error);
    return NextResponse.redirect(
      new URL("/app/settings/checkout?plan=pro_monthly&discount=auto", browserOrigin),
    );
  }
}

function safeReturnToPath(value: string | null) {
  return value && value.startsWith("/app/settings/data-connections")
    ? value
    : "/app/settings/data-connections";
}
