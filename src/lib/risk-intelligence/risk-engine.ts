import {
  isPrebookkeepingCategorization,
  normalizePrebookkeepingCategorization,
  type CategorizedTransaction,
  type PrebookkeepingCategorization,
} from "@/lib/accountancy/prebookkeeping-categorization"
import { formatCanonicalIsoTimestamp, parseCanonicalDate, periodKeyFromDate } from "@/lib/data/canonical-date"
import {
  buildBusinessSemanticProfile,
  conceptColumn,
  type BusinessConcept,
  type SemanticProfile,
} from "@/lib/data/business-semantics"
import {
  getSeverityForScore,
  RISK_ENGINE_VERSION,
  RISK_RULES,
  RISK_SEVERITY_LABELS,
  RISK_SEVERITY_RANK,
  SUPPORTED_RISK_DATASET_TYPES,
  thresholdMatches,
  type RiskCategory,
  type RiskMetricKey,
  type RiskRule,
  type RiskSemanticDatasetType,
  type RiskSeverity,
  type RiskThreshold,
} from "@/lib/risk-intelligence/risk-rules"

export type RiskDataRow = Record<string, unknown>

export type RiskDatasetInput = {
  id: string
  name: string
  fileName?: string | null
  datasetType?: string | null
  businessModel?: string | null
  columns?: string[] | null
  rowCount?: number | null
  createdAt?: Date | string | null
  updatedAt?: Date | string | null
  precomputedMetrics?: unknown
  detectedColumns?: unknown
  analysis?: unknown
}

export type RiskMetric = {
  value: number | null
  unit: "percent" | "count" | "score"
  available: boolean
  source: string
  details?: Record<string, unknown>
}

export type RiskFinding = {
  ruleId: string
  category: RiskCategory
  title: string
  description: string
  severity: RiskSeverity
  severityLabel: string
  score: number
  weight: number
  metric: RiskMetricKey
  metricValue: number
  metricUnit: RiskMetric["unit"]
  threshold: RiskThreshold
  recommendation: string
  sourceLabel: string
  sourceHref: string
  estimatedImpact: number
}

export type RiskCategorySummary = {
  category: RiskCategory
  label: string
  score: number
  severity: RiskSeverity
  applicableRuleCount: number
  triggeredRuleCount: number
}

export type RiskNotApplicableRule = {
  ruleId: string
  title: string
  category: RiskCategory
  reason: string
}

export type RiskIntelligenceResult = {
  engineVersion: string
  dataset: {
    id: string
    name: string
    fileName: string | null
    datasetType: string
    semanticDatasetType: RiskSemanticDatasetType
    semanticConfidence: string
    businessModel: string
    rowCount: number
    sourceHref: string
  }
  calculatedAt: string
  scope: string
  overallScore: number
  overallSeverity: RiskSeverity
  overallSeverityLabel: string
  severityCounts: Record<RiskSeverity, number>
  categorySummaries: RiskCategorySummary[]
  findings: RiskFinding[]
  notApplicableRules: RiskNotApplicableRule[]
  metrics: Record<RiskMetricKey, RiskMetric>
  missingMetrics: RiskMetricKey[]
  trendComparison: string
}

export const RISK_CATEGORY_LABELS: Record<RiskCategory, string> = {
  inventory: "Inventory Risk",
  financial: "Financial Risk",
  profitability: "Profitability Risk",
  cash_flow: "Cash Flow Risk",
  revenue_concentration: "Revenue Concentration Risk",
  data_quality: "Data Quality Risk",
}

const CATEGORY_ORDER: RiskCategory[] = [
  "inventory",
  "financial",
  "profitability",
  "cash_flow",
  "revenue_concentration",
  "data_quality",
]

export function calculateRiskIntelligence(dataset: RiskDatasetInput, rows: RiskDataRow[]): RiskIntelligenceResult | null {
  const datasetType = normalizeDatasetType(dataset.datasetType)
  const bookkeepingRisk = datasetType === "prebookkeeping" ? calculatePrebookkeepingRiskIntelligence(dataset) : null
  if (bookkeepingRisk) return bookkeepingRisk

  const normalizedRows = rows.filter(isRecord)
  const columns = getColumns(dataset.columns, normalizedRows)

  if (!isSupportedRiskDatasetType(datasetType) || columns.length === 0 || normalizedRows.length === 0) {
    return null
  }

  const profile = buildBusinessSemanticProfile({
    datasetId: dataset.id,
    datasetType: dataset.datasetType,
    businessModel: dataset.businessModel,
    fileName: dataset.fileName ?? null,
    datasetName: dataset.name,
    columns,
    rows: normalizedRows,
  })
  const semanticType = normalizeRiskSemanticType(profile)

  const derived = deriveRiskMetrics({
    rows: normalizedRows,
    columns,
    profile,
  })

  const applicableRules = RISK_RULES.filter((rule) =>
    rule.supportedDatasetTypes.includes(semanticType) &&
    rule.requiredConcepts.every((concept) => resolveConceptColumn(profile, concept) !== null),
  )
  const evaluated = applicableRules.map((rule) => evaluateRule(rule, derived.metrics[rule.metric]))
  const applicableEvaluations = evaluated.filter((item) => item.metric.available && item.metric.value !== null)
  const findings = applicableEvaluations
    .filter((item) => item.threshold)
    .map((item) => {
      const threshold = item.threshold as RiskThreshold
      const score = clampScore(threshold.score)
      return {
        ruleId: item.rule.ruleId,
        category: item.rule.category,
        title: item.rule.title,
        description: item.rule.description,
        severity: threshold.severity,
        severityLabel: RISK_SEVERITY_LABELS[threshold.severity],
        score,
        weight: item.rule.weight,
        metric: item.rule.metric,
        metricValue: roundMetric(item.metric.value ?? 0),
        metricUnit: item.metric.unit,
        threshold,
        recommendation: item.rule.recommendationTemplate,
        sourceLabel: item.rule.sourceTemplate,
        sourceHref: getDatasetSourceHref(dataset.id, datasetType),
        estimatedImpact: Math.round(score * item.rule.weight),
      } satisfies RiskFinding
    })
    .sort(compareFindings)

  const notApplicableRules = buildNotApplicableRules({
    evaluatedRuleIds: new Set(applicableEvaluations.map((item) => item.rule.ruleId)),
    metrics: derived.metrics,
    profile,
  })

  const categorySummaries = buildCategorySummaries(applicableEvaluations)
  const overallScore = calculateWeightedScore(applicableEvaluations)
  const overallSeverity = getSeverityForScore(overallScore)

  return {
    engineVersion: RISK_ENGINE_VERSION,
    dataset: {
      id: dataset.id,
      name: dataset.name,
      fileName: dataset.fileName || null,
      datasetType,
      semanticDatasetType: semanticType,
      semanticConfidence: profile.classificationConfidence,
      businessModel: dataset.businessModel || "generic",
      rowCount: dataset.rowCount ?? normalizedRows.length,
      sourceHref: getDatasetSourceHref(dataset.id, datasetType),
    },
    calculatedAt: serverTimestamp(),
    scope: `Single ${getDatasetTypeLabel(semanticType)} dataset`,
    overallScore,
    overallSeverity,
    overallSeverityLabel: RISK_SEVERITY_LABELS[overallSeverity],
    severityCounts: countSeverities(findings),
    categorySummaries,
    findings,
    notApplicableRules,
    metrics: derived.metrics,
    missingMetrics: Object.entries(derived.metrics)
      .filter(([, metric]) => !metric.available)
      .map(([metric]) => metric as RiskMetricKey),
    trendComparison: derived.hasComparableHistory ? derived.trendComparison : "No previous comparison available.",
  }
}

export function calculatePrebookkeepingRiskIntelligence(dataset: RiskDatasetInput): RiskIntelligenceResult | null {
  const analysis: Record<string, unknown> | null = isRecord(dataset.analysis)
    ? dataset.analysis
    : null
  const categorizationValue = analysis?.prebookkeepingCategorization
  if (!isPrebookkeepingCategorization(categorizationValue)) return null

  const categorization = normalizePrebookkeepingCategorization(categorizationValue)
  const transactions = categorization.transactions
  if (transactions.length === 0) return null

  const findings = buildPrebookkeepingFindings(dataset, categorization)
  const categorySummaries = buildPrebookkeepingCategorySummaries(findings)
  const overallScore = findings.length > 0
    ? clampScore(Math.round(findings.reduce((sum, finding) => sum + finding.score * finding.weight, 0) / findings.reduce((sum, finding) => sum + finding.weight, 0)))
    : 0
  const overallSeverity = getSeverityForScore(overallScore)

  return {
    engineVersion: RISK_ENGINE_VERSION,
    dataset: {
      id: dataset.id,
      name: dataset.name,
      fileName: dataset.fileName || null,
      datasetType: "prebookkeeping",
      semanticDatasetType: "prebookkeeping",
      semanticConfidence: "HIGH",
      businessModel: dataset.businessModel || "bookkeeping",
      rowCount: dataset.rowCount ?? transactions.length,
      sourceHref: getDatasetSourceHref(dataset.id, "prebookkeeping"),
    },
    calculatedAt: serverTimestamp(),
    scope: "Single Pre-bookkeeping dataset",
    overallScore,
    overallSeverity,
    overallSeverityLabel: RISK_SEVERITY_LABELS[overallSeverity],
    severityCounts: countSeverities(findings),
    categorySummaries,
    findings,
    notApplicableRules: [],
    metrics: {
      deadStockRatio: metricFromValue(null, "percent", "Not applicable to bookkeeping"),
      revenueGrowthPct: metricFromValue(null, "percent", "Bookkeeping categorization"),
      grossMarginTrendPct: metricFromValue(null, "percent", "Bookkeeping categorization"),
      netMarginPct: metricFromValue(calculateBookkeepingNetMargin(categorization), "percent", "Bookkeeping income and expense summary"),
      unprofitableProductRatio: metricFromValue(null, "percent", "Not applicable to bookkeeping"),
      costRevenueGrowthGapPct: metricFromValue(null, "percent", "Bookkeeping categorization"),
      expenseRevenueRatio: metricFromValue(calculateBookkeepingExpenseRevenueRatio(categorization), "percent", "Bookkeeping income and expense summary"),
      topProductRevenueShare: metricFromValue(null, "percent", "Not applicable to bookkeeping"),
      topCategoryRevenueShare: metricFromValue(calculateTopExpenseCategoryShare(transactions), "percent", "Bookkeeping category summary"),
      topCustomerRevenueShare: metricFromValue(calculateSupplierConcentrationShare(transactions), "percent", "Bookkeeping supplier summary"),
      topPortfolioCompanyRevenueShare: metricFromValue(null, "percent", "Not applicable to bookkeeping"),
      portfolioRunwayBreachRatio: metricFromValue(null, "percent", "Not applicable to bookkeeping"),
      runwayMonths: metricFromValue(null, "percent", "Not applicable to bookkeeping"),
      missingValueRatio: metricFromValue(calculateBookkeepingMissingDataRatio(transactions), "percent", "Bookkeeping review queue"),
      invalidNumericRatio: metricFromValue(null, "percent", "Bookkeeping parser validation"),
      invalidDateRatio: metricFromValue(calculateBookkeepingMissingDateRatio(transactions), "percent", "Bookkeeping transaction dates"),
      duplicateRowRatio: metricFromValue(calculateBookkeepingDuplicateRatio(transactions), "percent", "Bookkeeping duplicate review"),
      currencyInconsistencyRatio: metricFromValue(calculateBookkeepingCurrencyInconsistencyRatio(transactions), "percent", "Bookkeeping transaction currencies"),
      classificationConfidence: metricFromValue(categorization.reviewSummary.confidenceScore, "score", "Accounting AI categorization confidence"),
      historyPeriodCount: metricFromValue(calculateBookkeepingPeriodCount(transactions), "count", "Bookkeeping transaction dates"),
    },
    missingMetrics: [],
    trendComparison: "Bookkeeping risk uses the current reviewed transaction set.",
  }
}

function buildPrebookkeepingFindings(dataset: RiskDatasetInput, categorization: PrebookkeepingCategorization): RiskFinding[] {
  const transactions = categorization.transactions
  const sourceHref = getDatasetSourceHref(dataset.id, "prebookkeeping")
  const findings: RiskFinding[] = []
  const addFinding = (finding: Omit<RiskFinding, "sourceHref" | "severityLabel" | "estimatedImpact">) => {
    findings.push({
      ...finding,
      sourceHref,
      severityLabel: RISK_SEVERITY_LABELS[finding.severity],
      estimatedImpact: Math.round(finding.score * finding.weight),
    })
  }
  const total = Math.max(transactions.length, 1)
  const duplicateRows = transactions.filter((transaction) => transaction.duplicateStatus === "possible_duplicate").length
  const missingVatRows = transactions.filter((transaction) => transaction.vatStatus === "missing" || transaction.vatNeedsReview).length
  const uncategorizedRows = transactions.filter((transaction) => transaction.category === "uncategorized").length
  const missingSupplierRows = transactions.filter((transaction) => !transaction.supplierCustomer).length
  const largeExpenses = transactions.filter((transaction) => transaction.isLargeTransaction && (transaction.amount ?? 0) < 0)
  const supplierConcentration = calculateSupplierConcentrationShare(transactions)
  const expenseRatio = calculateBookkeepingExpenseRevenueRatio(categorization)

  if (duplicateRows > 0) {
    const ratio = (duplicateRows / total) * 100
    addFinding({
      ruleId: "bookkeeping.duplicate_payments.v1",
      category: "data_quality",
      title: "Possible duplicate payments",
      description: `${duplicateRows.toLocaleString()} transaction(s) are marked as possible duplicates.`,
      severity: ratio >= 10 ? "high" : "medium",
      score: ratio >= 10 ? 72 : 45,
      weight: 1,
      metric: "duplicateRowRatio",
      metricValue: roundMetric(ratio),
      metricUnit: "percent",
      threshold: { severity: ratio >= 10 ? "high" : "medium", operator: ">=", value: ratio >= 10 ? 10 : 1, score: ratio >= 10 ? 72 : 45 },
      recommendation: "Review duplicate payments before exporting the bookkeeping package.",
      sourceLabel: "Duplicate review queue",
    })
  }

  if (missingVatRows > 0) {
    const ratio = (missingVatRows / total) * 100
    addFinding({
      ruleId: "bookkeeping.vat_review.v1",
      category: "financial",
      title: "VAT review required",
      description: `${missingVatRows.toLocaleString()} transaction(s) still need VAT confirmation.`,
      severity: ratio >= 25 ? "high" : "medium",
      score: ratio >= 25 ? 70 : 44,
      weight: 1.1,
      metric: "missingValueRatio",
      metricValue: roundMetric(ratio),
      metricUnit: "percent",
      threshold: { severity: ratio >= 25 ? "high" : "medium", operator: ">=", value: ratio >= 25 ? 25 : 1, score: ratio >= 25 ? 70 : 44 },
      recommendation: "Complete VAT review before sending records to the accountant.",
      sourceLabel: "VAT review status",
    })
  }

  if (uncategorizedRows > 0 || missingSupplierRows > 0) {
    const affectedRows = uncategorizedRows + missingSupplierRows
    const ratio = (affectedRows / total) * 100
    addFinding({
      ruleId: "bookkeeping.missing_classification.v1",
      category: "data_quality",
      title: "Missing bookkeeping details",
      description: `${affectedRows.toLocaleString()} transaction detail(s) are uncategorized or missing supplier information.`,
      severity: ratio >= 20 ? "high" : "medium",
      score: ratio >= 20 ? 68 : 40,
      weight: 0.95,
      metric: "classificationConfidence",
      metricValue: categorization.reviewSummary.confidenceScore,
      metricUnit: "score",
      threshold: { severity: ratio >= 20 ? "high" : "medium", operator: ">=", value: ratio >= 20 ? 20 : 1, score: ratio >= 20 ? 68 : 40 },
      recommendation: "Review uncategorized transactions and missing suppliers so the export is accountant-ready.",
      sourceLabel: "Accounting AI review queue",
    })
  }

  if (largeExpenses.length > 0) {
    addFinding({
      ruleId: "bookkeeping.large_expenses.v1",
      category: "cash_flow",
      title: "Large expense transactions",
      description: `${largeExpenses.length.toLocaleString()} large withdrawal or expense transaction(s) need review.`,
      severity: largeExpenses.length >= 5 ? "high" : "medium",
      score: largeExpenses.length >= 5 ? 66 : 38,
      weight: 0.9,
      metric: "expenseRevenueRatio",
      metricValue: roundMetric(calculateBookkeepingExpenseRevenueRatio(categorization) ?? largeExpenses.length),
      metricUnit: "percent",
      threshold: { severity: largeExpenses.length >= 5 ? "high" : "medium", operator: ">=", value: largeExpenses.length >= 5 ? 5 : 1, score: largeExpenses.length >= 5 ? 66 : 38 },
      recommendation: "Check large withdrawals against invoices, receipts, and supplier agreements.",
      sourceLabel: "Large transaction filter",
    })
  }

  if (supplierConcentration !== null && supplierConcentration >= 35) {
    addFinding({
      ruleId: "bookkeeping.supplier_concentration.v1",
      category: "revenue_concentration",
      title: "Supplier concentration risk",
      description: `The largest supplier represents ${roundMetric(supplierConcentration)}% of expense value.`,
      severity: supplierConcentration >= 60 ? "high" : "medium",
      score: supplierConcentration >= 60 ? 72 : 45,
      weight: 0.85,
      metric: "topCustomerRevenueShare",
      metricValue: roundMetric(supplierConcentration),
      metricUnit: "percent",
      threshold: { severity: supplierConcentration >= 60 ? "high" : "medium", operator: ">=", value: supplierConcentration >= 60 ? 60 : 35, score: supplierConcentration >= 60 ? 72 : 45 },
      recommendation: "Review supplier dependency and confirm recurring or unusually large supplier spend.",
      sourceLabel: "Supplier expense concentration",
    })
  }

  if (expenseRatio !== null && expenseRatio >= 100) {
    addFinding({
      ruleId: "bookkeeping.expenses_exceed_income.v1",
      category: "cash_flow",
      title: "Expenses exceed income",
      description: `Detected expenses are ${roundMetric(expenseRatio)}% of detected income.`,
      severity: expenseRatio >= 120 ? "critical" : "high",
      score: expenseRatio >= 120 ? 90 : 72,
      weight: 1.2,
      metric: "expenseRevenueRatio",
      metricValue: roundMetric(expenseRatio),
      metricUnit: "percent",
      threshold: { severity: expenseRatio >= 120 ? "critical" : "high", operator: ">=", value: expenseRatio >= 120 ? 120 : 100, score: expenseRatio >= 120 ? 90 : 72 },
      recommendation: "Confirm that income and expense periods match before sending the summary to the accountant.",
      sourceLabel: "Bookkeeping summary",
    })
  }

  return findings.sort(compareFindings)
}

function buildPrebookkeepingCategorySummaries(findings: RiskFinding[]): RiskCategorySummary[] {
  return CATEGORY_ORDER.map((category) => {
    const categoryFindings = findings.filter((finding) => finding.category === category)
    const score = categoryFindings.length > 0
      ? clampScore(Math.round(categoryFindings.reduce((sum, finding) => sum + finding.score, 0) / categoryFindings.length))
      : 0
    return {
      category,
      label: RISK_CATEGORY_LABELS[category],
      score,
      severity: getSeverityForScore(score),
      applicableRuleCount: category === "inventory" || category === "profitability" ? 0 : 1,
      triggeredRuleCount: categoryFindings.length,
    }
  }).filter((summary) => summary.applicableRuleCount > 0 || summary.triggeredRuleCount > 0)
}

function calculateBookkeepingNetMargin(categorization: PrebookkeepingCategorization) {
  const income = categorization.incomeTotal
  if (income <= 0) return null
  return ((income - categorization.expenseTotal) / income) * 100
}

function calculateBookkeepingExpenseRevenueRatio(categorization: PrebookkeepingCategorization) {
  if (categorization.incomeTotal <= 0) return categorization.expenseTotal > 0 ? 100 : null
  return (categorization.expenseTotal / categorization.incomeTotal) * 100
}

function calculateTopExpenseCategoryShare(transactions: CategorizedTransaction[]) {
  const groups = new Map<string, number>()
  let total = 0
  for (const transaction of transactions) {
    if ((transaction.amount ?? 0) >= 0) continue
    const value = Math.abs(transaction.amount ?? transaction.debit ?? 0)
    if (value <= 0) continue
    total += value
    groups.set(transaction.category, (groups.get(transaction.category) || 0) + value)
  }
  if (total <= 0 || groups.size === 0) return null
  return (Math.max(...groups.values()) / total) * 100
}

function calculateSupplierConcentrationShare(transactions: CategorizedTransaction[]) {
  const groups = new Map<string, number>()
  let total = 0
  for (const transaction of transactions) {
    if ((transaction.amount ?? 0) >= 0 || !transaction.supplierCustomer) continue
    const value = Math.abs(transaction.amount ?? transaction.debit ?? 0)
    if (value <= 0) continue
    total += value
    const supplier = transaction.supplierCustomer.toLowerCase().replace(/\s+/g, " ").trim()
    groups.set(supplier, (groups.get(supplier) || 0) + value)
  }
  if (total <= 0 || groups.size === 0) return null
  return (Math.max(...groups.values()) / total) * 100
}

function calculateBookkeepingMissingDataRatio(transactions: CategorizedTransaction[]) {
  if (transactions.length === 0) return null
  const checks = transactions.length * 4
  const missing = transactions.reduce((sum, transaction) => {
    return sum +
      (transaction.transactionDate ? 0 : 1) +
      (transaction.description ? 0 : 1) +
      (transaction.supplierCustomer ? 0 : 1) +
      (transaction.category === "uncategorized" ? 1 : 0)
  }, 0)
  return (missing / checks) * 100
}

function calculateBookkeepingMissingDateRatio(transactions: CategorizedTransaction[]) {
  if (transactions.length === 0) return null
  return (transactions.filter((transaction) => !transaction.transactionDate).length / transactions.length) * 100
}

function calculateBookkeepingDuplicateRatio(transactions: CategorizedTransaction[]) {
  if (transactions.length === 0) return null
  return (transactions.filter((transaction) => transaction.duplicateStatus === "possible_duplicate").length / transactions.length) * 100
}

function calculateBookkeepingCurrencyInconsistencyRatio(transactions: CategorizedTransaction[]) {
  const currencies = transactions.map((transaction) => transaction.currency?.trim().toUpperCase()).filter(Boolean) as string[]
  if (currencies.length === 0) return null
  const dominant = Math.max(...Object.values(countValues(currencies)))
  return ((currencies.length - dominant) / currencies.length) * 100
}

function calculateBookkeepingPeriodCount(transactions: CategorizedTransaction[]) {
  const periods = new Set<string>()
  for (const transaction of transactions) {
    const date = parseCanonicalDate(transaction.transactionDate)
    if (!date) continue
    periods.add(periodKeyFromDate(date))
  }
  return periods.size
}

function normalizeRiskSemanticType(profile: SemanticProfile): RiskSemanticDatasetType {
  const type = profile.datasetType
  if (
    type === "standard" ||
    type === "retail" ||
    type === "profitability" ||
    type === "accountancy" ||
    type === "prebookkeeping" ||
    type === "marketplace" ||
    type === "saas" ||
    type === "investor"
  ) {
    return type
  }
  return "standard"
}

const NUMERIC_CONCEPTS = new Set<BusinessConcept>([
  "quantity",
  "gross_sales",
  "net_sales",
  "units_sold",
  "inventory_on_hand",
  "inventory_value",
  "unit_cost",
  "selling_price",
  "discount",
  "reorder_point",
  "revenue",
  "cogs",
  "gross_profit",
  "operating_expense",
  "operating_profit",
  "interest_expense",
  "tax",
  "net_profit",
  "debit",
  "credit",
  "opening_balance",
  "closing_balance",
  "gmv",
  "marketplace_revenue",
  "merchant_payout",
  "refund",
  "commission",
  "mrr",
  "arr",
  "subscription_revenue",
  "new_mrr",
  "expansion_mrr",
  "contraction_mrr",
  "churned_mrr",
  "active_customers",
  "new_customers",
  "churned_customers",
  "customer_churn_rate",
  "revenue_churn_rate",
  "burn",
  "cash_balance",
  "runway",
  "arpu",
  "portfolio_company_annual_revenue",
  "invested_amount",
  "entry_valuation",
  "latest_valuation",
  "ownership_percent",
  "portfolio_company_growth_rate",
  "portfolio_company_monthly_burn",
  "portfolio_company_runway",
  "portfolio_company_employees",
])

const DATE_LIKE_CONCEPTS: BusinessConcept[] = ["date", "journal_date", "investment_date"]

function resolveConceptColumn(profile: SemanticProfile, concept: string): string | null {
  switch (concept) {
    case "date":
      return conceptColumn(profile, "date") || conceptColumn(profile, "journal_date")
    case "customer":
      return conceptColumn(profile, "customer") || conceptColumn(profile, "customer_id")
    case "product":
      return conceptColumn(profile, "product") || conceptColumn(profile, "sku")
    case "units_sold":
      return conceptColumn(profile, "units_sold") || conceptColumn(profile, "quantity")
    case "revenue":
      return resolveTrendRevenueColumn(profile)
    default:
      return conceptColumn(profile, concept as BusinessConcept)
  }
}

function resolveTrendRevenueColumn(profile: SemanticProfile): string | null {
  return (
    conceptColumn(profile, "revenue") ||
    conceptColumn(profile, "net_sales") ||
    conceptColumn(profile, "gross_sales") ||
    conceptColumn(profile, "subscription_revenue")
  )
}

function deriveRiskMetrics(input: {
  rows: RiskDataRow[]
  columns: string[]
  profile: SemanticProfile
}): { metrics: Record<RiskMetricKey, RiskMetric>; hasComparableHistory: boolean; trendComparison: string } {
  const { rows, columns, profile } = input
  const revenueColumn = resolveTrendRevenueColumn(profile)
  const costColumns = unique([
    conceptColumn(profile, "cogs"),
    conceptColumn(profile, "operating_expense"),
  ].filter(Boolean) as string[])
  const productColumn = resolveConceptColumn(profile, "product")
  const dateColumn = resolveConceptColumn(profile, "date")
  const stockColumn = conceptColumn(profile, "inventory_on_hand")
  const soldColumn = resolveConceptColumn(profile, "units_sold")
  const categoryColumn = conceptColumn(profile, "category")
  const customerColumn = resolveConceptColumn(profile, "customer")
  const currencyColumn = conceptColumn(profile, "currency")
  const portfolioCompanyColumn = conceptColumn(profile, "portfolio_company")
  const portfolioRevenueColumn = conceptColumn(profile, "portfolio_company_annual_revenue")
  const portfolioRunwayColumn = conceptColumn(profile, "portfolio_company_runway")
  const cashBalanceColumn = conceptColumn(profile, "cash_balance")
  const burnColumn = conceptColumn(profile, "burn")

  const revenueSeries = dateColumn && revenueColumn ? groupByPeriod(rows, dateColumn, revenueColumn) : []
  const costSeries = dateColumn && costColumns.length > 0 ? groupByPeriod(rows, dateColumn, costColumns) : []
  const profitSeries =
    dateColumn && revenueColumn && costColumns.length > 0
      ? revenueSeries.map((period) => {
          const matchingCost = costSeries.find((item) => item.period === period.period)?.value ?? 0
          return { period: period.period, value: period.value - matchingCost, basis: period.value }
        })
      : []

  const revenueGrowthPct = getLatestGrowth(revenueSeries)
  const latestGrossMargin = getLatestMargin(profitSeries)
  const previousGrossMargin = getPreviousMargin(profitSeries)
  const grossMarginTrendPct =
    latestGrossMargin !== null && previousGrossMargin !== null ? latestGrossMargin - previousGrossMargin : null
  const costGrowthPct = getLatestGrowth(costSeries)
  const costRevenueGrowthGapPct =
    costGrowthPct !== null && revenueGrowthPct !== null ? costGrowthPct - revenueGrowthPct : null

  const totalRevenue = sumColumn(rows, revenueColumn)
  const totalCosts = sumColumns(rows, costColumns)
  const netMarginPct =
    totalRevenue !== null && totalCosts !== null && totalRevenue > 0 ? ((totalRevenue - totalCosts) / totalRevenue) * 100 : null
  const expenseRevenueRatio =
    totalRevenue !== null && totalCosts !== null && totalRevenue > 0 ? (totalCosts / totalRevenue) * 100 : null

  const runwayMonths = calculateRunwayMonths(rows, cashBalanceColumn, burnColumn)
  const mappedNumericColumns = mappedConceptColumnsForConcepts(profile, NUMERIC_CONCEPTS)
  const dateLikeColumns = DATE_LIKE_CONCEPTS
    .map((concept) => conceptColumn(profile, concept))
    .filter(Boolean) as string[]
  const classificationConfidence = calculateClassificationConfidence(profile, columns)

  const metrics: Record<RiskMetricKey, RiskMetric> = {
    deadStockRatio: metricFromValue(
      calculateDeadStockRatio(rows, productColumn, stockColumn, soldColumn),
      "percent",
      "Mapped inventory columns",
    ),
    revenueGrowthPct: metricFromValue(revenueGrowthPct, "percent", "Validated revenue trend KPI"),
    grossMarginTrendPct: metricFromValue(grossMarginTrendPct, "percent", "Validated gross margin trend KPI"),
    netMarginPct: metricFromValue(netMarginPct, "percent", "Validated revenue and cost columns"),
    unprofitableProductRatio: metricFromValue(
      calculateUnprofitableProductRatio(rows, productColumn, revenueColumn, costColumns),
      "percent",
      "Mapped product profitability breakdown",
    ),
    costRevenueGrowthGapPct: metricFromValue(costRevenueGrowthGapPct, "percent", "Validated revenue and cost trend KPIs"),
    expenseRevenueRatio: metricFromValue(expenseRevenueRatio, "percent", "Validated revenue and expense columns"),
    topProductRevenueShare: metricFromValue(
      calculateTopShare(rows, productColumn, revenueColumn),
      "percent",
      "Mapped product revenue breakdown",
    ),
    topCategoryRevenueShare: metricFromValue(
      calculateTopShare(rows, categoryColumn, revenueColumn),
      "percent",
      "Mapped category revenue breakdown",
    ),
    topCustomerRevenueShare: metricFromValue(
      calculateTopShare(rows, customerColumn, revenueColumn),
      "percent",
      "Mapped customer revenue breakdown",
    ),
    topPortfolioCompanyRevenueShare: metricFromValue(
      calculateTopShare(rows, portfolioCompanyColumn, portfolioRevenueColumn),
      "percent",
      "Mapped portfolio company revenue breakdown",
    ),
    portfolioRunwayBreachRatio: metricFromValue(
      calculateRunwayBreachRatio(rows, portfolioRunwayColumn),
      "percent",
      "Mapped portfolio company runway distribution",
    ),
    runwayMonths: metricFromValue(runwayMonths, "count", "Validated cash balance and burn KPIs"),
    missingValueRatio: metricFromValue(
      calculateMissingRatio(rows, mappedConceptColumns(profile)),
      "percent",
      "Dataset profiling",
    ),
    invalidNumericRatio: metricFromValue(
      calculateInvalidNumericRatio(rows, mappedNumericColumns),
      "percent",
      "Dataset profiling",
    ),
    invalidDateRatio: metricFromValue(
      calculateInvalidDateRatio(rows, dateLikeColumns),
      "percent",
      "Dataset profiling",
    ),
    duplicateRowRatio: metricFromValue(calculateDuplicateRatio(rows), "percent", "Dataset profiling"),
    currencyInconsistencyRatio: metricFromValue(
      calculateCurrencyInconsistencyRatio(rows, currencyColumn),
      "percent",
      "Dataset profiling",
    ),
    classificationConfidence: metricFromValue(classificationConfidence, "score", "Semantic mapping profile"),
    historyPeriodCount: metricFromValue(
      revenueColumn && dateColumn ? revenueSeries.length : null,
      "count",
      "Validated revenue trend profile",
    ),
  }

  return {
    metrics,
    hasComparableHistory: revenueSeries.length >= 2,
    trendComparison: revenueGrowthPct === null
      ? "No previous comparison available."
      : `Latest revenue period changed ${formatPercent(revenueGrowthPct)} from the previous period.`,
  }
}

function evaluateRule(rule: RiskRule, metric: RiskMetric) {
  const threshold = metric.available && metric.value !== null
    ? [...rule.thresholds]
        .filter((candidate) => thresholdMatches(metric.value as number, candidate))
        .sort((a, b) => RISK_SEVERITY_RANK[b.severity] - RISK_SEVERITY_RANK[a.severity] || b.score - a.score)[0] || null
    : null
  return { rule, metric, threshold }
}

function buildNotApplicableRules(input: {
  evaluatedRuleIds: Set<string>
  metrics: Record<RiskMetricKey, RiskMetric>
  profile: SemanticProfile
}): RiskNotApplicableRule[] {
  const reasons: RiskNotApplicableRule[] = []
  for (const rule of RISK_RULES) {
    if (input.evaluatedRuleIds.has(rule.ruleId)) continue
    const missingConcepts = rule.requiredConcepts.filter(
      (concept) => resolveConceptColumn(input.profile, concept) === null,
    )
    const semanticTypeMismatch = !rule.supportedDatasetTypes.includes(input.profile.datasetType as RiskSemanticDatasetType)
    const reason = semanticTypeMismatch
      ? `Not applicable to ${getDatasetTypeLabel(input.profile.datasetType)} datasets.`
      : missingConcepts.length > 0
        ? `Requires mapped ${missingConcepts.join(", ")} evidence.`
        : `Insufficient data for ${rule.metric}.`
    reasons.push({
      ruleId: rule.ruleId,
      title: rule.title,
      category: rule.category,
      reason,
    })
  }
  return reasons
}

function buildCategorySummaries(
  evaluations: Array<{ rule: RiskRule; metric: RiskMetric; threshold: RiskThreshold | null }>,
): RiskCategorySummary[] {
  return CATEGORY_ORDER.map((category) => {
    const categoryEvaluations = evaluations.filter((item) => item.rule.category === category)
    const score = calculateWeightedScore(categoryEvaluations)
    const triggeredRuleCount = categoryEvaluations.filter((item) => item.threshold).length
    return {
      category,
      label: RISK_CATEGORY_LABELS[category],
      score,
      severity: getSeverityForScore(score),
      applicableRuleCount: categoryEvaluations.length,
      triggeredRuleCount,
    }
  }).filter((summary) => summary.applicableRuleCount > 0)
}

function calculateWeightedScore(evaluations: Array<{ rule: RiskRule; threshold: RiskThreshold | null }>) {
  const weightTotal = evaluations.reduce((sum, item) => sum + item.rule.weight, 0)
  if (weightTotal <= 0) return 0
  const weighted = evaluations.reduce((sum, item) => sum + (item.threshold?.score || 0) * item.rule.weight, 0)
  return clampScore(Math.round(weighted / weightTotal))
}

function countSeverities(findings: RiskFinding[]): Record<RiskSeverity, number> {
  return findings.reduce<Record<RiskSeverity, number>>(
    (counts, finding) => {
      counts[finding.severity] += 1
      return counts
    },
    { low: 0, medium: 0, high: 0, critical: 0 },
  )
}

function compareFindings(a: RiskFinding, b: RiskFinding) {
  return (
    RISK_SEVERITY_RANK[b.severity] - RISK_SEVERITY_RANK[a.severity] ||
    b.score - a.score ||
    b.estimatedImpact - a.estimatedImpact ||
    a.title.localeCompare(b.title)
  )
}

function calculateDeadStockRatio(rows: RiskDataRow[], productColumn: string | null, stockColumn: string | null, soldColumn: string | null) {
  if (!productColumn || !stockColumn || !soldColumn) return null
  const products = new Map<string, { stock: number; sold: number }>()
  for (const row of rows) {
    const product = String(row[productColumn] || "").trim()
    if (!product) continue
    const current = products.get(product) || { stock: 0, sold: 0 }
    current.stock += parseNumber(row[stockColumn]) ?? 0
    current.sold += parseNumber(row[soldColumn]) ?? 0
    products.set(product, current)
  }
  if (products.size === 0) return null
  const deadStock = [...products.values()].filter((item) => item.stock > 0 && item.sold <= 0).length
  return (deadStock / products.size) * 100
}

function calculateUnprofitableProductRatio(
  rows: RiskDataRow[],
  productColumn: string | null,
  revenueColumn: string | null,
  costColumns: string[],
) {
  if (!productColumn || !revenueColumn || costColumns.length === 0) return null
  const products = new Map<string, { revenue: number; cost: number }>()
  for (const row of rows) {
    const product = String(row[productColumn] || "").trim()
    if (!product) continue
    const current = products.get(product) || { revenue: 0, cost: 0 }
    current.revenue += parseNumber(row[revenueColumn]) ?? 0
    current.cost += sumRowColumns(row, costColumns)
    products.set(product, current)
  }
  if (products.size === 0) return null
  const unprofitable = [...products.values()].filter((item) => item.revenue - item.cost < 0).length
  return (unprofitable / products.size) * 100
}

function calculateTopShare(rows: RiskDataRow[], dimensionColumn: string | null, valueColumn: string | null) {
  if (!dimensionColumn || !valueColumn) return null
  const groups = new Map<string, number>()
  let total = 0
  for (const row of rows) {
    const dimension = String(row[dimensionColumn] || "").trim()
    const value = parseNumber(row[valueColumn])
    if (!dimension || value === null || value <= 0) continue
    total += value
    groups.set(dimension, (groups.get(dimension) || 0) + value)
  }
  if (total <= 0 || groups.size === 0) return null
  const top = Math.max(...groups.values())
  return (top / total) * 100
}

function calculateRunwayBreachRatio(rows: RiskDataRow[], runwayColumn: string | null) {
  if (!runwayColumn) return null
  const values = rows.map((row) => parseNumber(row[runwayColumn])).filter((value): value is number => value !== null)
  if (values.length === 0) return null
  const breaches = values.filter((value) => value < 6).length
  return (breaches / values.length) * 100
}

function calculateRunwayMonths(rows: RiskDataRow[], cashBalanceColumn: string | null, burnColumn: string | null) {
  if (!cashBalanceColumn || !burnColumn) return null
  let latest: { cash: number; burn: number } | null = null
  for (const row of rows) {
    const cash = parseNumber(row[cashBalanceColumn])
    const burn = parseNumber(row[burnColumn])
    if (cash === null || burn === null || burn <= 0 || cash <= 0) continue
    latest = { cash, burn }
  }
  if (!latest) return null
  return latest.cash / latest.burn
}

function calculateMissingRatio(rows: RiskDataRow[], columns: string[]) {
  if (rows.length === 0 || columns.length === 0) return null
  let missing = 0
  let total = 0
  for (const row of rows) {
    for (const column of columns) {
      total += 1
      if (isBlank(row[column])) missing += 1
    }
  }
  return total > 0 ? (missing / total) * 100 : null
}

function calculateInvalidNumericRatio(rows: RiskDataRow[], columns: string[]) {
  if (rows.length === 0 || columns.length === 0) return null
  let invalid = 0
  let total = 0
  for (const row of rows) {
    for (const column of columns) {
      if (isBlank(row[column])) continue
      total += 1
      if (parseNumber(row[column]) === null) invalid += 1
    }
  }
  return total > 0 ? (invalid / total) * 100 : null
}

function calculateInvalidDateRatio(rows: RiskDataRow[], dateColumns: string[]) {
  if (dateColumns.length === 0 || rows.length === 0) return null
  let invalid = 0
  let total = 0
  for (const column of dateColumns) {
    const values = rows.map((row) => row[column]).filter((value) => !isBlank(value))
    for (const value of values) {
      total += 1
      if (parseCanonicalDate(value) === null) invalid += 1
    }
  }
  return total > 0 ? (invalid / total) * 100 : null
}

function calculateDuplicateRatio(rows: RiskDataRow[]) {
  if (rows.length === 0) return null
  const seen = new Set<string>()
  let duplicates = 0
  for (const row of rows) {
    const key = JSON.stringify(Object.entries(row).sort(([a], [b]) => a.localeCompare(b)))
    if (seen.has(key)) duplicates += 1
    else seen.add(key)
  }
  return (duplicates / rows.length) * 100
}

function calculateCurrencyInconsistencyRatio(rows: RiskDataRow[], currencyColumn: string | null) {
  if (!currencyColumn) return null
  const values = rows.map((row) => String(row[currencyColumn] || "").trim().toUpperCase()).filter(Boolean)
  if (values.length === 0) return null
  const dominant = Math.max(...Object.values(countValues(values)))
  return ((values.length - dominant) / values.length) * 100
}

function calculateClassificationConfidence(profile: SemanticProfile, columns: string[]) {
  if (columns.length === 0) return 0
  const confirmed = profile.concepts.filter((mapping) => mapping.status === "confirmed").length
  return Math.min(100, Math.round((confirmed / columns.length) * 100))
}

function mappedConceptColumns(profile: SemanticProfile): string[] {
  return unique(profile.concepts.filter((mapping) => mapping.status === "confirmed").map((mapping) => mapping.sourceColumn))
}

function mappedConceptColumnsForConcepts(profile: SemanticProfile, concepts: Set<BusinessConcept>): string[] {
  return unique(
    profile.concepts
      .filter((mapping) => mapping.status === "confirmed" && concepts.has(mapping.concept))
      .map((mapping) => mapping.sourceColumn),
  )
}

function groupByPeriod(rows: RiskDataRow[], dateColumn: string, valueColumns: string | string[]) {
  const columns = Array.isArray(valueColumns) ? valueColumns : [valueColumns]
  const periods = new Map<string, number>()
  for (const row of rows) {
    const date = parseCanonicalDate(row[dateColumn])
    if (!date) continue
    const period = periodKeyFromDate(date)
    periods.set(period, (periods.get(period) || 0) + sumRowColumns(row, columns))
  }
  return [...periods.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, value]) => ({ period, value }))
}

function getLatestGrowth(series: Array<{ period: string; value: number }>) {
  if (series.length < 2) return null
  const latest = series[series.length - 1]
  const previous = series[series.length - 2]
  if (!previous || previous.value <= 0) return null
  return ((latest.value - previous.value) / previous.value) * 100
}

function getLatestMargin(series: Array<{ value: number; basis: number }>) {
  const latest = series[series.length - 1]
  return latest && latest.basis > 0 ? (latest.value / latest.basis) * 100 : null
}

function getPreviousMargin(series: Array<{ value: number; basis: number }>) {
  const previous = series[series.length - 2]
  return previous && previous.basis > 0 ? (previous.value / previous.basis) * 100 : null
}

function sumColumn(rows: RiskDataRow[], column: string | null) {
  if (!column) return null
  return rows.reduce((sum, row) => sum + (parseNumber(row[column]) ?? 0), 0)
}

function sumColumns(rows: RiskDataRow[], columns: string[]) {
  if (columns.length === 0) return null
  return rows.reduce((sum, row) => sum + sumRowColumns(row, columns), 0)
}

function sumRowColumns(row: RiskDataRow, columns: string[]) {
  return columns.reduce((sum, column) => sum + (parseNumber(row[column]) ?? 0), 0)
}

function metricFromValue(value: number | null, unit: RiskMetric["unit"], source: string): RiskMetric {
  if (value === null || !Number.isFinite(value)) {
    return { value: null, available: false, unit, source }
  }
  return { value: roundMetric(value), available: true, unit, source }
}

function parseNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value !== "string") return null
  const normalized = value.replace(/,/g, "").replace(/[^0-9.-]/g, "").trim()
  if (!normalized || normalized === "-" || normalized === ".") return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function getColumns(columns: string[] | null | undefined, rows: RiskDataRow[]) {
  return unique([...(Array.isArray(columns) ? columns : []), ...rows.slice(0, 25).flatMap((row) => Object.keys(row))])
}

export function isSupportedRiskDatasetType(datasetType?: string | null) {
  return SUPPORTED_RISK_DATASET_TYPES.includes(normalizeDatasetType(datasetType) as (typeof SUPPORTED_RISK_DATASET_TYPES)[number])
}

export function normalizeDatasetType(datasetType?: string | null) {
  const normalized = (datasetType || "standard").trim().toLowerCase().replace(/[\s_-]+/g, "")
  if (normalized === "prebookkeeping" || normalized === "prebook") return "prebookkeeping"
  if (normalized === "accounting") return "accountancy"
  return normalized || "standard"
}

export function getDatasetTypeLabel(datasetType?: string | null) {
  const normalized = (datasetType || "standard").trim().toLowerCase()
  if (normalized === "prebookkeeping" || normalized === "pre-bookkeeping") return "Pre-bookkeeping"
  if (normalized === "investor") return "Investor Portfolio"
  if (normalized === "saas") return "SaaS"
  if (normalized === "marketplace") return "Marketplace"
  if (normalized === "accountancy" || normalized === "accounting") return "Accountancy"
  if (normalized === "retail") return "Retail"
  if (normalized === "profitability") return "Profitability"
  if (normalized === "standard") return "Standard"
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

export function getDatasetSourceHref(datasetId: string, datasetType?: string | null) {
  const encoded = encodeURIComponent(datasetId)
  const normalized = normalizeDatasetType(datasetType)
  if (normalized === "retail") return "/app/retail"
  if (normalized === "profitability") return "/app/upload"
  if (normalized === "prebookkeeping") return `/app/prebookkeeping?datasetId=${encoded}`
  if (normalized === "accountancy") return `/app/accountancy?datasetId=${encoded}`
  return `/app/datasets/${encoded}/analyze`
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value))
}

function serverTimestamp() {
  return formatCanonicalIsoTimestamp(new Date()) ?? "1970-01-01T00:00:00.000Z"
}

function roundMetric(value: number) {
  return Math.round(value * 10) / 10
}

function formatPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${roundMetric(value)}%`
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function isBlank(value: unknown) {
  return value === null || value === undefined || String(value).trim() === ""
}

function countValues(values: string[]) {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] || 0) + 1
    return counts
  }, {})
}

function isRecord(value: unknown): value is RiskDataRow {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}
