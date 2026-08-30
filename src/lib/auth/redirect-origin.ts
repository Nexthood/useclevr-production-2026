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
  if (parsedBase && parsedBase.hostname !== "0.0.0.0") {
    return parsedBase.toString().replace(/\/+$/, "")
  }

  const configured = [
    process.env.AUTH_URL,
    process.env.NEXTAUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ]
    .map((candidate) => parseUrl(candidate))
    .find((candidate) => candidate && candidate.hostname !== "0.0.0.0")

  if (configured) {
    return configured.toString().replace(/\/+$/, "")
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
