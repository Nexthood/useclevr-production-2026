import { normalizeReferralCode, recordReferralEvent, referralCookieName } from "@/lib/referrals/referral-store";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const code = normalizeReferralCode(body.code) || normalizeReferralCode(request.cookies.get(referralCookieName)?.value)

  if (!code) {
    return NextResponse.json({ error: "Referral code is required." }, { status: 400 })
  }

  try {
    const stats = await recordReferralEvent(code, "paid", {
      eventKey: body.eventKey || body.paymentId || body.checkoutId || body.userId || body.email,
      referredUserId: body.userId,
      referredEmail: body.email,
    })
    return NextResponse.json({ success: true, stats })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not record paid referral." },
      { status: 400 },
    )
  }
}
