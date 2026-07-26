import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/auth";
import { getRetailConnector } from "@/integrations/retail/core/connector.factory";
import { createOauthState } from "@/integrations/retail/core/connection.service";
import { requirePrimaryRetailOrganization } from "@/integrations/retail/core/organization.service";
import { requireSquareOAuthConfig } from "@/integrations/retail/providers/square/square.config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const organizationId = await requirePrimaryRetailOrganization(session.user.id);
    const state = await createOauthState({
      organizationId,
      provider: "square",
      createdBy: session.user.id,
    });
    const config = requireSquareOAuthConfig();
    const authorizationUrl = await getRetailConnector("square").getAuthorizationUrl({
      state,
      redirectUri: config.redirectUri,
    });
    return NextResponse.json({ authorizationUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start Square connection.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
