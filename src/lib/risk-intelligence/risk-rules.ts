export const RISK_ENGINE_VERSION = "risk-intelligence-lite-v1" as const

export type RiskCategory =
  | "inventory"
  | "financial"
  | "profitability"
  | "cash_flow"
  | "revenue_concentration"
  | "data_quality"

export type RiskSeverity = "low" | "medium" | "high" | "critical"

export type RiskOperator = ">=" | "<=" | ">" | "<"

export type RiskMetricKey =
  | "deadStockRatio"
  | "revenueGrowthPct"
  | "grossMarginTrendPct"
  | "netMarginPct"
  | "unprofitableProductRatio"
  | "costRevenueGrowthGapPct"
  | "expenseRevenueRatio"
  | "topProductRevenueShare"
  | "topCategoryRevenueShare"
  | "topCustomerRevenueShare"
  | "missingValueRatio"
  | "invalidNumericRatio"
  | "invalidDateRatio"
  | "duplicateRowRatio"
  | "currencyInconsistencyRatio"
  | "classificationConfidence"
  | "historyPeriodCount"

export type RiskThreshold = {
  severity: RiskSeverity
  operator: RiskOperator
  value: number
  score: number
}

export type RiskRule = {
  ruleId: string
  category: RiskCategory
  title: string
  description: string
  metric: RiskMetricKey
  weight: number
  thresholds: RiskThreshold[]
  requiredFields: string[]
  supportedDatasetTypes: string[]
  recommendationTemplate: string
  sourceTemplate: string
}

export const RISK_SEVERITY_RANK: Record<RiskSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
}

export const RISK_SEVERITY_LABELS: Record<RiskSeverity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
}

export function getSeverityForScore(score: number): RiskSeverity {
  if (score >= 75) return "critical"
  if (score >= 50) return "high"
  if (score >= 25) return "medium"
  return "low"
}

export function thresholdMatches(value: number, threshold: RiskThreshold) {
  if (threshold.operator === ">=") return value >= threshold.value
  if (threshold.operator === "<=") return value <= threshold.value
  if (threshold.operator === ">") return value > threshold.value
  return value < threshold.value
}

export const SUPPORTED_RISK_DATASET_TYPES = [
  "standard",
  "retail",
  "profitability",
  "accountancy",
  "prebookkeeping",
] as const

const ALL_SUPPORTED_TYPES = [...SUPPORTED_RISK_DATASET_TYPES]
const FINANCIAL_TYPES = ["standard", "profitability", "accountancy", "prebookkeeping"]
const RETAIL_TYPES = ["standard", "retail"]

export const RISK_RULES: RiskRule[] = [
  {
    ruleId: "inventory.dead_stock_ratio.v1",
    category: "inventory",
    title: "Dead-stock inventory exposure",
    description: "Measures stocked products with no detected sales activity.",
    metric: "deadStockRatio",
    weight: 1.2,
    requiredFields: ["stock", "quantity sold", "product"],
    supportedDatasetTypes: RETAIL_TYPES,
    sourceTemplate: "Retail or uploaded inventory rows",
    recommendationTemplate: "Review products with stock on hand and no detected sales before reordering.",
    thresholds: [
      { severity: "medium", operator: ">=", value: 10, score: 45 },
      { severity: "high", operator: ">=", value: 20, score: 70 },
      { severity: "critical", operator: ">=", value: 35, score: 92 },
    ],
  },
  {
    ruleId: "financial.revenue_decline.v1",
    category: "financial",
    title: "Latest-period revenue decline",
    description: "Compares the latest detected revenue period against the previous period.",
    metric: "revenueGrowthPct",
    weight: 1.15,
    requiredFields: ["revenue", "date"],
    supportedDatasetTypes: FINANCIAL_TYPES,
    sourceTemplate: "Revenue trend KPI",
    recommendationTemplate: "Investigate the latest revenue decline and review affected products, customers, or periods.",
    thresholds: [
      { severity: "medium", operator: "<=", value: -5, score: 45 },
      { severity: "high", operator: "<=", value: -10, score: 70 },
      { severity: "critical", operator: "<=", value: -20, score: 94 },
    ],
  },
  {
    ruleId: "profitability.margin_decline.v1",
    category: "profitability",
    title: "Declining gross margin",
    description: "Flags a drop in gross margin between comparable periods.",
    metric: "grossMarginTrendPct",
    weight: 1,
    requiredFields: ["revenue", "cost", "date"],
    supportedDatasetTypes: FINANCIAL_TYPES,
    sourceTemplate: "Profitability period KPI",
    recommendationTemplate: "Compare revenue and cost movement in the latest period before changing pricing or costs.",
    thresholds: [
      { severity: "medium", operator: "<=", value: -3, score: 40 },
      { severity: "high", operator: "<=", value: -8, score: 68 },
      { severity: "critical", operator: "<=", value: -15, score: 90 },
    ],
  },
  {
    ruleId: "profitability.negative_net_margin.v1",
    category: "profitability",
    title: "Negative net margin",
    description: "Detects datasets where known costs exceed revenue.",
    metric: "netMarginPct",
    weight: 1.2,
    requiredFields: ["revenue", "cost or profit"],
    supportedDatasetTypes: FINANCIAL_TYPES,
    sourceTemplate: "Profitability KPI",
    recommendationTemplate: "Review the rows or segments contributing negative margin and validate cost inputs.",
    thresholds: [
      { severity: "high", operator: "<", value: 0, score: 72 },
      { severity: "critical", operator: "<=", value: -10, score: 92 },
    ],
  },
  {
    ruleId: "profitability.unprofitable_products.v1",
    category: "profitability",
    title: "Multiple unprofitable products",
    description: "Measures product groups with negative calculated profit.",
    metric: "unprofitableProductRatio",
    weight: 0.9,
    requiredFields: ["product", "revenue", "cost or profit"],
    supportedDatasetTypes: ["standard", "retail", "profitability"],
    sourceTemplate: "Product profitability breakdown",
    recommendationTemplate: "Rank negative-margin products by impact and validate whether price, cost, or returns drive the loss.",
    thresholds: [
      { severity: "medium", operator: ">=", value: 10, score: 42 },
      { severity: "high", operator: ">=", value: 25, score: 68 },
      { severity: "critical", operator: ">=", value: 40, score: 88 },
    ],
  },
  {
    ruleId: "profitability.cost_growth_exceeds_revenue.v1",
    category: "profitability",
    title: "Cost growth exceeds revenue growth",
    description: "Compares latest-period cost growth against revenue growth.",
    metric: "costRevenueGrowthGapPct",
    weight: 0.9,
    requiredFields: ["revenue", "cost", "date"],
    supportedDatasetTypes: FINANCIAL_TYPES,
    sourceTemplate: "Revenue and cost period KPIs",
    recommendationTemplate: "Review recent cost growth against revenue movement by period and category.",
    thresholds: [
      { severity: "medium", operator: ">=", value: 5, score: 42 },
      { severity: "high", operator: ">=", value: 12, score: 68 },
      { severity: "critical", operator: ">=", value: 25, score: 90 },
    ],
  },
  {
    ruleId: "cash_flow.expenses_exceed_revenue.v1",
    category: "cash_flow",
    title: "Expenses exceed revenue",
    description: "Compares known expense or cost values against revenue.",
    metric: "expenseRevenueRatio",
    weight: 1.15,
    requiredFields: ["revenue", "expenses or cost"],
    supportedDatasetTypes: FINANCIAL_TYPES,
    sourceTemplate: "Revenue and expense KPIs",
    recommendationTemplate: "Review expense categories that exceed revenue and validate whether the dataset covers the same period.",
    thresholds: [
      { severity: "medium", operator: ">=", value: 80, score: 45 },
      { severity: "high", operator: ">=", value: 100, score: 74 },
      { severity: "critical", operator: ">=", value: 120, score: 92 },
    ],
  },
  {
    ruleId: "concentration.top_product_share.v1",
    category: "revenue_concentration",
    title: "Top-product revenue concentration",
    description: "Measures the top product share of detected revenue.",
    metric: "topProductRevenueShare",
    weight: 0.95,
    requiredFields: ["product", "revenue"],
    supportedDatasetTypes: ["standard", "retail", "profitability"],
    sourceTemplate: "Product revenue breakdown",
    recommendationTemplate: "Review dependency on the top revenue product and compare alternatives before scaling spend.",
    thresholds: [
      { severity: "medium", operator: ">=", value: 35, score: 45 },
      { severity: "high", operator: ">=", value: 50, score: 70 },
      { severity: "critical", operator: ">=", value: 70, score: 92 },
    ],
  },
  {
    ruleId: "concentration.top_category_share.v1",
    category: "revenue_concentration",
    title: "Top-category revenue concentration",
    description: "Measures the top category share of detected revenue.",
    metric: "topCategoryRevenueShare",
    weight: 0.9,
    requiredFields: ["category", "revenue"],
    supportedDatasetTypes: ["standard", "retail", "profitability"],
    sourceTemplate: "Category revenue breakdown",
    recommendationTemplate: "Review category dependency and compare performance across secondary categories.",
    thresholds: [
      { severity: "medium", operator: ">=", value: 35, score: 45 },
      { severity: "high", operator: ">=", value: 50, score: 70 },
      { severity: "critical", operator: ">=", value: 70, score: 92 },
    ],
  },
  {
    ruleId: "concentration.top_customer_share.v1",
    category: "revenue_concentration",
    title: "Top-customer revenue concentration",
    description: "Measures the largest customer share of detected revenue.",
    metric: "topCustomerRevenueShare",
    weight: 1,
    requiredFields: ["customer", "revenue"],
    supportedDatasetTypes: ["standard", "profitability", "accountancy"],
    sourceTemplate: "Customer revenue breakdown",
    recommendationTemplate: "Review customer concentration and compare revenue across the remaining customer base.",
    thresholds: [
      { severity: "medium", operator: ">=", value: 35, score: 45 },
      { severity: "high", operator: ">=", value: 50, score: 70 },
      { severity: "critical", operator: ">=", value: 70, score: 92 },
    ],
  },
  {
    ruleId: "data_quality.missing_values.v1",
    category: "data_quality",
    title: "Missing values in detected business fields",
    description: "Measures blanks only across detected business-critical columns.",
    metric: "missingValueRatio",
    weight: 0.75,
    requiredFields: ["detected business columns"],
    supportedDatasetTypes: ALL_SUPPORTED_TYPES,
    sourceTemplate: "Dataset profiling",
    recommendationTemplate: "Fill blanks in detected business-critical fields or remove rows that cannot support KPI calculations.",
    thresholds: [
      { severity: "low", operator: ">=", value: 5, score: 20 },
      { severity: "medium", operator: ">=", value: 15, score: 45 },
      { severity: "high", operator: ">=", value: 30, score: 70 },
    ],
  },
  {
    ruleId: "data_quality.invalid_numeric_values.v1",
    category: "data_quality",
    title: "Invalid numeric business values",
    description: "Detects unparseable numbers in detected metric columns.",
    metric: "invalidNumericRatio",
    weight: 0.85,
    requiredFields: ["numeric business columns"],
    supportedDatasetTypes: ALL_SUPPORTED_TYPES,
    sourceTemplate: "Dataset profiling",
    recommendationTemplate: "Fix numeric formatting in revenue, cost, stock, quantity, and margin fields before relying on the score.",
    thresholds: [
      { severity: "medium", operator: ">=", value: 5, score: 45 },
      { severity: "high", operator: ">=", value: 15, score: 70 },
      { severity: "critical", operator: ">=", value: 35, score: 90 },
    ],
  },
  {
    ruleId: "data_quality.invalid_dates.v1",
    category: "data_quality",
    title: "Invalid date values",
    description: "Detects unparseable values in detected date columns.",
    metric: "invalidDateRatio",
    weight: 0.65,
    requiredFields: ["date"],
    supportedDatasetTypes: ALL_SUPPORTED_TYPES,
    sourceTemplate: "Dataset profiling",
    recommendationTemplate: "Normalize date values so trend and period comparisons use comparable rows.",
    thresholds: [
      { severity: "medium", operator: ">=", value: 5, score: 40 },
      { severity: "high", operator: ">=", value: 15, score: 66 },
      { severity: "critical", operator: ">=", value: 35, score: 88 },
    ],
  },
  {
    ruleId: "data_quality.duplicate_rows.v1",
    category: "data_quality",
    title: "Duplicate rows",
    description: "Detects exact duplicate uploaded rows.",
    metric: "duplicateRowRatio",
    weight: 0.65,
    requiredFields: ["rows"],
    supportedDatasetTypes: ALL_SUPPORTED_TYPES,
    sourceTemplate: "Dataset profiling",
    recommendationTemplate: "Remove exact duplicate rows before calculating final KPIs and reports.",
    thresholds: [
      { severity: "low", operator: ">=", value: 2, score: 18 },
      { severity: "medium", operator: ">=", value: 8, score: 42 },
      { severity: "high", operator: ">=", value: 20, score: 68 },
    ],
  },
  {
    ruleId: "data_quality.inconsistent_currency.v1",
    category: "data_quality",
    title: "Inconsistent currency labels",
    description: "Detects multiple currency labels in one dataset.",
    metric: "currencyInconsistencyRatio",
    weight: 0.75,
    requiredFields: ["currency"],
    supportedDatasetTypes: ALL_SUPPORTED_TYPES,
    sourceTemplate: "Dataset profiling",
    recommendationTemplate: "Split or normalize rows with different currency labels before comparing revenue, costs, or profit.",
    thresholds: [
      { severity: "medium", operator: ">=", value: 1, score: 45 },
      { severity: "high", operator: ">=", value: 10, score: 68 },
      { severity: "critical", operator: ">=", value: 25, score: 88 },
    ],
  },
  {
    ruleId: "data_quality.low_classification_confidence.v1",
    category: "data_quality",
    title: "Low calculation readiness",
    description: "Measures whether enough business columns are mapped for reliable risk intelligence.",
    metric: "classificationConfidence",
    weight: 0.8,
    requiredFields: ["mapped revenue, inventory, or profitability columns"],
    supportedDatasetTypes: ALL_SUPPORTED_TYPES,
    sourceTemplate: "Column mapping profile",
    recommendationTemplate: "Map or rename core business columns such as revenue, cost, product, stock, quantity, date, category, or customer.",
    thresholds: [
      { severity: "medium", operator: "<=", value: 40, score: 45 },
      { severity: "high", operator: "<=", value: 20, score: 70 },
      { severity: "critical", operator: "<=", value: 0, score: 90 },
    ],
  },
  {
    ruleId: "data_quality.insufficient_history.v1",
    category: "data_quality",
    title: "Insufficient trend history",
    description: "Detects when comparable period history is too short for trend analysis.",
    metric: "historyPeriodCount",
    weight: 0.45,
    requiredFields: ["date", "revenue"],
    supportedDatasetTypes: ALL_SUPPORTED_TYPES,
    sourceTemplate: "Revenue trend profile",
    recommendationTemplate: "Upload at least two comparable periods before relying on trend-based risk signals.",
    thresholds: [
      { severity: "low", operator: "<", value: 2, score: 20 },
    ],
  },
]
