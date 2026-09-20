import { buildReferralLink, createReferralCode, normalizeReferralCode, referralCookieName } from "@/lib/referrals/referral-store"
import {
  getOwnerReferralSummary,
  grantPendingReferralRewardsForOwner,
  referralAttributionCookieName,
} from "@/lib/referrals/referral-lifecycle"
import { REFERRAL_REWARD_CONFIG } from "@/lib/referrals/referral-config"
import { getDb } from "@/lib/db"
import { referralStats } from "@/lib/db/schema"
import { and, eq, isNull } from "drizzle-orm"
import { requireSession } from "@/lib/auth/require-session"
import { debugWarn } from "@/lib/utils/debug"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

/**
 * Resolves the caller's own referral code.
 *
 * A cookie value is only reused when the server verifies it belongs to the
 * session user (or is still unowned, in which case it is bound to them). A
 * cookie carrying somebody else's code is ignored and a fresh code is minted,
 * so referral-code ownership can never be hijacked by editing cookies.
 */
async function resolveOwnerCode(request: NextRequest, userId: string, email: string | null | undefined) {
  const db = getDb()
  const cookieCode = normalizeReferralCode(request.cookies.get(referralCookieName)?.value)

  if (cookieCode && db) {
    const [existing] = await db
      .select({ code: referralStats.code, ownerUserId: referralStats.ownerUserId })
      .from(referralStats)
      .where(eq(referralStats.code, cookieCode))
      .limit(1)

    if (existing && existing.ownerUserId && existing.ownerUserId !== userId) {
      return { code: createReferralCode(), takeOwnership: true }
    }

    if (existing && !existing.ownerUserId) {
      await db
        .update(referralStats)
        .set({ ownerUserId: userId, ownerEmail: email || null, updatedAt: new Date() })
        .where(and(eq(referralStats.code, cookieCode), isNull(referralStats.ownerUserId)))
      return { code: cookieCode, takeOwnership: false }
    }

    if (existing) {
      return { code: cookieCode, takeOwnership: false }
    }
  }

  return { code: cookieCode || createReferralCode(), takeOwnership: true }
}

export async function GET(request: NextRequest) {
  const authResult = await requireSession()
  if (!authResult.success) return authResult.error

  const session = authResult.session
  const userId = session.user.id
  const email = session.user.email || null

  const { code, takeOwnership } = await resolveOwnerCode(request, userId, email)

  const db = getDb()
  if (!db) {
    debugWarn("[referral] database unavailable for referral center lookup", { userId })
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 })
  }

  if (takeOwnership) {
    await db
      .insert(referralStats)
      .values({
        code,
        ownerUserId: userId,
        ownerEmail: email,
        clicks: 0,
        signups: 0,
        paidReferrals: 0,
        creditsEarned: 0,
      })
      .onConflictDoNothing({ target: referralStats.code })

    await db
      .update(referralStats)
      .set({ ownerUserId: userId, ownerEmail: email, updatedAt: new Date() })
      .where(and(eq(referralStats.code, code), isNull(referralStats.ownerUserId)))
  } else {
    await db
      .insert(referralStats)
      .values({
        code,
        ownerUserId: userId,
        ownerEmail: email,
        clicks: 0,
        signups: 0,
        paidReferrals: 0,
        creditsEarned: 0,
      })
      .onConflictDoNothing({ target: referralStats.code })
  }

  // Retry any reward grant that failed transiently after a confirmed signup.
  await grantPendingReferralRewardsForOwner(userId)

  const stats = await getOwnerReferralSummary({ code, ownerUserId: userId })

  const response = NextResponse.json({
    code,
    referralLink: buildReferralLink(request.nextUrl.origin, code),
    stats: {
      clicks: stats?.clicks ?? 0,
      signups: stats?.signups ?? 0,
      paidReferrals: stats?.paidReferrals ?? 0,
      creditsEarned: stats?.creditsEarned ?? 0,
      pendingRewards: stats?.pendingRewards ?? 0,
    },
    rewards: {
      signupCredits: REFERRAL_REWARD_CONFIG.signup.credits,
      paidCredits: REFERRAL_REWARD_CONFIG.paid.credits,
      paidProMonths: REFERRAL_REWARD_CONFIG.paid.pro.months,
    },
  })

  const forwardedProto = request.headers.get("x-forwarded-proto")
  response.cookies.set(referralCookieName, code, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:" || forwardedProto === "https",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  })

  // Visitors carry the visitor attribution cookie; the owner center must not
  // keep somebody else's referral attribution alive in the owner's browser.
  if (request.cookies.get(referralAttributionCookieName)) {
    response.cookies.delete(referralAttributionCookieName)
  }

  return response
}

export async function POST(request: NextRequest) {
  return GET(request)
}
