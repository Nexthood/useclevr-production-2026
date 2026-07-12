import { getBillingPlanByTier, type BillingPlan } from "@/lib/billing/plans"

export const CREDIT_ENGINE_FEATURES = [
  "ai_question",
  "standard_analysis",
  "retail_analysis",
  "profitability_analysis",
  "accountancy_analysis",
  "prebookkeeping_analysis",
  "report_generation",
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
  allowedPlans: Array<BillingPlan["tier"] | "admin" | "superadmin">
  variableCredits(input: FeatureCostInput): number
}

const onePer = (value: number | null | undefined, divisor: number) =>
  Math.max(0, Math.ceil(Math.max(0, value ?? 0) / divisor))

export const FEATURE_COST_REGISTRY: Record<CreditFeature, FeatureCostRule> = {
  ai_question: {
    feature: "ai_question",
    label: "AI question",
    baseCredits: 2,
    maxReservationCredits: 12,
    allowedPlans: ["free", "demo", "pro", "business", "admin", "superadmin"],
    variableCredits: (input) => onePer(input.estimatedTokens, 8_000),
  },
  standard_analysis: {
    feature: "standard_analysis",
    label: "Standard analysis",
    baseCredits: 10,
    maxReservationCredits: 60,
    allowedPlans: ["free", "demo", "pro", "business", "admin", "superadmin"],
    variableCredits: (input) => onePer(input.rowCount, 10_000),
  },
  retail_analysis: {
    feature: "retail_analysis",
    label: "Retail analysis",
    baseCredits: 12,
    maxReservationCredits: 75,
    allowedPlans: ["free", "demo", "pro", "business", "admin", "superadmin"],
    variableCredits: (input) => onePer(input.rowCount, 8_000),
  },
  profitability_analysis: {
    feature: "profitability_analysis",
    label: "Profitability analysis",
    baseCredits: 12,
    maxReservationCredits: 75,
    allowedPlans: ["pro", "business", "admin", "superadmin"],
    variableCredits: (input) => onePer(input.rowCount, 8_000),
  },
  accountancy_analysis: {
    feature: "accountancy_analysis",
    label: "Accountancy analysis",
    baseCredits: 15,
    maxReservationCredits: 90,
    allowedPlans: ["business", "admin", "superadmin"],
    variableCredits: (input) => onePer(input.rowCount, 5_000),
  },
  prebookkeeping_analysis: {
    feature: "prebookkeeping_analysis",
    label: "Pre-bookkeeping analysis",
    baseCredits: 15,
    maxReservationCredits: 90,
    allowedPlans: ["business", "admin", "superadmin"],
    variableCredits: (input) => onePer(input.rowCount, 5_000),
  },
  report_generation: {
    feature: "report_generation",
    label: "Report generation",
    baseCredits: 20,
    maxReservationCredits: 80,
    allowedPlans: ["free", "demo", "pro", "business", "admin", "superadmin"],
    variableCredits: (input) => onePer(input.fileSizeBytes, 2_000_000),
  },
  document_extraction: {
    feature: "document_extraction",
    label: "Document extraction",
    baseCredits: 10,
    maxReservationCredits: 100,
    allowedPlans: ["business", "admin", "superadmin"],
    variableCredits: (input) => onePer(input.fileSizeBytes, 1_000_000),
  },
  embedding_ingestion: {
    feature: "embedding_ingestion",
    label: "Embedding ingestion",
    baseCredits: 1,
    maxReservationCredits: 50,
    allowedPlans: ["pro", "business", "admin", "superadmin"],
    variableCredits: (input) => onePer(input.estimatedTokens, 20_000),
  },
  hybrid_retrieval: {
    feature: "hybrid_retrieval",
    label: "Hybrid retrieval",
    baseCredits: 1,
    maxReservationCredits: 10,
    allowedPlans: ["free", "demo", "pro", "business", "admin", "superadmin"],
    variableCredits: () => 0,
  },
  export_generation: {
    feature: "export_generation",
    label: "Export generation",
    baseCredits: 5,
    maxReservationCredits: 30,
    allowedPlans: ["free", "demo", "pro", "business", "admin", "superadmin"],
    variableCredits: (input) => onePer(input.rowCount, 20_000),
  },
}

export function normalizeCreditFeature(actionType: string): CreditFeature {
  if ((CREDIT_ENGINE_FEATURES as readonly string[]).includes(actionType)) {
    return actionType as CreditFeature
  }

  if (actionType === "ai_chat") return "ai_question"
  if (actionType === "dataset_analysis") return "standard_analysis"
  if (actionType === "data_insight") return "standard_analysis"
  if (actionType === "dashboard_generation") return "standard_analysis"
  if (actionType === "multi_dataset_analysis") return "standard_analysis"
  if (actionType === "forecast_analysis") return "profitability_analysis"
  if (actionType === "mcp_tool_invocation") return "hybrid_retrieval"
  if (actionType === "file_upload") return "document_extraction"

  return "standard_analysis"
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
