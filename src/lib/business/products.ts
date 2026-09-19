import { getFixedProPrice } from "@/lib/billing/launch-pricing"

export const PRODUCTS = {
  pro_monthly: {
    id: "pro_monthly",
    name: "UseClevr Pro",
    description:
      "AI-powered analytics for growing businesses.",
    priceInCents: getFixedProPrice("EUR").amountMinor,
    currency: "eur",
    interval: "month" as const,
  },
  business_monthly: {
    id: "business_monthly",
    name: "UseClevr Business",
    description:
      "Advanced AI platform for business teams.",
    priceInCents: 42000,
    currency: "eur",
    interval: "month" as const,
  },
}

export type ProductId = keyof typeof PRODUCTS
