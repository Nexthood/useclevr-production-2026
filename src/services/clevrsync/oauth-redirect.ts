const PRODUCTION_APP_ORIGIN = "https://app.useclevr.com";
const GOOGLE_CALLBACK_PATH = "/api/clevrsync/google/oauth/callback";

const PUBLIC_APP_URL_CANDIDATES = ["NEXT_PUBLIC_APP_URL", "AUTH_URL", "NEXTAUTH_URL"] as const;

const LOCAL_BROWSER_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function resolveClevrSyncBrowserOrigin(requestOrigin?: string | null) {
  for (const candidate of PUBLIC_APP_URL_CANDIDATES) {
    const origin = toSafeBrowserOrigin(process.env[candidate]);
    if (origin) return origin;
  }

  if (process.env.NODE_ENV !== "production") {
    return (
      toSafeBrowserOrigin(requestOrigin) || `http://localhost:${process.env.PORT || "3000"}`
    );
  }

  return PRODUCTION_APP_ORIGIN;
}

export function resolveClevrSyncGoogleRedirectUri(requestOrigin?: string | null) {
  const configured = process.env.GOOGLE_CLEVRSYNC_REDIRECT_URI?.trim();
  if (configured && isSafeBrowserUrl(configured)) return configured;
  return new URL(
    GOOGLE_CALLBACK_PATH,
    resolveClevrSyncBrowserOrigin(requestOrigin),
  ).toString();
}

export function buildClevrSyncGoogleRedirect(input: {
  path: string;
  requestOrigin?: string | null;
}) {
  return new URL(input.path, resolveClevrSyncBrowserOrigin(input.requestOrigin));
}

function toSafeBrowserOrigin(value?: string | null) {
  if (!isSafeBrowserUrl(value)) return "";
  return new URL(value).origin;
}

function isSafeBrowserUrl(value?: string | null): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (url.hostname === "0.0.0.0") return false;
    if (process.env.NODE_ENV === "production") {
      if (url.protocol !== "https:") return false;
      if (LOCAL_BROWSER_HOSTS.has(url.hostname)) return false;
      if (isPrivateNetworkHost(url.hostname)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function isPrivateNetworkHost(hostname: string) {
  return (
    /^10\./.test(hostname) ||
    /^172\.(1[6-9]|2[0-9]|3[01])\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    hostname === "169.254.169.254" ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".local")
  );
}
