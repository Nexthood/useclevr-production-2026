import {
  billingPlans,
  publicMonthlyPlanPrices,
} from "@/lib/billing/plans";
import {
  proMarketByCurrency,
  resolvePlanPrice,
  type SupportedCurrency,
} from "@/lib/billing/launch-pricing";
import { FEATURE_CREDIT_COSTS } from "@/lib/billing/feature-costs";
import { allowedUploadDatasetCategories } from "@/lib/data/dataset-category";
import { STANDARD_UPLOAD_FORMAT_EXTENSIONS } from "@/lib/upload/upload-security";
import type { SupportedUsyLanguage, UsyContactCategory } from "@/lib/usy/types";

export const supportedUsyCurrencies: SupportedCurrency[] = ["EUR", "GBP", "USD", "CAD"];

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

export const usyClevrSyncFacts = {
  accessRules: {
    free: "ClevrSync is not available on Free.",
    pro: "ClevrSync is enabled on Pro.",
    business: "ClevrSync is enabled on Business.",
    superadmin: "ClevrSync is enabled for superadmins regardless of subscription.",
  },
  connectors: [
    { name: "Google Sheets", status: "available" as const },
    { name: "OneDrive", status: "available" as const },
    { name: "SharePoint", status: "available" as const },
  ],
  localFilesAreNotConnectors:
    "Excel and CSV files can be uploaded directly through UseClevr. ClevrSync is used for connecting external data sources such as Google Sheets, OneDrive, and SharePoint.",
  googleSheetsFlow: [
    "Connect Google",
    "Select spreadsheet",
    "Select worksheet",
    "Preview",
    "Connect & Analyze",
    "UseClevr creates or updates the dataset",
    "Analysis opens for the selected dataset",
  ],
  oneDriveFlow: [
    "Connect Microsoft",
    "Select OneDrive Excel workbook",
    "Select worksheet",
    "Preview",
    "Connect & Analyze",
    "UseClevr creates or updates the dataset",
    "Analysis opens for the selected dataset",
  ],
  sharePointFlow: [
    "Connect Microsoft",
    "Select SharePoint site",
    "Select document library",
    "Select Excel workbook",
    "Select worksheet",
    "Preview",
    "Connect & Analyze",
    "UseClevr creates or updates the dataset",
    "Analysis opens for the selected dataset",
  ],
  manualUrlEntryFallback: "Manual Google Sheet URL entry is only a fallback when discovery does not list the spreadsheet.",
  discoveryPreviewCredits:
    "ClevrSync discovery and preview do not consume analysis credits; credits are charged when a connection runs Connect & Analyze.",
} as const;

export const usyDatasetIsolationFacts = {
  selectedDatasetOnly:
    "UseClevr analysis and generated reports for a selected dataset use only that dataset.",
  noCrossDatasetAggregation:
    "Dashboard and report metrics are never automatically aggregated across all datasets when a specific dataset is selected.",
  provenance:
    "Reports identify the calculation basis as selected dataset only, include rows analyzed, and keep dataset-specific calculations and provenance.",
} as const;

export const usyReportFacts = {
  sections: [
    "Executive Summary",
    "Revenue",
    "Orders",
    "AOV",
    "Customers",
    "Units Sold",
    "Products",
    "COGS",
    "Gross Profit",
    "Gross Margin",
    "Revenue trends",
    "Category performance",
    "Product performance",
    "Customer metrics",
    "Geography",
    "Business Balanced Scorecard",
    "Recommendations",
    "Data confidence",
    "Provenance",
    "Results Summary",
    "Missing-data disclosure",
  ],
  supportedMetricsOnly:
    "Metrics are only presented when the dataset supports them.",
  missingDataDisclosure:
    "Missing information stays explicitly unavailable instead of being invented; for example, Return Rate is marked unavailable when return values cannot be normalized reliably.",
} as const;

export const usyRetailProfitabilityFacts = {
  revenue: "Revenue maps to the source revenue field.",
  cost: "Cost maps to COGS when valid retail-sales semantics are established.",
  profit: "Profit maps to Gross Profit when valid retail-sales semantics are established.",
  grossMargin: "Gross Margin is derived from valid Revenue/COGS/Profit inputs.",
  noExampleValues:
    "Usy explains the mapping rules without hardcoding example values from any specific dataset.",
} as const;

export const usyCreditCostFacts = {
  uploadWithStandardAnalysis: FEATURE_CREDIT_COSTS.STANDARD_UPLOAD_ANALYSIS,
  aiAssistantMessage: FEATURE_CREDIT_COSTS.AI_ANALYST_MESSAGE,
  reportGeneration: FEATURE_CREDIT_COSTS.REPORT_GENERATION,
  forecast: FEATURE_CREDIT_COSTS.FORECAST,
  profitabilityAnalysis: FEATURE_CREDIT_COSTS.PROFITABILITY_ANALYSIS,
  existingReportDownload: FEATURE_CREDIT_COSTS.EXISTING_REPORT_DOWNLOAD,
  bundledOperationsNote:
    "Internal processing that belongs to the same bundled operation is not charged as an additional user cost.",
} as const;

export function normalizeUsyCurrency(currency?: string | null): SupportedCurrency | null {
  const normalized = currency?.trim().toUpperCase();
  return normalized && (supportedUsyCurrencies as string[]).includes(normalized)
    ? (normalized as SupportedCurrency)
    : null;
}

function monthlyPriceTextForMarket(
  planId: "pro_monthly" | "business_monthly",
  currency: SupportedCurrency,
): string | null {
  const market = proMarketByCurrency[currency];
  const resolved = resolvePlanPrice(planId, market, "monthly");
  return resolved?.displayPrice ?? null;
}

export function getPlanSummary(currency?: string | null) {
  const free = billingPlans.find((plan) => plan.id === "free");
  const pro = billingPlans.find((plan) => plan.id === "pro_monthly");
  const business = billingPlans.find((plan) => plan.id === "business_monthly");
  const resolvedCurrency = normalizeUsyCurrency(currency) ?? "EUR";

  return {
    currency: resolvedCurrency,
    free: {
      name: free?.name ?? "Free",
      monthlyCredits: free?.limits.monthlyCredits ?? 2,
      monthlyPrice: free?.price ?? 0,
      maxDatasets: free?.limits.maxDatasets ?? 2,
      maxFileSizeMb: free?.limits.maxFileSizeMb ?? 10,
      clevrSyncEnabled: false,
      topUpsEnabled: false,
      features: free?.features ?? [],
    },
    pro: {
      name: pro?.name ?? "Pro",
      priceText: monthlyPriceTextForMarket("pro_monthly", resolvedCurrency)
        ?? `€${publicMonthlyPlanPrices.pro}/month`,
      monthlyPrice: pro?.price ?? 40,
      monthlyCredits: pro?.limits.monthlyCredits ?? 500,
      maxDatasets: pro?.limits.maxDatasets ?? 25,
      maxFileSizeMb: pro?.limits.maxFileSizeMb ?? 100,
      clevrSyncEnabled: true,
      topUpsEnabled: true,
      features: pro?.features ?? [],
    },
    business: {
      name: business?.name ?? "Business",
      priceText: monthlyPriceTextForMarket("business_monthly", resolvedCurrency)
        ?? `€${publicMonthlyPlanPrices.business}/month`,
      monthlyPrice: business?.price ?? 420,
      monthlyCredits: business?.limits.monthlyCredits ?? 1500,
      maxDatasets: business?.limits.maxDatasets ?? 100,
      maxFileSizeMb: business?.limits.maxFileSizeMb ?? 500,
      clevrSyncEnabled: true,
      topUpsEnabled: true,
      features: business?.features ?? [],
    },
    superadmin: {
      name: "Superadmin",
      clevrSyncEnabled: true,
    },
  };
}

export type UsyPlanSummary = ReturnType<typeof getPlanSummary>;
