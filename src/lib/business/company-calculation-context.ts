import {
  type CompanySetupPayload,
  computeMissingFields,
  computeSetupAccuracy,
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

function formatCurrency(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? "-" : ""
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}K`
  return `${sign}${abs.toFixed(2)}`
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
