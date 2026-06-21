import {
  type CompanySetupPayload,
  computeMissingFields,
  computeSetupAccuracy,
  normalizeCompanySetupPayload,
} from "./company-setup"

export type ConfidenceLevel = "high" | "medium" | "low"

export interface CalculatedKPI {
  label: string
  value: number | null
  formattedValue: string
  confidence: ConfidenceLevel
  missingInputs?: string[]
  note?: string
}

export interface CalculationContextResult {
  profitMargin: CalculatedKPI
  netProfit: CalculatedKPI
  grossRevenue: CalculatedKPI
  operatingCosts: CalculatedKPI
  taxEstimate: CalculatedKPI
  cashFlowAvailable: CalculatedKPI
  revenueGrowth: CalculatedKPI
  confidenceSummary: {
    overallConfidence: ConfidenceLevel
    lowConfidenceCount: number
    totalKPIs: number
    warnings: string[]
  }
}

export interface ProfileCalculationLayer {
  profileInputs: {
    currency: string | null
    fiscalYearStart: string | null
    fiscalYearEnd: string | null
    riskTolerance: string | null
    targetMarginPercent: number | null
    growthTarget: string | null
  }
  uploadedDataInputs: {
    revenue: number | null
    datasetCosts: number | null
    payroll: number | null
    detectedCurrency: string | null
  }
  profileAdjustments: {
    fixedCostsAnnual: number
    insuranceAnnual: number
    employerContributionRatePercent: number | null
    employerContributionsAnnual: number | null
    taxRatePercent: number | null
  }
  kpis: {
    adjustedOperatingCosts: number | null
    profitBeforeTax: number | null
    estimatedTax: number | null
    profitAfterTax: number | null
    netMarginAfterProfileCosts: number | null
    targetMarginVariance: number | null
  }
  warnings: string[]
  conflicts: string[]
  recommendations: string[]
}

function formatCurrency(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? "-" : ""
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}K`
  return `${sign}${abs.toFixed(2)}`
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value !== "string") return null
  const cleaned = value.replace(/[^0-9,.-]/g, "").replace(/,(?=\d{3}\b)/g, "").replace(",", ".")
  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function annualAmount(monthly?: string, annual?: string): number {
  const annualValue = parseNumber(annual)
  if (annualValue !== null) return annualValue
  const monthlyValue = parseNumber(monthly)
  return monthlyValue !== null ? monthlyValue * 12 : 0
}

function average(values: number[]): number | null {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

function percent(values: Array<string | undefined>): number | null {
  const nums = values.map(parseNumber).filter((value): value is number => value !== null)
  return average(nums)
}

function sumColumnByPattern(rows: Record<string, unknown>[], patterns: RegExp[]): number | null {
  if (rows.length === 0) return null
  const columns = Object.keys(rows[0])
  const matches = columns.filter((column) => patterns.some((pattern) => pattern.test(column)))
  if (matches.length === 0) return null
  const total = rows.reduce((sum, row) => {
    return sum + matches.reduce((columnSum, column) => columnSum + (parseNumber(row[column]) ?? 0), 0)
  }, 0)
  return total || null
}

function detectCurrency(rows: Record<string, unknown>[]): string | null {
  if (rows.length === 0) return null
  const currencyColumn = Object.keys(rows[0]).find((column) => /currency|iso_currency/i.test(column))
  if (!currencyColumn) return null
  const values = rows
    .map((row) => String(row[currencyColumn] ?? "").trim().toUpperCase())
    .filter(Boolean)
  return values[0] || null
}

function detectTaxRate(rows: Record<string, unknown>[]): number | null {
  if (rows.length === 0) return null
  const taxRateColumns = Object.keys(rows[0]).filter((column) => /tax.*rate|vat.*rate|sales.*tax.*rate/i.test(column))
  const values = rows.flatMap((row) => taxRateColumns.map((column) => parseNumber(row[column])).filter((value): value is number => value !== null))
  return average(values)
}

export function buildProfileCalculationLayer({
  setup,
  rows,
  revenue,
  datasetCosts,
}: {
  setup: CompanySetupPayload
  rows: Record<string, unknown>[]
  revenue: number | null
  datasetCosts: number | null
}): ProfileCalculationLayer {
  const profile = normalizeCompanySetupPayload(setup)
  const warnings: string[] = []
  const conflicts: string[] = []
  const recommendations: string[] = []

  const fixedCostsAnnual = profile.fixedCosts.reduce((sum, item) => sum + annualAmount(item.monthlyCost, item.annualCost), 0)
  const insuranceAnnual = profile.insuranceSettings.insuranceEntries.reduce((sum, item) => sum + annualAmount(item.monthlyCost, item.annualCost), 0)
  const employerContributionRatePercent = percent(profile.employerContributions.map((item) => item.percentage))
  const payroll = sumColumnByPattern(rows, [/payroll/i, /salary/i, /salaries/i, /wage/i, /wages/i])
  const employerContributionsAnnual =
    payroll !== null && employerContributionRatePercent !== null
      ? payroll * (employerContributionRatePercent / 100)
      : null
  const taxRates = profile.taxSettings.taxEntries
    .map((entry) => parseNumber(entry.percentage))
    .filter((value): value is number => value !== null)
  const taxRatePercent = average(taxRates)
  const targetMarginPercent = parseNumber(profile.revenueModel.grossMarginTarget)
  const detectedCurrency = detectCurrency(rows)
  const detectedTaxRate = detectTaxRate(rows)

  if (!profile.currencySettings.primaryCurrency) warnings.push("Business Profile currency is missing.")
  if (!profile.companyInfo.fiscalYearStart || !profile.companyInfo.fiscalYearEnd) warnings.push("Fiscal year is missing from Business Profile.")
  if (profile.taxSettings.taxEntries.length === 0) warnings.push("Tax assumptions are missing, so after-tax profit is not estimated.")
  if (profile.insuranceSettings.insuranceEntries.length === 0) warnings.push("Insurance costs are missing, so insured operating cost may be understated.")
  if (profile.employerContributions.length === 0 && payroll !== null) warnings.push("Payroll exists in uploaded data, but employer contribution assumptions are missing.")
  if (fixedCostsAnnual === 0) warnings.push("Recurring fixed costs are missing, so cash-flow and margin analysis may be overstated.")

  if (
    detectedCurrency &&
    profile.currencySettings.primaryCurrency &&
    detectedCurrency !== profile.currencySettings.primaryCurrency.toUpperCase()
  ) {
    conflicts.push(`Uploaded data currency (${detectedCurrency}) differs from Business Profile currency (${profile.currencySettings.primaryCurrency}). Confirm which currency should be used.`)
  }

  if (detectedTaxRate !== null && taxRatePercent !== null && Math.abs(detectedTaxRate - taxRatePercent) > 0.5) {
    conflicts.push(`Uploaded tax rate (${detectedTaxRate.toFixed(2)}%) differs from Business Profile tax rate (${taxRatePercent.toFixed(2)}%). Confirm which tax rate should be used.`)
  }

  const profileCosts = fixedCostsAnnual + insuranceAnnual + (employerContributionsAnnual ?? 0)
  const adjustedOperatingCosts =
    datasetCosts !== null ? datasetCosts + profileCosts : profileCosts > 0 ? profileCosts : null
  const profitBeforeTax = revenue !== null && adjustedOperatingCosts !== null ? revenue - adjustedOperatingCosts : null
  const estimatedTax = profitBeforeTax !== null && taxRatePercent !== null ? Math.max(profitBeforeTax, 0) * (taxRatePercent / 100) : null
  const profitAfterTax = profitBeforeTax !== null ? profitBeforeTax - (estimatedTax ?? 0) : null
  const netMarginAfterProfileCosts = revenue !== null && revenue > 0 && profitAfterTax !== null ? (profitAfterTax / revenue) * 100 : null
  const targetMarginVariance =
    netMarginAfterProfileCosts !== null && targetMarginPercent !== null
      ? netMarginAfterProfileCosts - targetMarginPercent
      : null

  if (targetMarginVariance !== null && targetMarginVariance < 0) {
    recommendations.push(`Net margin after profile costs is ${Math.abs(targetMarginVariance).toFixed(1)} percentage points below target.`)
  }
  if (fixedCostsAnnual > 0) recommendations.push("Recurring fixed costs from Business Profile are included even when missing from the uploaded file.")
  if (employerContributionsAnnual !== null) recommendations.push("Payroll cost is adjusted using employer contribution percentages from Business Profile.")
  if (conflicts.length > 0) recommendations.push("Resolve Business Profile conflicts before relying on final tax, margin, or forecast outputs.")

  return {
    profileInputs: {
      currency: profile.currencySettings.primaryCurrency || null,
      fiscalYearStart: profile.companyInfo.fiscalYearStart || null,
      fiscalYearEnd: profile.companyInfo.fiscalYearEnd || null,
      riskTolerance: profile.businessGoals.riskTolerance || null,
      targetMarginPercent,
      growthTarget: profile.businessGoals.growthTarget || null,
    },
    uploadedDataInputs: { revenue, datasetCosts, payroll, detectedCurrency },
    profileAdjustments: {
      fixedCostsAnnual,
      insuranceAnnual,
      employerContributionRatePercent,
      employerContributionsAnnual,
      taxRatePercent,
    },
    kpis: {
      adjustedOperatingCosts,
      profitBeforeTax,
      estimatedTax,
      profitAfterTax,
      netMarginAfterProfileCosts,
      targetMarginVariance,
    },
    warnings,
    conflicts,
    recommendations,
  }
}

function kpi(
  label: string,
  value: number | null,
  confidence: ConfidenceLevel,
  missingInputs?: string[],
  note?: string,
): CalculatedKPI {
  return {
    label,
    value,
    formattedValue: value !== null ? formatCurrency(value) : "—",
    confidence,
    missingInputs,
    note,
  }
}

export function buildCalculationContext(
  setup: CompanySetupPayload,
  revenue: number | null,
  costs: { label: string; amount: number }[],
): CalculationContextResult {
  const missing = computeMissingFields(setup)
  const accuracy = computeSetupAccuracy(setup)

  const warnings: string[] = []
  let lowCount = 0
  const totalKPIs = 7

  function confidence(fieldKeys: string[]): { level: ConfidenceLevel; missing: string[] } {
    const missingInputs = fieldKeys.filter((k) => missing.includes(k))
    if (missingInputs.length === 0) return { level: "high", missing: [] }
    if (missingInputs.length <= 2) return { level: "medium", missing: missingInputs }
    return { level: "low", missing: missingInputs }
  }

  // Gross revenue
  const revConf = confidence(["primaryCurrency"])
  const grossRevenue = kpi(
    "Gross Revenue",
    revenue,
    revConf.level,
    revConf.missing,
    revenue === null ? "No revenue data available" : undefined,
  )
  if (grossRevenue.confidence !== "high") lowCount++

  // Operating costs
  const costConf = confidence(["expenseCategories"])
  const totalCosts = costs.reduce((sum, c) => sum + c.amount, 0)
  const operatingCosts = kpi(
    "Operating Costs",
    totalCosts || null,
    costConf.level,
    costConf.missing,
    totalCosts === 0 && costs.length === 0 ? "No cost data — results will be overestimated" : undefined,
  )
  if (operatingCosts.confidence !== "high") lowCount++

  // Net profit
  const profitConf = confidence(["expenseCategories", "revenueSources"])
  const netProfitVal = revenue !== null ? revenue - totalCosts : null
  const netProfit = kpi(
    "Net Profit",
    netProfitVal,
    profitConf.level,
    profitConf.missing,
    netProfitVal !== null && netProfitVal < 0 ? "Negative profit — costs exceed revenue" : undefined,
  )
  if (netProfit.confidence !== "high") lowCount++

  // Profit margin
  const marginConf = confidence(["expenseCategories", "revenueSources", "primaryCurrency"])
  const marginVal = revenue !== null && revenue > 0 && netProfitVal !== null
    ? Math.round((netProfitVal / revenue) * 1000) / 10
    : null
  const profitMargin = kpi(
    "Profit Margin",
    marginVal !== null ? marginVal : null,
    marginConf.level,
    marginConf.missing,
    marginVal === null ? "Cannot calculate margin without revenue data" : `${marginVal}%`,
  )
  if (profitMargin.confidence !== "high") lowCount++
  // Format margin differently
  profitMargin.formattedValue = marginVal !== null ? `${marginVal}%` : "—"

  // Tax estimate
  const taxConf = confidence(["taxRegistered", "taxType", "standardTaxRate"])
  const taxRate = setup.taxSettings.standardTaxRate
    ? parseFloat(setup.taxSettings.standardTaxRate) / 100
    : null
  const taxEstimateVal = netProfitVal !== null && taxRate !== null ? netProfitVal * taxRate : null
  const taxEstimate = kpi(
    "Estimated Tax",
    taxEstimateVal,
    taxConf.level,
    taxConf.missing,
    taxRate === null ? "Tax rate not configured — using default estimate" : `Based on ${setup.taxSettings.standardTaxRate}% rate`,
  )
  if (taxEstimate.confidence !== "high") lowCount++

  // Cash flow
  const cashConf = confidence(["expenseCategories", "revenueSources", "taxRegistered"])
  const monthlyCosts = totalCosts > 0 ? totalCosts / 12 : null
  const cashFlowVal = netProfitVal !== null && monthlyCosts !== null ? netProfitVal - monthlyCosts : null
  const cashFlowAvailable = kpi(
    "Cash Flow Available",
    cashFlowVal,
    cashConf.level,
    cashConf.missing,
    cashFlowVal !== null && cashFlowVal < 0 ? "Negative cash flow — review expenses" : undefined,
  )
  if (cashFlowAvailable.confidence !== "high") lowCount++

  // Revenue growth (from dataset, not profile)
  let revenueGrowth: CalculatedKPI
  if (revenue === null) {
    revenueGrowth = kpi(
      "Revenue Growth",
      null,
      "low",
      ["revenueSources"],
      "Upload a dataset with time-series revenue to calculate growth",
    )
    lowCount++
  } else {
    revenueGrowth = kpi(
      "Revenue Growth",
      null,
      "medium",
      [],
      "Requires multiple time periods — upload historical data for trend analysis",
    )
  }

  // Warnings
  if (accuracy < 50) {
    warnings.push("Setup accuracy is below 50% — results are preliminary")
  }
  if (missing.includes("legalStructure")) {
    warnings.push("Legal structure not set — tax and liability estimates are generic")
  }
  if (missing.includes("taxRegistered")) {
    warnings.push("Tax registration status unknown — tax estimates may be inaccurate")
  }
  if (revenue === null) {
    warnings.push("No dataset uploaded — KPIs show profile defaults only")
  }

  const overallConfidence: ConfidenceLevel =
    lowCount === 0 ? "high" : lowCount <= 2 ? "medium" : "low"

  return {
    profitMargin,
    netProfit,
    grossRevenue,
    operatingCosts,
    taxEstimate,
    cashFlowAvailable,
    revenueGrowth,
    confidenceSummary: {
      overallConfidence,
      lowConfidenceCount: lowCount,
      totalKPIs,
      warnings,
    },
  }
}

export function applyContextToKPIs(
  context: CalculationContextResult,
  externalKPIs: Record<string, number | null>,
): Record<string, { value: number | null; confidence: ConfidenceLevel; note?: string }> {
  const result: Record<string, { value: number | null; confidence: ConfidenceLevel; note?: string }> = {}

  for (const [key, externalVal] of Object.entries(externalKPIs)) {
    const ctxKPI = (context as unknown as Record<string, CalculatedKPI>)[key] as CalculatedKPI | undefined
    if (ctxKPI && ctxKPI.value !== null) {
      result[key] = {
        value: ctxKPI.value,
        confidence: ctxKPI.confidence,
        note: ctxKPI.note,
      }
    } else if (externalVal !== null) {
      // Use external value but flag confidence based on setup
      const isHighConf = context.confidenceSummary.overallConfidence === "high"
      result[key] = {
        value: externalVal,
        confidence: isHighConf ? "high" : "medium",
        note: isHighConf ? undefined : "Limited by incomplete business profile",
      }
    } else {
      result[key] = { value: null, confidence: "low", note: "No data available" }
    }
  }

  return result
}

export function confidenceBadgeClass(level: ConfidenceLevel): string {
  switch (level) {
    case "high":
      return "bg-green-500/10 text-green-600 dark:text-green-400"
    case "medium":
      return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
    case "low":
      return "bg-red-500/10 text-red-600 dark:text-red-400"
  }
}
