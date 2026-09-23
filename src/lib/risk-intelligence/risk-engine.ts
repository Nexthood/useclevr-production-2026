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
  formatRiskOperator,
  getSeverityForScore,
  RISK_ENGINE_VERSION,
  RISK_METRIC_LABELS,
  RISK_RULES,
  RISK_SCORE_SEVERITY_BANDS,
  RISK_SEVERITY_LABELS,
  RISK_SEVERITY_RANK,
  SUPPORTED_RISK_DATASET_TYPES,
  thresholdMatches,
  type RiskCategory,
  type RiskEvidence,
  type RiskFindingExplanation,
  type RiskMetricKey,
  type RiskRule,
  type RiskScoringModel,
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
  details?: RiskEvidence
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
  explanation: RiskFindingExplanation
}

export type RiskCategorySummary = {
  category: RiskCategory
  label: string
  score: number
  severity: RiskSeverity
  applicableRuleCount: number
  triggeredRuleCount: number
  scoreFormula: string
  topTriggeredRules: Array<{ ruleId: string; title: string; metricDisplay: string }>
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
  scoringModel: RiskScoringModel
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
  const categoryAggregates = buildCategoryAggregates(applicableEvaluations)
  const findings = applicableEvaluations
    .filter((item) => item.threshold)
    .map((item) => {
      const threshold = item.threshold as RiskThreshold
      const score = clampScore(threshold.score)
      const metricValue = roundMetric(item.metric.value ?? 0)
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
        metricValue,
        metricUnit: item.metric.unit,
        threshold,
        recommendation: item.rule.recommendationTemplate,
        sourceLabel: item.rule.sourceTemplate,
        sourceHref: getDatasetSourceHref(dataset.id, datasetType),
        estimatedImpact: Math.round(score * item.rule.weight),
        explanation: buildFindingExplanation({
          rule: item.rule,
          metricValue,
          metricUnit: item.metric.unit,
          score,
          threshold,
          evidence: derived.evidence[item.rule.metric] ?? null,
          categoryAggregate: categoryAggregates.get(item.rule.category) ?? null,
        }),
      } satisfies RiskFinding
    })
    .sort(compareFindings)

  const notApplicableRules = buildNotApplicableRules({
    evaluatedRuleIds: new Set(applicableEvaluations.map((item) => item.rule.ruleId)),
    metrics: derived.metrics,
    profile,
  })

  const categorySummaries = buildCategorySummaries(applicableEvaluations, categoryAggregates)
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
    scoringModel: buildScoringModel(applicableEvaluations, overallScore),
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

  const bandedFindings = buildPrebookkeepingFindings(categorization)
  const categoryAggregates = buildPrebookkeepingCategoryAggregates(bandedFindings)
  const findings = finalizePrebookkeepingFindings(dataset, bandedFindings, categoryAggregates)
  const categorySummaries = buildPrebookkeepingCategorySummaries(findings, categoryAggregates)
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
    scoringModel: buildPrebookkeepingScoringModel(findings, overallScore),
    missingMetrics: [],
    trendComparison: "Bookkeeping risk uses the current reviewed transaction set.",
  }
}

type PrebookkeepingFindingDraft = Omit<RiskFinding, "sourceHref" | "severityLabel" | "estimatedImpact" | "explanation"> & {
  bands: RiskThreshold[]
  evidence: RiskEvidence
}

function buildPrebookkeepingFindings(categorization: PrebookkeepingCategorization): PrebookkeepingFindingDraft[] {
  const transactions = categorization.transactions
  const findings: PrebookkeepingFindingDraft[] = []
  const addFinding = (finding: Omit<RiskFinding, "sourceHref" | "severityLabel" | "estimatedImpact" | "explanation"> & {
    bands: RiskThreshold[]
    evidence: RiskEvidence
  }) => {
    findings.push(finding)
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
      bands: [
        { severity: "medium", operator: ">=", value: 1, score: 45 },
        { severity: "high", operator: ">=", value: 10, score: 72 },
      ],
      evidence: {
        whatHappened: `${formatCount(duplicateRows)} of ${formatCount(transactions.length)} reviewed transactions are marked as possible duplicates (${formatSignedPercent(ratio)} of transactions).`,
        values: [
          { label: "Transactions marked as possible duplicates", display: formatCount(duplicateRows), raw: duplicateRows },
          { label: "Reviewed transactions", display: formatCount(transactions.length), raw: transactions.length },
        ],
        absoluteChange: null,
        percentChange: null,
        periodsCompared: null,
        scope: `${formatCount(transactions.length)} reviewed transactions`,
        sourceColumns: [],
        unavailable: [],
        interpretation: "Duplicate payment entries can inflate expenses and distort the bookkeeping package sent to the accountant.",
        sourceMetric: RISK_METRIC_LABELS.duplicateRowRatio,
      },
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
      bands: [
        { severity: "medium", operator: ">=", value: 1, score: 44 },
        { severity: "high", operator: ">=", value: 25, score: 70 },
      ],
      evidence: {
        whatHappened: `${formatCount(missingVatRows)} of ${formatCount(transactions.length)} reviewed transactions still need VAT confirmation (${formatSignedPercent(ratio)} of transactions).`,
        values: [
          { label: "Transactions needing VAT confirmation", display: formatCount(missingVatRows), raw: missingVatRows },
          { label: "Reviewed transactions", display: formatCount(transactions.length), raw: transactions.length },
        ],
        absoluteChange: null,
        percentChange: null,
        periodsCompared: null,
        scope: `${formatCount(transactions.length)} reviewed transactions`,
        sourceColumns: [],
        unavailable: [],
        interpretation: "Unconfirmed VAT can misstate tax lines and force rework after the records reach the accountant.",
        sourceMetric: RISK_METRIC_LABELS.missingValueRatio,
      },
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
      bands: [
        { severity: "medium", operator: ">=", value: 1, score: 40 },
        { severity: "high", operator: ">=", value: 20, score: 68 },
      ],
      evidence: {
        whatHappened: `${formatCount(affectedRows)} transaction detail(s) are uncategorized or missing supplier information (${formatSignedPercent(ratio)} of ${formatCount(transactions.length)} transactions); categorization confidence is ${roundMetric(categorization.reviewSummary.confidenceScore)}.`,
        values: [
          { label: "Affected transaction details", display: formatCount(affectedRows), raw: affectedRows },
          { label: "Reviewed transactions", display: formatCount(transactions.length), raw: transactions.length },
          { label: "Categorization confidence score", display: roundMetric(categorization.reviewSummary.confidenceScore).toString(), raw: categorization.reviewSummary.confidenceScore },
        ],
        absoluteChange: null,
        percentChange: null,
        periodsCompared: null,
        scope: `${formatCount(transactions.length)} reviewed transactions`,
        sourceColumns: [],
        unavailable: [],
        interpretation: "Uncategorized transactions and missing suppliers make the export incomplete for accountant review.",
        sourceMetric: RISK_METRIC_LABELS.classificationConfidence,
      },
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
      bands: [
        { severity: "medium", operator: ">=", value: 1, score: 38 },
        { severity: "high", operator: ">=", value: 5, score: 66 },
      ],
      evidence: {
        whatHappened: `${formatCount(largeExpenses.length)} large withdrawal or expense transaction(s) need review${expenseRatio !== null ? `; mapped expenses equal ${formatSignedPercent(expenseRatio)} of detected income` : ""}.`,
        values: [
          { label: "Large expense transactions flagged for review", display: formatCount(largeExpenses.length), raw: largeExpenses.length },
          ...(expenseRatio !== null
            ? [{ label: "Expenses as share of detected income", display: formatSignedPercent(expenseRatio), raw: roundMetric(expenseRatio) }]
            : []),
        ],
        absoluteChange: null,
        percentChange: null,
        periodsCompared: null,
        scope: `${formatCount(transactions.length)} reviewed transactions`,
        sourceColumns: [],
        unavailable: expenseRatio === null ? ["Expenses as a share of income cannot be calculated without detected income."] : [],
        interpretation: "Large withdrawals need confirmation against invoices, receipts, and supplier agreements before closing the period.",
        sourceMetric: RISK_METRIC_LABELS.expenseRevenueRatio,
      },
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
      bands: [
        { severity: "medium", operator: ">=", value: 35, score: 45 },
        { severity: "high", operator: ">=", value: 60, score: 72 },
      ],
      evidence: {
        whatHappened: `The largest supplier represents ${formatSignedPercent(supplierConcentration)} of total expense value across reviewed transactions.`,
        values: [
          { label: "Largest supplier share of expense value", display: formatSignedPercent(supplierConcentration), raw: roundMetric(supplierConcentration) },
        ],
        absoluteChange: null,
        percentChange: null,
        periodsCompared: null,
        scope: `${formatCount(transactions.length)} reviewed transactions`,
        sourceColumns: [],
        unavailable: [],
        interpretation: "Heavy dependence on one supplier makes expense lines vulnerable to price changes or supply interruptions.",
        sourceMetric: RISK_METRIC_LABELS.topCustomerRevenueShare,
      },
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
      bands: [
        { severity: "high", operator: ">=", value: 100, score: 72 },
        { severity: "critical", operator: ">=", value: 120, score: 90 },
      ],
      evidence: {
        whatHappened: `Mapped expenses equal ${formatSignedPercent(expenseRatio)} of detected income across reviewed transactions.`,
        values: [
          { label: "Detected income total", display: formatAmount(categorization.incomeTotal), raw: categorization.incomeTotal },
          { label: "Detected expense total", display: formatAmount(categorization.expenseTotal), raw: categorization.expenseTotal },
          { label: "Expenses as share of income", display: formatSignedPercent(expenseRatio), raw: roundMetric(expenseRatio) },
        ],
        absoluteChange: null,
        percentChange: null,
        periodsCompared: null,
        scope: `${formatCount(transactions.length)} reviewed transactions`,
        sourceColumns: [],
        unavailable: [],
        interpretation: "When mapped expenses exceed detected income, either spending outruns income or the records cover mismatched periods.",
        sourceMetric: RISK_METRIC_LABELS.expenseRevenueRatio,
      },
      recommendation: "Confirm that income and expense periods match before sending the summary to the accountant.",
      sourceLabel: "Bookkeeping summary",
    })
  }

  return findings
}

function finalizePrebookkeepingFindings(
  dataset: RiskDatasetInput,
  drafts: PrebookkeepingFindingDraft[],
  aggregates: Map<RiskCategory, RiskCategoryAggregate>,
): RiskFinding[] {
  const sourceHref = getDatasetSourceHref(dataset.id, "prebookkeeping")
  return drafts.map((draft) => {
    const aggregate = aggregates.get(draft.category) ?? null
    return {
      ...draft,
      sourceHref,
      severityLabel: RISK_SEVERITY_LABELS[draft.severity],
      estimatedImpact: Math.round(draft.score * draft.weight),
      explanation: buildFindingExplanation({
        rule: {
          metric: draft.metric,
          weight: draft.weight,
          thresholds: draft.bands,
          recommendationTemplate: draft.recommendation,
        },
        metricValue: draft.metricValue,
        metricUnit: draft.metricUnit,
        score: draft.score,
        threshold: draft.threshold,
        evidence: draft.evidence,
        categoryAggregate: aggregate,
      }),
    }
  }).sort(compareFindings)
}

type RiskCategoryAggregate = {
  label: string
  score: number
  weightedPoints: number
  weightTotal: number
  formula: string
}

function buildPrebookkeepingCategoryAggregates(drafts: PrebookkeepingFindingDraft[]): Map<RiskCategory, RiskCategoryAggregate> {
  const aggregates = new Map<RiskCategory, RiskCategoryAggregate>()
  for (const category of CATEGORY_ORDER) {
    const categoryDrafts = drafts.filter((draft) => draft.category === category)
    if (categoryDrafts.length === 0) continue
    const scores = categoryDrafts.map((draft) => draft.score)
    const score = clampScore(Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length))
    aggregates.set(category, {
      label: RISK_CATEGORY_LABELS[category],
      score,
      weightedPoints: scores.reduce((sum, score) => sum + score, 0),
      weightTotal: scores.length,
      formula: formatMeanFormula(scores, score, RISK_CATEGORY_LABELS[category]),
    })
  }
  return aggregates
}

function buildPrebookkeepingScoringModel(findings: RiskFinding[], overallScore: number): RiskScoringModel {
  const terms = findings.map((finding) => ({ score: finding.score, weight: finding.weight }))
  return {
    ruleScoring:
      "Each bookkeeping review rule scores a fixed value (0–100) per severity level when its threshold is crossed.",
    categoryAggregation:
      "A category score is the average of the triggered rule scores in that category.",
    overallAggregation:
      "The overall risk score is the importance-weighted average across all triggered bookkeeping findings.",
    overallFormula: formatWeightedAverageFormula(terms, overallScore, "Overall risk"),
    severityBands: RISK_SCORE_SEVERITY_BANDS,
  }
}

function buildPrebookkeepingCategorySummaries(
  findings: RiskFinding[],
  aggregates: Map<RiskCategory, RiskCategoryAggregate>,
): RiskCategorySummary[] {
  return CATEGORY_ORDER.map((category) => {
    const categoryFindings = findings.filter((finding) => finding.category === category)
    const aggregate = aggregates.get(category)
    const score = aggregate ? aggregate.score : 0
    return {
      category,
      label: RISK_CATEGORY_LABELS[category],
      score,
      severity: getSeverityForScore(score),
      applicableRuleCount: category === "inventory" || category === "profitability" ? 0 : 1,
      triggeredRuleCount: categoryFindings.length,
      scoreFormula: aggregate ? aggregate.formula : "",
      topTriggeredRules: categoryFindings.map((finding) => ({
        ruleId: finding.ruleId,
        title: finding.title,
        metricDisplay: formatMetricDisplay(finding.metricValue, finding.metricUnit),
      })),
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
}): {
  metrics: Record<RiskMetricKey, RiskMetric>
  evidence: Partial<Record<RiskMetricKey, RiskEvidence>>
  hasComparableHistory: boolean
  trendComparison: string
} {
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
  const revenueTrendRowCount = dateColumn && revenueColumn
    ? rows.filter((row) => parseCanonicalDate(row[dateColumn]) !== null).length
    : 0

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

  const runwayDetail = calculateRunwayDetail(rows, cashBalanceColumn, burnColumn)
  const runwayMonths = runwayDetail?.months ?? null
  const mappedNumericColumns = mappedConceptColumnsForConcepts(profile, NUMERIC_CONCEPTS)
  const dateLikeColumns = DATE_LIKE_CONCEPTS
    .map((concept) => conceptColumn(profile, concept))
    .filter(Boolean) as string[]
  const confidenceDetail = calculateConfidenceDetail(profile, columns)
  const classificationConfidence = confidenceDetail?.value ?? null
  const mappedColumns = mappedConceptColumns(profile)

  const revenueGrowthEvidence: RiskEvidence | null = (() => {
    if (revenueGrowthPct === null) return null
    const latest = revenueSeries[revenueSeries.length - 1]
    const previous = revenueSeries[revenueSeries.length - 2]
    if (!latest || !previous) return null
    const absoluteChange = latest.value - previous.value
    return {
      whatHappened: `Revenue changed ${formatSignedPercent(revenueGrowthPct)} from ${previous.period} to ${latest.period}.`,
      values: [
        { label: `Revenue in ${previous.period} (previous period)`, display: formatAmount(previous.value), raw: previous.value },
        { label: `Revenue in ${latest.period} (latest period)`, display: formatAmount(latest.value), raw: latest.value },
      ],
      absoluteChange: { display: `${absoluteChange > 0 ? "+" : ""}${formatAmount(absoluteChange)}`, raw: absoluteChange },
      percentChange: { display: formatSignedPercent(revenueGrowthPct), raw: revenueGrowthPct },
      periodsCompared: `${previous.period} → ${latest.period}`,
      scope: `${formatCount(revenueTrendRowCount)} rows with valid dates across ${revenueSeries.length} revenue period(s)`,
      sourceColumns: unique([revenueColumn, dateColumn].filter(Boolean) as string[]),
      unavailable: [],
      interpretation: `Latest-period revenue is ${formatAmount(Math.abs(latest.value - previous.value))} ${revenueGrowthPct < 0 ? "lower" : "higher"} than the previous period (${formatSignedPercent(revenueGrowthPct)}).`,
      sourceMetric: `${RISK_METRIC_LABELS.revenueGrowthPct} (revenue, date)`,
    }
  })()

  const grossMarginEvidence: RiskEvidence | null = (() => {
    if (grossMarginTrendPct === null) return null
    const latest = profitSeries[profitSeries.length - 1]
    const previous = profitSeries[profitSeries.length - 2]
    if (!latest || !previous) return null
    return {
      whatHappened: `Gross margin moved from ${formatSignedPercent(previousGrossMargin as number)} in ${previous.period} to ${formatSignedPercent(latestGrossMargin as number)} in ${latest.period} (${formatSignedPercent(grossMarginTrendPct)} percentage points).`,
      values: [
        { label: `Gross margin in ${previous.period}`, display: formatSignedPercent(previousGrossMargin as number), raw: roundMetric(previousGrossMargin as number) },
        { label: `Gross margin in ${latest.period}`, display: formatSignedPercent(latestGrossMargin as number), raw: roundMetric(latestGrossMargin as number) },
        { label: `Revenue in ${latest.period}`, display: formatAmount(latest.basis), raw: latest.basis },
        { label: `Mapped costs in ${latest.period}`, display: formatAmount(latest.basis - latest.value), raw: roundMetric(latest.basis - latest.value) },
        { label: `Revenue in ${previous.period}`, display: formatAmount(previous.basis), raw: previous.basis },
        { label: `Mapped costs in ${previous.period}`, display: formatAmount(previous.basis - previous.value), raw: roundMetric(previous.basis - previous.value) },
      ],
      absoluteChange: { display: `${formatSignedPercent(grossMarginTrendPct)} percentage points`, raw: roundMetric(grossMarginTrendPct) },
      percentChange: null,
      periodsCompared: `${previous.period} → ${latest.period}`,
      scope: `${formatCount(revenueTrendRowCount)} rows with valid dates across ${revenueSeries.length} period(s)`,
      sourceColumns: unique([revenueColumn, ...costColumns, dateColumn].filter(Boolean) as string[]),
      unavailable: [],
      interpretation: `Gross margin in the latest period is ${formatSignedPercent(grossMarginTrendPct)} percentage points versus the previous period.`,
      sourceMetric: `${RISK_METRIC_LABELS.grossMarginTrendPct} (revenue, cost, date)`,
    }
  })()

  const costRevenueGapEvidence: RiskEvidence | null = (() => {
    if (costRevenueGrowthGapPct === null) return null
    const latestRevenue = revenueSeries[revenueSeries.length - 1]
    const previousRevenue = revenueSeries[revenueSeries.length - 2]
    const latestCost = costSeries[costSeries.length - 1]
    const previousCost = costSeries[costSeries.length - 2]
    if (!latestRevenue || !previousRevenue || !latestCost || !previousCost) return null
    return {
      whatHappened: `Mapped costs changed ${formatSignedPercent(costGrowthPct as number)} while revenue changed ${formatSignedPercent(revenueGrowthPct as number)} from ${previousRevenue.period} to ${latestRevenue.period}.`,
      values: [
        { label: `Revenue in ${previousRevenue.period}`, display: formatAmount(previousRevenue.value), raw: previousRevenue.value },
        { label: `Revenue in ${latestRevenue.period}`, display: formatAmount(latestRevenue.value), raw: latestRevenue.value },
        { label: `Revenue change`, display: formatSignedPercent(revenueGrowthPct as number), raw: roundMetric(revenueGrowthPct as number) },
        { label: `Mapped costs in ${previousCost.period}`, display: formatAmount(previousCost.value), raw: previousCost.value },
        { label: `Mapped costs in ${latestCost.period}`, display: formatAmount(latestCost.value), raw: latestCost.value },
        { label: `Cost change`, display: formatSignedPercent(costGrowthPct as number), raw: roundMetric(costGrowthPct as number) },
      ],
      absoluteChange: { display: `${formatSignedPercent(costRevenueGrowthGapPct)} percentage points`, raw: roundMetric(costRevenueGrowthGapPct) },
      percentChange: null,
      periodsCompared: `${previousRevenue.period} → ${latestRevenue.period}`,
      scope: `${formatCount(revenueTrendRowCount)} rows with valid dates across ${revenueSeries.length} period(s)`,
      sourceColumns: unique([revenueColumn, ...costColumns, dateColumn].filter(Boolean) as string[]),
      unavailable: [],
      interpretation: `Costs grew ${formatSignedPercent(costRevenueGrowthGapPct)} faster than revenue between the last two comparable periods.`,
      sourceMetric: `${RISK_METRIC_LABELS.costRevenueGrowthGapPct} (revenue, cost, date)`,
    }
  })()

  const netMarginEvidence: RiskEvidence | null = (() => {
    if (netMarginPct === null) return null
    return {
      whatHappened: `Mapped costs total ${formatAmount(totalCosts as number)} against revenue of ${formatAmount(totalRevenue as number)} across all rows, producing a net margin of ${formatSignedPercent(netMarginPct)}.`,
      values: [
        { label: "Total mapped revenue", display: formatAmount(totalRevenue as number), raw: roundMetric(totalRevenue as number) },
        { label: "Total mapped costs", display: formatAmount(totalCosts as number), raw: roundMetric(totalCosts as number) },
      ],
      absoluteChange: { display: `${formatAmount((totalRevenue as number) - (totalCosts as number))}`, raw: (totalRevenue as number) - (totalCosts as number) },
      percentChange: { display: formatSignedPercent(netMarginPct), raw: roundMetric(netMarginPct) },
      periodsCompared: null,
      scope: `${formatCount(rows.length)} rows`,
      sourceColumns: unique([revenueColumn, ...costColumns].filter(Boolean) as string[]),
      unavailable: [],
      interpretation: `Known costs equal ${formatSignedPercent(expenseRevenueRatio as number)} of revenue, so the dataset retains ${formatSignedPercent(netMarginPct)} of revenue as margin.`,
      sourceMetric: `${RISK_METRIC_LABELS.netMarginPct} (revenue, cost)`,
    }
  })()

  const expenseRatioEvidence: RiskEvidence | null = (() => {
    if (expenseRevenueRatio === null) return null
    return {
      whatHappened: `Mapped costs total ${formatAmount(totalCosts as number)} against revenue of ${formatAmount(totalRevenue as number)}, which is ${formatSignedPercent(expenseRevenueRatio)} of revenue.`,
      values: [
        { label: "Total mapped revenue", display: formatAmount(totalRevenue as number), raw: roundMetric(totalRevenue as number) },
        { label: "Total mapped costs", display: formatAmount(totalCosts as number), raw: roundMetric(totalCosts as number) },
      ],
      absoluteChange: { display: `${formatAmount((totalCosts as number) - (totalRevenue as number))}`, raw: (totalCosts as number) - (totalRevenue as number) },
      percentChange: { display: formatSignedPercent(expenseRevenueRatio), raw: roundMetric(expenseRevenueRatio) },
      periodsCompared: null,
      scope: `${formatCount(rows.length)} rows`,
      sourceColumns: unique([revenueColumn, ...costColumns].filter(Boolean) as string[]),
      unavailable: [],
      interpretation: `Costs at ${formatSignedPercent(expenseRevenueRatio)} of revenue mean the dataset ${expenseRevenueRatio >= 100 ? "spends more than it earns" : "keeps part of revenue after costs"} on the covered rows.`,
      sourceMetric: `${RISK_METRIC_LABELS.expenseRevenueRatio} (revenue, cost)`,
    }
  })()

  const deadStockDetail = calculateDeadStockDetail(rows, productColumn, stockColumn, soldColumn)
  const unprofitableDetail = calculateUnprofitableProductDetail(rows, productColumn, revenueColumn, costColumns)
  const topProductDetail = calculateTopShareDetail(rows, productColumn, revenueColumn, "product")
  const topCategoryDetail = calculateTopShareDetail(rows, categoryColumn, revenueColumn, "category")
  const topCustomerDetail = calculateTopShareDetail(rows, customerColumn, revenueColumn, "customer")
  const topPortfolioDetail = calculateTopShareDetail(rows, portfolioCompanyColumn, portfolioRevenueColumn, "portfolio company")
  const runwayBreachDetail = calculateRunwayBreachDetail(rows, portfolioRunwayColumn)
  const missingDetail = calculateMissingDetail(rows, mappedColumns)
  const invalidNumericDetail = calculateInvalidNumericDetail(rows, mappedNumericColumns)
  const invalidDateDetail = calculateInvalidDateDetail(rows, dateLikeColumns)
  const duplicateDetail = calculateDuplicateDetail(rows)
  const currencyDetail = calculateCurrencyDetail(rows, currencyColumn)

  const metrics: Record<RiskMetricKey, RiskMetric> = {
    deadStockRatio: metricFromValue(deadStockDetail?.ratio ?? null, "percent", "Mapped inventory columns", deadStockDetail?.evidence ?? null),
    revenueGrowthPct: metricFromValue(revenueGrowthPct, "percent", "Validated revenue trend KPI", revenueGrowthEvidence),
    grossMarginTrendPct: metricFromValue(grossMarginTrendPct, "percent", "Validated gross margin trend KPI", grossMarginEvidence),
    netMarginPct: metricFromValue(netMarginPct, "percent", "Validated revenue and cost columns", netMarginEvidence),
    unprofitableProductRatio: metricFromValue(
      unprofitableDetail?.ratio ?? null,
      "percent",
      "Mapped product profitability breakdown",
      unprofitableDetail?.evidence ?? null,
    ),
    costRevenueGrowthGapPct: metricFromValue(costRevenueGrowthGapPct, "percent", "Validated revenue and cost trend KPIs", costRevenueGapEvidence),
    expenseRevenueRatio: metricFromValue(expenseRevenueRatio, "percent", "Validated revenue and expense columns", expenseRatioEvidence),
    topProductRevenueShare: metricFromValue(
      topProductDetail?.share ?? null,
      "percent",
      "Mapped product revenue breakdown",
      topProductDetail?.evidence ?? null,
    ),
    topCategoryRevenueShare: metricFromValue(
      topCategoryDetail?.share ?? null,
      "percent",
      "Mapped category revenue breakdown",
      topCategoryDetail?.evidence ?? null,
    ),
    topCustomerRevenueShare: metricFromValue(
      topCustomerDetail?.share ?? null,
      "percent",
      "Mapped customer revenue breakdown",
      topCustomerDetail?.evidence ?? null,
    ),
    topPortfolioCompanyRevenueShare: metricFromValue(
      topPortfolioDetail?.share ?? null,
      "percent",
      "Mapped portfolio company revenue breakdown",
      topPortfolioDetail?.evidence ?? null,
    ),
    portfolioRunwayBreachRatio: metricFromValue(
      runwayBreachDetail?.ratio ?? null,
      "percent",
      "Mapped portfolio company runway distribution",
      runwayBreachDetail?.evidence ?? null,
    ),
    runwayMonths: metricFromValue(runwayMonths, "count", "Validated cash balance and burn KPIs", runwayDetail?.evidence ?? null),
    missingValueRatio: metricFromValue(missingDetail?.ratio ?? null, "percent", "Dataset profiling", missingDetail?.evidence ?? null),
    invalidNumericRatio: metricFromValue(invalidNumericDetail?.ratio ?? null, "percent", "Dataset profiling", invalidNumericDetail?.evidence ?? null),
    invalidDateRatio: metricFromValue(invalidDateDetail?.ratio ?? null, "percent", "Dataset profiling", invalidDateDetail?.evidence ?? null),
    duplicateRowRatio: metricFromValue(duplicateDetail?.ratio ?? null, "percent", "Dataset profiling", duplicateDetail?.evidence ?? null),
    currencyInconsistencyRatio: metricFromValue(
      currencyDetail?.ratio ?? null,
      "percent",
      "Dataset profiling",
      currencyDetail?.evidence ?? null,
    ),
    classificationConfidence: metricFromValue(classificationConfidence, "score", "Semantic mapping profile", confidenceDetail?.evidence ?? null),
    historyPeriodCount: metricFromValue(
      revenueColumn && dateColumn ? revenueSeries.length : null,
      "count",
      "Validated revenue trend profile",
      buildHistoryEvidence(revenueSeries),
    ),
  }

  return {
    metrics,
    evidence: {
      deadStockRatio: deadStockDetail?.evidence,
      revenueGrowthPct: revenueGrowthEvidence ?? undefined,
      grossMarginTrendPct: grossMarginEvidence ?? undefined,
      netMarginPct: netMarginEvidence ?? undefined,
      unprofitableProductRatio: unprofitableDetail?.evidence,
      costRevenueGrowthGapPct: costRevenueGapEvidence ?? undefined,
      expenseRevenueRatio: expenseRatioEvidence ?? undefined,
      topProductRevenueShare: topProductDetail?.evidence,
      topCategoryRevenueShare: topCategoryDetail?.evidence,
      topCustomerRevenueShare: topCustomerDetail?.evidence,
      topPortfolioCompanyRevenueShare: topPortfolioDetail?.evidence,
      portfolioRunwayBreachRatio: runwayBreachDetail?.evidence,
      runwayMonths: runwayDetail?.evidence,
      missingValueRatio: missingDetail?.evidence,
      invalidNumericRatio: invalidNumericDetail?.evidence,
      invalidDateRatio: invalidDateDetail?.evidence,
      duplicateRowRatio: duplicateDetail?.evidence,
      currencyInconsistencyRatio: currencyDetail?.evidence,
      classificationConfidence: confidenceDetail?.evidence,
      historyPeriodCount: buildHistoryEvidence(revenueSeries) ?? undefined,
    },
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

function buildCategoryAggregates(
  evaluations: Array<{ rule: RiskRule; metric: RiskMetric; threshold: RiskThreshold | null }>,
): Map<RiskCategory, RiskCategoryAggregate> {
  const aggregates = new Map<RiskCategory, RiskCategoryAggregate>()
  for (const category of CATEGORY_ORDER) {
    const categoryEvaluations = evaluations.filter((item) => item.rule.category === category)
    if (categoryEvaluations.length === 0) continue
    const weightTotal = categoryEvaluations.reduce((sum, item) => sum + item.rule.weight, 0)
    const weightedPoints = categoryEvaluations.reduce((sum, item) => sum + (item.threshold?.score || 0) * item.rule.weight, 0)
    const score = clampScore(Math.round(weightedPoints / weightTotal))
    aggregates.set(category, {
      label: RISK_CATEGORY_LABELS[category],
      score,
      weightedPoints,
      weightTotal,
      formula: formatWeightedAverageFormula(
        categoryEvaluations.map((item) => ({ score: item.threshold?.score || 0, weight: item.rule.weight })),
        score,
        RISK_CATEGORY_LABELS[category],
      ),
    })
  }
  return aggregates
}

function buildCategorySummaries(
  evaluations: Array<{ rule: RiskRule; metric: RiskMetric; threshold: RiskThreshold | null }>,
  aggregates: Map<RiskCategory, RiskCategoryAggregate>,
): RiskCategorySummary[] {
  return CATEGORY_ORDER.map((category) => {
    const categoryEvaluations = evaluations.filter((item) => item.rule.category === category)
    if (categoryEvaluations.length === 0) return null
    const aggregate = aggregates.get(category)
    const score = calculateWeightedScore(categoryEvaluations)
    const triggered = categoryEvaluations
      .filter((item) => item.threshold)
      .sort(
        (a, b) =>
          RISK_SEVERITY_RANK[(b.threshold as RiskThreshold).severity] -
            RISK_SEVERITY_RANK[(a.threshold as RiskThreshold).severity] ||
          (b.threshold as RiskThreshold).score - (a.threshold as RiskThreshold).score ||
          a.rule.title.localeCompare(b.rule.title),
      )
    return {
      category,
      label: RISK_CATEGORY_LABELS[category],
      score,
      severity: getSeverityForScore(score),
      applicableRuleCount: categoryEvaluations.length,
      triggeredRuleCount: triggered.length,
      scoreFormula: aggregate ? aggregate.formula : "",
      topTriggeredRules: triggered.map((item) => ({
        ruleId: item.rule.ruleId,
        title: item.rule.title,
        metricDisplay: formatMetricDisplay(roundMetric(item.metric.value ?? 0), item.metric.unit),
      })),
    } satisfies RiskCategorySummary
  }).filter((summary): summary is RiskCategorySummary => summary !== null)
}

function buildScoringModel(
  evaluations: Array<{ rule: RiskRule; threshold: RiskThreshold | null }>,
  overallScore: number,
): RiskScoringModel {
  return {
    ruleScoring:
      "Each rule measures one metric and compares it against fixed thresholds. The crossed threshold determines the rule score (0–100) and its severity.",
    categoryAggregation:
      "A category score is the importance-weighted average of its applicable rule scores. Rules that did not trigger contribute 0.",
    overallAggregation:
      "The overall risk score is the importance-weighted average across all applicable rules. Rules that did not trigger contribute 0.",
    overallFormula: formatWeightedAverageFormula(
      evaluations.map((item) => ({ score: item.threshold?.score || 0, weight: item.rule.weight })),
      overallScore,
      "Overall risk",
    ),
    severityBands: RISK_SCORE_SEVERITY_BANDS,
  }
}

function buildFindingExplanation(input: {
  rule: Pick<RiskRule, "metric" | "weight" | "thresholds" | "recommendationTemplate">
  metricValue: number
  metricUnit: RiskMetric["unit"]
  score: number
  threshold: RiskThreshold
  evidence: RiskEvidence | null
  categoryAggregate: RiskCategoryAggregate | null
}): RiskFindingExplanation {
  const { rule, metricValue, metricUnit, score, threshold, evidence, categoryAggregate } = input
  const operatorSymbol = formatRiskOperator(threshold.operator)
  const crossedDisplay = `${operatorSymbol} ${formatMetricDisplay(threshold.value, metricUnit)}`
  const weightedPoints = Math.round(score * rule.weight)
  const categoryLabel = categoryAggregate?.label ?? ""
  const explanation: RiskFindingExplanation = {
    metricLabel: RISK_METRIC_LABELS[rule.metric],
    metricDisplay: formatMetricDisplay(metricValue, metricUnit),
    evidence: evidence ?? {
      whatHappened: `${rule.metric}: ${formatMetricDisplay(metricValue, metricUnit)}.`,
      values: [{ label: RISK_METRIC_LABELS[rule.metric], display: formatMetricDisplay(metricValue, metricUnit), raw: metricValue }],
      absoluteChange: null,
      percentChange: null,
      periodsCompared: null,
      scope: null,
      sourceColumns: [],
      unavailable: ["Detailed row-level evidence is not available for this rule."],
      interpretation: rule.recommendationTemplate,
      sourceMetric: RISK_METRIC_LABELS[rule.metric],
    },
    threshold: {
      operator: threshold.operator,
      value: threshold.value,
      display: crossedDisplay,
      severity: threshold.severity,
      score: threshold.score,
      severityReason: `${RISK_SEVERITY_LABELS[threshold.severity]} applies because ${formatMetricDisplay(metricValue, metricUnit)} is within the ${RISK_SEVERITY_LABELS[threshold.severity]} band (${crossedDisplay}).`,
      bands: rule.thresholds.map((band) => ({
        severity: band.severity,
        display: `${formatRiskOperator(band.operator)} ${formatMetricDisplay(band.value, metricUnit)}`,
        score: band.score,
        matched: band.severity === threshold.severity && band.value === threshold.value && band.score === threshold.score,
      })),
    },
    score: {
      ruleScore: score,
      weight: rule.weight,
      weightedPoints,
      contributionDisplay: `${score} × ${formatWeight(rule.weight)} = ${weightedPoints} weighted points`,
      contributionNote:
        "The weighted contribution ranks rules by importance inside the category. It is not a monetary impact estimate.",
      categoryLabel,
      categoryScore: categoryAggregate?.score ?? score,
      categoryFormula: categoryAggregate?.formula ?? "",
    },
    investigation: rule.recommendationTemplate,
  }
  return explanation
}

function formatWeightedAverageFormula(
  terms: Array<{ score: number; weight: number }>,
  score: number,
  label: string,
) {
  const weightTotal = roundWeight(terms.reduce((sum, term) => sum + term.weight, 0))
  const numerator = terms.map((term) => `${term.score}×${formatWeight(term.weight)}`).join(" + ")
  return `${label} = round((${numerator}) ÷ ${formatWeight(weightTotal)}) = ${score}`
}

function formatMeanFormula(scores: number[], score: number, label: string) {
  return `${label} = round((${scores.join(" + ")}) ÷ ${scores.length}) = ${score}`
}

function roundWeight(value: number) {
  return Math.round(value * 100) / 100
}

function formatWeight(value: number) {
  return String(roundWeight(value))
}

function formatMetricDisplay(value: number, unit: RiskMetric["unit"]) {
  if (unit === "percent") return `${roundMetric(value)}%`
  if (unit === "score") return `${roundMetric(value)}`
  return formatCount(value)
}

function formatAmount(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 })
}

function formatCount(value: number) {
  return roundMetric(value).toLocaleString("en-US", { maximumFractionDigits: 1 })
}

function formatSignedPercent(value: number) {
  const rounded = roundMetric(value)
  return `${rounded > 0 ? "+" : ""}${rounded}%`
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

function calculateDeadStockDetail(
  rows: RiskDataRow[],
  productColumn: string | null,
  stockColumn: string | null,
  soldColumn: string | null,
): { ratio: number; evidence: RiskEvidence } | null {
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
  const ratio = (deadStock / products.size) * 100
  const deadNames = [...products.entries()]
    .filter(([, item]) => item.stock > 0 && item.sold <= 0)
    .map(([name]) => name)
  return {
    ratio,
    evidence: {
      whatHappened: `${formatCount(deadStock)} of ${formatCount(products.size)} stocked products have stock on hand with no recorded sales (${formatSignedPercent(ratio)}).`,
      values: [
        { label: "Products with stock on hand and no sales", display: formatCount(deadStock), raw: deadStock },
        { label: "Stocked products in total", display: formatCount(products.size), raw: products.size },
        ...(deadNames.length > 0
          ? [{ label: "Examples", display: deadNames.slice(0, 5).join(", ") + (deadNames.length > 5 ? ` (+${deadNames.length - 5} more)` : ""), raw: null }]
          : []),
      ],
      absoluteChange: null,
      percentChange: null,
      periodsCompared: null,
      scope: `${formatCount(products.size)} products across ${formatCount(rows.length)} rows`,
      sourceColumns: unique([productColumn, stockColumn, soldColumn]),
      unavailable: [],
      interpretation: "Stock that never sells ties up working capital and storage while generating no revenue.",
      sourceMetric: `${RISK_METRIC_LABELS.deadStockRatio} (product, inventory_on_hand, units_sold)`,
    },
  }
}

function calculateUnprofitableProductDetail(
  rows: RiskDataRow[],
  productColumn: string | null,
  revenueColumn: string | null,
  costColumns: string[],
): { ratio: number; evidence: RiskEvidence } | null {
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
  const ratio = (unprofitable / products.size) * 100
  const lossProducts = [...products.entries()]
    .filter(([, item]) => item.revenue - item.cost < 0)
    .map(([name]) => name)
  return {
    ratio,
    evidence: {
      whatHappened: `${formatCount(unprofitable)} of ${formatCount(products.size)} products generate less revenue than their mapped costs (${formatSignedPercent(ratio)}).`,
      values: [
        { label: "Products with revenue below mapped costs", display: formatCount(unprofitable), raw: unprofitable },
        { label: "Products in total", display: formatCount(products.size), raw: products.size },
        ...(lossProducts.length > 0
          ? [{ label: "Examples", display: lossProducts.slice(0, 5).join(", ") + (lossProducts.length > 5 ? ` (+${lossProducts.length - 5} more)` : ""), raw: null }]
          : []),
      ],
      absoluteChange: null,
      percentChange: null,
      periodsCompared: null,
      scope: `${formatCount(products.size)} products across ${formatCount(rows.length)} rows`,
      sourceColumns: unique([productColumn, revenueColumn, ...costColumns]),
      unavailable: [],
      interpretation: "Selling below mapped cost erodes margin on every additional unit sold.",
      sourceMetric: `${RISK_METRIC_LABELS.unprofitableProductRatio} (product, revenue, cost)`,
    },
  }
}

function calculateTopShareDetail(
  rows: RiskDataRow[],
  dimensionColumn: string | null,
  valueColumn: string | null,
  dimensionLabel: string,
): { share: number; evidence: RiskEvidence } | null {
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
  const share = (top / total) * 100
  const topEntity = [...groups.entries()].reduce((max, entry) => (entry[1] > max[1] ? entry : max))
  return {
    share,
    evidence: {
      whatHappened: `The largest ${dimensionLabel} accounts for ${formatSignedPercent(share)} of the mapped value across ${formatCount(groups.size)} ${dimensionLabel}(s).`,
      values: [
        { label: `Largest ${dimensionLabel}`, display: topEntity[0], raw: topEntity[0] },
        { label: `Value for the largest ${dimensionLabel}`, display: formatAmount(topEntity[1]), raw: roundMetric(topEntity[1]) },
        { label: `Total mapped value`, display: formatAmount(total), raw: roundMetric(total) },
        { label: `${dimensionLabel === "portfolio company" ? "Portfolio companies" : `${dimensionLabel}(s)`} counted`, display: formatCount(groups.size), raw: groups.size },
      ],
      absoluteChange: null,
      percentChange: { display: formatSignedPercent(share), raw: roundMetric(share) },
      periodsCompared: null,
      scope: `${formatCount(groups.size)} ${dimensionLabel}(s) across ${formatCount(rows.length)} rows`,
      sourceColumns: [dimensionColumn, valueColumn],
      unavailable: [],
      interpretation: `Concentration on one ${dimensionLabel} means ${formatSignedPercent(share)} of value depends on a single counterparty or group.`,
      sourceMetric: `${RISK_METRIC_LABELS.topProductRevenueShare} (${dimensionLabel}, value)`,
    },
  }
}

function calculateRunwayBreachDetail(rows: RiskDataRow[], runwayColumn: string | null): { ratio: number; evidence: RiskEvidence } | null {
  if (!runwayColumn) return null
  const values = rows.map((row) => parseNumber(row[runwayColumn])).filter((value): value is number => value !== null)
  if (values.length === 0) return null
  const breaches = values.filter((value) => value < 6).length
  const ratio = (breaches / values.length) * 100
  return {
    ratio,
    evidence: {
      whatHappened: `${formatCount(breaches)} of ${formatCount(values.length)} portfolio companies report less than 6 months of runway (${formatSignedPercent(ratio)}).`,
      values: [
        { label: "Companies below 6 months of runway", display: formatCount(breaches), raw: breaches },
        { label: "Companies with reported runway", display: formatCount(values.length), raw: values.length },
        { label: "Runway threshold", display: "6 months", raw: 6 },
      ],
      absoluteChange: null,
      percentChange: { display: formatSignedPercent(ratio), raw: roundMetric(ratio) },
      periodsCompared: null,
      scope: `${formatCount(values.length)} portfolio companies`,
      sourceColumns: [runwayColumn],
      unavailable: [],
      interpretation: "Companies under 6 months of runway face funding pressure before their next milestone.",
      sourceMetric: `${RISK_METRIC_LABELS.portfolioRunwayBreachRatio} (portfolio company runway)`,
    },
  }
}

function calculateRunwayDetail(
  rows: RiskDataRow[],
  cashBalanceColumn: string | null,
  burnColumn: string | null,
): { months: number; evidence: RiskEvidence } | null {
  if (!cashBalanceColumn || !burnColumn) return null
  let latest: { cash: number; burn: number } | null = null
  for (const row of rows) {
    const cash = parseNumber(row[cashBalanceColumn])
    const burn = parseNumber(row[burnColumn])
    if (cash === null || burn === null || burn <= 0 || cash <= 0) continue
    latest = { cash, burn }
  }
  if (!latest) return null
  const months = latest.cash / latest.burn
  return {
    months,
    evidence: {
      whatHappened: `The latest valid cash balance of ${formatAmount(latest.cash)} against monthly burn of ${formatAmount(latest.burn)} gives ${formatCount(months)} months of runway.`,
      values: [
        { label: "Latest confirmed cash balance", display: formatAmount(latest.cash), raw: roundMetric(latest.cash) },
        { label: "Latest confirmed monthly burn", display: formatAmount(latest.burn), raw: roundMetric(latest.burn) },
      ],
      absoluteChange: null,
      percentChange: null,
      periodsCompared: null,
      scope: `Point-in-time value from ${formatCount(rows.length)} rows`,
      sourceColumns: [cashBalanceColumn, burnColumn],
      unavailable: [],
      interpretation: `At the current burn rate, confirmed cash covers about ${formatCount(months)} months of operations.`,
      sourceMetric: `${RISK_METRIC_LABELS.runwayMonths} (cash_balance, burn)`,
    },
  }
}

function calculateMissingDetail(rows: RiskDataRow[], columns: string[]): { ratio: number; evidence: RiskEvidence } | null {
  if (rows.length === 0 || columns.length === 0) return null
  let missing = 0
  let total = 0
  for (const row of rows) {
    for (const column of columns) {
      total += 1
      if (isBlank(row[column])) missing += 1
    }
  }
  if (total <= 0) return null
  const ratio = (missing / total) * 100
  return {
    ratio,
    evidence: {
      whatHappened: `${formatCount(missing)} of ${formatCount(total)} mapped business cells are empty across ${formatCount(rows.length)} rows and ${formatCount(columns.length)} mapped columns (${formatSignedPercent(ratio)}).`,
      values: [
        { label: "Empty mapped business cells", display: formatCount(missing), raw: missing },
        { label: "Mapped business cells checked", display: formatCount(total), raw: total },
        { label: "Mapped columns checked", display: formatCount(columns.length), raw: columns.length },
      ],
      absoluteChange: null,
      percentChange: { display: formatSignedPercent(ratio), raw: roundMetric(ratio) },
      periodsCompared: null,
      scope: `${formatCount(rows.length)} rows × ${formatCount(columns.length)} mapped columns`,
      sourceColumns: columns,
      unavailable: [],
      interpretation: "Blanks in mapped business fields reduce how much of the dataset can support reliable calculations.",
      sourceMetric: `${RISK_METRIC_LABELS.missingValueRatio} (mapped business columns)`,
    },
  }
}

function calculateInvalidNumericDetail(rows: RiskDataRow[], columns: string[]): { ratio: number; evidence: RiskEvidence } | null {
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
  if (total <= 0) return null
  const ratio = (invalid / total) * 100
  return {
    ratio,
    evidence: {
      whatHappened: `${formatCount(invalid)} of ${formatCount(total)} filled mapped numeric cells cannot be parsed as numbers (${formatSignedPercent(ratio)}).`,
      values: [
        { label: "Unparseable numeric values", display: formatCount(invalid), raw: invalid },
        { label: "Filled mapped numeric cells", display: formatCount(total), raw: total },
        { label: "Numeric columns checked", display: formatCount(columns.length), raw: columns.length },
      ],
      absoluteChange: null,
      percentChange: { display: formatSignedPercent(ratio), raw: roundMetric(ratio) },
      periodsCompared: null,
      scope: `${formatCount(rows.length)} rows × ${formatCount(columns.length)} mapped numeric columns`,
      sourceColumns: columns,
      unavailable: [],
      interpretation: "Unparseable numbers in business columns make dependent KPIs unreliable.",
      sourceMetric: `${RISK_METRIC_LABELS.invalidNumericRatio} (mapped numeric columns)`,
    },
  }
}

function calculateInvalidDateDetail(rows: RiskDataRow[], dateColumns: string[]): { ratio: number; evidence: RiskEvidence } | null {
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
  if (total <= 0) return null
  const ratio = (invalid / total) * 100
  return {
    ratio,
    evidence: {
      whatHappened: `${formatCount(invalid)} of ${formatCount(total)} filled date values cannot be parsed with the canonical date parser (${formatSignedPercent(ratio)}).`,
      values: [
        { label: "Unparseable date values", display: formatCount(invalid), raw: invalid },
        { label: "Filled date values", display: formatCount(total), raw: total },
        { label: "Date columns checked", display: formatCount(dateColumns.length), raw: dateColumns.length },
      ],
      absoluteChange: null,
      percentChange: { display: formatSignedPercent(ratio), raw: roundMetric(ratio) },
      periodsCompared: null,
      scope: `${formatCount(rows.length)} rows × ${formatCount(dateColumns.length)} date column(s)`,
      sourceColumns: dateColumns,
      unavailable: [],
      interpretation: "Invalid dates break period comparisons and trend calculations.",
      sourceMetric: `${RISK_METRIC_LABELS.invalidDateRatio} (date columns)`,
    },
  }
}

function calculateDuplicateDetail(rows: RiskDataRow[]): { ratio: number; evidence: RiskEvidence } | null {
  if (rows.length === 0) return null
  const seen = new Set<string>()
  let duplicates = 0
  for (const row of rows) {
    const key = JSON.stringify(Object.entries(row).sort(([a], [b]) => a.localeCompare(b)))
    if (seen.has(key)) duplicates += 1
    else seen.add(key)
  }
  const ratio = (duplicates / rows.length) * 100
  return {
    ratio,
    evidence: {
      whatHappened: `${formatCount(duplicates)} of ${formatCount(rows.length)} rows are exact duplicates of an earlier row (${formatSignedPercent(ratio)}).`,
      values: [
        { label: "Duplicate rows", display: formatCount(duplicates), raw: duplicates },
        { label: "Rows in total", display: formatCount(rows.length), raw: rows.length },
      ],
      absoluteChange: null,
      percentChange: { display: formatSignedPercent(ratio), raw: roundMetric(ratio) },
      periodsCompared: null,
      scope: `${formatCount(rows.length)} rows`,
      sourceColumns: [],
      unavailable: [],
      interpretation: "Exact duplicate rows double-count values and distort totals and KPIs.",
      sourceMetric: `${RISK_METRIC_LABELS.duplicateRowRatio} (rows)`,
    },
  }
}

function calculateCurrencyDetail(rows: RiskDataRow[], currencyColumn: string | null): { ratio: number; evidence: RiskEvidence } | null {
  if (!currencyColumn) return null
  const values = rows.map((row) => String(row[currencyColumn] || "").trim().toUpperCase()).filter(Boolean)
  if (values.length === 0) return null
  const counts = countValues(values)
  const dominant = Math.max(...Object.values(counts))
  const dominantLabel = Object.entries(counts).find(([, count]) => count === dominant)?.[0] ?? ""
  const minority = values.length - dominant
  const ratio = (minority / values.length) * 100
  return {
    ratio,
    evidence: {
      whatHappened: `${formatCount(minority)} of ${formatCount(values.length)} currency labels differ from the dominant label ${dominantLabel} (${formatSignedPercent(ratio)}).`,
      values: [
        { label: "Currency labels checked", display: formatCount(values.length), raw: values.length },
        { label: "Distinct currency labels", display: formatCount(Object.keys(counts).length), raw: Object.keys(counts).length },
        { label: "Labels outside the dominant currency", display: formatCount(minority), raw: minority },
      ],
      absoluteChange: null,
      percentChange: { display: formatSignedPercent(ratio), raw: roundMetric(ratio) },
      periodsCompared: null,
      scope: `${formatCount(values.length)} currency labels across ${formatCount(rows.length)} rows`,
      sourceColumns: [currencyColumn],
      unavailable: [],
      interpretation: "Mixed currency labels make sums across rows incomparable without conversion.",
      sourceMetric: `${RISK_METRIC_LABELS.currencyInconsistencyRatio} (currency)`,
    },
  }
}

function calculateConfidenceDetail(profile: SemanticProfile, columns: string[]): { value: number; evidence: RiskEvidence } | null {
  if (columns.length === 0) return null
  const confirmed = profile.concepts.filter((mapping) => mapping.status === "confirmed").length
  const value = Math.min(100, Math.round((confirmed / columns.length) * 100))
  return {
    value,
    evidence: {
      whatHappened: `${formatCount(confirmed)} of ${formatCount(columns.length)} columns are semantically confirmed for business calculations (readiness ${formatCount(value)}).`,
      values: [
        { label: "Confirmed business columns", display: formatCount(confirmed), raw: confirmed },
        { label: "Columns in total", display: formatCount(columns.length), raw: columns.length },
      ],
      absoluteChange: null,
      percentChange: { display: formatSignedPercent(value), raw: value },
      periodsCompared: null,
      scope: `${formatCount(columns.length)} columns`,
      sourceColumns: [],
      unavailable: [],
      interpretation: "Low mapping readiness means fewer columns can be trusted for KPI and risk calculations.",
      sourceMetric: `${RISK_METRIC_LABELS.classificationConfidence} (semantic mapping profile)`,
    },
  }
}

function buildHistoryEvidence(series: Array<{ period: string; value: number }>): RiskEvidence | null {
  if (series.length === 0) return null
  const periods = series.map((item) => item.period)
  return {
    whatHappened: `${formatCount(series.length)} revenue period(s) are available for trend comparison.`,
    values: [
      { label: "Comparable revenue periods", display: formatCount(series.length), raw: series.length },
      { label: "Periods", display: periods.slice(0, 12).join(", ") + (periods.length > 12 ? " …" : ""), raw: null },
    ],
    absoluteChange: null,
    percentChange: null,
    periodsCompared: periods.length >= 2 ? `${periods[0]} → ${periods[periods.length - 1]}` : null,
    scope: `${formatCount(series.length)} period(s)`,
    sourceColumns: [],
    unavailable: series.length < 2 ? ["Fewer than two periods exist, so no period-over-period comparison is possible."] : [],
    interpretation: "Trend rules need at least two comparable periods to measure change.",
    sourceMetric: `${RISK_METRIC_LABELS.historyPeriodCount} (revenue, date)`,
  }
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

function metricFromValue(value: number | null, unit: RiskMetric["unit"], source: string, evidence?: RiskEvidence | null): RiskMetric {
  if (value === null || !Number.isFinite(value)) {
    return { value: null, available: false, unit, source }
  }
  return { value: roundMetric(value), available: true, unit, source, ...(evidence ? { details: evidence } : {}) }
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
