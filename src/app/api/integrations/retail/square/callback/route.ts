import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth/auth";
import { getRetailConnector } from "@/integrations/retail/core/connector.factory";
import {
  consumeOauthState,
  saveRetailConnection,
} from "@/integrations/retail/core/connection.service";
import { queueRetailSync } from "@/integrations/retail/core/sync-engine";
import { getSquareConfig } from "@/integrations/retail/providers/square/square.config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await auth();
  const baseUrl = new URL("/app/retail", request.url);
  if (!session?.user?.id) {
    baseUrl.searchParams.set("error", "unauthorized");
    return NextResponse.redirect(baseUrl);
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const providerError = searchParams.get("error");

  if (providerError) {
    baseUrl.searchParams.set("error", providerError);
    return NextResponse.redirect(baseUrl);
  }
  if (!code || !state) {
    baseUrl.searchParams.set("error", "missing_square_authorization");
    return NextResponse.redirect(baseUrl);
  }

  try {
    const organizationId = await consumeOauthState({
      state,
      provider: "square",
      userId: session.user.id,
    });
    const config = getSquareConfig();
    if (!config.redirectUri) throw new Error("Square redirect URI is not configured.");
    const connector = getRetailConnector("square");
    const token = await connector.exchangeAuthorizationCode({ code, redirectUri: config.redirectUri });
    const connection = await saveRetailConnection({
      organizationId,
      provider: "square",
      createdBy: session.user.id,
      token,
      displayName: "Square",
    });
    await queueRetailSync(connection, "initial");
    baseUrl.searchParams.set("connected", "square");
    return NextResponse.redirect(baseUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Square authorization failed.";
    baseUrl.searchParams.set("error", message);
    return NextResponse.redirect(baseUrl);
  }
}
