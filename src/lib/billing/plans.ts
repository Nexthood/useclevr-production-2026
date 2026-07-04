export type BillingPlanId = "free" | "pro_monthly" | "pro_annual" | "business_monthly";

export interface BillingPlan {
  id: BillingPlanId;
  name: string;
  tier: "free" | "pro" | "business";
  price: number;
  interval: "month" | "year";
  description: string;
  features: string[];
  discountLabel?: string;
  stripePriceId?: string;
  maxDatasets: number;
  maxRowsPerFile: number;
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
    stripePriceId: process.env.STRIPE_PRICE_PRO_MONTHLY,
  },
  {
    id: "pro_annual",
    name: "Pro Annual",
    tier: "pro",
    price: 400,
    interval: "year",
    description: "Pro access with the automatic annual discount applied.",
    features: ["Everything in Pro", "Automatic annual discount", "Hybrid AI Lite"],
    maxDatasets: 25,
    maxRowsPerFile: 100_000,
    discountLabel: "Auto discount: save €80/year",
    stripePriceId: process.env.STRIPE_PRICE_PRO_ANNUAL,
  },
  {
    id: "business_monthly",
    name: "Business / Custom",
    tier: "business",
    price: 420,
    interval: "month",
    description: "Unlimited datasets, advanced security, and dedicated support.",
    features: [
      "Unlimited datasets",
      "Advanced security",
      "Private deployment options",
      "Dedicated support",
    ],
    maxDatasets: Infinity,
    maxRowsPerFile: 300_000,
    stripePriceId: process.env.STRIPE_PRICE_BUSINESS_MONTHLY,
  },
];

export const publicMonthlyPlanPrices = {
  pro: billingPlans.find((plan) => plan.id === "pro_monthly")?.price ?? 40,
  business: billingPlans.find((plan) => plan.id === "business_monthly")?.price ?? 420,
} as const

export function getBillingPlan(planId: string | null | undefined) {
  return billingPlans.find((plan) => plan.id === planId) || billingPlans[1];
}

export function getBillingPlanByTier(tier: string | null | undefined) {
  return billingPlans.find((plan) => plan.tier === tier) || billingPlans[0];
}

export function formatPlanPrice(plan: BillingPlan) {
  if (plan.price === 0) return "€0/month";
  return `€${plan.price}/${plan.interval === "year" ? "year" : "month"}`;
}

export function getDatasetLimitForTier(tier: string | null | undefined): number {
  const plan = getBillingPlanByTier(tier)
  return plan.maxDatasets
}

export function getRowLimitForTier(tier: string | null | undefined): number {
  const plan = getBillingPlanByTier(tier)
  return plan.maxRowsPerFile
}
