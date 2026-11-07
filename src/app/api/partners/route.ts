import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";
import { partnerAccounts } from "@/lib/db/schema";
import { assertPartnerAccess, partnerApiError } from "@/lib/partners/api";
import { database, partnerSummary } from "@/lib/partners/store";
import { buildReferralLink } from "@/lib/referrals/referral-store";

export async function GET(request: Request) {
  const auth = await requireSession();
  if (!auth.success) return auth.error;
  try {
    const partner = await database().query.partnerAccounts.findFirst({
      where: eq(partnerAccounts.userId, auth.userId),
    });
    if (!partner)
      return NextResponse.json(
        {
          error: "No partner agreement is registered for this account. Contact UseClevr to apply.",
        },
        { status: 404 },
      );
    assertPartnerAccess(auth.userId, partner.userId);
    const offset = Math.max(
      0,
      Math.min(100000, Number(new URL(request.url).searchParams.get("offset")) || 0),
    );
    return NextResponse.json(
      {
        ...(await partnerSummary(partner.id, false, offset)),
        referralLink: buildReferralLink(new URL(request.url).origin, partner.code),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return partnerApiError(error);
  }
}
