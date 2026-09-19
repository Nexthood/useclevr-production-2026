import { getCreditAccount } from "./credit-account-service"
import { CREDIT_TOP_UPS_BILLING_HREF } from "./credit-topup-navigation"
import { normalizeSubscriptionTier } from "./plans"

export type CreditExhaustionTier = "free" | "pro" | "business"

export type CreditExhaustionActionType = "add_credits" | "upgrade"

export interface CreditExhaustionCta {
  action: CreditExhaustionActionType
  label: string
  href: string
}

export interface CreditExhaustionState {
  reason: "zero_credits" | "insufficient_credits"
  tier: CreditExhaustionTier
  usableCredits: number
  includedBalance: number
  purchasedBalance: number
  reservedCredits: number
  requiredCredits: number
  resetAt: string | null
  cta: CreditExhaustionCta
  title: string
  message: string
}

export function usableCreditsFromBalances(
  remainingCredits: number,
  reservedCredits: number,
): number {
  return Math.max(0, Math.floor(remainingCredits) - Math.max(0, Math.floor(reservedCredits)))
}

export function planUsableCredits(
  tier: string | null | undefined,
  balances: {
    remainingCredits: number
    reservedCredits: number
    includedBalance: number
  },
): number {
  // Usable credits include preserved purchased balances for every plan; the
  // plan only changes the recovery CTA (Free upgrades, paid plans top up).
  void tier
  return usableCreditsFromBalances(balances.remainingCredits, balances.reservedCredits)
}

export function resolveCreditExhaustionCta(tier: string | null | undefined): CreditExhaustionCta {
  if (normalizeSubscriptionTier(tier) === "free") {
    return {
      action: "upgrade",
      label: "Upgrade to Pro",
      href: "/app/settings/checkout?plan=pro_monthly&discount=auto",
    }
  }
  return {
    action: "add_credits",
    label: "Add Credits",
    href: CREDIT_TOP_UPS_BILLING_HREF,
  }
}

export function buildCreditExhaustionCopy(input: {
  tier: CreditExhaustionTier
  reason: CreditExhaustionState["reason"]
  usableCredits: number
  requiredCredits: number
  purchasedBalance: number
}): { title: string; message: string } {
  const { tier, reason, usableCredits, requiredCredits, purchasedBalance } = input

  if (tier === "free") {
    if (reason === "zero_credits") {
      return {
        title: "Free credits exhausted",
        message: purchasedBalance > 0
          ? "You have no usable credits left, including your preserved purchased credits. Free plans cannot purchase top-ups. Upgrade to Pro or Business to continue."
          : "You have used all your Free credits. Free plans cannot purchase top-ups. Upgrade to Pro or Business to continue.",
      }
    }
    return {
      title: "Not enough credits",
      message: `This action needs ${requiredCredits} credit${requiredCredits === 1 ? "" : "s"} but your Free plan has ${usableCredits} usable credit${usableCredits === 1 ? "" : "s"}. Free plans cannot purchase top-ups. Upgrade to Pro or Business to continue.`,
    }
  }

  if (reason === "zero_credits") {
    return {
      title: "Out of credits",
      message: "You have no usable credits left. Add credits to keep using AI actions — your plan supports top-ups.",
    }
  }

  return {
    title: "Not enough credits",
    message: `This action needs ${requiredCredits} credit${requiredCredits === 1 ? "" : "s"} but you have ${usableCredits} usable credit${usableCredits === 1 ? "" : "s"}. Add credits to continue.`,
  }
}

export async function buildCreditExhaustionState(input: {
  userId: string
  tier?: string | null
  requiredCredits?: number
}): Promise<CreditExhaustionState | null> {
  const account = await getCreditAccount(input.userId)
  if (!account) return null

  return buildCreditExhaustionStateFromUsage({
    tier: account.tier || input.tier,
    remainingCredits: account.remainingCredits,
    reservedCredits: account.reservedCredits,
    includedBalance: account.includedBalance,
    purchasedBalance: account.purchasedBalance,
    creditsResetAt: account.creditsResetAt,
    requiredCredits: input.requiredCredits,
  })
}

export function buildCreditExhaustionStateFromUsage(input: {
  tier: string | null | undefined
  remainingCredits?: number | null
  reservedCredits?: number | null
  includedBalance?: number | null
  purchasedBalance?: number | null
  availableCredits?: number | null
  creditsResetAt?: Date | string | null
  requiredCredits?: number
}): CreditExhaustionState {
  const tier = normalizeSubscriptionTier(input.tier) as CreditExhaustionTier
  const reservedCredits = Math.max(0, Math.floor(input.reservedCredits ?? 0))
  const includedBalance = Math.max(0, Math.floor(input.includedBalance ?? 0))
  const purchasedBalance = Math.max(0, Math.floor(input.purchasedBalance ?? 0))
  const requiredCredits = Math.max(0, Math.ceil(input.requiredCredits ?? 0))

  const remainingCredits =
    input.remainingCredits ?? Math.max(0, includedBalance + purchasedBalance)
  const availableFromServer = input.availableCredits ?? Math.max(0, Math.floor(remainingCredits) - reservedCredits)
  const usableCredits = planUsableCredits(tier, {
    remainingCredits: input.remainingCredits ?? availableFromServer + reservedCredits,
    reservedCredits,
    includedBalance,
  })
  const reason: CreditExhaustionState["reason"] = usableCredits <= 0 ? "zero_credits" : "insufficient_credits"
  const copy = buildCreditExhaustionCopy({
    tier,
    reason,
    usableCredits,
    requiredCredits,
    purchasedBalance,
  })

  return {
    reason,
    tier,
    usableCredits,
    includedBalance,
    purchasedBalance,
    reservedCredits,
    requiredCredits,
    resetAt: input.creditsResetAt
      ? input.creditsResetAt instanceof Date
        ? input.creditsResetAt.toISOString()
        : String(input.creditsResetAt)
      : null,
    cta: resolveCreditExhaustionCta(tier),
    title: copy.title,
    message: copy.message,
  }
}
