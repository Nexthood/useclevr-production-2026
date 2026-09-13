import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth/auth";
import { requireBuiltinUserRecord } from "@/lib/auth/builtin-user-store";
import { buildGoogleSheetsAuthorizationUrl } from "@/services/clevrsync";
import { createGoogleOAuthState } from "@/services/clevrsync/google-oauth-state";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/auth/signin", request.url));
  }

  await requireBuiltinUserRecord(session.user.id);
  const state = createGoogleOAuthState({
    userId: session.user.id,
    returnTo: request.nextUrl.searchParams.get("returnTo"),
  });
  const redirectUri = getGoogleRedirectUri(request);
  return NextResponse.redirect(buildGoogleSheetsAuthorizationUrl({ state, redirectUri }));
}

function getGoogleRedirectUri(request: NextRequest) {
  return (
    process.env.GOOGLE_CLEVRSYNC_REDIRECT_URI?.trim() ||
    new URL("/api/clevrsync/google/oauth/callback", request.nextUrl.origin).toString()
  );
}
