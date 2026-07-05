export type BillingPlanId = "free" | "pro_monthly" | "business_monthly";
export type StripePricePlanId = BillingPlanId | "pro_annual";

type StripePriceEnvConfig = {
  primary: string;
  fallbacks?: string[];
};

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
  maxDatasets: number;
  maxRowsPerFile: number;
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

export const billingPlans: BillingPlan[] = [
  {
    id: "free",
    name: "Free",
    tier: "free",
    price: 0,
    interval: "month",
    description: "Explore UseClevr with basic cloud analysis.",
    features: ["2 datasets", "Limited AI questions", "Basic insights"],
    maxDatasets: 2,
    maxRowsPerFile: 5_000,
  },
  {
    id: "pro_monthly",
    name: "Pro",
    tier: "pro",
    price: 40,
    interval: "month",
    description: "Up to 25 datasets, report downloads, and Hybrid AI Lite.",
    features: ["25 datasets", "Hybrid AI Lite", "Priority processing", "Download center"],
    maxDatasets: 25,
    maxRowsPerFile: 100_000,
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
      "Unlimited datasets",
      "Unlimited AI analyses",
      "Full Hybrid AI",
      "Team members",
      "API & MCP access",
      "Priority infrastructure",
      "Advanced BI modules",
      "Private deployment options",
      "Dedicated support",
      "White-label options",
      "Enterprise billing",
    ],
    maxDatasets: Infinity,
    maxRowsPerFile: 300_000,
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
  return plan.maxDatasets
}

export function getRowLimitForTier(tier: string | null | undefined): number {
  const plan = getBillingPlanByTier(tier)
  return plan.maxRowsPerFile
}
