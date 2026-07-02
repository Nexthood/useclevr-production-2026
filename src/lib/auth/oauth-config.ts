import { normalizePublicAuthBaseUrl } from "@/lib/auth/redirect-origin";
import { config } from "@/lib/config";
import { debugLog, debugWarn } from "@/lib/utils/debug";

export const googleProviderId = "google";
export const linkedinProviderId = "linkedin";
export const oauthDashboardCallbackUrl = "/app/dashboard";

const googleClientIdConfig = readOAuthEnv("AUTH_GOOGLE_ID", "GOOGLE_CLIENT_ID", "GOOGLE_ID");
const googleClientSecretConfig = readOAuthEnv(
  "AUTH_GOOGLE_SECRET",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_SECRET",
);
const linkedinClientIdConfig = readOAuthEnv(
  "AUTH_LINKEDIN_ID",
  "LINKEDIN_CLIENT_ID",
  "LINKEDIN_ID",
);
const linkedinClientSecretConfig = readOAuthEnv(
  "AUTH_LINKEDIN_SECRET",
  "LINKEDIN_CLIENT_SECRET",
  "LINKEDIN_SECRET",
);

export const googleClientId = googleClientIdConfig.value;
export const googleClientSecret = googleClientSecretConfig.value;
export const linkedinClientId = linkedinClientIdConfig.value;
export const linkedinClientSecret = linkedinClientSecretConfig.value;
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
    googleClientIdSource: googleClientIdConfig.source,
    googleClientSecretSource: googleClientSecretConfig.source,
    linkedInClientIdSource: linkedinClientIdConfig.source,
    linkedInClientSecretSource: linkedinClientSecretConfig.source,
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
    googleClientIdSource: status.googleClientIdSource,
    googleClientSecretSource: status.googleClientSecretSource,
    linkedInClientIdSource: status.linkedInClientIdSource,
    linkedInClientSecretSource: status.linkedInClientSecretSource,
  };

  if (!status.authSecretPresent) {
    debugWarn("[Auth] OAuth config status:", sanitizedStatus);
    return;
  }

  debugLog("[Auth] OAuth config status:", sanitizedStatus);
}

function readOAuthEnv(primaryName: string, ...fallbackNames: string[]) {
  const primaryValue = process.env[primaryName]?.trim();
  if (primaryValue) return { value: primaryValue, source: primaryName };

  return firstEnvValue(...fallbackNames);
}

function firstEnvValue(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return { value, source: name };
  }
  return { value: undefined, source: undefined };
}
