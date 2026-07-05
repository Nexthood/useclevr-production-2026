export type BillingPlanId = "free" | "pro_monthly" | "business_monthly";
export type StripePricePlanId = BillingPlanId | "pro_annual";

type StripePriceEnvConfig = {
  primary: string;
  fallbacks?: string[];
};

export interface PlanLimits {
  monthlyCredits: number;
  maxDatasets: number;
  maxFileSizeMb: number;
  maxRowsPerDataset: number;
  maxTeamMembers: number;
  maxAiRequestsPerDay: number;
  maxConcurrentAnalyses: number;
  creditResetDay: number;
}

export interface BillingPlan {
  id: BillingPlanId;
  name: string;
  tier: "free" | "pro" | "business";
  price: number;
  interval: "month";
  description: string;
  features: string[];
  discountLabel?: string;
  stripePriceId?: string;
  limits: PlanLimits;
}

const stripePriceEnvByPlanId: Partial<Record<StripePricePlanId, StripePriceEnvConfig>> = {
  pro_monthly: { primary: "STRIPE_PRICE_PRO_MONTHLY" },
  pro_annual: { primary: "STRIPE_PRICE_PRO_ANNUAL" },
  business_monthly: {
    primary: "STRIPE_PRICE_BUSINESS_MONTHLY",
    fallbacks: ["STRIPE_PRICE_ID_BUSINESS_MONTHLY"],
  },
};

export function getStripePriceEnvNames(planId: StripePricePlanId): string[] {
  const config = stripePriceEnvByPlanId[planId];
  if (!config) return [];
  return [config.primary, ...(config.fallbacks ?? [])];
}

export function resolveStripePriceId(planId: StripePricePlanId): string | undefined {
  return getStripePriceEnvNames(planId)
    .map((envName) => process.env[envName]?.trim())
    .find((priceId): priceId is string => Boolean(priceId));
}

export function getMissingStripePriceEnvLabel(planId: StripePricePlanId): string {
  const envNames = getStripePriceEnvNames(planId);
  return envNames.length > 0 ? envNames.join(" or ") : "no Stripe price env configured";
}

export function logMissingStripePriceId(plan: BillingPlan, context: string) {
  if (process.env.NODE_ENV === "production" || plan.tier === "free" || plan.stripePriceId) return;

  console.warn(
    `[${context}] Missing Stripe price ID for plan "${plan.id}". Set ${getMissingStripePriceEnvLabel(plan.id)}.`,
  );
}

export const FREE_PLAN_LIMITS: PlanLimits = {
  monthlyCredits: 50,
  maxDatasets: 2,
  maxFileSizeMb: 10,
  maxRowsPerDataset: 5000,
  maxTeamMembers: 1,
  maxAiRequestsPerDay: 20,
  maxConcurrentAnalyses: 1,
  creditResetDay: 1,
};

export const PRO_PLAN_LIMITS: PlanLimits = {
  monthlyCredits: 500,
  maxDatasets: 25,
  maxFileSizeMb: 100,
  maxRowsPerDataset: 100000,
  maxTeamMembers: 5,
  maxAiRequestsPerDay: 200,
  maxConcurrentAnalyses: 3,
  creditResetDay: 1,
};

export const BUSINESS_PLAN_LIMITS: PlanLimits = {
  monthlyCredits: 5000,
  maxDatasets: 100,
  maxFileSizeMb: 500,
  maxRowsPerDataset: 300000,
  maxTeamMembers: 20,
  maxAiRequestsPerDay: 1000,
  maxConcurrentAnalyses: 10,
  creditResetDay: 1,
};

export const billingPlans: BillingPlan[] = [
  {
    id: "free",
    name: "Free",
    tier: "free",
    price: 0,
    interval: "month",
    description: "Explore UseClevr with basic cloud analysis.",
    features: [
      "50 AI credits/month",
      "2 datasets",
      "10MB file size limit",
      "5,000 rows per dataset",
      "20 AI requests/day",
      "Basic AI insights",
    ],
    limits: FREE_PLAN_LIMITS,
  },
  {
    id: "pro_monthly",
    name: "Pro",
    tier: "pro",
    price: 40,
    interval: "month",
    description: "Up to 25 datasets, report downloads, and Hybrid AI Lite.",
    features: [
      "500 AI credits/month",
      "25 datasets",
      "100MB file size limit",
      "100,000 rows per dataset",
      "5 team members",
      "200 AI requests/day",
      "Hybrid AI Lite",
      "Priority processing",
      "Download center",
    ],
    limits: PRO_PLAN_LIMITS,
    stripePriceId: resolveStripePriceId("pro_monthly"),
  },
  {
    id: "business_monthly",
    name: "Business",
    tier: "business",
    price: 420,
    interval: "month",
    description: "Unlimited datasets, full Hybrid AI, teams, API access, and enterprise-grade support.",
    features: [
      "5,000 AI credits/month",
      "100 datasets",
      "500MB file size limit",
      "300,000 rows per dataset",
      "20 team members",
      "1,000 AI requests/day",
      "Full Hybrid AI",
      "API & MCP access",
      "Priority infrastructure",
      "Advanced BI modules",
      "Dedicated support",
      "White-label options",
      "Enterprise billing",
    ],
    limits: BUSINESS_PLAN_LIMITS,
    stripePriceId: resolveStripePriceId("business_monthly"),
  },
];

export const publicMonthlyPlanPrices = {
  pro: billingPlans.find((plan) => plan.id === "pro_monthly")?.price ?? 40,
  business: billingPlans.find((plan) => plan.id === "business_monthly")?.price ?? 420,
} as const

export function getBillingPlan(planId: string | null | undefined) {
  return billingPlans.find((plan) => plan.id === normalizeBillingPlanId(planId)) || billingPlans[1];
}

export function getBillingPlanByTier(tier: string | null | undefined) {
  return billingPlans.find((plan) => plan.tier === tier) || billingPlans[0];
}

export function normalizeBillingPlanId(planId: string | null | undefined): BillingPlanId {
  if (planId === "business" || planId === "business_monthly") return "business_monthly"
  if (planId === "free") return "free"
  return "pro_monthly"
}

export function formatPlanPrice(plan: BillingPlan) {
  if (plan.price === 0) return "€0/month";
  return `€${plan.price}/month`;
}

export function getDatasetLimitForTier(tier: string | null | undefined): number {
  const plan = getBillingPlanByTier(tier)
  return plan.limits.maxDatasets
}

export function getRowLimitForTier(tier: string | null | undefined): number {
  const plan = getBillingPlanByTier(tier)
  return plan.limits.maxRowsPerDataset
}

export function getCreditsLimitForTier(tier: string | null | undefined): number {
  const plan = getBillingPlanByTier(tier)
  return plan.limits.monthlyCredits
}

export function getFileSizeLimitForTier(tier: string | null | undefined): number {
  const plan = getBillingPlanByTier(tier)
  return plan.limits.maxFileSizeMb
}

export function getTeamMembersLimitForTier(tier: string | null | undefined): number {
  const plan = getBillingPlanByTier(tier)
  return plan.limits.maxTeamMembers
}

export function getAiRequestsLimitForTier(tier: string | null | undefined): number {
  const plan = getBillingPlanByTier(tier)
  return plan.limits.maxAiRequestsPerDay
}

export function getConcurrentAnalysesLimitForTier(tier: string | null | undefined): number {
  const plan = getBillingPlanByTier(tier)
  return plan.limits.maxConcurrentAnalyses
}

export function getCreditResetDayForTier(tier: string | null | undefined): number {
  const plan = getBillingPlanByTier(tier)
  return plan.limits.creditResetDay
}
