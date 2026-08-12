import {
  formatMonthlyPrice,
  getFixedProPrice,
  getCheckoutMarketOptions,
  getProLaunchPrices,
  getProStripePriceId,
  getStripePriceIdForCheckout,
  type SupportedCurrency,
} from "@/lib/billing/launch-pricing";

export type BillingPlanId = "free" | "pro_monthly" | "business_monthly" | "demo";
export type StripePricePlanId = BillingPlanId | "pro_annual" | "business_annual";

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
  isDemo?: boolean;
}

export interface BillingPlan {
  id: BillingPlanId;
  name: string;
  tier: "free" | "pro" | "business";
  price: number;
  priceInMinor?: number;
  currency?: SupportedCurrency;
  launchPrices?: Array<{ currency: SupportedCurrency; amountMinor: number; label: string }>;
  interval: "month";
  description: string;
  features: string[];
  discountLabel?: string;
  stripePriceId?: string;
  limits: PlanLimits;
}

const stripePriceEnvByPlanId: Partial<Record<StripePricePlanId, StripePriceEnvConfig>> = {
  pro_monthly: {
    primary: "STRIPE_PRICE_PRO_EUR_MONTHLY",
    fallbacks: ["STRIPE_PRICE_PRO_MONTHLY", "STRIPE_PRICE_ID_PRO_MONTHLY"],
  },
  pro_annual: {
    primary: "STRIPE_PRICE_PRO_ANNUAL",
    fallbacks: ["STRIPE_PRICE_PRO_EUR_ANNUAL"],
  },
  business_monthly: {
    primary: "STRIPE_PRICE_BUSINESS_EUR_MONTHLY",
    fallbacks: ["STRIPE_PRICE_BUSINESS_MONTHLY", "STRIPE_PRICE_ID_BUSINESS_MONTHLY"],
  },
  business_annual: {
    primary: "STRIPE_PRICE_BUSINESS_ANNUAL",
    fallbacks: ["STRIPE_PRICE_BUSINESS_EUR_ANNUAL"],
  },
};

export function getStripePriceEnvNames(planId: StripePricePlanId): string[] {
  if (planId === "pro_monthly" || planId === "business_monthly") {
    const slug = planId === "pro_monthly" ? "pro" : "business";
    return getCheckoutMarketOptions(slug).flatMap((option) => option.priceEnvNames);
  }

  const config = stripePriceEnvByPlanId[planId];
  if (!config) return [];
  return [config.primary, ...(config.fallbacks ?? [])];
}

export function resolveStripePriceId(planId: StripePricePlanId): string | undefined {
  if (planId === "pro_monthly") return getProStripePriceId("EUR");
  if (planId === "business_monthly") return getStripePriceIdForCheckout("business", "eu");

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
  monthlyCredits: 2,
  maxDatasets: 2,
  maxFileSizeMb: 10,
  maxRowsPerDataset: 5000,
  maxTeamMembers: 1,
  maxAiRequestsPerDay: 20,
  maxConcurrentAnalyses: 1,
  creditResetDay: 1,
};

export const DEMO_PLAN_LIMITS: PlanLimits = {
  monthlyCredits: 2,
  maxDatasets: 1,
  maxFileSizeMb: 10,
  maxRowsPerDataset: 5000,
  maxTeamMembers: 1,
  maxAiRequestsPerDay: 10,
  maxConcurrentAnalyses: 1,
  creditResetDay: 1,
  isDemo: true,
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
  maxDatasets: 250,
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
    description: "Try UseClevr with essential AI insights.",
    features: [
      "CSV & Excel Upload",
      "2 AI Credits total",
      "Up to 2 Datasets",
      "Basic AI Insights",
      "Retail Dashboard",
      "Community Support",
    ],
    limits: FREE_PLAN_LIMITS,
  },
  {
    id: "pro_monthly",
    name: "Pro",
    tier: "pro",
    price: 40,
    priceInMinor: getFixedProPrice("EUR").amountMinor,
    currency: "EUR",
    launchPrices: getProLaunchPrices(),
    interval: "month",
    description: "AI-powered analytics for growing businesses.",
    features: [
      "500 AI Credits / Month",
      "Up to 25 Datasets",
      "AI Business Analysis",
      "Revenue Analysis",
      "Margin Analysis",
      "Low Stock Detection",
      "Dead Stock Detection",
      "PDF Reports",
      "Excel Export",
      "Priority Support",
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
    description: "AI business intelligence platform for teams that need governed, explainable analysis.",
    features: [
      "Everything in Pro",
      "5000 AI Credits / Month",
      "Up to 250 Datasets",
      "Larger File Upload Limits",
      "Dataset-aware AI Analyst",
      "Executive AI Briefings",
      "Risk Intelligence",
      "Automatic KPI Discovery",
      "Evidence & Confidence Scores",
      "Explainable AI Governance",
      "Business Profile Intelligence",
      "Accounting AI",
      "Invoice Processing",
      "Receipt Processing",
      "Multi-dataset Intelligence",
      "Dedicated Support",
    ],
    limits: BUSINESS_PLAN_LIMITS,
    stripePriceId: resolveStripePriceId("business_monthly"),
  },
];

export const publicMonthlyPlanPrices = {
  pro: billingPlans.find((plan) => plan.id === "pro_monthly")?.price ?? 40,
  business: billingPlans.find((plan) => plan.id === "business_monthly")?.price ?? 420,
} as const

export const publicProMonthlyLaunchPrices = getProLaunchPrices()

export function getBillingPlan(planId: string | null | undefined) {
  return billingPlans.find((plan) => plan.id === normalizeBillingPlanId(planId)) || billingPlans[1];
}

export function getBillingPlanByTier(tier: string | null | undefined) {
  return billingPlans.find((plan) => plan.tier === normalizeSubscriptionTier(tier)) || billingPlans[0];
}

export function formatCustomerPlanLabel(tier: string | null | undefined, unlimitedLabel?: string | null) {
  if (unlimitedLabel) return unlimitedLabel

  const normalizedTier = tier?.toLowerCase()
  if (normalizedTier === "superadmin") return "Super admin"
  if (normalizedTier === "admin") return "Admin"

  return getBillingPlanByTier(normalizedTier).name
}

export function normalizeBillingPlanId(planId: string | null | undefined): BillingPlanId {
  if (planId === "business" || planId === "business_monthly") return "business_monthly"
  if (planId === "free") return "free"
  if (planId === "demo") return "free"
  return "pro_monthly"
}

export function normalizeSubscriptionTier(tier: string | null | undefined): BillingPlan["tier"] {
  const normalizedTier = tier?.toLowerCase()
  if (normalizedTier === "business") return "business"
  if (normalizedTier === "pro") return "pro"
  return "free"
}

export function formatPlanPrice(plan: BillingPlan) {
  if (plan.price === 0) return "$0/€0/month";
  if (plan.id === "pro_monthly") return formatMonthlyPrice(getFixedProPrice("EUR").amountMinor, "EUR");
  return `€${plan.price}/month`;
}

export function formatPlanPriceForCurrency(plan: BillingPlan, currency: SupportedCurrency = "EUR") {
  if (plan.price === 0) return "$0/€0/month";
  if (plan.id === "pro_monthly") {
    return formatMonthlyPrice(getFixedProPrice(currency).amountMinor, currency);
  }
  return formatPlanPrice(plan);
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
