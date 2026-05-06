export const PRODUCTS = {
  pro_monthly: {
    id: "pro_monthly",
    name: "UseClevr Pro",
    description:
      "For professionals & teams. Unlimited datasets, advanced AI assistant, priority processing, email support, and API access.",
    priceInCents: 2900,
    currency: "eur",
    interval: "month" as const,
  },
  pro_yearly: {
    id: "pro_yearly",
    name: "UseClevr Pro (Yearly)",
    description:
      "For professionals & teams. Unlimited datasets, advanced AI assistant, priority processing, email support, and API access.",
    priceInCents: 29000,
    currency: "eur",
    interval: "year" as const,
  },
}

// Credit-based pricing (like v0)
export const CREDIT_PACKAGES = {
  starter: {
    id: "credits_starter",
    name: "Starter Pack",
    credits: 100,
    priceInCents: 1000, // €10
    currency: "eur",
  },
  standard: {
    id: "credits_standard",
    name: "Standard Pack",
    credits: 300,
    priceInCents: 2500, // €25
    currency: "eur",
    popular: true,
  },
  premium: {
    id: "credits_premium",
    name: "Premium Pack",
    credits: 1000,
    priceInCents: 7500, // €75
    currency: "eur",
  },
}

// Credit costs per action
export const CREDIT_COSTS = {
  csv_upload: 10, // 10 credits per CSV upload
  ai_query: 5, // 5 credits per AI query
  chart_generation: 15, // 15 credits per chart
  export: 5, // 5 credits per export
}

export const FREE_UPLOADS_LIMIT = 3

export type ProductId = keyof typeof PRODUCTS
export type CreditPackageId = keyof typeof CREDIT_PACKAGES
