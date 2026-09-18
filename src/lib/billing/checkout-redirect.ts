const PRODUCTION_APP_URL = "https://app.useclevr.com"
const LOCAL_CHECKOUT_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"])

export function resolveCheckoutBaseUrl(_requestOrigin?: string | null) {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.AUTH_URL,
    process.env.NEXTAUTH_URL,
  ]

  for (const candidate of candidates) {
    const url = parseAppUrl(candidate)
    if (url && isAllowedCheckoutBaseUrl(url)) {
      return url.origin
    }
  }

  return PRODUCTION_APP_URL
}

export function buildCheckoutSuccessUrl(token: string, sessionIdPlaceholder = "{CHECKOUT_SESSION_ID}", requestOrigin?: string | null, path?: string) {
  const baseUrl = resolveCheckoutBaseUrl(requestOrigin)
  const urlPath = path || "/checkout/success"
  const url = new URL(urlPath, baseUrl)
  url.searchParams.set("t", token)
  if (!path) {
    url.searchParams.set("session_id", sessionIdPlaceholder)
  }
  return url.toString()
}

export function resolveCheckoutSuccessUrl(token: string, returnUrl?: string | null) {
  const url = parseAppUrl(returnUrl)
  if (url && isAllowedCheckoutBaseUrl(url)) {
    return url.toString()
  }

  return buildCheckoutSuccessUrl(token)
}

export function buildCheckoutCancelUrl(path: string, _requestOrigin?: string | null) {
  return new URL(path, resolveCheckoutBaseUrl(_requestOrigin)).toString()
}

function parseAppUrl(value?: string | null) {
  const candidate = value?.trim()
  if (!candidate) return null

  try {
    return new URL(candidate.startsWith("http://") || candidate.startsWith("https://") ? candidate : `https://${candidate}`)
  } catch {
    return null
  }
}

function isAllowedCheckoutBaseUrl(url: URL) {
  if (url.hostname === "0.0.0.0") return false
  if (process.env.NODE_ENV === "production" && isLocalHost(url.hostname)) return false
  return url.protocol === "https:" || url.protocol === "http:"
}

function isLocalHost(hostname: string) {
  return LOCAL_CHECKOUT_HOSTS.has(hostname)
}
