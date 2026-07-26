import { normalizePublicAuthBaseUrl } from "@/lib/auth/redirect-origin";

export const SQUARE_CALLBACK_PATH = "/api/integrations/retail/square/callback";
export const SQUARE_INTEGRATIONS_PATH = "/app/retail/integrations";

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
  "provider_error",
  "token_exchange_failed",
]);

export function getSquareCallbackUrl() {
  const explicit = normalizeSquareRedirectUri(process.env.SQUARE_REDIRECT_URI);
  if (explicit) {
    assertSquareRedirectUriMatchesAppUrl(explicit);
    return explicit;
  }

  const baseUrl = getCanonicalSquareAppBaseUrl();
  return new URL(SQUARE_CALLBACK_PATH, baseUrl).toString();
}

export function getSquareRedirectUri() {
  return getSquareCallbackUrl();
}

export function requireSquareRedirectUri(environment: "production" | "sandbox") {
  const redirectUri = getSquareCallbackUrl();
  assertSquareRedirectUriAllowed(redirectUri, environment);
  return redirectUri;
}

export function logSquareOAuthDiagnostics(environment: "production" | "sandbox") {
  if (hasLoggedSquareOAuthDiagnostics) return;
  hasLoggedSquareOAuthDiagnostics = true;

  const appUrl = getCanonicalSquareAppBaseUrl();
  const callbackUrl = getSquareCallbackUrl();
  const parsedCallback = new URL(callbackUrl);
  console.warn("[SQUARE_OAUTH] Resolved configuration", {
    appUrl,
    squareEnvironment: environment,
    callbackHostname: parsedCallback.hostname,
    callbackPath: parsedCallback.pathname,
  });
}

export function getCanonicalSquareAppBaseUrl() {
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
  const baseUrl = getCanonicalSquareAppBaseUrl();
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

export function assertSquareRedirectUriAllowed(redirectUri: string, environment: "production" | "sandbox") {
  let parsed: URL;
  try {
    parsed = new URL(redirectUri);
  } catch {
    throw new Error("Square redirect URI is invalid.");
  }

  if (parsed.pathname !== SQUARE_CALLBACK_PATH || parsed.search || parsed.hash) {
    throw new Error(`Square redirect URI must use ${SQUARE_CALLBACK_PATH} with no query string or hash.`);
  }

  if (parsed.toString() !== normalizeSquareRedirectUri(parsed.toString())) {
    throw new Error("Square redirect URI must not include a trailing slash after the callback path.");
  }

  if (environment === "production") {
    if (parsed.protocol !== "https:") {
      throw new Error("Square production redirect URI must use HTTPS.");
    }
    if (isLocalhost(parsed.hostname)) {
      throw new Error("Square production redirect URI must not use localhost.");
    }
    if (parsed.hostname.endsWith(".vercel.app")) {
      throw new Error("Square production redirect URI must not use preview domains.");
    }
  }
}

function assertSquareRedirectUriMatchesAppUrl(redirectUri: string) {
  const configuredBaseUrl = getConfiguredSquareAppBaseUrl();
  if (!configuredBaseUrl) return;

  const redirectUrl = new URL(redirectUri);
  const appUrl = new URL(configuredBaseUrl);
  if (redirectUrl.origin !== appUrl.origin) {
    throw new Error("Square redirect URI origin must match the configured application URL.");
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

function normalizeSquareRedirectUri(value: string | undefined) {
  const normalizedBase = normalizeSquareBaseUrl(value);
  if (!normalizedBase) return "";
  const url = new URL(normalizedBase);
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
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
