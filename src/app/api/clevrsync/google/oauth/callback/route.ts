import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth/auth";
import { requireBuiltinUserRecord } from "@/lib/auth/builtin-user-store";
import {
  createGoogleSheetsConnector,
  exchangeGoogleSheetsCode,
  getGoogleSheetsScope,
} from "@/services/clevrsync";
import { requireClevrSyncAccess } from "@/services/clevrsync/access";
import { verifyGoogleOAuthState } from "@/services/clevrsync/google-oauth-state";
import {
  resolveClevrSyncBrowserOrigin,
  resolveClevrSyncGoogleRedirectUri,
} from "@/services/clevrsync/oauth-redirect";
import { encryptClevrSyncToken } from "@/services/clevrsync/token-vault";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const browserOrigin = resolveClevrSyncBrowserOrigin(request.nextUrl.origin);
  const fallbackUrl = new URL("/app/settings/data-connections?google=error", browserOrigin);
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(fallbackUrl);

  try {
    await requireBuiltinUserRecord(session.user.id);
    await requireClevrSyncAccess(session.user);
    const code = request.nextUrl.searchParams.get("code");
    const stateValue = request.nextUrl.searchParams.get("state");
    const error = request.nextUrl.searchParams.get("error");
    if (error) throw new Error("Google authorization was cancelled.");
    if (!code || !stateValue) throw new Error("Google authorization response is incomplete.");

    const state = verifyGoogleOAuthState(stateValue, session.user.id);
    const tokens = await exchangeGoogleSheetsCode({
      code,
      redirectUri: resolveClevrSyncGoogleRedirectUri(request.nextUrl.origin),
    });

    const connector = await createGoogleSheetsConnector({
      userId: session.user.id,
      type: "google_sheets",
      displayName: "Google Sheets",
      sourceMeta: {
        scope: tokens.scope || getGoogleSheetsScope(),
        selectedByUser: true,
      },
      accessTokenEncrypted: encryptClevrSyncToken(tokens.accessToken),
      refreshTokenEncrypted: tokens.refreshToken
        ? encryptClevrSyncToken(tokens.refreshToken)
        : null,
      tokenExpiresAt: tokens.expiresAt,
    });

    const redirectUrl = new URL(state.returnTo, browserOrigin);
    redirectUrl.searchParams.set("google", "connected");
    redirectUrl.searchParams.set("connectorId", connector.id);
    return NextResponse.redirect(redirectUrl);
  } catch {
    return NextResponse.redirect(fallbackUrl);
  }
}
