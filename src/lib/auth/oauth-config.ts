import { normalizePublicAuthBaseUrl } from "@/lib/auth/redirect-origin";
import { config } from "@/lib/config";
import { debugLog, debugWarn } from "@/lib/utils/debug";

export const googleProviderId = "google";
export const linkedinProviderId = "linkedin";
export const oauthDashboardCallbackUrl = "/app/dashboard";

export const googleClientId = firstEnvValue("AUTH_GOOGLE_ID", "GOOGLE_CLIENT_ID", "GOOGLE_ID");
export const googleClientSecret = firstEnvValue(
  "AUTH_GOOGLE_SECRET",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_SECRET",
);
export const linkedinClientId = firstEnvValue("AUTH_LINKEDIN_ID", "LINKEDIN_CLIENT_ID", "LINKEDIN_ID");
export const linkedinClientSecret = firstEnvValue(
  "AUTH_LINKEDIN_SECRET",
  "LINKEDIN_CLIENT_SECRET",
  "LINKEDIN_SECRET",
);
export const authSecret = config.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

export function getOAuthConfigStatus() {
  const authUrl = normalizePublicAuthBaseUrl(
    process.env.AUTH_URL ||
      process.env.NEXTAUTH_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      `http://localhost:${process.env.PORT || "8080"}`,
  );
  const callbackBase = `${authUrl}/api/auth/callback`;

  return {
    googleIdPresent: Boolean(googleClientId),
    googleSecretPresent: Boolean(googleClientSecret),
    linkedInIdPresent: Boolean(linkedinClientId),
    linkedInSecretPresent: Boolean(linkedinClientSecret),
    authSecretPresent: Boolean(authSecret),
    authUrl,
    googleEnabled: Boolean(googleClientId && googleClientSecret && authSecret),
    linkedInEnabled: Boolean(linkedinClientId && linkedinClientSecret && authSecret),
    googleProviderId,
    linkedInProviderId: linkedinProviderId,
    googleCallbackUrl: `${callbackBase}/${googleProviderId}`,
    linkedInCallbackUrl: `${callbackBase}/${linkedinProviderId}`,
  };
}

export function logOAuthConfigStatus(source: string) {
  const status = getOAuthConfigStatus();
  const sanitizedStatus = {
    source,
    googleIdPresent: status.googleIdPresent,
    googleSecretPresent: status.googleSecretPresent,
    linkedInIdPresent: status.linkedInIdPresent,
    linkedInSecretPresent: status.linkedInSecretPresent,
    authSecretPresent: status.authSecretPresent,
    authUrl: status.authUrl,
    googleEnabled: status.googleEnabled,
    linkedInEnabled: status.linkedInEnabled,
    googleProviderId: status.googleProviderId,
    linkedInProviderId: status.linkedInProviderId,
    googleCallbackUrl: status.googleCallbackUrl,
    linkedInCallbackUrl: status.linkedInCallbackUrl,
  };

  if (!status.authSecretPresent) {
    debugWarn("[Auth] OAuth config status:", sanitizedStatus);
    return;
  }

  debugLog("[Auth] OAuth config status:", sanitizedStatus);
}

function firstEnvValue(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}
