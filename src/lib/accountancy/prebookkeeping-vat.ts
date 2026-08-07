import type { CompanySetupPayload, TaxEntry } from "@/lib/business/company-setup";
import type { PrebookkeepingCategory } from "@/lib/accountancy/prebookkeeping-categorization";

export type VatPredictionSource =
  | "business_profile"
  | "learning_rule"
  | "transaction_data"
  | "manual_review";

export type VatPredictionStatus = "predicted" | "needs_review" | "not_applicable";

export type PrebookkeepingVatLearningRuleInput = {
  supplierKey?: string | null;
  descriptionKeyword?: string | null;
  merchantKey?: string | null;
  category?: string | null;
  countryKey?: string | null;
  vatRate?: number | null;
};

export type BusinessTaxProfile = {
  taxCountry: string | null;
  vatRegistered: boolean | null;
  defaultVatRate: number | null;
  reducedVatRate: number | null;
  zeroVatRate: number | null;
  reverseChargeEnabled: boolean;
  fiscalYear: string | null;
  currency: string | null;
  taxRegime: string | null;
  businessType: string | null;
  availableRates: number[];
  source: "business_profile";
};

export type VatPrediction = {
  vatRate: number | null;
  confidence: number;
  reason: string;
  businessRule: string;
  source: VatPredictionSource;
  status: VatPredictionStatus;
};

export type VatPredictionInput = {
  amount: number | null;
  description: string | null;
  supplierCustomer: string | null;
  sourceCategory: string | null;
  category: PrebookkeepingCategory;
  currency: string | null;
  existingVatTax: number | null;
};

type NormalizedVatLearningRule = {
  supplierKey: string | null;
  descriptionKeyword: string | null;
  merchantKey: string | null;
  category: PrebookkeepingCategory | null;
  countryKey: string | null;
  vatRate: number;
};

export function buildBusinessTaxProfile(setup: CompanySetupPayload | null | undefined): BusinessTaxProfile {
  const taxEntries = Array.isArray(setup?.taxSettings.taxEntries) ? setup.taxSettings.taxEntries : [];
  const defaultVatRate = firstNumber(
    setup?.taxSettings.standardTaxRate,
    ...taxEntries
      .filter((entry) => isDefaultTaxEntry(entry))
      .map((entry) => entry.percentage),
  );
  const reducedVatRate = firstNumber(
    setup?.taxSettings.reducedTaxRate,
    ...taxEntries
      .filter((entry) => /reduced|lower|discount/i.test(entry.taxType))
      .map((entry) => entry.percentage),
  );
  const zeroVatRate = firstNumber(
    setup?.taxSettings.zeroTaxRate,
    ...taxEntries
      .filter((entry) => /zero|exempt|export|reverse/i.test(entry.taxType) || normalizeRate(entry.percentage) === 0)
      .map((entry) => entry.percentage),
  );
  const vatRegistered = normalizeVatRegistered(setup?.taxSettings.taxRegistered);
  const configuredRates = uniqueRates([
    defaultVatRate,
    reducedVatRate,
    zeroVatRate,
    ...taxEntries.map((entry) => normalizeRate(entry.percentage)),
    vatRegistered === false ? 0 : null,
  ]);

  return {
    taxCountry: firstText(
      setup?.companyInfo.taxResidenceCountry,
      setup?.companyInfo.countryOfRegistration,
      setup?.companyInfo.country,
    ),
    vatRegistered,
    defaultVatRate,
    reducedVatRate,
    zeroVatRate,
    reverseChargeEnabled: setup?.taxSettings.reverseChargeEnabled === "yes" || taxEntries.some((entry) => /reverse/i.test(`${entry.taxType} ${entry.notes}`)),
    fiscalYear: fiscalYearLabel(setup?.companyInfo.fiscalYearStart, setup?.companyInfo.fiscalYearEnd),
    currency: firstText(setup?.currencySettings.primaryCurrency, setup?.currencySettings.reportingCurrency),
    taxRegime: firstText(setup?.taxSettings.taxType),
    businessType: firstText(setup?.companyInfo.businessType, setup?.companyInfo.industry, setup?.revenueModel.businessModels?.[0]),
    availableRates: configuredRates,
    source: "business_profile",
  };
}

export function predictVatForTransaction(
  input: VatPredictionInput,
  taxProfile: BusinessTaxProfile,
  learningRules: PrebookkeepingVatLearningRuleInput[] = [],
): VatPrediction {
  if (typeof input.existingVatTax === "number") {
    return {
      vatRate: null,
      confidence: 0.99,
      reason: "VAT/tax amount is present in the uploaded transaction.",
      businessRule: "Uploaded VAT amount is authoritative for this row.",
      source: "transaction_data",
      status: "predicted",
    };
  }

  if (taxProfile.vatRegistered === false) {
    return {
      vatRate: 0,
      confidence: 0.99,
      reason: "Business Profile says the business is not VAT registered.",
      businessRule: "Non-registered businesses use a zero tax rate unless manually changed.",
      source: "business_profile",
      status: "not_applicable",
    };
  }

  const learned = findVatLearningRule(input, taxProfile, learningRules);
  if (learned) {
    return {
      vatRate: learned.vatRate,
      confidence: 0.97,
      reason: "Matching supplier, category, and country correction was learned from prior review.",
      businessRule: "Apply user-confirmed VAT only to matching supplier/category/country patterns.",
      source: "learning_rule",
      status: "predicted",
    };
  }

  const text = [input.description, input.supplierCustomer, input.sourceCategory, input.category].filter(Boolean).join(" ").toLowerCase();
  if (taxProfile.reverseChargeEnabled && taxProfile.zeroVatRate !== null && /reverse charge|self.?assess|intra.?community/.test(text)) {
    return {
      vatRate: taxProfile.zeroVatRate,
      confidence: 0.96,
      reason: "Reverse-charge wording is present and reverse charge is enabled in Business Profile.",
      businessRule: "Use the configured zero VAT rate for reverse-charge transactions.",
      source: "business_profile",
      status: "predicted",
    };
  }

  if (taxProfile.zeroVatRate !== null && /export|zero.?rated|outside tax area|exempt/.test(text)) {
    return {
      vatRate: taxProfile.zeroVatRate,
      confidence: 0.94,
      reason: "Zero-rated or export wording is present in the transaction.",
      businessRule: "Use the configured zero VAT rate for zero-rated transactions.",
      source: "business_profile",
      status: "predicted",
    };
  }

  if (taxProfile.reducedVatRate !== null && /food|meal|restaurant|book|medicine|reduced/.test(text)) {
    return {
      vatRate: taxProfile.reducedVatRate,
      confidence: 0.9,
      reason: "Transaction wording matches reduced-rate supplier or category signals.",
      businessRule: "Use the configured reduced VAT rate when reduced-rate signals are present.",
      source: "business_profile",
      status: "predicted",
    };
  }

  if (!input.supplierCustomer || input.category === "uncategorized") {
    return {
      vatRate: null,
      confidence: 0.55,
      reason: !input.supplierCustomer ? "Supplier/customer is missing." : "Category is unknown.",
      businessRule: "Rows with missing supplier or category require review before VAT is assigned.",
      source: "business_profile",
      status: "needs_review",
    };
  }

  if (taxProfile.defaultVatRate !== null) {
    return {
      vatRate: taxProfile.defaultVatRate,
      confidence: 0.92,
      reason: "Business Profile default VAT rate applies to this classified transaction.",
      businessRule: "Apply Business Profile default VAT when no stronger exception applies.",
      source: "business_profile",
      status: "predicted",
    };
  }

  return {
    vatRate: null,
    confidence: 0.4,
    reason: "Business Profile has no configured VAT rate for this transaction.",
    businessRule: "Missing tax configuration requires manual review.",
    source: "business_profile",
    status: "needs_review",
  };
}

export function calculateVatAmount(amount: number | null, vatRate: number | null) {
  if (typeof amount !== "number" || typeof vatRate !== "number") return null;
  return Math.round(Math.abs(amount) * (vatRate / 100) * 100) / 100;
}

function findVatLearningRule(
  input: VatPredictionInput,
  taxProfile: BusinessTaxProfile,
  learningRules: PrebookkeepingVatLearningRuleInput[],
) {
  const normalized = learningRules
    .map(normalizeVatLearningRule)
    .filter((rule): rule is NormalizedVatLearningRule => Boolean(rule));
  const text = [input.description, input.supplierCustomer].filter(Boolean).join(" ").toLowerCase();
  const countryKey = normalizeKey(taxProfile.taxCountry);

  return normalized.find((rule) => {
    if (rule.countryKey && countryKey && rule.countryKey !== countryKey) return false;
    if (rule.category && rule.category !== input.category) return false;
    if (rule.supplierKey && input.supplierCustomer?.toLowerCase().includes(rule.supplierKey)) return true;
    if (rule.merchantKey && text.includes(rule.merchantKey)) return true;
    if (rule.descriptionKeyword && text.includes(rule.descriptionKeyword)) return true;
    return false;
  });
}

function normalizeVatLearningRule(rule: PrebookkeepingVatLearningRuleInput): NormalizedVatLearningRule | null {
  const vatRate = normalizeRate(rule.vatRate);
  if (vatRate === null) return null;
  return {
    supplierKey: normalizeKey(rule.supplierKey),
    descriptionKeyword: normalizeKey(rule.descriptionKeyword),
    merchantKey: normalizeKey(rule.merchantKey),
    category: normalizeVatCategory(rule.category),
    countryKey: normalizeKey(rule.countryKey),
    vatRate,
  };
}

function normalizeVatCategory(value: unknown): PrebookkeepingCategory | null {
  const text = String(value ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  const known = [
    "revenue",
    "operating_expenses",
    "payroll",
    "fixed_costs",
    "taxes",
    "bank_fees",
    "transfers",
    "assets",
    "liabilities",
    "equity",
    "other",
  ];
  return known.includes(text) ? text as PrebookkeepingCategory : null;
}

function normalizeVatRegistered(value: unknown) {
  if (value === "yes" || value === true) return true;
  if (value === "no" || value === false) return false;
  return null;
}

function isDefaultTaxEntry(entry: TaxEntry) {
  return /vat|gst|sales tax|default|standard/i.test(entry.taxType);
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    const rate = normalizeRate(value);
    if (rate !== null) return rate;
  }
  return null;
}

function normalizeRate(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return Math.round(value * 100) / 100;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace("%", "").replace(",", ".").trim());
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : null;
}

function uniqueRates(values: Array<number | null>) {
  return Array.from(new Set(values.filter((value): value is number => typeof value === "number" && Number.isFinite(value))))
    .sort((a, b) => a - b);
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const text = value.trim();
    if (text) return text;
  }
  return null;
}

function fiscalYearLabel(start: unknown, end: unknown) {
  const values = [firstText(start), firstText(end)].filter(Boolean);
  return values.length > 0 ? values.join(" to ") : null;
}

function normalizeKey(value: unknown) {
  const text = String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  return text.length >= 3 ? text.slice(0, 120) : null;
}
