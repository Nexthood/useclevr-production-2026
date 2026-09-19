import { getBillingPlanByTier, type BillingPlan } from "@/lib/billing/plans"

/**
 * Authoritative customer-facing feature credit costs.
 *
 * Single source of truth: every reservation, debit, pricing preview, and
 * customer-facing copy derives from this table. Adjust values here only —
 * never scatter numeric literals through feature code.
 *
 * Canonical credit value: 1 credit = €0.085 customer value (10 credits = €0.85).
 */
export const FEATURE_CREDIT_COSTS = {
  /** Upload + standard initial analysis, charged once as a single feature. */
  STANDARD_UPLOAD_ANALYSIS: 10,
  /** Each successfully completed AI Analyst/Assistant request. */
  AI_ANALYST_MESSAGE: 1,
  /** Report generation and report regeneration (new processing each time). */
  REPORT_GENERATION: 3,
  /** Forecast generation. */
  FORECAST: 3,
  /** Profitability analysis run. */
  PROFITABILITY_ANALYSIS: 15,
  /** Downloading an already generated report artifact costs nothing. */
  EXISTING_REPORT_DOWNLOAD: 0,
} as const

/**
 * Canonical customer value of one credit: €0.085 (10 credits = €0.85).
 * Internal economic constant — never expose provider/margin cost data.
 */
export const CREDIT_VALUE_EUR = 0.085

/** Credits per euro, derived from the canonical credit value. */
export const CREDITS_PER_EURO = 1 / CREDIT_VALUE_EUR

export const CREDIT_ENGINE_FEATURES = [
  "standard_upload_analysis",
  "ai_question",
  "report_generation",
  "forecast",
  "profitability_analysis",
  "existing_report_download",
  "accountancy_analysis",
  "prebookkeeping_analysis",
  "document_extraction",
  "embedding_ingestion",
  "hybrid_retrieval",
  "export_generation",
] as const

export type CreditFeature = (typeof CREDIT_ENGINE_FEATURES)[number]

export type FeatureCostInput = {
  rowCount?: number | null
  fileSizeBytes?: number | null
  modelMultiplier?: number | null
  estimatedTokens?: number | null
}

export type FeatureCostRule = {
  feature: CreditFeature
  label: string
  baseCredits: number
  maxReservationCredits: number
  allowedPlans: Array<BillingPlan["tier"] | "demo" | "admin" | "superadmin">
  variableCredits(input: FeatureCostInput): number
}

/**
 * Credit costs are deterministic flat amounts. variableCredits stays in the
 * rule shape so the economic model can later be adjusted from real provider
 * usage data without rewriting feature logic.
 */
const flatCosts = (baseCredits: number) => ({
  maxReservationCredits: baseCredits,
  variableCredits: () => 0,
})

export const FEATURE_COST_REGISTRY: Record<CreditFeature, FeatureCostRule> = {
  standard_upload_analysis: {
    feature: "standard_upload_analysis",
    label: "Upload with standard analysis",
    baseCredits: FEATURE_CREDIT_COSTS.STANDARD_UPLOAD_ANALYSIS,
    allowedPlans: ["free", "demo", "pro", "business", "admin", "superadmin"],
    ...flatCosts(FEATURE_CREDIT_COSTS.STANDARD_UPLOAD_ANALYSIS),
  },
  ai_question: {
    feature: "ai_question",
    label: "AI Analyst message",
    baseCredits: FEATURE_CREDIT_COSTS.AI_ANALYST_MESSAGE,
    allowedPlans: ["free", "demo", "pro", "business", "admin", "superadmin"],
    ...flatCosts(FEATURE_CREDIT_COSTS.AI_ANALYST_MESSAGE),
  },
  report_generation: {
    feature: "report_generation",
    label: "Report generation",
    baseCredits: FEATURE_CREDIT_COSTS.REPORT_GENERATION,
    allowedPlans: ["free", "demo", "pro", "business", "admin", "superadmin"],
    ...flatCosts(FEATURE_CREDIT_COSTS.REPORT_GENERATION),
  },
  forecast: {
    feature: "forecast",
    label: "Forecast",
    baseCredits: FEATURE_CREDIT_COSTS.FORECAST,
    allowedPlans: ["free", "demo", "pro", "business", "admin", "superadmin"],
    ...flatCosts(FEATURE_CREDIT_COSTS.FORECAST),
  },
  profitability_analysis: {
    feature: "profitability_analysis",
    label: "Profitability analysis",
    baseCredits: FEATURE_CREDIT_COSTS.PROFITABILITY_ANALYSIS,
    allowedPlans: ["pro", "business", "admin", "superadmin"],
    ...flatCosts(FEATURE_CREDIT_COSTS.PROFITABILITY_ANALYSIS),
  },
  existing_report_download: {
    feature: "existing_report_download",
    label: "Existing report download",
    baseCredits: FEATURE_CREDIT_COSTS.EXISTING_REPORT_DOWNLOAD,
    allowedPlans: ["free", "demo", "pro", "business", "admin", "superadmin"],
    ...flatCosts(FEATURE_CREDIT_COSTS.EXISTING_REPORT_DOWNLOAD),
  },
  accountancy_analysis: {
    feature: "accountancy_analysis",
    label: "Accountancy analysis",
    baseCredits: 15,
    allowedPlans: ["business", "admin", "superadmin"],
    ...flatCosts(15),
  },
  prebookkeeping_analysis: {
    feature: "prebookkeeping_analysis",
    label: "Pre-bookkeeping analysis",
    baseCredits: 15,
    allowedPlans: ["business", "admin", "superadmin"],
    ...flatCosts(15),
  },
  document_extraction: {
    feature: "document_extraction",
    label: "Document extraction",
    baseCredits: 10,
    allowedPlans: ["business", "admin", "superadmin"],
    ...flatCosts(10),
  },
  embedding_ingestion: {
    feature: "embedding_ingestion",
    label: "Embedding ingestion",
    baseCredits: 1,
    allowedPlans: ["pro", "business", "admin", "superadmin"],
    ...flatCosts(1),
  },
  hybrid_retrieval: {
    feature: "hybrid_retrieval",
    label: "Hybrid retrieval",
    baseCredits: 1,
    allowedPlans: ["free", "demo", "pro", "business", "admin", "superadmin"],
    ...flatCosts(1),
  },
  export_generation: {
    feature: "export_generation",
    label: "Export generation",
    baseCredits: 5,
    allowedPlans: ["free", "demo", "pro", "business", "admin", "superadmin"],
    ...flatCosts(5),
  },
}

export function normalizeCreditFeature(actionType: string): CreditFeature {
  if ((CREDIT_ENGINE_FEATURES as readonly string[]).includes(actionType)) {
    return actionType as CreditFeature
  }

  if (actionType === "ai_chat") return "ai_question"
  if (actionType === "dataset_analysis") return "standard_upload_analysis"
  if (actionType === "standard_analysis") return "standard_upload_analysis"
  if (actionType === "data_insight") return "standard_upload_analysis"
  if (actionType === "dashboard_generation") return "standard_upload_analysis"
  if (actionType === "multi_dataset_analysis") return "standard_upload_analysis"
  if (actionType === "dataset_upload") return "standard_upload_analysis"
  if (actionType === "file_upload") return "standard_upload_analysis"
  if (actionType === "retail_analysis") return "standard_upload_analysis"
  if (actionType === "forecast_analysis") return "forecast"
  if (actionType === "report_download") return "existing_report_download"
  if (actionType === "mcp_tool_invocation") return "hybrid_retrieval"

  return "standard_upload_analysis"
}

export function estimateFeatureCredits(featureOrAction: string, input: FeatureCostInput = {}) {
  const feature = normalizeCreditFeature(featureOrAction)
  const rule = FEATURE_COST_REGISTRY[feature]
  const multiplier = Math.max(1, input.modelMultiplier ?? 1)
  const credits = Math.ceil((rule.baseCredits + rule.variableCredits(input)) * multiplier)
  return Math.max(0, Math.min(rule.maxReservationCredits, credits))
}

export function canPlanUseFeature(tier: string | null | undefined, featureOrAction: string) {
  const normalizedTier = tier === "admin" || tier === "superadmin"
    ? tier
    : getBillingPlanByTier(tier).tier
  return FEATURE_COST_REGISTRY[normalizeCreditFeature(featureOrAction)].allowedPlans.includes(normalizedTier)
}
