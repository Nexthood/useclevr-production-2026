import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth/auth";
import { getRetailConnector } from "@/integrations/retail/core/connector.factory";
import {
  consumeOauthState,
  saveRetailConnection,
} from "@/integrations/retail/core/connection.service";
import { queueRetailSync } from "@/integrations/retail/core/sync-engine";
import { requireSquareOAuthConfig } from "@/integrations/retail/providers/square/square.config";
import {
  getSquareCallbackFailureReason,
  getSafeSquareFailureReason,
  getSquareIntegrationRedirectUrl,
  getSquareProviderDenialReason,
} from "@/integrations/retail/providers/square/square-oauth";
import { debugWarn } from "@/lib/utils/debug";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await auth();
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const providerError = searchParams.get("error");
  const providerErrorDescription = searchParams.get("error_description");

  if (providerError) {
    debugWarn("[SQUARE_OAUTH] Provider denied authorization", {
      error: providerError,
      errorDescription: providerErrorDescription ? "present" : "absent",
    });
    return redirectWithError(request.url, getSquareProviderDenialReason(providerError));
  }
  if (!state) {
    return redirectWithError(request.url, "missing_state");
  }
  if (!code) {
    return redirectWithError(request.url, "missing_code");
  }

  try {
    const config = requireSquareOAuthConfig();
    const oauthState = await consumeOauthState({
      state,
      provider: "square",
      providerEnvironment: config.environment,
      userId: session?.user?.id,
    });
    const connector = getRetailConnector("square");
    const token = await connector.exchangeAuthorizationCode({ code, redirectUri: config.redirectUri });
    const connection = await saveRetailConnection({
      organizationId: oauthState.organizationId,
      provider: "square",
      providerEnvironment: config.environment,
      createdBy: oauthState.createdBy,
      token,
      displayName: "Square",
    });
    await queueRetailSync(connection, "initial");
    return NextResponse.redirect(getSquareIntegrationRedirectUrl({ requestUrl: request.url, status: "success" }));
  } catch (error) {
    const reason = getSquareCallbackFailureReason(error);
    debugWarn("[SQUARE_OAUTH] Callback failed", {
      reason,
      hasCode: Boolean(code),
      hasState: Boolean(state),
    });
    return redirectWithError(request.url, reason);
  }
}

function redirectWithError(requestUrl: string, reason: string) {
  return NextResponse.redirect(
    getSquareIntegrationRedirectUrl({
      requestUrl,
      status: "error",
      reason: getSafeSquareFailureReason(reason),
    }),
  );
}
