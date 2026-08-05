export const UPLOAD_CREDIT_LIMIT_TITLE = "Free upload limit reached"

export const UPLOAD_CREDIT_LIMIT_BUTTONS = {
  compare: "Compare Free vs Pro",
  pro: "Upgrade to Pro",
  business: "Business Plans",
  billing: "Billing & Invoices",
} as const

export function normalizeUploadCreditCount(value: number | null | undefined, fallback = 2) {
  return Number.isFinite(value) && typeof value === "number" ? value : fallback
}

export function formatUploadCreditUsage(used: number | null | undefined, limit: number | null | undefined) {
  return `${normalizeUploadCreditCount(used)} / ${normalizeUploadCreditCount(limit)} upload credits used`
}

export function buildUploadCreditLimitMessage(limit: number | null | undefined = 2) {
  const normalizedLimit = normalizeUploadCreditCount(limit)
  return [
    `You've used all ${normalizedLimit} included upload credits.`,
    "Successful uploads permanently consume upload credits.",
    "Deleting datasets does not restore credits.",
    "Upgrade to Pro or Business to continue uploading files.",
  ].join("\n\n")
}

export function buildUploadCreditLimitInlineMessage(limit: number | null | undefined = 2) {
  const normalizedLimit = normalizeUploadCreditCount(limit)
  return `You've used all ${normalizedLimit} included upload credits. Successful uploads permanently consume upload credits. Deleting datasets does not restore credits. Upgrade to Pro or Business to continue uploading files.`
}

export function buildUploadCreditLimitCopy(input: {
  used?: number | null
  limit?: number | null
  remaining?: number | null
} = {}) {
  const limit = normalizeUploadCreditCount(input.limit)
  const used = normalizeUploadCreditCount(input.used, limit)
  const remaining = normalizeUploadCreditCount(input.remaining, 0)

  return {
    title: UPLOAD_CREDIT_LIMIT_TITLE,
    message: buildUploadCreditLimitMessage(limit),
    inlineMessage: buildUploadCreditLimitInlineMessage(limit),
    usageLabel: formatUploadCreditUsage(used, limit),
    used,
    limit,
    remaining,
  }
}
