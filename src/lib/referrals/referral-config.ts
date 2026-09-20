/**
 * Authoritative server-side referral reward configuration.
 *
 * This is the single source of truth for referral rewards. The Referral Center
 * UI reads the values exposed by /api/referral (derived from this module) so
 * reward copy never drifts from what the lifecycle actually grants.
 *
 * Signup referral:  5 AI credits, granted once per verified referred account.
 * Paid referral:    25 AI credits + 1 month Pro per referred account that
 *                   becomes a paying subscriber.
 *
 * The 1-month Pro component has no safe automated fulfillment path in the
 * current entitlement architecture: profile.subscriptionTier is the
 * Stripe-synced source of truth and there is no expiring entitlement/extension
 * mechanism, so granting it automatically would corrupt Stripe-backed billing
 * state. The lifecycle records the reward as "pending_fulfillment" (auditable)
 * and a superadmin resolves it through the admin referral API. Never write a
 * referral Pro grant directly into subscriptionTier.
 */
export const REFERRAL_REWARD_CONFIG = {
  signup: {
    credits: 5,
  },
  paid: {
    credits: 25,
    pro: {
      months: 1,
      tier: "pro" as const,
      fulfillment: "superadmin_decision_required" as const,
    },
  },
  /** Referral attribution cookie lifetime until signup completes. */
  attributionCookieMaxAgeDays: 30,
  /**
   * Clicks are informational analytics: one recorded click per referral code
   * per client-IP hash per UTC day. Clicks never unlock rewards.
   */
  clickDedupe: {
    bucket: "day" as const,
    saltedIpHash: true,
  },
  /**
   * Stripe evidence required for a paid referral conversion. A referred user
   * is "paid" when the existing billing lifecycle synced an active paid
   * subscription (tier pro/business, Stripe subscription status active) from
   * checkout.session.completed (subscription mode) or
   * customer.subscription.created/updated. checkout creation, redirects,
   * client success pages, and incomplete/past-due/unpaid states never qualify.
   */
  paidEvidence: {
    activeSubscriptionStatuses: ["active"],
    paidSubscriptionTiers: ["pro", "business"],
  },
} as const;

export type ReferralPaidEvidenceTier = (typeof REFERRAL_REWARD_CONFIG.paidEvidence.paidSubscriptionTiers)[number];
