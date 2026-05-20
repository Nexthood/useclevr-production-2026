import { buildReferralLink, normalizeReferralCode } from "@/lib/referrals/referral-store";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import QRCode from "qrcode";

export async function GET(request: NextRequest) {
  const code = normalizeReferralCode(request.nextUrl.searchParams.get("code"))

  if (!code) {
    return NextResponse.json({ error: "Referral code is required." }, { status: 400 })
  }

  const link = buildReferralLink(request.nextUrl.origin, code)
  const svg = await QRCode.toString(link, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    width: 220,
    color: {
      dark: "#111827",
      light: "#ffffff",
    },
  })

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  })
}
