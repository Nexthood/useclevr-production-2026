import {
    buildReferralLink,
    createReferralCode,
    getReferralStats,
    normalizeReferralCode,
    referralCookieName
} from "@/lib/referrals/referral-store";
import { auth } from "@/lib/auth/auth";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const session = await auth()
  const cookieCode = normalizeReferralCode(request.cookies.get(referralCookieName)?.value)
  const code = cookieCode || createReferralCode()
  const stats = await getReferralStats(code, {
    userId: session?.user?.id,
    email: session?.user?.email,
  })

  const response = NextResponse.json({
    code,
    referralLink: buildReferralLink(request.nextUrl.origin, code),
    stats,
  })

  if (!cookieCode) {
    const forwardedProto = request.headers.get("x-forwarded-proto")
    response.cookies.set(referralCookieName, code, {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:" || forwardedProto === "https",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    })
  }

  return response
}

export async function POST(request: NextRequest) {
  return GET(request)
}
