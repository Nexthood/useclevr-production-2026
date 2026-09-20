import { randomUUID } from "node:crypto"
import { normalizePublicAuthBaseUrl } from "@/lib/auth/redirect-origin"

/**
 * Referral link helpers. This module is intentionally write-free: referral
 * statistics, attribution, and rewards are owned exclusively by the
 * server-side lifecycle in @/lib/referrals/referral-lifecycle, which runs only
 * on authoritative signup/Stripe events. There is no client-callable referral
 * mutation path.
 */

export const COOKIE_NAME = "useclevr_referral_code"

export { COOKIE_NAME as referralCookieName }

export function normalizeReferralCode(value: unknown) {
  if (typeof value !== "string") return ""
  return value.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32)
}

export function createReferralCode() {
  return `uc-${randomUUID().replace(/-/g, "").slice(0, 10)}`
}

export function buildReferralLink(origin: string, code: string) {
  const baseUrl = normalizePublicAuthBaseUrl(process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || origin)
  const url = new URL("/signup", baseUrl)
  url.searchParams.set("ref", code)
  return url.toString()
}
