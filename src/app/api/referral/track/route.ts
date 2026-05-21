import { normalizeReferralCode, recordReferralEvent, referralCookieName } from "@/lib/referrals/referral-store";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const code = normalizeReferralCode(body.code) || normalizeReferralCode(request.cookies.get(referralCookieName)?.value)

  if (!code) {
    return NextResponse.json({ error: "Referral code is required." }, { status: 400 })
  }

  const stats = await recordReferralEvent(code, "click", {
    eventKey: body.eventKey,
  })
  return NextResponse.json({ success: true, stats })
}
