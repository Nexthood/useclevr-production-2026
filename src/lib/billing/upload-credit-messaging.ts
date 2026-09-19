import { FEATURE_CREDIT_COSTS } from "@/lib/billing/feature-costs"

export const STANDARD_UPLOAD_ANALYSIS_CREDITS = FEATURE_CREDIT_COSTS.STANDARD_UPLOAD_ANALYSIS

export const UPLOAD_CREDIT_LIMIT_TITLE = "Not enough credits"

export const UPLOAD_CREDIT_LIMIT_BUTTONS = {
  compare: "Compare Free vs Pro",
  pro: "Upgrade to Pro",
  business: "Business Plans",
  billing: "Add Credits",
} as const

export function normalizeUploadCreditCount(value: number | null | undefined, fallback = 0) {
  return Number.isFinite(value) && typeof value === "number" ? value : fallback
}

export function formatUploadCreditUsage(remaining: number | null | undefined) {
  return `${normalizeUploadCreditCount(remaining)} credits available`
}

export function buildUploadCreditLimitMessage() {
  return [
    `Each upload with its standard analysis uses ${STANDARD_UPLOAD_ANALYSIS_CREDITS} credits.`,
    "Successful uploads permanently consume credits.",
    "Deleting datasets does not restore credits.",
    "Upgrade to Pro or Business to continue uploading files.",
  ].join("\n\n")
}

export function buildUploadCreditLimitInlineMessage() {
  return `You don't have enough credits. Each upload with its standard analysis uses ${STANDARD_UPLOAD_ANALYSIS_CREDITS} credits. Successful uploads permanently consume credits and deleting datasets does not restore them. Upgrade to Pro or Business to continue uploading files.`
}

export function buildUploadCreditLimitCopy(input: {
  used?: number | null
  limit?: number | null
  remaining?: number | null
  tier?: string | null
} = {}) {
  const remaining = Math.max(0, normalizeUploadCreditCount(input.remaining))
  const isPaidTier = input.tier === "pro" || input.tier === "business"

  return {
    title: UPLOAD_CREDIT_LIMIT_TITLE,
    message: buildUploadCreditLimitMessage(),
    inlineMessage: buildUploadCreditLimitInlineMessage(),
    usageLabel: formatUploadCreditUsage(remaining),
    used: normalizeUploadCreditCount(input.used),
    limit: normalizeUploadCreditCount(input.limit),
    remaining,
    isPaidTier,
    ctaLabel: isPaidTier ? UPLOAD_CREDIT_LIMIT_BUTTONS.billing : UPLOAD_CREDIT_LIMIT_BUTTONS.pro,
  }
}
