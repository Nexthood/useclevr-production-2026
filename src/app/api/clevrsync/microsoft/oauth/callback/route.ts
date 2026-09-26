import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth/auth";
import { requireBuiltinUserRecord } from "@/lib/auth/builtin-user-store";
import { debugError } from "@/lib/utils/debug";
import {
  exchangeMicrosoftCode,
  getMicrosoftAccountProfile,
} from "@/services/clevrsync/connectors/microsoft-graph";
import { requireClevrSyncAccess } from "@/services/clevrsync/access";
import { verifyMicrosoftOAuthState } from "@/services/clevrsync/microsoft-oauth-state";
import {
  resolveClevrSyncBrowserOrigin,
  resolveClevrSyncMicrosoftRedirectUri,
} from "@/services/clevrsync/oauth-redirect";
import { upsertMicrosoftConnector } from "@/services/clevrsync/sync-engine";
import { encryptClevrSyncToken } from "@/services/clevrsync/token-vault";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const browserOrigin = resolveClevrSyncBrowserOrigin(request.nextUrl.origin);
  const fallbackUrl = new URL("/app/settings/data-connections?microsoft=error", browserOrigin);
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(fallbackUrl);

  const stateValue = request.nextUrl.searchParams.get("state");

  try {
    await requireBuiltinUserRecord(session.user.id);
    await requireClevrSyncAccess(session.user);

    const error = request.nextUrl.searchParams.get("error");
    const errorSubcode = request.nextUrl.searchParams.get("error_subcode");
    const code = request.nextUrl.searchParams.get("code");
    if (error === "access_denied" || errorSubcode === "cancel") {
      // Consent was cancelled or dismissed on the Microsoft side.
      return NextResponse.redirect(
        new URL("/app/settings/data-connections?microsoft=cancelled", browserOrigin),
      );
    }
    if (error) {
      throw new Error("Microsoft authorization failed.");
    }
    if (!code || !stateValue) {
      throw new Error("Microsoft authorization response is incomplete.");
    }

    const state = verifyMicrosoftOAuthState(stateValue, session.user.id);
    const tokens = await exchangeMicrosoftCode({
      code,
      redirectUri: resolveClevrSyncMicrosoftRedirectUri(request.nextUrl.origin),
      connectorType: state.connectorType,
    });
    const accountLabel = await getMicrosoftAccountProfile(tokens.accessToken).catch(() => null);

    const connector = await upsertMicrosoftConnector({
      userId: session.user.id,
      type: state.connectorType,
      displayName: state.connectorType === "onedrive" ? "OneDrive" : "SharePoint",
      sourceMeta: {
        scope: tokens.scope || null,
        selectedByUser: true,
      },
      accessTokenEncrypted: encryptClevrSyncToken(tokens.accessToken),
      refreshTokenEncrypted: tokens.refreshToken ? encryptClevrSyncToken(tokens.refreshToken) : null,
      tokenExpiresAt: tokens.expiresAt,
      providerAccountLabel: accountLabel,
    });
    if (!connector) throw new Error("Microsoft connection could not be stored.");

    const redirectUrl = new URL(state.returnTo, browserOrigin);
    redirectUrl.searchParams.set("microsoft", "connected");
    redirectUrl.searchParams.set("connectorType", state.connectorType);
    redirectUrl.searchParams.set("connectorId", connector.id);
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    debugError("[ClevrSync] Microsoft OAuth callback failed:", error);
    return NextResponse.redirect(fallbackUrl);
  }
}
