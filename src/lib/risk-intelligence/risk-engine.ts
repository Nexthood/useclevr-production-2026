import {
  isPrebookkeepingCategorization,
  normalizePrebookkeepingCategorization,
  type CategorizedTransaction,
  type PrebookkeepingCategorization,
} from "@/lib/accountancy/prebookkeeping-categorization"
import {
  analyzeBusinessData,
  detectBusinessColumns,
  type DetectedBusinessColumns,
} from "@/lib/business/business-columns"
import { normalizeDashboardColumnName } from "@/lib/data/dashboard-dataset-aggregation"
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

export type RiskIntelligenceResult = {
  engineVersion: string
  dataset: {
    id: string
    name: string
    fileName: string | null
    datasetType: string
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

  const detectedBusinessColumns = mergeDetectedColumns(detectBusinessColumns(normalizedRows), dataset.detectedColumns)
  const businessAnalysis = analyzeBusinessData(normalizedRows, detectedBusinessColumns)
  const derived = deriveRiskMetrics({
    rows: normalizedRows,
    columns,
    detectedColumns: detectedBusinessColumns,
    precomputedMetrics: dataset.precomputedMetrics,
    businessAnalysis,
  })

  const applicableRules = RISK_RULES.filter((rule) => rule.supportedDatasetTypes.includes(datasetType))
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
      businessModel: dataset.businessModel || "generic",
      rowCount: dataset.rowCount ?? normalizedRows.length,
      sourceHref: getDatasetSourceHref(dataset.id, datasetType),
    },
    calculatedAt: new Date().toISOString(),
    scope: `Single ${getDatasetTypeLabel(datasetType)} dataset`,
    overallScore,
    overallSeverity,
    overallSeverityLabel: RISK_SEVERITY_LABELS[overallSeverity],
    severityCounts: countSeverities(findings),
    categorySummaries,
    findings,
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
      businessModel: dataset.businessModel || "bookkeeping",
      rowCount: dataset.rowCount ?? transactions.length,
      sourceHref: getDatasetSourceHref(dataset.id, "prebookkeeping"),
    },
    calculatedAt: new Date().toISOString(),
    scope: "Single Pre-bookkeeping dataset",
    overallScore,
    overallSeverity,
    overallSeverityLabel: RISK_SEVERITY_LABELS[overallSeverity],
    severityCounts: countSeverities(findings),
    categorySummaries,
    findings,
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
    const date = parseDate(transaction.transactionDate)
    if (!date) continue
    periods.add(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`)
  }
  return periods.size
}

function deriveRiskMetrics(input: {
  rows: RiskDataRow[]
  columns: string[]
  detectedColumns: DetectedBusinessColumns
  precomputedMetrics: unknown
  businessAnalysis: ReturnType<typeof analyzeBusinessData>
}): { metrics: Record<RiskMetricKey, RiskMetric>; hasComparableHistory: boolean; trendComparison: string } {
  const extraColumns = detectRiskColumns(input.columns)
  const revenueColumn = input.detectedColumns.revenueColumn
  const costColumns = unique([
    input.detectedColumns.costColumn,
    ...Object.values(input.detectedColumns.costComponents || {}),
    extraColumns.expense,
  ].filter(Boolean) as string[])
  const productColumn = input.detectedColumns.productColumn || extraColumns.product
  const dateColumn = input.detectedColumns.dateColumn || extraColumns.date
  const stockColumn = extraColumns.stock
  const soldColumn = extraColumns.quantitySold || input.detectedColumns.quantityColumn
  const categoryColumn = extraColumns.category
  const customerColumn = extraColumns.customer
  const currencyColumn = input.detectedColumns.currencyColumn || extraColumns.currency

  const revenueSeries = dateColumn && revenueColumn ? groupByPeriod(input.rows, dateColumn, revenueColumn) : []
  const costSeries = dateColumn && costColumns.length > 0 ? groupByPeriod(input.rows, dateColumn, costColumns) : []
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

  const totalRevenue = sumColumn(input.rows, revenueColumn)
  const totalCosts = sumColumns(input.rows, costColumns)
  const netMarginPct =
    totalRevenue !== null && totalCosts !== null && totalRevenue > 0 ? ((totalRevenue - totalCosts) / totalRevenue) * 100 : null
  const expenseRevenueRatio =
    totalRevenue !== null && totalCosts !== null && totalRevenue > 0 ? (totalCosts / totalRevenue) * 100 : null

  const metrics: Record<RiskMetricKey, RiskMetric> = {
    deadStockRatio: metricFromValue(calculateDeadStockRatio(input.rows, productColumn, stockColumn, soldColumn), "percent", "Inventory columns"),
    revenueGrowthPct: metricFromValue(revenueGrowthPct, "percent", "Revenue trend KPI"),
    grossMarginTrendPct: metricFromValue(grossMarginTrendPct, "percent", "Gross margin trend KPI"),
    netMarginPct: metricFromValue(netMarginPct, "percent", "Revenue and cost columns"),
    unprofitableProductRatio: metricFromValue(
      calculateUnprofitableProductRatio(input.rows, productColumn, revenueColumn, costColumns),
      "percent",
      "Product profitability breakdown",
    ),
    costRevenueGrowthGapPct: metricFromValue(costRevenueGrowthGapPct, "percent", "Revenue and cost trend KPIs"),
    expenseRevenueRatio: metricFromValue(expenseRevenueRatio, "percent", "Revenue and expense columns"),
    topProductRevenueShare: metricFromValue(calculateTopShare(input.rows, productColumn, revenueColumn), "percent", "Product revenue breakdown"),
    topCategoryRevenueShare: metricFromValue(calculateTopShare(input.rows, categoryColumn, revenueColumn), "percent", "Category revenue breakdown"),
    topCustomerRevenueShare: metricFromValue(calculateTopShare(input.rows, customerColumn, revenueColumn), "percent", "Customer revenue breakdown"),
    missingValueRatio: metricFromValue(
      calculateMissingRatio(input.rows, unique([
        revenueColumn,
        ...costColumns,
        productColumn,
        stockColumn,
        soldColumn,
        dateColumn,
        categoryColumn,
        customerColumn,
      ].filter(Boolean) as string[])),
      "percent",
      "Dataset profiling",
    ),
    invalidNumericRatio: metricFromValue(
      calculateInvalidNumericRatio(input.rows, unique([revenueColumn, ...costColumns, stockColumn, soldColumn].filter(Boolean) as string[])),
      "percent",
      "Dataset profiling",
    ),
    invalidDateRatio: metricFromValue(calculateInvalidDateRatio(input.rows, dateColumn), "percent", "Dataset profiling"),
    duplicateRowRatio: metricFromValue(calculateDuplicateRatio(input.rows), "percent", "Dataset profiling"),
    currencyInconsistencyRatio: metricFromValue(calculateCurrencyInconsistencyRatio(input.rows, currencyColumn), "percent", "Dataset profiling"),
    classificationConfidence: metricFromValue(calculateClassificationConfidence({
      revenueColumn,
      costColumns,
      productColumn,
      stockColumn,
      soldColumn,
      dateColumn,
      categoryColumn,
      customerColumn,
      precomputedMetrics: input.precomputedMetrics,
      businessAnalysis: input.businessAnalysis,
    }), "score", "Column mapping profile"),
    historyPeriodCount: metricFromValue(revenueSeries.length, "count", "Revenue trend profile"),
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

function mergeDetectedColumns(detected: DetectedBusinessColumns, stored: unknown): DetectedBusinessColumns {
  if (!isRecord(stored)) return detected
  const storedCostComponents = isRecord(stored.costComponents) ? stored.costComponents : {}
  return {
    revenueColumn: firstString(stored.revenueColumn, stored.revenue, detected.revenueColumn),
    profitColumn: firstString(stored.profitColumn, stored.profit, detected.profitColumn),
    costColumn: firstString(stored.costColumn, stored.cost, detected.costColumn),
    dateColumn: firstString(stored.dateColumn, stored.date, detected.dateColumn),
    productColumn: firstString(stored.productColumn, stored.product, detected.productColumn),
    regionColumn: firstString(stored.regionColumn, stored.region, detected.regionColumn),
    fallbackRegionColumn: firstString(stored.fallbackRegionColumn, stored.country, detected.fallbackRegionColumn),
    currencyColumn: firstString(stored.currencyColumn, stored.currency, detected.currencyColumn),
    quantityColumn: firstString(stored.quantityColumn, stored.quantity, detected.quantityColumn),
    costComponents: {
      ...detected.costComponents,
      ...Object.fromEntries(
        Object.entries(storedCostComponents).filter(([, value]) => typeof value === "string" || value === null),
      ),
    } as Record<string, string | null>,
  }
}

function detectRiskColumns(columns: string[]) {
  return {
    stock: findAlias(columns, ["stock", "inventory", "quantity_on_hand", "units_in_stock", "on_hand", "available"]),
    quantitySold: findAlias(columns, ["quantity_sold", "units_sold", "sold", "sales_units", "qty_sold"]),
    category: findAlias(columns, ["category", "product_category", "department", "segment", "collection"]),
    customer: findAlias(columns, ["customer", "customer_id", "client", "client_id", "account", "account_id"]),
    expense: findAlias(columns, ["expense", "expenses", "operating_expenses", "opex", "spend"]),
    currency: findAlias(columns, ["currency", "currency_code", "iso_currency"]),
    date: findAlias(columns, ["date", "order_date", "sale_date", "transaction_date", "month", "period", "created_at"]),
    product: findAlias(columns, ["product", "product_name", "sku", "item", "item_name", "title"]),
  }
}

function findAlias(columns: string[], aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeDashboardColumnName)
  return columns.find((column) => {
    const normalized = normalizeDashboardColumnName(column)
    return normalizedAliases.some((alias) => normalized === alias || normalized.includes(alias))
  }) || null
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

function calculateInvalidDateRatio(rows: RiskDataRow[], dateColumn: string | null) {
  if (!dateColumn || rows.length === 0) return null
  const values = rows.map((row) => row[dateColumn]).filter((value) => !isBlank(value))
  if (values.length === 0) return null
  const invalid = values.filter((value) => Number.isNaN(new Date(String(value)).getTime())).length
  return (invalid / values.length) * 100
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

function calculateClassificationConfidence(input: {
  revenueColumn: string | null
  costColumns: string[]
  productColumn: string | null
  stockColumn: string | null
  soldColumn: string | null
  dateColumn: string | null
  categoryColumn: string | null
  customerColumn: string | null
  precomputedMetrics: unknown
  businessAnalysis: ReturnType<typeof analyzeBusinessData>
}) {
  const signals = [
    input.revenueColumn,
    input.costColumns.length > 0 ? "cost" : null,
    input.productColumn,
    input.stockColumn,
    input.soldColumn,
    input.dateColumn,
    input.categoryColumn,
    input.customerColumn,
    input.businessAnalysis.kpis.totalRevenue !== null ? "kpiRevenue" : null,
    isRecord(input.precomputedMetrics) && Object.keys(input.precomputedMetrics).length > 0 ? "precomputedMetrics" : null,
  ].filter(Boolean).length
  return Math.min(100, Math.round((signals / 10) * 100))
}

function groupByPeriod(rows: RiskDataRow[], dateColumn: string, valueColumns: string | string[]) {
  const columns = Array.isArray(valueColumns) ? valueColumns : [valueColumns]
  const periods = new Map<string, number>()
  for (const row of rows) {
    const date = parseDate(row[dateColumn])
    if (!date) continue
    const period = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
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
  return { value: value === null ? null : roundMetric(value), available: value !== null && Number.isFinite(value), unit, source }
}

function parseNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value !== "string") return null
  const normalized = value.replace(/,/g, "").replace(/[^0-9.-]/g, "").trim()
  if (!normalized || normalized === "-" || normalized === ".") return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function parseDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value !== "string" && typeof value !== "number") return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
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
  const normalized = normalizeDatasetType(datasetType)
  if (normalized === "prebookkeeping") return "Pre-bookkeeping"
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

function roundMetric(value: number) {
  return Math.round(value * 10) / 10
}

function formatPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${roundMetric(value)}%`
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function firstString(...values: unknown[]) {
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0) || null
}

function isRecord(value: unknown): value is RiskDataRow {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
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
