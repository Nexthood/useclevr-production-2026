import { normalizeReferralCode } from "@/lib/referrals/referral-store"
import { recordReferralClick, referralAttributionCookieName } from "@/lib/referrals/referral-lifecycle"
import { auth } from "@/lib/auth/auth"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

/**
 * Automated referral-link visit tracking.
 *
 * This handler runs when a visitor opens a referral link
 * (`/signup?ref=<code>` redirects here). It records an informational click
 * (deduped per code per client fingerprint per day, never counted for the
 * referrer's own session) and preserves the attribution in an httpOnly cookie
 * until the signup flow confirms it server-side. It never grants rewards.
 */
export async function GET(request: NextRequest) {
  const code = normalizeReferralCode(request.nextUrl.searchParams.get("code"))

  const loginUrl = new URL("/login", request.nextUrl.origin)
  loginUrl.searchParams.set("tab", "signup")
  const callbackUrl = request.nextUrl.searchParams.get("callbackUrl")
  if (callbackUrl) loginUrl.searchParams.set("callbackUrl", callbackUrl)

  if (!code) {
    return NextResponse.redirect(loginUrl.toString())
  }

  const session = await auth()
  const visitorUserId = session?.user?.id || null

  const forwardedFor = request.headers.get("x-forwarded-for")
  const result = await recordReferralClick({
    code,
    visitorUserId,
    clientIp: forwardedFor,
  })

  if (result.recorded === false && (result.reason === "unknown_code" || result.reason === "self_visit")) {
    // Unknown codes and the referrer's own visits get no attribution.
    return NextResponse.redirect(loginUrl.toString())
  }

  const response = NextResponse.redirect(loginUrl.toString())
  const forwardedProto = request.headers.get("x-forwarded-proto")
  response.cookies.set(referralAttributionCookieName, code, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:" || forwardedProto === "https",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  })
  return response
}
