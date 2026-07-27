import {
  SquareOAuthConfigurationError,
  getSquareCallbackUrl,
  logSquareOAuthDiagnostics,
  requireSquareRedirectUri,
  type SquareEnvironment,
} from "./square-oauth";

export const SQUARE_READ_ONLY_SCOPES = [
  "MERCHANT_PROFILE_READ",
  "ITEMS_READ",
  "INVENTORY_READ",
  "ORDERS_READ",
  "PAYMENTS_READ",
] as const;

export type { SquareEnvironment };

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
  const redirectUri = getSquareCallbackUrl(environment);
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
    authorizeUrl: `${oauthBaseUrl}/authorize`,
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
    throw new SquareOAuthConfigurationError("square_config_missing", "Square OAuth is not configured.");
  }
  if (process.env.NEXT_PUBLIC_SQUARE_APPLICATION_SECRET) {
    throw new SquareOAuthConfigurationError(
      "square_config_missing",
      "Square application secret must not be exposed through NEXT_PUBLIC_SQUARE_APPLICATION_SECRET.",
    );
  }
  assertSquareApplicationIdMatchesEnvironment(config.applicationId, config.environment);
  assertSquareApplicationSecretMatchesEnvironment(config.applicationSecret, config.environment);
  requireSquareRedirectUri(config.environment);
  logSquareOAuthDiagnostics({
    environment: config.environment,
    authorizationUrl: config.authorizationUrl,
    applicationId: config.applicationId,
    redirectUri: config.redirectUri,
    redirectUriIncluded: Boolean(config.redirectUri),
    stage: "config",
  });
  return config as ReturnType<typeof getSquareConfig> & {
    applicationId: string;
    applicationSecret: string;
    redirectUri: string;
  };
}

function readSquareEnvironment(value: string | undefined): SquareEnvironment {
  if (value === "production" || value === "sandbox") return value;
  throw new SquareOAuthConfigurationError(
    "square_config_missing",
    "SQUARE_ENVIRONMENT must be set exactly to production or sandbox.",
  );
}

function assertSquareApplicationIdMatchesEnvironment(applicationId: string, environment: SquareEnvironment) {
  const isSandboxId = applicationId.startsWith("sandbox-");
  const isProductionId = applicationId.startsWith("sq0idp-");
  if (environment === "sandbox" && isProductionId) {
    throw new SquareOAuthConfigurationError(
      "square_application_id_mismatch",
      "Square sandbox environment must not use a production application ID.",
    );
  }
  if (environment === "production" && isSandboxId) {
    throw new SquareOAuthConfigurationError(
      "square_application_id_mismatch",
      "Square production environment must not use a sandbox application ID.",
    );
  }
}

function assertSquareApplicationSecretMatchesEnvironment(applicationSecret: string, environment: SquareEnvironment) {
  if (environment === "production" && applicationSecret.startsWith("sandbox-")) {
    throw new SquareOAuthConfigurationError(
      "square_application_id_mismatch",
      "Square production environment must not use a sandbox application secret.",
    );
  }
}
