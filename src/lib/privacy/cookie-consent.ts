"use client"

export const COOKIE_CONSENT_KEY = "useclevr_cookie_consent"

export type CookieConsentPreferences = {
  essential: true
  analytics: boolean
  productImprovement: boolean
  savedAt: string
  version: 1
}

export function getCookieConsent(): CookieConsentPreferences | null {
  if (typeof window === "undefined") return null

  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CookieConsentPreferences>

    if (parsed.version !== 1 || parsed.essential !== true) {
      return null
    }

    return {
      essential: true,
      analytics: Boolean(parsed.analytics),
      productImprovement: Boolean(parsed.productImprovement),
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : new Date().toISOString(),
      version: 1,
    }
  } catch {
    return null
  }
}

export function setCookieConsent(
  preferences: Pick<CookieConsentPreferences, "analytics" | "productImprovement">,
): CookieConsentPreferences {
  const consent: CookieConsentPreferences = {
    essential: true,
    analytics: Boolean(preferences.analytics),
    productImprovement: Boolean(preferences.productImprovement),
    savedAt: new Date().toISOString(),
    version: 1,
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consent))
  }

  return consent
}

export function hasCookieConsent() {
  return getCookieConsent() !== null
}

export function canUseAnalyticsCookies() {
  return Boolean(getCookieConsent()?.analytics)
}

export function canUseProductImprovementCookies() {
  return Boolean(getCookieConsent()?.productImprovement)
}
