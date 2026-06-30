import { getOAuthConfigStatus, logOAuthConfigStatus } from "@/lib/auth/oauth-config";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  logOAuthConfigStatus("oauth-status-route");
  const status = getOAuthConfigStatus();

  return NextResponse.json({
    googleEnabled: status.googleEnabled,
    linkedInEnabled: status.linkedInEnabled,
    googleProviderId: status.googleProviderId,
    linkedInProviderId: status.linkedInProviderId,
  });
}
