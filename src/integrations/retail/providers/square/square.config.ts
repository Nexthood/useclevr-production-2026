export const SQUARE_READ_ONLY_SCOPES = [
  "MERCHANT_PROFILE_READ",
  "ITEMS_READ",
  "INVENTORY_READ",
  "ORDERS_READ",
  "PAYMENTS_READ",
] as const;

export type SquareEnvironment = "sandbox" | "production";

export function getSquareConfig() {
  const environment = normalizeEnvironment(process.env.SQUARE_ENVIRONMENT);
  const applicationId = process.env.SQUARE_APPLICATION_ID?.trim();
  const applicationSecret = process.env.SQUARE_APPLICATION_SECRET?.trim();
  const redirectUri = process.env.SQUARE_REDIRECT_URI?.trim();
  const webhookNotificationUrl = process.env.SQUARE_WEBHOOK_NOTIFICATION_URL?.trim();
  const webhookSignatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY?.trim();

  return {
    environment,
    applicationId,
    applicationSecret,
    redirectUri,
    webhookNotificationUrl,
    webhookSignatureKey,
    oauthBaseUrl:
      environment === "production"
        ? "https://connect.squareup.com/oauth2"
        : "https://connect.squareupsandbox.com/oauth2",
    apiBaseUrl:
      environment === "production"
        ? "https://connect.squareup.com/v2"
        : "https://connect.squareupsandbox.com/v2",
    squareVersion: process.env.SQUARE_VERSION?.trim() || "2026-07-23",
  };
}

export function requireSquareOAuthConfig() {
  const config = getSquareConfig();
  if (!config.applicationId || !config.applicationSecret || !config.redirectUri) {
    throw new Error("Square OAuth is not configured.");
  }
  return config as ReturnType<typeof getSquareConfig> & {
    applicationId: string;
    applicationSecret: string;
    redirectUri: string;
  };
}

function normalizeEnvironment(value: string | undefined): SquareEnvironment {
  return value?.toLowerCase() === "production" ? "production" : "sandbox";
}
