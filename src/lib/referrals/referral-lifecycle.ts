import { createHash, randomUUID } from "node:crypto"

import { and, count, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm"

import { getDb, type Database } from "@/lib/db"
import {
  creditLedger,
  profiles,
  referralAttributions,
  referralEvents,
  referralStats,
  userCredits,
} from "@/lib/db/schema"
import { REFERRAL_REWARD_CONFIG } from "@/lib/referrals/referral-config"

type ReferralTx = Parameters<Parameters<Database["transaction"]>[0]>[0]

/**
 * Server-side referral lifecycle.
 *
 * Every mutation in this module is triggered by an authoritative server event:
 *  - a visitor opening a referral link (click analytics only),
 *  - the auth verification flow confirming a real, verified account (signup),
 *  - the Stripe webhook lifecycle confirming an active paid subscription
 *    (paid conversion),
 *  - a superadmin correction via the admin referral API.
 *
 * No client-supplied userId, referral code, or Stripe identifier is trusted as
 * attribution evidence. All writes are idempotent through database uniqueness
 * (attribution per referred user, unique event keys, unique credit-ledger
 * idempotency keys) so retries, replays, and races never double-count or
 * double-grant.
 */

export const referralAttributionCookieName = "useclevr_ref_attribution"

const CLICK_EVENT_SALT = "useclevr-referral-click-v1"

export type ReferralVisitResult =
  | { recorded: true }
  | { recorded: false; reason: "unknown_code" | "self_visit" | "database_unavailable" | "error" }

export type ReferralSignupConfirmation =
  | { confirmed: true; attributionId: string; referrerUserId: string; code: string; rewardStatus: string }
  | { confirmed: false; reason: "no_attribution" | "self_referral" | "already_attributed" | "database_unavailable" | "error"; detail?: string }

export type ReferralPaidConfirmation =
  | { confirmed: true; attributionId: string; referrerUserId: string; code: string; rewardStatus: string }
  | { confirmed: false; reason: "no_attribution" | "not_eligible_tier" | "already_confirmed" | "database_unavailable" | "error"; detail?: string }

function attributionId() {
  return `refattr-${randomUUID().replace(/-/g, "").slice(0, 20)}`
}

function eventId() {
  return `refevt-${randomUUID().replace(/-/g, "").slice(0, 16)}`
}

function dayBucketUtc(now = new Date()) {
  return now.toISOString().slice(0, 10)
}

/**
 * Non-reversible click fingerprint. The raw IP is never persisted — only this
 * salted one-way hash, used solely to dedupe informational click analytics.
 */
export function clientClickFingerprint(ip: string | null | undefined) {
  const normalizedIp = (ip || "").split(",")[0]?.trim()
  if (!normalizedIp) return null
  return createHash("sha256").update(`${CLICK_EVENT_SALT}:${normalizedIp}`).digest("hex").slice(0, 32)
}

async function getDbClient() {
  try {
    return getDb()
  } catch {
    return null
  }
}

async function insertReferralEvent(input: {
  code: string
  type: "click" | "signup" | "paid" | "admin"
  eventKey: string
  referredUserId?: string | null
  referredEmail?: string | null
  source?: "automated" | "admin"
  metadata?: Record<string, unknown>
}) {
  const db = await getDbClient()
  if (!db) return null
  const [row] = await db
    .insert(referralEvents)
    .values({
      id: eventId(),
      code: input.code,
      type: input.type,
      eventKey: input.eventKey,
      referredUserId: input.referredUserId || null,
      referredEmail: input.referredEmail || null,
      source: input.source || "automated",
      metadata: input.metadata || {},
    })
    .onConflictDoNothing({ target: referralEvents.eventKey })
    .returning()
  return row || null
}

export async function findReferralCodeOwner(code: string) {
  const db = await getDbClient()
  if (!db) return null
  const row = await db.query.referralStats.findFirst({
    where: eq(referralStats.code, code),
    columns: { code: true, ownerUserId: true, ownerEmail: true },
  })
  return row || null
}

/**
 * Records a referral-link click. Informational analytics only — a click never
 * grants credits or unlocks rewards. Deduped per code per client fingerprint
 * per UTC day to blunt refresh and script inflation; the referrer's own
 * logged-in visits never count.
 */
export async function recordReferralClick(input: {
  code: string
  visitorUserId?: string | null
  clientIp?: string | null
}): Promise<ReferralVisitResult> {
  const db = await getDbClient()
  if (!db) return { recorded: false, reason: "database_unavailable" }

  try {
    const owner = await findReferralCodeOwner(input.code)
    if (!owner || !owner.ownerUserId) {
      return { recorded: false, reason: "unknown_code" }
    }

    if (input.visitorUserId && input.visitorUserId === owner.ownerUserId) {
      return { recorded: false, reason: "self_visit" }
    }

    const fingerprint = clientClickFingerprint(input.clientIp)
    const eventKey = fingerprint
      ? `${input.code}:click:${dayBucketUtc()}:${fingerprint}`
      : `${input.code}:click:${randomUUID()}`

    const inserted = await insertReferralEvent({
      code: input.code,
      type: "click",
      eventKey,
      metadata: { dedupe: "code_ip_day" },
    })

    if (inserted) {
      await db
        .update(referralStats)
        .set({ clicks: sql`${referralStats.clicks} + 1`, updatedAt: new Date() })
        .where(eq(referralStats.code, input.code))
    }

    return { recorded: true }
  } catch (error) {
    console.warn("[REFERRAL_LIFECYCLE] click recording failed", {
      code: input.code,
      error: error instanceof Error ? error.message : String(error),
    })
    return { recorded: false, reason: "error" }
  }
}

/**
 * Confirms a referral signup for a REAL account that just completed
 * email verification. Called only from the server-side auth verification flow.
 *
 * Idempotency: the unique index on ReferralAttribution.referredUserId makes
 * replays (refreshed callbacks, second tabs, duplicate verifications) no-ops.
 * Attribution is immutable afterwards: if the account is already attributed
 * (to any referrer), the original attribution stands and no reward re-fires.
 */
export async function confirmReferralSignup(input: {
  referredUserId: string
  referredEmail: string
  attributionCode: string
}): Promise<ReferralSignupConfirmation> {
  const db = await getDbClient()
  if (!db) return { confirmed: false, reason: "database_unavailable" }

  const referredEmail = input.referredEmail.trim().toLowerCase()

  try {
    const owner = await findReferralCodeOwner(input.attributionCode)
    if (!owner || !owner.ownerUserId) {
      return { confirmed: false, reason: "no_attribution", detail: "Referral code has no owner." }
    }

    if (owner.ownerUserId === input.referredUserId) {
      return { confirmed: false, reason: "self_referral" }
    }

    if (owner.ownerEmail && owner.ownerEmail.trim().toLowerCase() === referredEmail) {
      return { confirmed: false, reason: "self_referral" }
    }

    const inserted = await db
      .insert(referralAttributions)
      .values({
        id: attributionId(),
        code: owner.code,
        referrerUserId: owner.ownerUserId,
        referrerEmail: owner.ownerEmail,
        referredUserId: input.referredUserId,
        referredEmail,
        status: "signed_up",
        signupConfirmedAt: new Date(),
        signupRewardStatus: "pending",
      })
      .onConflictDoNothing({ target: referralAttributions.referredUserId })
      .returning()

    if (!inserted[0]) {
      // One referred account belongs to exactly one referrer — the first
      // valid attribution is locked in and later links never switch it.
      return { confirmed: false, reason: "already_attributed" }
    }

    await insertReferralEvent({
      code: owner.code,
      type: "signup",
      eventKey: `${owner.code}:signup:${input.referredUserId}`,
      referredUserId: input.referredUserId,
      referredEmail,
      metadata: { attributionId: inserted[0].id },
    })

    await db
      .update(referralStats)
      .set({ signups: sql`${referralStats.signups} + 1`, updatedAt: new Date() })
      .where(eq(referralStats.code, owner.code))

    // The reward grant is a separate idempotent transaction. If it fails, the
    // conversion survives (signupRewardStatus stays "pending") and only the
    // reward operation is retried.
    await grantSignupReward(inserted[0])

    return {
      confirmed: true,
      attributionId: inserted[0].id,
      referrerUserId: owner.ownerUserId,
      code: owner.code,
      rewardStatus: "pending",
    }
  } catch (error) {
    console.error("[REFERRAL_LIFECYCLE] signup confirmation failed", {
      referredUserId: input.referredUserId,
      error: error instanceof Error ? error.message : String(error),
    })
    return { confirmed: false, reason: "error", detail: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Keeps ReferralStats.creditsEarned equal to the canonical sum of finalized,
 * non-reversed referral reward credits recorded on the code's attributions.
 */
async function recomputeCreditsEarned(tx: ReferralTx, code: string) {
  const [row] = await tx
    .select({
      total: sql<number>`COALESCE(SUM(
        CASE WHEN ${referralAttributions.signupRewardStatus} = 'granted' THEN ${referralAttributions.signupRewardCredits} ELSE 0 END
        + CASE WHEN ${referralAttributions.paidRewardStatus} = 'granted' THEN ${referralAttributions.paidRewardCredits} ELSE 0 END
      ), 0)`,
    })
    .from(referralAttributions)
    .where(eq(referralAttributions.code, code))

  await tx
    .update(referralStats)
    .set({ creditsEarned: Number(row?.total ?? 0), updatedAt: new Date() })
    .where(eq(referralStats.code, code))
}

/**
 * Grants referral AI credits through the central credit engine.
 *
 * Credits land in purchasedBalance (the non-expiring reward-compatible pool
 * that survives downgrades and stays consumable on Free), with a
 * REFERRAL_REWARD ledger row (source "referral") carrying the full audit trail.
 * Idempotent by CreditLedger.idempotencyKey plus a conditional attribution
 * status update, so webhook retries and replays never double-grant.
 */
async function grantReferralCredits(input: {
  kind: "signup" | "paid"
  credits: number
  code: string
  attributionId: string
  referrerUserId: string
  referredUserId: string
  idempotencyKey: string
}): Promise<{ granted: boolean; error?: string }> {
  const db = await getDbClient()
  if (!db) return { granted: false, error: "database_unavailable" }

  const now = new Date()
  const isSignup = input.kind === "signup"

  try {
    await db.transaction(async (tx) => {
      const profile = await tx.query.profiles.findFirst({
        where: eq(profiles.userId, input.referrerUserId),
        columns: { role: true },
      })

      // Admin/superadmin accounts have unlimited credits and no UserCredit row.
      const unlimited = profile?.role === "admin" || profile?.role === "superadmin"

      // Single-grant guard: only the writer that flips the attribution reward
      // state out of its pre-grant value may credit the balance. Concurrent
      // retries lose this conditional update entirely and change nothing.
      const claimed = await tx
        .update(referralAttributions)
        .set(
          isSignup
            ? {
                signupRewardStatus: "granted",
                signupRewardCredits: input.credits,
                signupRewardGrantedAt: now,
                updatedAt: now,
              }
            : {
                paidRewardStatus: "granted",
                paidRewardCredits: input.credits,
                paidRewardGrantedAt: now,
                proRewardStatus: "pending_fulfillment",
                proRewardMonths: REFERRAL_REWARD_CONFIG.paid.pro.months,
                updatedAt: now,
              },
        )
        .where(
          and(
            eq(referralAttributions.id, input.attributionId),
            isSignup
              ? eq(referralAttributions.signupRewardStatus, "pending")
              : inArray(referralAttributions.paidRewardStatus, ["pending", "qualified"]),
          ),
        )
        .returning()

      if (!claimed[0]) {
        // Another writer already granted this reward — do nothing.
        return
      }

      const existingLedger = await tx.query.creditLedger.findFirst({
        where: eq(creditLedger.idempotencyKey, input.idempotencyKey),
      })

      if (existingLedger) {
        // Ledger evidence already exists for this exact reward (crash-repair
        // case): keep the attribution pointer consistent without re-crediting.
        await tx
          .update(referralAttributions)
          .set(isSignup ? { signupRewardLedgerId: existingLedger.id } : { paidRewardLedgerId: existingLedger.id })
          .where(eq(referralAttributions.id, input.attributionId))
        return
      }

      const account = unlimited
        ? null
        : await tx.query.userCredits.findFirst({
            where: eq(userCredits.userId, input.referrerUserId),
            columns: { remainingCredits: true, purchasedBalance: true, includedBalance: true },
          })

      if (!unlimited) {
        await tx.execute(sql`
          UPDATE "UserCredit"
          SET
            "purchasedBalance" = "purchasedBalance" + ${input.credits},
            "remainingCredits" = "remainingCredits" + ${input.credits},
            "lifetimeCreditsEarned" = "lifetimeCreditsEarned" + ${input.credits},
            "updatedAt" = ${now}
          WHERE "userId" = ${input.referrerUserId}
        `)
      }

      const ledgerEntryId = `cl_${randomUUID().replace(/-/g, "").slice(0, 20)}`

      await tx.insert(creditLedger).values({
        id: ledgerEntryId,
        workspaceId: input.referrerUserId,
        userId: input.referrerUserId,
        type: "grant",
        transactionType: "REFERRAL_REWARD",
        status: "finalized",
        operationId: input.idempotencyKey,
        idempotencyKey: input.idempotencyKey,
        amount: input.credits,
        credits: input.credits,
        balanceBefore: account?.remainingCredits ?? 0,
        balanceAfter: (account?.remainingCredits ?? 0) + input.credits,
        includedBalanceBefore: account?.includedBalance ?? 0,
        includedBalanceAfter: account?.includedBalance ?? 0,
        purchasedBalanceBefore: account?.purchasedBalance ?? 0,
        purchasedBalanceAfter: (account?.purchasedBalance ?? 0) + input.credits,
        source: "referral",
        feature: isSignup ? "referral_signup" : "referral_paid",
        action: isSignup ? "referral_signup_reward" : "referral_paid_reward",
        description: isSignup
          ? `Referral signup reward: ${input.credits} AI credits`
          : `Referral paid-conversion reward: ${input.credits} AI credits`,
        currency: "EUR",
        metadata: {
          source: "referral",
          reason: isSignup ? "referral_signup" : "referral_paid",
          referralId: input.attributionId,
          referralCode: input.code,
          referrerUserId: input.referrerUserId,
          referredUserId: input.referredUserId,
          rewardKind: input.kind,
        },
        createdAt: now,
        finalizedAt: now,
      }).onConflictDoNothing({ target: creditLedger.idempotencyKey })

      await tx
        .update(referralAttributions)
        .set(isSignup ? { signupRewardLedgerId: ledgerEntryId } : { paidRewardLedgerId: ledgerEntryId })
        .where(eq(referralAttributions.id, input.attributionId))

      await recomputeCreditsEarned(tx, input.code)
    })

    return { granted: true }
  } catch (error) {
    return { granted: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function grantSignupReward(attribution: typeof referralAttributions.$inferSelect) {
  if (attribution.signupRewardStatus === "granted") return

  const result = await grantReferralCredits({
    kind: "signup",
    credits: REFERRAL_REWARD_CONFIG.signup.credits,
    code: attribution.code,
    attributionId: attribution.id,
    referrerUserId: attribution.referrerUserId,
    referredUserId: attribution.referredUserId,
    idempotencyKey: `referral:reward:signup:${attribution.referredUserId}`,
  })

  if (!result.granted) {
    console.error("[REFERRAL_LIFECYCLE] signup reward grant failed", {
      attributionId: attribution.id,
      error: result.error,
    })
  }
}

async function grantPaidReward(attribution: typeof referralAttributions.$inferSelect) {
  const result = await grantReferralCredits({
    kind: "paid",
    credits: REFERRAL_REWARD_CONFIG.paid.credits,
    code: attribution.code,
    attributionId: attribution.id,
    referrerUserId: attribution.referrerUserId,
    referredUserId: attribution.referredUserId,
    idempotencyKey: `referral:reward:paid:${attribution.referredUserId}`,
  })

  if (!result.granted) {
    console.error("[REFERRAL_LIFECYCLE] paid reward grant failed", {
      attributionId: attribution.id,
      error: result.error,
    })
  }
}

/**
 * Retries finalized conversions whose reward grant is still outstanding
 * (e.g. a transient credit-engine failure right after the conversion).
 * Called when the referrer loads the Referral Center; every grant is
 * idempotent, so this is safe to run repeatedly.
 */
export async function grantPendingReferralRewardsForOwner(ownerUserId: string) {
  const db = await getDbClient()
  if (!db) return

  try {
    const pendingSignup = await db.query.referralAttributions.findMany({
      where: and(
        eq(referralAttributions.referrerUserId, ownerUserId),
        eq(referralAttributions.signupRewardStatus, "pending"),
      ),
      limit: 25,
      orderBy: desc(referralAttributions.createdAt),
    })
    for (const attribution of pendingSignup) {
      await grantSignupReward(attribution)
    }

    const qualifiedPaid = await db.query.referralAttributions.findMany({
      where: and(
        eq(referralAttributions.referrerUserId, ownerUserId),
        inArray(referralAttributions.paidRewardStatus, ["pending", "qualified"]),
      ),
      limit: 25,
      orderBy: desc(referralAttributions.createdAt),
    })
    for (const attribution of qualifiedPaid) {
      await grantPaidReward(attribution)
    }
  } catch (error) {
    console.warn("[REFERRAL_LIFECYCLE] pending reward retry failed", {
      ownerUserId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Confirms a paid referral conversion from authoritative Stripe evidence.
 *
 * Called only from the existing Stripe webhook subscription lifecycle after
 * billing synced an ACTIVE paid subscription (tier pro/business, subscription
 * status active) for the referred user. Checkout creation, redirects, client
 * success pages, and incomplete/past-due/unpaid states never reach here.
 *
 * Idempotency: one paid conversion per referred account. paidConfirmedAt plus
 * the unique ReferralEvent event key make duplicate checkout/subscription
 * events (and Stripe redeliveries) deterministic no-ops.
 */
export async function confirmReferralPaidConversion(input: {
  referredUserId: string
  tier: string
  evidence: {
    eventId?: string | null
    sessionId?: string | null
    subscriptionId?: string | null
    customerId?: string | null
  }
}): Promise<ReferralPaidConfirmation> {
  const db = await getDbClient()
  if (!db) return { confirmed: false, reason: "database_unavailable" }

  const eligibleTiers = REFERRAL_REWARD_CONFIG.paidEvidence.paidSubscriptionTiers as readonly string[]
  if (!eligibleTiers.includes(input.tier)) {
    return { confirmed: false, reason: "not_eligible_tier", detail: `Tier ${input.tier} is not a paid referral tier.` }
  }

  try {
    const attribution = await db.query.referralAttributions.findFirst({
      where: eq(referralAttributions.referredUserId, input.referredUserId),
    })

    if (!attribution) {
      return { confirmed: false, reason: "no_attribution" }
    }

    if (attribution.paidConfirmedAt) {
      return { confirmed: false, reason: "already_confirmed" }
    }

    const now = new Date()

    const qualified = await db
      .update(referralAttributions)
      .set({
        status: "paid",
        paidConfirmedAt: now,
        paidRewardStatus: "qualified",
        stripeEventId: input.evidence.eventId || attribution.stripeEventId,
        stripeSessionId: input.evidence.sessionId || attribution.stripeSessionId,
        stripeSubscriptionId: input.evidence.subscriptionId || attribution.stripeSubscriptionId,
        stripeCustomerId: input.evidence.customerId || attribution.stripeCustomerId,
        updatedAt: now,
      })
      // Conditional write: concurrent webhook deliveries race here and only
      // the first one qualifies the conversion.
      .where(and(eq(referralAttributions.id, attribution.id), isNull(referralAttributions.paidConfirmedAt)))
      .returning()

    if (!qualified[0]) {
      return { confirmed: false, reason: "already_confirmed" }
    }

    await insertReferralEvent({
      code: attribution.code,
      type: "paid",
      eventKey: `${attribution.code}:paid:${attribution.referredUserId}`,
      referredUserId: attribution.referredUserId,
      referredEmail: attribution.referredEmail,
      metadata: {
        attributionId: attribution.id,
        stripeEventId: input.evidence.eventId || null,
        stripeSessionId: input.evidence.sessionId || null,
        stripeSubscriptionId: input.evidence.subscriptionId || null,
        stripeCustomerId: input.evidence.customerId || null,
        tier: input.tier,
      },
    })

    await db
      .update(referralStats)
      .set({ paidReferrals: sql`${referralStats.paidReferrals} + 1`, updatedAt: now })
      .where(eq(referralStats.code, attribution.code))

    // The credit reward is granted in its own idempotent transaction. If it
    // fails, the qualified conversion is preserved and retried safely.
    await grantPaidReward(attribution)

    return {
      confirmed: true,
      attributionId: attribution.id,
      referrerUserId: attribution.referrerUserId,
      code: attribution.code,
      rewardStatus: "granted",
    }
  } catch (error) {
    console.error("[REFERRAL_LIFECYCLE] paid confirmation failed", {
      referredUserId: input.referredUserId,
      error: error instanceof Error ? error.message : String(error),
    })
    return { confirmed: false, reason: "error", detail: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Records an observed Stripe refund for a referred customer, resolving the
 * referred account server-side from the trusted Stripe customer ID (never
 * from client input). Subscription cancellation is not a refund and never
 * reaches this function.
 */
export async function recordReferralRefundForCustomer(input: {
  stripeCustomerId: string
  evidence: { eventId?: string | null; chargeId?: string | null; refundAmountMinor?: number | null }
}) {
  const db = await getDbClient()
  if (!db || !input.stripeCustomerId) return

  try {
    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.stripeCustomerId, input.stripeCustomerId),
      columns: { userId: true },
    })
    if (!profile?.userId) return

    await recordReferralRefundObservation({
      referredUserId: profile.userId,
      evidence: input.evidence,
    })
  } catch (error) {
    console.warn("[REFERRAL_LIFECYCLE] customer refund observation failed", {
      stripeCustomerId: input.stripeCustomerId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Records that a Stripe refund was observed for a referred user's payment.
 *
 * Automatic reward reversal on refund is a business-policy decision and stays
 * disabled. Refunds are DETECTABLE and auditable; reversal happens only via a
 * deliberate superadmin action (reverseReferralReward), which is idempotent
 * and never creates negative balances. Subscription cancellation
 * (cancel_at_period_end) is not a refund and never reaches this function.
 */
export async function recordReferralRefundObservation(input: {
  referredUserId: string
  evidence: { eventId?: string | null; chargeId?: string | null; refundAmountMinor?: number | null }
}) {
  const db = await getDbClient()
  if (!db) return

  try {
    const updated = await db
      .update(referralAttributions)
      .set({ refundObservedAt: new Date(), updatedAt: new Date() })
      .where(eq(referralAttributions.referredUserId, input.referredUserId))
      .returning()

    if (updated[0]) {
      await insertReferralEvent({
        code: updated[0].code,
        type: "paid",
        eventKey: `refund-observation:${input.evidence.eventId || input.evidence.chargeId || randomUUID()}`,
        referredUserId: input.referredUserId,
        source: "automated",
        metadata: {
          observation: "stripe_refund_detected",
          automaticReversal: "disabled_pending_business_policy",
          eventId: input.evidence.eventId || null,
          chargeId: input.evidence.chargeId || null,
          refundAmountMinor: input.evidence.refundAmountMinor ?? null,
        },
      })
    }

    console.warn("[REFERRAL_LIFECYCLE] refund observed for referred user (auto-reversal disabled)", {
      referredUserId: input.referredUserId,
      chargeId: input.evidence.chargeId || null,
    })
  } catch (error) {
    console.warn("[REFERRAL_LIFECYCLE] refund observation failed", {
      referredUserId: input.referredUserId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Reverses one referral reward grant (signup or paid credits). Reverses ONLY
 * the corresponding referral reward — never unrelated credits — and never
 * creates a negative balance (unrecoverable credits are flagged for billing
 * review instead). Idempotent by CreditLedger.idempotencyKey
 * (`referral:reverse:<kind>:<referredUserId>`). Restricted to superadmin
 * callers via the admin referral API.
 */
export async function reverseReferralReward(input: {
  referredUserId: string
  rewardKind: "signup" | "paid"
  adminUserId: string
  reason: string
}): Promise<{ success: boolean; creditsReversed: number; flaggedForReview?: boolean; error?: string }> {
  const db = await getDbClient()
  if (!db) return { success: false, creditsReversed: 0, error: "database_unavailable" }

  if (!input.reason.trim()) {
    return { success: false, creditsReversed: 0, error: "A reversal reason is required." }
  }

  const kind = input.rewardKind
  const statusOf = (row: typeof referralAttributions.$inferSelect) =>
    kind === "signup" ? row.signupRewardStatus : row.paidRewardStatus
  const creditsOf = (row: typeof referralAttributions.$inferSelect) =>
    kind === "signup" ? row.signupRewardCredits : row.paidRewardCredits

  try {
    const attribution = await db.query.referralAttributions.findFirst({
      where: eq(referralAttributions.referredUserId, input.referredUserId),
    })

    if (!attribution) {
      return { success: false, creditsReversed: 0, error: "No referral attribution for this user." }
    }

    if (statusOf(attribution) !== "granted") {
      return {
        success: false,
        creditsReversed: 0,
        error: `Referral ${kind} reward is not in granted state (status: ${statusOf(attribution)}).`,
      }
    }

    const credits = creditsOf(attribution)
    const idempotencyKey = `referral:reverse:${kind}:${input.referredUserId}`

    const existingReversal = await db.query.creditLedger.findFirst({
      where: eq(creditLedger.idempotencyKey, idempotencyKey),
    })
    if (existingReversal) {
      return { success: true, creditsReversed: 0 }
    }

    let flaggedForReview = false
    const now = new Date()

    const referrerProfile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, attribution.referrerUserId),
      columns: { role: true },
    })
    const referrerUnlimited = referrerProfile?.role === "admin" || referrerProfile?.role === "superadmin"

    await db.transaction(async (tx) => {
      // Claim the reversal first: only the writer that flips the reward state
      // out of "granted" performs the balance debit (consistent lock ordering
      // with the grant path, which also claims the attribution row first).
      const claimed = await tx
        .update(referralAttributions)
        .set({
          ...(kind === "signup"
            ? { signupRewardStatus: "reversed" as const }
            : { paidRewardStatus: "reversed" as const, proRewardStatus: "reversed" as const, proRewardDecidedAt: now }),
          adminAudit: [
            ...(attribution.adminAudit || []),
            {
              actor: input.adminUserId,
              action: `reverse_${kind}_reward`,
              reason: input.reason,
              oldState: { [`${kind}RewardStatus`]: "granted", [`${kind}RewardCredits`]: credits },
              newState: { [`${kind}RewardStatus`]: "reversed" },
              at: now.toISOString(),
            },
          ],
          updatedAt: now,
        })
        .where(
          and(
            eq(referralAttributions.id, attribution.id),
            eq(kind === "signup" ? referralAttributions.signupRewardStatus : referralAttributions.paidRewardStatus, "granted"),
          ),
        )
        .returning()

      if (!claimed[0]) {
        // A concurrent reversal already claimed this reward.
        return
      }

      if (credits > 0 && !referrerUnlimited) {
        const referrerCredit = await tx.query.userCredits.findFirst({
          where: eq(userCredits.userId, attribution.referrerUserId),
          columns: { purchasedBalance: true },
        })

        // Credits already consumed cannot be pulled back — flag for billing
        // review instead of driving any balance negative.
        if ((referrerCredit?.purchasedBalance ?? 0) < credits) {
          flaggedForReview = true
        }

        await tx.execute(sql`
          UPDATE "UserCredit"
          SET
            "purchasedBalance" = GREATEST(0, "purchasedBalance" - ${credits}),
            "remainingCredits" = GREATEST(0, "remainingCredits" - ${credits}),
            "lifetimeCreditsEarned" = GREATEST(0, "lifetimeCreditsEarned" - ${credits}),
            "updatedAt" = ${now}
          WHERE "userId" = ${attribution.referrerUserId}
        `)
      }

      await tx.insert(creditLedger).values({
        id: `cl_${randomUUID().replace(/-/g, "").slice(0, 20)}`,
        workspaceId: attribution.referrerUserId,
        userId: attribution.referrerUserId,
        type: "REVERSAL",
        transactionType: "REVERSAL",
        status: "finalized",
        operationId: idempotencyKey,
        idempotencyKey,
        amount: -credits,
        credits,
        balanceBefore: 0,
        balanceAfter: 0,
        source: "referral",
        feature: `referral_${kind}_reversal`,
        action: "referral_reward_reversal",
        description: `Referral ${kind} reward reversed: ${input.reason}`,
        adminUserId: input.adminUserId,
        currency: "EUR",
        metadata: {
          source: "referral",
          reason: input.reason,
          referralId: attribution.id,
          referralCode: attribution.code,
          rewardKind: kind,
          referredUserId: attribution.referredUserId,
          reviewFlagged: flaggedForReview,
        },
        finalizedAt: now,
      }).onConflictDoNothing({ target: creditLedger.idempotencyKey })

      await recomputeCreditsEarned(tx, attribution.code)
    })

    if (flaggedForReview) {
      await db
        .update(referralAttributions)
        .set({
          adminAudit: sql`(${referralAttributions.adminAudit} || ${JSON.stringify([
            {
              actor: input.adminUserId,
              action: "reverse_review_flagged",
              reason: "Referral credits already consumed; flagged for billing review instead of a negative balance.",
              oldState: {},
              newState: { reviewFlagged: true },
              at: new Date().toISOString(),
            },
          ])}::jsonb)`,
          updatedAt: new Date(),
        })
        .where(eq(referralAttributions.id, attribution.id))
    }

    await insertReferralEvent({
      code: attribution.code,
      type: "admin",
      eventKey: `admin:${kind}-reward-reversal:${attribution.referredUserId}:${now.getTime()}`,
      referredUserId: attribution.referredUserId,
      referredEmail: attribution.referredEmail,
      source: "admin",
      metadata: {
        adminUserId: input.adminUserId,
        action: `reverse_${kind}_reward`,
        reason: input.reason,
        credits,
      },
    })

    return { success: true, creditsReversed: credits, flaggedForReview }
  } catch (error) {
    return {
      success: false,
      creditsReversed: 0,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Records a superadmin decision on the 1-month Pro component of a paid
 * referral reward. The Pro reward has no safe automated fulfillment path
 * (Stripe-synced subscriptionTier must never be mutated by referral logic), so
 * the lifecycle records the decision here and the admin applies any actual
 * tier change through the existing admin customer tooling.
 */
export async function decideProReward(input: {
  referredUserId: string
  decision: "fulfilled" | "reversed"
  adminUserId: string
  reason: string
}): Promise<{ success: boolean; error?: string }> {
  const db = await getDbClient()
  if (!db) return { success: false, error: "database_unavailable" }

  if (!input.reason.trim()) {
    return { success: false, error: "A decision reason is required." }
  }

  try {
    const attribution = await db.query.referralAttributions.findFirst({
      where: eq(referralAttributions.referredUserId, input.referredUserId),
    })
    if (!attribution) {
      return { success: false, error: "No referral attribution for this user." }
    }
    if (attribution.proRewardStatus !== "pending_fulfillment") {
      return { success: false, error: `Pro reward is not awaiting fulfillment (status: ${attribution.proRewardStatus}).` }
    }

    const now = new Date()
    await db
      .update(referralAttributions)
      .set({
        proRewardStatus: input.decision === "fulfilled" ? "fulfilled" : "reversed",
        proRewardDecidedAt: now,
        adminAudit: [
          ...(attribution.adminAudit || []),
          {
            actor: input.adminUserId,
            action: `pro_reward_${input.decision}`,
            reason: input.reason,
            oldState: { proRewardStatus: attribution.proRewardStatus },
            newState: { proRewardStatus: input.decision === "fulfilled" ? "fulfilled" : "reversed" },
            at: now.toISOString(),
          },
        ],
        updatedAt: now,
      })
      .where(eq(referralAttributions.id, attribution.id))

    await insertReferralEvent({
      code: attribution.code,
      type: "admin",
      eventKey: `admin:pro-reward:${input.decision}:${attribution.referredUserId}:${now.getTime()}`,
      referredUserId: attribution.referredUserId,
      referredEmail: attribution.referredEmail,
      source: "admin",
      metadata: {
        adminUserId: input.adminUserId,
        action: `pro_reward_${input.decision}`,
        reason: input.reason,
        oldState: { proRewardStatus: attribution.proRewardStatus },
      },
    })

    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Owner-facing referral summary derived from canonical records:
 *  - Clicks:         recorded ReferralEvent click rows (dedupe applied at insert)
 *  - Signups:        confirmed ReferralAttribution rows
 *  - Paid Users:     attributions with a confirmed first paid conversion
 *  - Credits Earned: finalized, non-reversed referral credit grants
 */
export async function getOwnerReferralSummary(input: { code: string; ownerUserId: string }) {
  const db = await getDbClient()
  if (!db) return null

  const [clickRow] = await db
    .select({ total: count() })
    .from(referralEvents)
    .where(and(eq(referralEvents.code, input.code), eq(referralEvents.type, "click")))

  const [signupRow] = await db
    .select({ total: count() })
    .from(referralAttributions)
    .where(and(eq(referralAttributions.code, input.code), isNotNull(referralAttributions.signupConfirmedAt)))

  const [paidRow] = await db
    .select({ total: count() })
    .from(referralAttributions)
    .where(and(eq(referralAttributions.code, input.code), isNotNull(referralAttributions.paidConfirmedAt)))

  const [creditRow] = await db
    .select({
      total: sql<number>`COALESCE(SUM(
        CASE WHEN ${referralAttributions.signupRewardStatus} = 'granted' THEN ${referralAttributions.signupRewardCredits} ELSE 0 END
        + CASE WHEN ${referralAttributions.paidRewardStatus} = 'granted' THEN ${referralAttributions.paidRewardCredits} ELSE 0 END
      ), 0)`,
    })
    .from(referralAttributions)
    .where(eq(referralAttributions.code, input.code))

  const [pendingRow] = await db
    .select({ total: count() })
    .from(referralAttributions)
    .where(
      and(
        eq(referralAttributions.referrerUserId, input.ownerUserId),
        inArray(referralAttributions.signupRewardStatus, ["pending"]),
      ),
    )

  return {
    clicks: Number(clickRow?.total ?? 0),
    signups: Number(signupRow?.total ?? 0),
    paidReferrals: Number(paidRow?.total ?? 0),
    creditsEarned: Number(creditRow?.total ?? 0),
    pendingRewards: Number(pendingRow?.total ?? 0),
  }
}
