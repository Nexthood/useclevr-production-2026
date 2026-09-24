import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth/auth";
import { requireBuiltinUserRecord } from "@/lib/auth/builtin-user-store";
import { buildGoogleSheetsAuthorizationUrl } from "@/services/clevrsync";
import { requireClevrSyncAccess } from "@/services/clevrsync/access";
import { createGoogleOAuthState } from "@/services/clevrsync/google-oauth-state";
import {
  resolveClevrSyncBrowserOrigin,
  resolveClevrSyncGoogleRedirectUri,
} from "@/services/clevrsync/oauth-redirect";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const browserOrigin = resolveClevrSyncBrowserOrigin(request.nextUrl.origin);
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/auth/signin", browserOrigin));
  }

  try {
    await requireBuiltinUserRecord(session.user.id);
    await requireClevrSyncAccess(session.user);
    const state = createGoogleOAuthState({
      userId: session.user.id,
      returnTo: request.nextUrl.searchParams.get("returnTo"),
    });
    const redirectUri = resolveClevrSyncGoogleRedirectUri(request.nextUrl.origin);
    return NextResponse.redirect(buildGoogleSheetsAuthorizationUrl({ state, redirectUri }));
  } catch {
    return NextResponse.redirect(
      new URL("/app/settings/checkout?plan=pro_monthly&discount=auto", browserOrigin),
    );
  }
}
