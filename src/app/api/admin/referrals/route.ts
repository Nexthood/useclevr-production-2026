import { requireSuperAdmin } from "@/lib/auth/require-session"
import { getDb } from "@/lib/db"
import { referralAttributions } from "@/lib/db/schema"
import {
  decideProReward,
  grantPendingReferralRewardsForOwner,
  reverseReferralReward,
} from "@/lib/referrals/referral-lifecycle"
import { desc, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

/**
 * Superadmin referral inspection and correction API.
 *
 * Normal users have no referral mutation capability anywhere in the product;
 * the only manual mutation path is this server-side superadmin-authorized
 * API. Every action requires an explicit reason and is recorded in the
 * attribution's adminAudit trail plus a ReferralEvent "admin" row, so manual
 * interventions are distinguishable from automated signup/Stripe events.
 */
export async function GET(request: Request) {
  const auth = await requireSuperAdmin()
  if (!auth.success) return auth.error

  const db = getDb()
  if (!db) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 })
  }

  const url = new URL(request.url)
  const referredUserId = url.searchParams.get("referredUserId")
  const referrerUserId = url.searchParams.get("referrerUserId")

  const rows = referredUserId
    ? await db.query.referralAttributions.findMany({
        where: eq(referralAttributions.referredUserId, referredUserId),
        limit: 50,
        orderBy: desc(referralAttributions.createdAt),
      })
    : referrerUserId
      ? await db.query.referralAttributions.findMany({
          where: eq(referralAttributions.referrerUserId, referrerUserId),
          limit: 100,
          orderBy: desc(referralAttributions.createdAt),
        })
      : await db.query.referralAttributions.findMany({
          limit: 100,
          orderBy: desc(referralAttributions.createdAt),
        })

  return NextResponse.json({
    referrals: rows.map((row) => ({
      id: row.id,
      code: row.code,
      referrerUserId: row.referrerUserId,
      referredUserId: row.referredUserId,
      referredEmail: row.referredEmail,
      status: row.status,
      signupConfirmedAt: row.signupConfirmedAt?.toISOString() || null,
      paidConfirmedAt: row.paidConfirmedAt?.toISOString() || null,
      signupRewardStatus: row.signupRewardStatus,
      paidRewardStatus: row.paidRewardStatus,
      proRewardStatus: row.proRewardStatus,
      refundObservedAt: row.refundObservedAt?.toISOString() || null,
      stripeSubscriptionId: row.stripeSubscriptionId,
      stripeEventId: row.stripeEventId,
      adminAudit: row.adminAudit,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
  })
}

type CorrectionAction = "reverse_reward" | "retry_reward" | "pro_decision"

export async function PATCH(request: Request) {
  const auth = await requireSuperAdmin()
  if (!auth.success) return auth.error

  const db = getDb()
  if (!db) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 })
  }

  const body = await request.json().catch(() => null)
  const action = body?.action as CorrectionAction | undefined
  const referredUserId = typeof body?.referredUserId === "string" ? body.referredUserId : ""
  const reason = typeof body?.reason === "string" ? body.reason.trim() : ""

  if (!action || !referredUserId) {
    return NextResponse.json({ error: "action and referredUserId are required." }, { status: 400 })
  }
  if (!reason) {
    return NextResponse.json({ error: "A reason is required for every referral correction." }, { status: 400 })
  }

  const adminUserId = auth.userId

  if (action === "reverse_reward") {
    const rewardKind = body?.rewardKind === "paid" ? "paid" : body?.rewardKind === "signup" ? "signup" : null
    if (!rewardKind) {
      return NextResponse.json({ error: "rewardKind must be signup or paid." }, { status: 400 })
    }

    const result = await reverseReferralReward({
      referredUserId,
      rewardKind,
      adminUserId,
      reason,
    })
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({
      success: true,
      creditsReversed: result.creditsReversed,
      flaggedForReview: result.flaggedForReview ?? false,
    })
  }

  if (action === "retry_reward") {
    const attribution = await db.query.referralAttributions.findFirst({
      where: eq(referralAttributions.referredUserId, referredUserId),
    })
    if (!attribution) {
      return NextResponse.json({ error: "No referral attribution for this user." }, { status: 404 })
    }

    await grantPendingReferralRewardsForOwner(attribution.referrerUserId)

    const refreshed = await db.query.referralAttributions.findFirst({
      where: eq(referralAttributions.referredUserId, referredUserId),
    })
    return NextResponse.json({
      success: true,
      attribution: refreshed
        ? {
            id: refreshed.id,
            signupRewardStatus: refreshed.signupRewardStatus,
            paidRewardStatus: refreshed.paidRewardStatus,
            proRewardStatus: refreshed.proRewardStatus,
          }
        : null,
    })
  }

  if (action === "pro_decision") {
    const decision = body?.decision === "fulfilled" ? "fulfilled" : body?.decision === "reversed" ? "reversed" : null
    if (!decision) {
      return NextResponse.json({ error: "decision must be fulfilled or reversed." }, { status: 400 })
    }

    const result = await decideProReward({
      referredUserId,
      decision,
      adminUserId,
      reason,
    })
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 })
}
