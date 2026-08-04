import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth/auth";
import { getRetailConnector } from "@/integrations/retail/core/connector.factory";
import { createOauthState } from "@/integrations/retail/core/connection.service";
import { requirePrimaryRetailOrganization } from "@/integrations/retail/core/organization.service";
import { requireSquareOAuthConfig } from "@/integrations/retail/providers/square/square.config";
import { getSquareIntegrationRedirectUrl } from "@/integrations/retail/providers/square/square-oauth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const result = await createSquareAuthorizationUrl(request);
  if (!result.ok) {
    return NextResponse.redirect(
      getSquareIntegrationRedirectUrl({ requestUrl: request.url, status: "error", reason: "oauth_start_failed" }),
    );
  }
  return NextResponse.redirect(result.authorizationUrl);
}

export async function POST(request: NextRequest) {
  const result = await createSquareAuthorizationUrl(request);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: result.status });
  }
  return NextResponse.json({ authorizationUrl: result.authorizationUrl });
}

async function createSquareAuthorizationUrl(request: NextRequest): Promise<
  | { ok: true; authorizationUrl: string }
  | { ok: false; reason: string; status: number }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, reason: "Unauthorized", status: 401 };
  }

  try {
    const organizationId = await requirePrimaryRetailOrganization(session.user.id);
    const config = requireSquareOAuthConfig({ requestUrl: request.url });
    const state = await createOauthState({
      organizationId,
      provider: "square",
      providerEnvironment: config.environment,
      createdBy: session.user.id,
    });
    const authorizationUrl = await getRetailConnector("square").getAuthorizationUrl({
      state,
      redirectUri: config.redirectUri,
    });
    return { ok: true, authorizationUrl };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start Square connection.";
    console.warn("[SQUARE_OAUTH] Connect start failed", {
      reason: message,
      stage: "authorize",
    });
    return { ok: false, reason: message, status: 400 };
  }
}
