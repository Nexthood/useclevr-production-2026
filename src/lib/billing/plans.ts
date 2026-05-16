export type BillingPlanId = "free" | "pro_monthly" | "pro_annual" | "business_monthly"

export interface BillingPlan {
  id: BillingPlanId
  name: string
  tier: "free" | "pro" | "business"
  price: number
  interval: "month" | "year"
  description: string
  features: string[]
  discountLabel?: string
  paymentProviderConnected?: boolean
}

export const billingPlans: BillingPlan[] = [
  {
    id: "free",
    name: "Free",
    tier: "free",
    price: 0,
    interval: "month",
    description: "Explore UseClevr with basic cloud analysis.",
    features: ["1 dataset", "Limited AI questions", "Basic insights"],
  },
  {
    id: "pro_monthly",
    name: "Pro",
    tier: "pro",
    price: 40,
    interval: "month",
    description: "Unlimited datasets, report downloads, and Hybrid AI Lite.",
    features: ["Unlimited datasets", "Hybrid AI Lite", "Priority processing", "Download center"],
    paymentProviderConnected: false,
  },
  {
    id: "pro_annual",
    name: "Pro Annual",
    tier: "pro",
    price: 400,
    interval: "year",
    description: "Pro access with the automatic annual discount applied.",
    features: ["Everything in Pro", "Automatic annual discount", "Hybrid AI Lite"],
    discountLabel: "Auto discount: save €80/year",
    paymentProviderConnected: false,
  },
  {
    id: "business_monthly",
    name: "Business / Custom",
    tier: "business",
    price: 420,
    interval: "month",
    description: "Higher volume, advanced security, and dedicated support.",
    features: ["Custom limits", "Advanced security", "Private deployment options", "Dedicated support"],
    paymentProviderConnected: false,
  },
]

export function getBillingPlan(planId: string | null | undefined) {
  return billingPlans.find((plan) => plan.id === planId) || billingPlans[1]
}

export function formatPlanPrice(plan: BillingPlan) {
  if (plan.price === 0) return "€0/month"
  return `€${plan.price}/${plan.interval === "year" ? "year" : "month"}`
}
