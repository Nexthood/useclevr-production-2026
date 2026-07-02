import { getOAuthConfigStatus, logOAuthConfigStatus } from "@/lib/auth/oauth-config";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  logOAuthConfigStatus("oauth-status-route");
  const status = getOAuthConfigStatus();
  logDevelopmentOAuthStatus(status);

  return NextResponse.json({
    googleEnabled: status.googleEnabled,
    linkedInEnabled: status.linkedInEnabled,
    googleProviderId: status.googleProviderId,
    linkedInProviderId: status.linkedInProviderId,
  });
}

function logDevelopmentOAuthStatus(status: ReturnType<typeof getOAuthConfigStatus>) {
  if (process.env.NODE_ENV !== "development") return;

  const missing: string[] = [];
  if (!status.authSecretPresent) missing.push("AUTH_SECRET or NEXTAUTH_SECRET");
  if (status.googleIdPresent !== status.googleSecretPresent) {
    missing.push(status.googleIdPresent ? "AUTH_GOOGLE_SECRET" : "AUTH_GOOGLE_ID");
  }
  if (status.linkedInIdPresent !== status.linkedInSecretPresent) {
    missing.push(status.linkedInIdPresent ? "AUTH_LINKEDIN_SECRET" : "AUTH_LINKEDIN_ID");
  }

  if (missing.length === 0) return;

  console.warn("[Auth] OAuth providers disabled or incomplete.", {
    missing,
    authUrl: status.authUrl,
    googleEnabled: status.googleEnabled,
    linkedInEnabled: status.linkedInEnabled,
    googleCallbackUrl: status.googleCallbackUrl,
    linkedInCallbackUrl: status.linkedInCallbackUrl,
  });
}
