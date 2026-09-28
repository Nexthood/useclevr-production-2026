const PRODUCTION_APP_ORIGIN = "https://app.useclevr.com"
const LOCAL_AUTH_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"])

export function resolveAuthRedirect(url: string, baseUrl: string) {
  const safeBaseUrl = normalizePublicAuthBaseUrl(baseUrl)

  try {
    if (url.startsWith("/")) {
      return new URL(url, safeBaseUrl).toString()
    }

    const targetUrl = new URL(url)
    const baseOrigin = new URL(safeBaseUrl).origin

    if (targetUrl.origin === baseOrigin || isLocalAuthOrigin(targetUrl)) {
      return targetUrl.toString()
    }
  } catch {
    // Invalid redirect values fall through to the sign-in page.
  }

  return new URL("/login", safeBaseUrl).toString()
}

export function normalizePublicAuthBaseUrl(baseUrl: string) {
  const parsedBase = parseUrl(baseUrl)
  if (parsedBase && isSafePublicAuthUrl(parsedBase)) {
    return parsedBase.toString().replace(/\/+$/, "")
  }

  const configured = [
    process.env.AUTH_URL,
    process.env.NEXTAUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "",
    process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL}` : "",
  ]
    .map((candidate) => parseUrl(candidate))
    .find((candidate) => candidate && isSafePublicAuthUrl(candidate))

  if (configured) {
    return configured.toString().replace(/\/+$/, "")
  }

  if (process.env.NODE_ENV === "production") {
    return PRODUCTION_APP_ORIGIN
  }

  const port = parsedBase?.port || process.env.PORT || "8080"
  return `http://localhost:${port}`
}

export function isLocalAuthOrigin(url: URL) {
  return url.protocol === "http:" && ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname)
}

function parseUrl(value?: string | null) {
  if (!value) return null
  try {
    return new URL(value)
  } catch {
    return null
  }
}

function isSafePublicAuthUrl(url: URL) {
  if (url.hostname === "0.0.0.0") return false

  if (process.env.NODE_ENV !== "production") {
    return url.protocol === "http:" || url.protocol === "https:"
  }

  if (url.protocol !== "https:") return false
  if (LOCAL_AUTH_HOSTS.has(url.hostname)) return false
  if (isPrivateOrInternalHost(url.hostname)) return false
  return true
}

function isPrivateOrInternalHost(hostname: string) {
  return (
    /^10\./.test(hostname) ||
    /^172\.(1[6-9]|2[0-9]|3[01])\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    hostname === "169.254.169.254" ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".local")
  )
}
