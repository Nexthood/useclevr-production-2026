import { getSquareCallbackUrl, logSquareOAuthDiagnostics, requireSquareRedirectUri } from "./square-oauth";

export const SQUARE_READ_ONLY_SCOPES = [
  "MERCHANT_PROFILE_READ",
  "ITEMS_READ",
  "INVENTORY_READ",
  "ORDERS_READ",
  "PAYMENTS_READ",
] as const;

export type SquareEnvironment = "sandbox" | "production";

const squareEnvironmentConfig: Record<SquareEnvironment, { oauthHost: string; apiHost: string }> = {
  production: {
    oauthHost: "connect.squareup.com",
    apiHost: "connect.squareup.com",
  },
  sandbox: {
    oauthHost: "connect.squareupsandbox.com",
    apiHost: "connect.squareupsandbox.com",
  },
};

export function getSquareConfig() {
  const environment = readSquareEnvironment(process.env.SQUARE_ENVIRONMENT);
  const endpointConfig = squareEnvironmentConfig[environment];
  const oauthBaseUrl = `https://${endpointConfig.oauthHost}/oauth2`;
  const apiBaseUrl = `https://${endpointConfig.apiHost}/v2`;
  const applicationId = process.env.SQUARE_APPLICATION_ID?.trim();
  const applicationSecret = process.env.SQUARE_APPLICATION_SECRET?.trim();
  const redirectUri = getSquareCallbackUrl();
  const webhookNotificationUrl = process.env.SQUARE_WEBHOOK_NOTIFICATION_URL?.trim();
  const webhookSignatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY?.trim();

  return {
    environment,
    applicationId,
    applicationSecret,
    redirectUri,
    webhookNotificationUrl,
    webhookSignatureKey,
    oauthBaseUrl,
    authorizationUrl: `${oauthBaseUrl}/authorize`,
    tokenUrl: `${oauthBaseUrl}/token`,
    revokeUrl: `${oauthBaseUrl}/revoke`,
    apiBaseUrl,
    squareVersion: process.env.SQUARE_VERSION?.trim() || "2026-07-23",
  };
}

export function requireSquareOAuthConfig() {
  const config = getSquareConfig();
  if (!config.applicationId || !config.applicationSecret) {
    throw new Error("Square OAuth is not configured.");
  }
  requireSquareRedirectUri(config.environment);
  logSquareOAuthDiagnostics(config.environment);
  return config as ReturnType<typeof getSquareConfig> & {
    applicationId: string;
    applicationSecret: string;
    redirectUri: string;
  };
}

function readSquareEnvironment(value: string | undefined): SquareEnvironment {
  if (value === "production" || value === "sandbox") return value;
  throw new Error("SQUARE_ENVIRONMENT must be set exactly to production or sandbox.");
}
