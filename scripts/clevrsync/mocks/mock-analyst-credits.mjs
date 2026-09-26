/**
 * In-memory replacement for `@/lib/usage/analyst-credits` used by the
 * ClevrSync entitlement behavioral tests. Tiers are keyed by test user id —
 * no database is touched. Client-supplied plan data is structurally ignored:
 * the resolver only reads the server-side session user identity fields.
 */

const USAGE_BY_USER = {
  user_free: { subscriptionTier: "free", unlimited: false },
  user_pro: { subscriptionTier: "pro", unlimited: false },
  user_business: { subscriptionTier: "business", unlimited: false },
  user_superadmin: { subscriptionTier: "superadmin", unlimited: true },
}

export const resolutionLog = []

export async function getAnalystCreditUsage(userId, role, email) {
  resolutionLog.push({ userId: userId ?? null, role: role ?? null, email: email ?? null })
  const seeded = USAGE_BY_USER[userId ?? ""]
  if (seeded) {
    return {
      analysisCount: 0,
      total: seeded.unlimited ? null : seeded.subscriptionTier === "business" ? 1500 : seeded.subscriptionTier === "pro" ? 500 : 2,
      includedBalance: seeded.unlimited ? null : 0,
      purchasedBalance: seeded.unlimited ? null : 0,
      availableCredits: seeded.unlimited ? null : 2,
      reservedCredits: 0,
      usedCredits: 0,
      remainingCredits: seeded.unlimited ? null : 2,
      nextResetAt: null,
      subscriptionTier: seeded.subscriptionTier,
      canAnalyze: true,
      limitReached: false,
      unlimited: seeded.unlimited,
      unlimitedLabel: seeded.unlimited ? "Superadmin unlimited" : null,
      trialActive: false,
      trialEndsAt: null,
      trialDaysRemaining: 0,
      datasetCount: 0,
    }
  }
  // Unknown users fail closed as Free.
  return {
    analysisCount: 0,
    total: 2,
    includedBalance: 2,
    purchasedBalance: 0,
    availableCredits: 2,
    reservedCredits: 0,
    usedCredits: 0,
    remainingCredits: 2,
    nextResetAt: null,
    subscriptionTier: "free",
    canAnalyze: true,
    limitReached: false,
    unlimited: false,
    unlimitedLabel: null,
    trialActive: false,
    trialEndsAt: null,
    trialDaysRemaining: 0,
    datasetCount: 0,
  }
}

export function resetResolutionLog() {
  resolutionLog.length = 0
}
