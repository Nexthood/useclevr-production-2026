import { NextRequest, NextResponse } from "next/server"
import { normalizeReferralCode, recordReferralEvent, referralCookieName } from "@/lib/referrals/referral-store"

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const code = normalizeReferralCode(body.code) || normalizeReferralCode(request.cookies.get(referralCookieName)?.value)

  if (!code) {
    return NextResponse.json({ error: "Referral code is required." }, { status: 400 })
  }

  const stats = await recordReferralEvent(code, "paid")
  return NextResponse.json({ success: true, stats })
}
