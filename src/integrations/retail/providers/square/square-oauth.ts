import { normalizePublicAuthBaseUrl } from "@/lib/auth/redirect-origin";

export const SQUARE_CALLBACK_PATH = "/api/integrations/retail/square/callback";
export const SQUARE_INTEGRATIONS_PATH = "/app/retail/integrations";
export const SQUARE_TEST_APP_ORIGIN = "https://test.useclevr.com";
export const SQUARE_PRODUCTION_APP_ORIGIN = "https://useclevr.com";

export type SquareEnvironment = "sandbox" | "production";

export type SquareOAuthUrlOptions = {
  requestUrl?: string | URL | null;
};

export type SquareOAuthErrorCode =
  | "square_config_missing"
  | "square_environment_mismatch"
  | "square_application_id_mismatch"
  | "square_redirect_uri_missing"
  | "square_redirect_uri_invalid"
  | "square_redirect_uri_mismatch";

export class SquareOAuthConfigurationError extends Error {
  constructor(
    public readonly code: SquareOAuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SquareOAuthConfigurationError";
  }
}

let hasLoggedSquareOAuthDiagnostics = false;

const safeFailureReasons = new Set([
  "access_denied",
  "callback_domain_mismatch",
  "database_failure",
  "expired_state",
  "invalid_state",
  "merchant_already_connected",
  "missing_code",
  "missing_configuration",
  "missing_state",
  "oauth_denied",
  "oauth_start_failed",
  "provider_error",
  "square_account_not_activated",
  "square_account_region_unsupported",
  "square_application_id_mismatch",
  "square_config_missing",
  "square_environment_mismatch",
  "square_redirect_uri_invalid",
  "square_redirect_uri_mismatch",
  "square_redirect_uri_missing",
  "token_exchange_failed",
]);

export function getSquareCallbackUrl(
  environment: SquareEnvironment = readSquareEnvironmentForOAuth(),
  options: SquareOAuthUrlOptions = {},
): string {
  const requestBaseUrl = getSquareRequestBaseUrl(options.requestUrl, environment);
  if (requestBaseUrl) {
    return `${requestBaseUrl}${SQUARE_CALLBACK_PATH}`;
  }

  const explicit = process.env.SQUARE_REDIRECT_URI?.trim();
  if (explicit) {
    const redirectUri = normalizeSquareRedirectUri(explicit);
    if (!redirectUri) {
      throw new SquareOAuthConfigurationError("square_redirect_uri_invalid", "Square redirect URI is invalid.");
    }
    if (new URL(explicit).toString() !== redirectUri) {
      throw new SquareOAuthConfigurationError(
        "square_redirect_uri_invalid",
        "Square redirect URI must match exactly and must not include a trailing slash after the callback path.",
      );
    }

    assertSquareRedirectUriMatchesAppUrl(redirectUri, environment);
    assertSquareRedirectUriAllowed(redirectUri, environment);
    return redirectUri;
  }

  if (environment === "production") {
    return `${SQUARE_PRODUCTION_APP_ORIGIN}${SQUARE_CALLBACK_PATH}`;
  }

  throw new SquareOAuthConfigurationError(
    "square_redirect_uri_missing",
    "SQUARE_REDIRECT_URI must be set to the Square OAuth callback URL.",
  );
}

export function getSquareRedirectUri(options: SquareOAuthUrlOptions = {}): string {
  return getSquareCallbackUrl(readSquareEnvironmentForOAuth(), options);
}

export function requireSquareRedirectUri(
  environment: SquareEnvironment,
  options: SquareOAuthUrlOptions = {},
): string {
  const redirectUri = getSquareCallbackUrl(environment, options);
  assertSquareRedirectUriAllowed(redirectUri, environment);
  return redirectUri;
}

export function logSquareOAuthDiagnostics(input: {
  environment: SquareEnvironment;
  authorizationUrl: string;
  applicationId?: string | null;
  redirectUri: string;
  redirectUriIncluded: boolean;
  stage: "config" | "authorize" | "token_exchange" | "refresh" | "revoke" | "api";
  requestId?: string;
  errorCode?: string;
}) {
  if (hasLoggedSquareOAuthDiagnostics) return;
  hasLoggedSquareOAuthDiagnostics = true;

  const parsedCallback = new URL(input.redirectUri);
  const parsedAuthorization = new URL(input.authorizationUrl);
  console.warn("[SQUARE_OAUTH] Resolved configuration", {
    appUrl: parsedCallback.origin,
    squareEnvironment: input.environment,
    authorizationHostname: parsedAuthorization.hostname,
    callbackHostname: parsedCallback.hostname,
    callbackPath: parsedCallback.pathname,
    redirectUriIncluded: input.redirectUriIncluded,
    applicationIdPrefix: getSafeApplicationIdPrefix(input.applicationId),
    oauthStage: input.stage,
    requestId: input.requestId,
    errorCode: input.errorCode,
  });
}

export function getCanonicalSquareAppBaseUrl(options: SquareOAuthUrlOptions = {}) {
  const environment = readOptionalSquareEnvironmentForOAuth();
  const requestBaseUrl = getSquareRequestBaseUrl(options.requestUrl, environment);
  if (requestBaseUrl) {
    return requestBaseUrl;
  }

  if (environment === "production") {
    return SQUARE_PRODUCTION_APP_ORIGIN;
  }

  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.AUTH_URL,
    process.env.NEXTAUTH_URL,
    process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "",
    process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL}` : "",
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "",
  ];

  for (const candidate of candidates) {
    const normalized = normalizeSquareBaseUrl(candidate);
    if (normalized) return normalized;
  }

  return normalizePublicAuthBaseUrl(`http://localhost:${process.env.PORT || "8080"}`);
}

export function getSquareIntegrationRedirectUrl(input: {
  requestUrl?: string;
  status: "success" | "error";
  reason?: string | null;
}) {
  const baseUrl = getCanonicalSquareAppBaseUrl({ requestUrl: input.requestUrl });
  const redirectUrl = new URL(SQUARE_INTEGRATIONS_PATH, baseUrl);
  redirectUrl.searchParams.set("connection", "square");
  redirectUrl.searchParams.set("status", input.status);
  if (input.status === "error") {
    redirectUrl.searchParams.set("reason", getSafeSquareFailureReason(input.reason));
  }
  return redirectUrl;
}

export function getSafeSquareFailureReason(reason: string | null | undefined) {
  const normalized = (reason || "provider_error")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return safeFailureReasons.has(normalized) ? normalized : "provider_error";
}

export function getSquareProviderDenialReason(providerError: string | null | undefined) {
  return providerError === "access_denied" ? "access_denied" : "oauth_denied";
}

export function getSquareCallbackFailureReason(error: unknown) {
  const code = typeof error === "object" && error && "code" in error
    ? String((error as { code?: unknown }).code)
    : "";
  if (code === "invalid_state" || code === "expired_state") return code;
  if (code === "environment_mismatch") return "square_environment_mismatch";
  if (safeFailureReasons.has(code)) return code;

  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("oauth") && message.includes("configured")) return "missing_configuration";
  if (message.includes("redirect uri")) return "callback_domain_mismatch";
  if (message.includes("token")) return "token_exchange_failed";
  if (message.includes("database")) return "database_failure";
  return "provider_error";
}

export function isSquareOAuthCallbackPath(pathname: string) {
  return pathname === SQUARE_CALLBACK_PATH;
}

export function assertSquareRedirectUriAllowed(redirectUri: string, environment: SquareEnvironment) {
  let parsed: URL;
  try {
    parsed = new URL(redirectUri);
  } catch {
    throw new SquareOAuthConfigurationError("square_redirect_uri_invalid", "Square redirect URI is invalid.");
  }

  if (parsed.pathname !== SQUARE_CALLBACK_PATH || parsed.search || parsed.hash) {
    throw new SquareOAuthConfigurationError(
      "square_redirect_uri_invalid",
      `Square redirect URI must use ${SQUARE_CALLBACK_PATH} with no query string or hash.`,
    );
  }

  if (parsed.toString() !== normalizeSquareRedirectUri(parsed.toString())) {
    throw new SquareOAuthConfigurationError(
      "square_redirect_uri_invalid",
      "Square redirect URI must not include a trailing slash after the callback path.",
    );
  }

  if (isLocalhost(parsed.hostname)) {
    if (environment === "production") {
      throw new SquareOAuthConfigurationError(
        "square_redirect_uri_mismatch",
        "Square production redirect URI must not use localhost.",
      );
    }
    return;
  }

  if (parsed.protocol !== "https:") {
    throw new SquareOAuthConfigurationError("square_redirect_uri_invalid", "Square redirect URI must use HTTPS.");
  }

  const allowedOrigins = getAllowedSquareRedirectOrigins(environment);
  if (!allowedOrigins.includes(parsed.origin)) {
    throw new SquareOAuthConfigurationError(
      "square_redirect_uri_mismatch",
      `Square ${environment} redirect URI must use ${allowedOrigins.join(" or ")}.`,
    );
  }
}

function assertSquareRedirectUriMatchesAppUrl(redirectUri: string, environment: SquareEnvironment) {
  const configuredBaseUrl = getConfiguredSquareAppBaseUrl();
  if (!configuredBaseUrl) return;

  const redirectUrl = new URL(redirectUri);
  const appUrl = new URL(configuredBaseUrl);
  const allowedOrigins = getAllowedSquareRedirectOrigins(environment);
  if (allowedOrigins.includes(redirectUrl.origin) && allowedOrigins.includes(appUrl.origin)) return;

  if (redirectUrl.origin !== appUrl.origin) {
    throw new SquareOAuthConfigurationError(
      "square_redirect_uri_mismatch",
      "Square redirect URI origin must match the configured application URL.",
    );
  }
}

function getConfiguredSquareAppBaseUrl() {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.AUTH_URL,
    process.env.NEXTAUTH_URL,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeSquareBaseUrl(candidate);
    if (normalized) return normalized;
  }

  return "";
}

function getSquareRequestBaseUrl(requestUrl: SquareOAuthUrlOptions["requestUrl"], environment: SquareEnvironment | null) {
  if (!requestUrl) return "";

  try {
    const parsed = new URL(requestUrl);
    const origin = normalizeSquareBaseUrl(parsed.origin);
    if (!origin) return "";
    const allowedOrigins = environment ? getAllowedSquareRedirectOrigins(environment) : [
      SQUARE_TEST_APP_ORIGIN,
      SQUARE_PRODUCTION_APP_ORIGIN,
    ];
    if (allowedOrigins.includes(origin) || (environment !== "production" && isLocalhost(parsed.hostname))) {
      return origin;
    }
  } catch {
    return "";
  }

  return "";
}

function getAllowedSquareRedirectOrigins(environment: SquareEnvironment) {
  if (environment === "production") {
    return [SQUARE_PRODUCTION_APP_ORIGIN, SQUARE_TEST_APP_ORIGIN];
  }
  return [SQUARE_TEST_APP_ORIGIN];
}

function normalizeSquareRedirectUri(value: string | undefined) {
  if (!value) return "";
  try {
    const url = new URL(value);
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return "";
  }
}

function normalizeSquareBaseUrl(value: string | undefined) {
  if (!value) return "";
  try {
    const candidate = value.startsWith("http") ? value : `https://${value}`;
    const url = new URL(candidate);
    if (url.hostname === "0.0.0.0") return "";
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

function isLocalhost(hostname: string) {
  return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname);
}

function readSquareEnvironmentForOAuth(): SquareEnvironment {
  const value = process.env.SQUARE_ENVIRONMENT;
  if (value === "production" || value === "sandbox") return value;
  throw new SquareOAuthConfigurationError(
    "square_config_missing",
    "SQUARE_ENVIRONMENT must be set exactly to production or sandbox.",
  );
}

function readOptionalSquareEnvironmentForOAuth(): SquareEnvironment | null {
  const value = process.env.SQUARE_ENVIRONMENT;
  return value === "production" || value === "sandbox" ? value : null;
}

function getSafeApplicationIdPrefix(applicationId: string | null | undefined) {
  if (!applicationId) return "missing";
  return applicationId.slice(0, Math.min(applicationId.length, 14));
}
