export function resolveAuthRedirect(url: string, baseUrl: string) {
  try {
    if (url.startsWith("/")) {
      return new URL(url, baseUrl).toString()
    }

    const targetUrl = new URL(url)
    const baseOrigin = new URL(baseUrl).origin

    if (
      targetUrl.origin === baseOrigin ||
      isLocalAuthOrigin(targetUrl) ||
      isUseClevrAuthOrigin(targetUrl)
    ) {
      return targetUrl.toString()
    }
  } catch {
    // Invalid redirect values fall through to the sign-in page.
  }

  return new URL("/login", baseUrl).toString()
}

export function isLocalAuthOrigin(url: URL) {
  return url.protocol === "http:" && ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname)
}

function isUseClevrAuthOrigin(url: URL) {
  return (
    url.protocol === "https:" &&
    (url.hostname === "useclevr.com" || url.hostname.endsWith(".useclevr.com"))
  )
}
