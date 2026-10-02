export type CanonicalRevenueGrowthStatus = "available" | "insufficient_data" | "zero_baseline"

export type CanonicalRevenueGrowthPeriod = {
  period: string
  revenue: number | null
  firstDate?: string | null
  lastDate?: string | null
  isComplete?: boolean | null
}

export type CanonicalRevenueGrowthResult = {
  value: number | null
  status: CanonicalRevenueGrowthStatus
  currentPeriod: string | null
  previousPeriod: string | null
  currentRevenue: number | null
  previousRevenue: number | null
  comparisonType: "latest_complete_month_vs_previous_complete_month"
  reason: string | null
}

export type RevenueGrowthReportingContext = {
  reportingStart?: string | null
  reportingEnd?: string | null
}

export function resolveCanonicalRevenueGrowth(
  periodTrends: CanonicalRevenueGrowthPeriod[],
  reportingContext: RevenueGrowthReportingContext = {},
): CanonicalRevenueGrowthResult {
  const periods = periodTrends
    .filter((period) => period.period && period.revenue !== null && Number.isFinite(period.revenue))
    .map((period) => ({
      ...period,
      revenue: period.revenue as number,
      normalizedPeriod: normalizeMonthPeriod(period.period),
    }))
    .filter((period) => period.normalizedPeriod !== null)
    .sort((a, b) => (a.normalizedPeriod as string).localeCompare(b.normalizedPeriod as string))

  const completePeriods = periods.filter((period) => isComparableCompleteMonth(period, reportingContext))
  if (completePeriods.length < 2) {
    return unavailable("insufficient_data", "Requires two comparable periods.")
  }

  const current = completePeriods[completePeriods.length - 1]
  const previous = completePeriods[completePeriods.length - 2]
  if (previous.revenue === 0) {
    return {
      value: null,
      status: "zero_baseline",
      currentPeriod: current.normalizedPeriod,
      previousPeriod: previous.normalizedPeriod,
      currentRevenue: round(current.revenue),
      previousRevenue: round(previous.revenue),
      comparisonType: "latest_complete_month_vs_previous_complete_month",
      reason: "Previous comparable period revenue is zero.",
    }
  }

  return {
    value: round(((current.revenue - previous.revenue) / Math.abs(previous.revenue)) * 100),
    status: "available",
    currentPeriod: current.normalizedPeriod,
    previousPeriod: previous.normalizedPeriod,
    currentRevenue: round(current.revenue),
    previousRevenue: round(previous.revenue),
    comparisonType: "latest_complete_month_vs_previous_complete_month",
    reason: null,
  }
}

export function buildMonthlyRevenueGrowthPeriods(
  records: Array<{ date: string | null; amount: number }>,
): { periods: CanonicalRevenueGrowthPeriod[]; reportingStart: string | null; reportingEnd: string | null } {
  const monthly = new Map<string, { revenue: number; firstDate: string | null; lastDate: string | null }>()
  let reportingStart: string | null = null
  let reportingEnd: string | null = null

  for (const record of records) {
    if (!record.date) continue
    const month = normalizeMonthPeriod(record.date)
    if (!month || !Number.isFinite(record.amount)) continue
    const day = normalizeIsoDay(record.date)
    const bucket: { revenue: number; firstDate: string | null; lastDate: string | null } =
      monthly.get(month) || { revenue: 0, firstDate: null, lastDate: null }
    bucket.revenue += record.amount
    if (day) {
      bucket.firstDate = bucket.firstDate === null || day < bucket.firstDate ? day : bucket.firstDate
      bucket.lastDate = bucket.lastDate === null || day > bucket.lastDate ? day : bucket.lastDate
      if (reportingStart === null || day.localeCompare(reportingStart) < 0) reportingStart = day
      if (reportingEnd === null || day.localeCompare(reportingEnd) > 0) reportingEnd = day
    }
    monthly.set(month, bucket)
  }

  return {
    periods: Array.from(monthly.entries()).map(([period, bucket]) => ({
      period,
      revenue: round(bucket.revenue),
      firstDate: bucket.firstDate,
      lastDate: bucket.lastDate,
    })),
    reportingStart,
    reportingEnd,
  }
}

export function revenueGrowthDisplayDetail(result: CanonicalRevenueGrowthResult) {
  if (result.status === "available") return "Latest comparable month vs previous comparable month"
  return result.reason || "Not available"
}

function isComparableCompleteMonth(
  period: CanonicalRevenueGrowthPeriod & { normalizedPeriod: string | null },
  context: RevenueGrowthReportingContext,
) {
  if (period.isComplete === true) return true
  if (period.isComplete === false) return false
  const month = period.normalizedPeriod
  if (!month) return false

  const reportingStart = normalizeIsoDay(context.reportingStart)
  const reportingEnd = normalizeIsoDay(context.reportingEnd)
  const monthStart = `${month}-01`
  const monthEnd = endOfMonth(month)
  if (!monthEnd) return false
  if (reportingStart && reportingStart.slice(0, 7) === month && reportingStart !== monthStart) return false
  if (reportingEnd && reportingEnd.slice(0, 7) === month && reportingEnd !== monthEnd) return false
  return true
}

function normalizeMonthPeriod(value: string) {
  const text = String(value || "").trim()
  const match = text.match(/^(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?$/)
  if (!match) return null
  return `${match[1]}-${match[2].padStart(2, "0")}`
}

function normalizeIsoDay(value: string | null | undefined) {
  if (!value) return null
  const match = String(value).trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (!match) return null
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`
}

function endOfMonth(month: string) {
  const match = month.match(/^(\d{4})-(\d{2})$/)
  if (!match) return null
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]), 0))
  return `${match[1]}-${match[2]}-${String(date.getUTCDate()).padStart(2, "0")}`
}

function unavailable(status: Exclude<CanonicalRevenueGrowthStatus, "available">, reason: string): CanonicalRevenueGrowthResult {
  return {
    value: null,
    status,
    currentPeriod: null,
    previousPeriod: null,
    currentRevenue: null,
    previousRevenue: null,
    comparisonType: "latest_complete_month_vs_previous_complete_month",
    reason,
  }
}

function round(value: number) {
  return Math.round(value * 100) / 100
}
