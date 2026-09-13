import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth/auth";
import { requireBuiltinUserRecord } from "@/lib/auth/builtin-user-store";
import {
  createGoogleSheetsConnector,
  exchangeGoogleSheetsCode,
  getGoogleSheetsScope,
} from "@/services/clevrsync";
import { verifyGoogleOAuthState } from "@/services/clevrsync/google-oauth-state";
import { encryptClevrSyncToken } from "@/services/clevrsync/token-vault";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await auth();
  const fallbackUrl = new URL(
    "/app/settings/data-connections?google=error",
    request.nextUrl.origin,
  );
  if (!session?.user?.id) return NextResponse.redirect(fallbackUrl);

  try {
    await requireBuiltinUserRecord(session.user.id);
    const code = request.nextUrl.searchParams.get("code");
    const stateValue = request.nextUrl.searchParams.get("state");
    const error = request.nextUrl.searchParams.get("error");
    if (error) throw new Error("Google authorization was cancelled.");
    if (!code || !stateValue) throw new Error("Google authorization response is incomplete.");

    const state = verifyGoogleOAuthState(stateValue, session.user.id);
    const tokens = await exchangeGoogleSheetsCode({
      code,
      redirectUri: getGoogleRedirectUri(request),
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

    const redirectUrl = new URL(state.returnTo, request.nextUrl.origin);
    redirectUrl.searchParams.set("google", "connected");
    redirectUrl.searchParams.set("connectorId", connector.id);
    return NextResponse.redirect(redirectUrl);
  } catch {
    return NextResponse.redirect(fallbackUrl);
  }
}

function getGoogleRedirectUri(request: NextRequest) {
  return (
    process.env.GOOGLE_CLEVRSYNC_REDIRECT_URI?.trim() ||
    new URL("/api/clevrsync/google/oauth/callback", request.nextUrl.origin).toString()
  );
}
