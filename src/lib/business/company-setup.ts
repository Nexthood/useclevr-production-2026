export type LegalStructure =
  | "sole_proprietor"
  | "limited_liability"
  | "corporation"
  | "partnership"
  | "non_profit"
  | "other"
  | "not_sure";

export type AccountingMethod = "cash" | "accrual" | "not_sure";

export type TaxRegistered = "yes" | "no" | "not_sure";
export type TaxType = "vat" | "gst" | "sales_tax" | "none" | "not_sure";
export type AmountType = "gross" | "net" | "mixed" | "not_sure";
export type EstimateTaxes = "yes" | "no" | "not_sure";

export type CustomerType = "b2b" | "b2c" | "marketplace" | "government" | "mixed" | "not_sure";
export type InvoiceOrPayment = "invoice" | "payment" | "not_sure";
export type HasRefunds = "yes" | "no" | "not_sure";

export type MixedExpenses = "yes" | "no" | "not_sure";
export type ReceiptsAvailable = "yes" | "no" | "partly" | "not_sure";
export type HasRecurring = "yes" | "no" | "not_sure";

export type HasInsurance = "yes" | "no" | "not_sure";
export type InsurancePaymentFrequency = "monthly" | "quarterly" | "yearly" | "one_time" | "not_sure";
export type InsuranceBusinessUse = "100" | "75" | "50" | "25" | "not_sure";

export type HasLoans = "yes" | "no" | "not_sure";
export type InterestKnown = "yes" | "no" | "not_sure";

export const LEGAL_STRUCTURES: { value: LegalStructure; label: string }[] = [
  { value: "sole_proprietor", label: "Sole proprietor" },
  { value: "limited_liability", label: "Limited liability company" },
  { value: "corporation", label: "Corporation" },
  { value: "partnership", label: "Partnership" },
  { value: "non_profit", label: "Non-profit" },
  { value: "other", label: "Other" },
  { value: "not_sure", label: "Not sure" },
];

export const ACCOUNTING_METHODS: { value: AccountingMethod; label: string }[] = [
  { value: "cash", label: "Cash basis" },
  { value: "accrual", label: "Accrual basis" },
  { value: "not_sure", label: "Not sure" },
];

export const TAX_REGISTERED_OPTIONS: { value: TaxRegistered; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "not_sure", label: "Not sure" },
];

export const TAX_TYPES: { value: TaxType; label: string }[] = [
  { value: "vat", label: "VAT" },
  { value: "gst", label: "GST" },
  { value: "sales_tax", label: "Sales Tax" },
  { value: "none", label: "None" },
  { value: "not_sure", label: "Not sure" },
];

export const AMOUNT_TYPES: { value: AmountType; label: string }[] = [
  { value: "gross", label: "Gross, tax included" },
  { value: "net", label: "Net, tax excluded" },
  { value: "mixed", label: "Mixed" },
  { value: "not_sure", label: "Not sure" },
];

export const CURRENCIES = ["EUR", "USD", "GBP", "RON", "HUF", "CHF", "Other"];

export const REVENUE_SOURCES = [
  "Product sales", "Services", "Subscriptions", "Marketplace sales",
  "Consulting", "Affiliate / commissions", "Licensing", "Other",
];

export const CUSTOMER_TYPES: { value: CustomerType; label: string }[] = [
  { value: "b2b", label: "B2B" },
  { value: "b2c", label: "B2C" },
  { value: "marketplace", label: "Marketplace" },
  { value: "government", label: "Government" },
  { value: "mixed", label: "Mixed" },
  { value: "not_sure", label: "Not sure" },
];

export const INVOICE_OR_PAYMENT: { value: InvoiceOrPayment; label: string }[] = [
  { value: "invoice", label: "Count revenue when invoice is created" },
  { value: "payment", label: "Count revenue when payment arrives" },
  { value: "not_sure", label: "Not sure" },
];

export const PAYMENT_PROVIDERS = [
  "Stripe", "PayPal", "Wise", "Revolut", "Shopify Payments",
  "Amazon / Marketplace", "Bank transfer", "Cash", "Other",
];

export const EXPENSE_CATEGORIES = [
  "Software / SaaS", "Hosting / cloud", "Marketing / ads", "Office / rent",
  "Travel", "Meals", "Contractors", "Payroll", "Insurance", "Bank fees",
  "Payment processing fees", "Legal", "Accounting", "Taxes paid",
  "Materials / inventory", "Vehicle", "Loan interest", "Lease payments", "Other",
];

export const INSURANCE_TYPES = [
  "General liability", "Professional liability", "Cyber insurance",
  "Product liability", "Business property", "Vehicle insurance",
  "Health insurance", "Workers compensation", "Employer liability",
  "Directors & Officers", "Travel insurance", "Key person insurance", "Other",
];

export interface CompanyInfo {
  companyName: string;
  countryOfRegistration: string;
  taxResidenceCountry: string;
  legalStructure: LegalStructure | "";
  industry: string;
  accountingMethod: AccountingMethod | "";
}

export interface TaxSettings {
  taxRegistered: TaxRegistered | "";
  taxType: TaxType | "";
  standardTaxRate: string;
  revenueAmountType: AmountType | "";
  expenseAmountType: AmountType | "";
  estimateTaxes: EstimateTaxes | "";
}

export interface CurrencySettings {
  primaryCurrency: string;
  reportingCurrency: string;
  otherCurrenciesUsed: string[];
}

export interface RevenueRules {
  revenueSources: string[];
  customerType: CustomerType | "";
  invoiceOrPaymentBased: InvoiceOrPayment | "";
  paymentProviders: string[];
  hasRefundsOrChargebacks: HasRefunds | "";
}

export interface ExpenseRules {
  expenseCategories: string[];
  hasMixedBusinessPrivateExpenses: MixedExpenses | "";
  receiptsAvailable: ReceiptsAvailable | "";
  hasRecurringExpenses: HasRecurring | "";
}

export interface InsuranceSettings {
  hasBusinessInsurance: HasInsurance | "";
  insuranceTypes: string[];
  insurancePremiumAmount: string;
  insurancePaymentFrequency: InsurancePaymentFrequency | "";
  insuranceBusinessUsePercentage: InsuranceBusinessUse | "";
}

export interface LoanLeasingSettings {
  hasBusinessLoans: HasLoans | "";
  hasLeasing: HasLoans | "";
  hasCreditCards: HasLoans | "";
  hasOverdraft: HasLoans | "";
  monthlyDebtPayment: string;
  loanInterestKnown: InterestKnown | "";
  principalInterestSplitKnown: InterestKnown | "";
}

export interface SetupStatus {
  setupAccuracy: number;
  completedSections: string[];
  missingFields: string[];
  accountantReviewFlags: string[];
}

export interface CompanySetupPayload {
  companyInfo: CompanyInfo;
  taxSettings: TaxSettings;
  currencySettings: CurrencySettings;
  revenueRules: RevenueRules;
  expenseRules: ExpenseRules;
  insuranceSettings: InsuranceSettings;
  loanLeasingSettings: LoanLeasingSettings;
  setupStatus: SetupStatus;
}

function isFilled(value: string | string[]): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return value.trim().length > 0;
}

const SECTION_WEIGHTS: Record<string, number> = {
  companyInfo: 20,
  taxSettings: 20,
  currencySettings: 10,
  revenueRules: 15,
  expenseRules: 15,
  insuranceSettings: 10,
  loanLeasingSettings: 10,
};

function calculateSectionCompletion(payload: CompanySetupPayload, section: string): number {
  const fields = getSectionFields(payload, section);
  const filled = fields.filter((f) => isFilled(f.value)).length;
  return fields.length > 0 ? Math.round((filled / fields.length) * 100) : 0;
}

function getSectionFields(payload: CompanySetupPayload, section: string): { key: string; value: string | string[] }[] {
  switch (section) {
    case "companyInfo":
      return Object.entries(payload.companyInfo).map(([k, v]) => ({ key: k, value: v }));
    case "taxSettings":
      return Object.entries(payload.taxSettings).map(([k, v]) => ({ key: k, value: v }));
    case "currencySettings":
      return [
        { key: "primaryCurrency", value: payload.currencySettings.primaryCurrency },
        { key: "reportingCurrency", value: payload.currencySettings.reportingCurrency },
        { key: "otherCurrenciesUsed", value: payload.currencySettings.otherCurrenciesUsed },
      ];
    case "revenueRules":
      return Object.entries(payload.revenueRules).map(([k, v]) => ({ key: k, value: v }));
    case "expenseRules":
      return Object.entries(payload.expenseRules).map(([k, v]) => ({ key: k, value: v }));
    case "insuranceSettings":
      return Object.entries(payload.insuranceSettings).map(([k, v]) => ({ key: k, value: v }));
    case "loanLeasingSettings":
      return Object.entries(payload.loanLeasingSettings).map(([k, v]) => ({ key: k, value: v }));
    default:
      return [];
  }
}

export function computeSetupAccuracy(payload: CompanySetupPayload): number {
  let totalScore = 0;
  const sections = Object.keys(SECTION_WEIGHTS);
  for (const section of sections) {
    const completion = calculateSectionCompletion(payload, section);
    totalScore += Math.round((completion / 100) * (SECTION_WEIGHTS[section] || 0));
  }
  return Math.min(totalScore, 100);
}

export function computeAccountantReviewFlags(payload: CompanySetupPayload): string[] {
  const flags: string[] = [];
  const { companyInfo, taxSettings, insuranceSettings, loanLeasingSettings, expenseRules } = payload;

  if (companyInfo.accountingMethod === "not_sure") {
    flags.push("Accounting method is unknown — profit calculations may need review");
  }
  if (taxSettings.taxRegistered === "not_sure") {
    flags.push("Tax registration status is unknown — verify with tax advisor");
  }
  if (taxSettings.taxType === "not_sure") {
    flags.push("Tax type is unknown — verify applicable tax regime");
  }
  if (taxSettings.revenueAmountType === "mixed" || taxSettings.revenueAmountType === "not_sure") {
    flags.push("Revenue amount type needs clarification — gross/net treatment may affect tax");
  }
  if (taxSettings.expenseAmountType === "mixed" || taxSettings.expenseAmountType === "not_sure") {
    flags.push("Expense amount type needs clarification — gross/net treatment may affect deductions");
  }
  if (taxSettings.estimateTaxes === "not_sure") {
    flags.push("Tax estimation preference is unknown — tax calculations will use defaults");
  }
  if (insuranceSettings.hasBusinessInsurance === "yes" && insuranceSettings.insuranceBusinessUsePercentage === "not_sure") {
    flags.push("Business insurance percentage is unknown — personal/business split may affect deductions");
  }
  if (loanLeasingSettings.hasBusinessLoans === "yes" && loanLeasingSettings.loanInterestKnown === "not_sure") {
    flags.push("Loan interest details are unknown — only interest portion is tax-deductible");
  }
  if (loanLeasingSettings.hasLeasing === "yes") {
    flags.push("Leasing present — lease type may affect expense treatment, consider accountant review");
  }
  if (loanLeasingSettings.principalInterestSplitKnown === "no" || loanLeasingSettings.principalInterestSplitKnown === "not_sure") {
    flags.push("Principal/interest split unknown — loan principal is not a deductible expense");
  }
  if (expenseRules.hasMixedBusinessPrivateExpenses === "yes" || expenseRules.hasMixedBusinessPrivateExpenses === "not_sure") {
    flags.push("Mixed business/private expenses need separation for accurate tax reporting");
  }

  return flags;
}

export function computeMissingFields(payload: CompanySetupPayload): string[] {
  const missing: string[] = [];
  const allSections: [string, string[]][] = [
    ["companyInfo", ["companyName", "countryOfRegistration", "legalStructure"]],
    ["taxSettings", ["taxRegistered", "taxType"]],
    ["currencySettings", ["primaryCurrency"]],
    ["revenueRules", ["revenueSources", "customerType"]],
    ["expenseRules", ["expenseCategories"]],
  ];

  for (const [section, keys] of allSections) {
    const sectionData = (payload as any)[section] || {};
    for (const key of keys) {
      if (!isFilled(sectionData[key])) {
        missing.push(`${key}`);
      }
    }
  }
  return missing;
}

export function computeCompletedSections(payload: CompanySetupPayload): string[] {
  const sections = Object.keys(SECTION_WEIGHTS);
  return sections.filter((s) => calculateSectionCompletion(payload, s) >= 80);
}

export function buildSetupStatus(payload: CompanySetupPayload): SetupStatus {
  return {
    setupAccuracy: computeSetupAccuracy(payload),
    completedSections: computeCompletedSections(payload),
    missingFields: computeMissingFields(payload),
    accountantReviewFlags: computeAccountantReviewFlags(payload),
  };
}

export function emptyCompanySetupPayload(): CompanySetupPayload {
  return {
    companyInfo: {
      companyName: "", countryOfRegistration: "", taxResidenceCountry: "",
      legalStructure: "", industry: "", accountingMethod: "",
    },
    taxSettings: {
      taxRegistered: "", taxType: "", standardTaxRate: "",
      revenueAmountType: "", expenseAmountType: "", estimateTaxes: "",
    },
    currencySettings: {
      primaryCurrency: "", reportingCurrency: "", otherCurrenciesUsed: [],
    },
    revenueRules: {
      revenueSources: [], customerType: "", invoiceOrPaymentBased: "",
      paymentProviders: [], hasRefundsOrChargebacks: "",
    },
    expenseRules: {
      expenseCategories: [], hasMixedBusinessPrivateExpenses: "",
      receiptsAvailable: "", hasRecurringExpenses: "",
    },
    insuranceSettings: {
      hasBusinessInsurance: "", insuranceTypes: [], insurancePremiumAmount: "",
      insurancePaymentFrequency: "", insuranceBusinessUsePercentage: "",
    },
    loanLeasingSettings: {
      hasBusinessLoans: "", hasLeasing: "", hasCreditCards: "",
      hasOverdraft: "", monthlyDebtPayment: "",
      loanInterestKnown: "", principalInterestSplitKnown: "",
    },
    setupStatus: {
      setupAccuracy: 0, completedSections: [], missingFields: [], accountantReviewFlags: [],
    },
  };
}
