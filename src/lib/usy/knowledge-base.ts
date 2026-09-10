import {
  billingPlans,
  publicMonthlyPlanPrices,
} from "@/lib/billing/plans";
import { allowedUploadDatasetCategories } from "@/lib/data/dataset-category";
import { STANDARD_UPLOAD_FORMAT_EXTENSIONS } from "@/lib/upload/upload-security";
import type { SupportedUsyLanguage, UsyContactCategory } from "@/lib/usy/types";

export const supportedUsyLanguages: SupportedUsyLanguage[] = [
  "english",
  "german",
  "dutch",
  "spanish",
  "hungarian",
  "romanian",
];

export const supportedUsyLanguageLabel = "English, German, Dutch, Spanish, Hungarian, and Romanian";

export const usyContactCategories: UsyContactCategory[] = [
  "sales",
  "technical_support",
  "billing",
  "management",
  "executive",
];

export const usyProductFacts = {
  productName: "UseClevr",
  uploadFormats: [...STANDARD_UPLOAD_FORMAT_EXTENSIONS],
  uploadDatasetTypes: [...allowedUploadDatasetCategories],
  persistentDisclaimer: "UseClevr AI can make mistakes. Verify important business and financial information.",
  routes: {
    upload: "/app/upload",
    datasets: "/app/datasets",
    dashboard: "/app",
    assistant: "/app/assistant",
    reports: "/app/reports",
    billing: "/app/settings/billing",
    account: "/app/settings",
    business: "/app/business",
    retail: "/app/retail",
    accountancy: "/app/accountancy",
    governance: "/app/ai-governance",
    aiTraces: "/app/admin/ai-traces",
    aiBenchmarking: "/app/admin/ai-benchmarking",
    aiCostOptimizer: "/app/admin/ai-cost-optimizer",
    integrations: "/app/retail/integrations",
  },
  contactDepartments: {
    sales: "Sales",
    technical_support: "Technical Support / IT",
    billing: "Billing",
    management: "Management",
    executive: "Executive Management",
  } satisfies Record<UsyContactCategory, string>,
} as const;

export function getPlanSummary() {
  const free = billingPlans.find((plan) => plan.id === "free");
  const pro = billingPlans.find((plan) => plan.id === "pro_monthly");
  const business = billingPlans.find((plan) => plan.id === "business_monthly");

  return {
    free: {
      name: free?.name ?? "Free",
      monthlyCredits: free?.limits.monthlyCredits ?? 2,
      maxDatasets: free?.limits.maxDatasets ?? 2,
      maxFileSizeMb: free?.limits.maxFileSizeMb ?? 10,
      features: free?.features ?? [],
    },
    pro: {
      name: pro?.name ?? "Pro",
      priceText: `€${publicMonthlyPlanPrices.pro}/month`,
      monthlyCredits: pro?.limits.monthlyCredits ?? 500,
      maxDatasets: pro?.limits.maxDatasets ?? 25,
      maxFileSizeMb: pro?.limits.maxFileSizeMb ?? 100,
      features: pro?.features ?? [],
    },
    business: {
      name: business?.name ?? "Business",
      priceText: `EUR ${publicMonthlyPlanPrices.business}/month`,
      monthlyCredits: business?.limits.monthlyCredits ?? 5000,
      maxDatasets: business?.limits.maxDatasets ?? 250,
      maxFileSizeMb: business?.limits.maxFileSizeMb ?? 500,
      features: business?.features ?? [],
    },
  };
}
