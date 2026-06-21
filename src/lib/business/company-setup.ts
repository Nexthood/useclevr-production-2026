export type LegalStructure =
  | "sole_proprietor"
  | "limited_liability"
  | "corporation"
  | "partnership"
  | "non_profit"
  | "other"
  | "not_sure"

export type AccountingMethod = "cash" | "accrual" | "not_sure"
export type TaxRegistered = "yes" | "no" | "not_sure"
export type TaxType = "vat" | "gst" | "sales_tax" | "none" | "not_sure"
export type AmountType = "gross" | "net" | "mixed" | "not_sure"
export type EstimateTaxes = "yes" | "no" | "not_sure"
export type CustomerType = "b2b" | "b2c" | "marketplace" | "government" | "mixed" | "not_sure"
export type InvoiceOrPayment = "invoice" | "payment" | "not_sure"
export type HasRefunds = "yes" | "no" | "not_sure"
export type MixedExpenses = "yes" | "no" | "not_sure"
export type ReceiptsAvailable = "yes" | "no" | "partly" | "not_sure"
export type HasRecurring = "yes" | "no" | "not_sure"
export type HasInsurance = "yes" | "no" | "not_sure"
export type InsurancePaymentFrequency = "monthly" | "quarterly" | "yearly" | "one_time" | "not_sure"
export type InsuranceBusinessUse = "100" | "75" | "50" | "25" | "not_sure"
export type HasLoans = "yes" | "no" | "not_sure"
export type InterestKnown = "yes" | "no" | "not_sure"

export const LEGAL_STRUCTURES: { value: LegalStructure; label: string }[] = [
  { value: "sole_proprietor", label: "Sole proprietor" },
  { value: "limited_liability", label: "Limited liability company" },
  { value: "corporation", label: "Corporation" },
  { value: "partnership", label: "Partnership" },
  { value: "non_profit", label: "Non-profit" },
  { value: "other", label: "Other" },
  { value: "not_sure", label: "Not sure" },
]

export const ACCOUNTING_METHODS: { value: AccountingMethod; label: string }[] = [
  { value: "cash", label: "Cash basis" },
  { value: "accrual", label: "Accrual basis" },
  { value: "not_sure", label: "Not sure" },
]

export const TAX_REGISTERED_OPTIONS: { value: TaxRegistered; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "not_sure", label: "Not sure" },
]

export const TAX_TYPES: { value: TaxType; label: string }[] = [
  { value: "vat", label: "VAT" },
  { value: "gst", label: "GST" },
  { value: "sales_tax", label: "Sales Tax" },
  { value: "none", label: "None" },
  { value: "not_sure", label: "Not sure" },
]

export const AMOUNT_TYPES: { value: AmountType; label: string }[] = [
  { value: "gross", label: "Gross, tax included" },
  { value: "net", label: "Net, tax excluded" },
  { value: "mixed", label: "Mixed" },
  { value: "not_sure", label: "Not sure" },
]

export const CURRENCIES = ["EUR", "USD", "GBP", "CAD", "AUD", "CHF", "RON", "HUF", "Other"]
export const COMPANY_SIZES = ["Solo", "2-10", "11-50", "51-200", "201-500", "500+"]
export const BUSINESS_TYPES = ["SaaS", "Services", "Manufacturing", "Retail", "Marketplace", "Subscription", "Consulting", "Other"]

export const TAX_ENTRY_TYPES = [
  "Corporate Tax", "Income Tax", "Trade Tax", "VAT", "Sales Tax", "State Tax",
  "Federal Tax", "Payroll Tax", "Local Tax", "Franchise Tax", "Other",
]

export const CONTRIBUTION_TYPES = [
  "Health Insurance", "Pension", "Retirement", "Social Security",
  "Unemployment Insurance", "Care Insurance", "Workers Compensation",
  "Accident Insurance", "Other",
]

export const INSURANCE_TYPES = [
  "General Liability", "Professional Liability", "Cyber Insurance", "Legal Insurance",
  "Property Insurance", "Vehicle Insurance", "Product Liability",
  "Directors & Officers Insurance", "Other",
]

export const FIXED_COST_CATEGORIES = [
  "Rent", "Utilities", "Internet", "Software", "Cloud Infrastructure", "Marketing",
  "Logistics", "Leasing", "Loan Payments", "Accounting", "Tax Advisor",
  "Maintenance", "Banking Fees", "Other",
]

export const REVENUE_SOURCES = [
  "Product sales", "Services", "Subscriptions", "Marketplace sales",
  "Consulting", "Affiliate / commissions", "Licensing", "Other",
]

export const CUSTOMER_TYPES: { value: CustomerType; label: string }[] = [
  { value: "b2b", label: "B2B" },
  { value: "b2c", label: "B2C" },
  { value: "marketplace", label: "Marketplace" },
  { value: "government", label: "Government" },
  { value: "mixed", label: "Mixed" },
  { value: "not_sure", label: "Not sure" },
]

export const INVOICE_OR_PAYMENT: { value: InvoiceOrPayment; label: string }[] = [
  { value: "invoice", label: "Count revenue when invoice is created" },
  { value: "payment", label: "Count revenue when payment arrives" },
  { value: "not_sure", label: "Not sure" },
]

export const PAYMENT_PROVIDERS = [
  "Stripe", "PayPal", "Wise", "Revolut", "Shopify Payments",
  "Amazon / Marketplace", "Bank transfer", "Cash", "Other",
]

export const EXPENSE_CATEGORIES = [
  "Software / SaaS", "Hosting / cloud", "Marketing / ads", "Office / rent",
  "Travel", "Meals", "Contractors", "Payroll", "Insurance", "Bank fees",
  "Payment processing fees", "Legal", "Accounting", "Taxes paid",
  "Materials / inventory", "Vehicle", "Loan interest", "Lease payments", "Other",
]

export interface CompanyInfo {
  companyName: string
  countryOfRegistration: string
  taxResidenceCountry: string
  country: string
  stateRegion: string
  industry: string
  businessType: string
  legalStructure: LegalStructure | ""
  companySize: string
  employeeCount: string
  fiscalYearStart: string
  fiscalYearEnd: string
  accountingMethod: AccountingMethod | ""
}

export interface TaxEntry {
  id: string
  taxType: string
  percentage: string
  fixedAmount: string
  frequency: "monthly" | "quarterly" | "annual" | ""
  notes: string
  confirmed: boolean
}

export interface EmployerContribution {
  id: string
  contributionType: string
  percentage: string
  monthlyCost: string
  annualCost: string
}

export interface InsuranceEntry {
  id: string
  insuranceType: string
  provider: string
  monthlyCost: string
  annualCost: string
  coverageAmount: string
}

export interface FixedCostEntry {
  id: string
  costCategory: string
  monthlyCost: string
  annualCost: string
}

export interface RevenueModel {
  businessModels: string[]
  averageDealValue: string
  averageCustomerValue: string
  averageCustomerLifetime: string
  recurringRevenuePercentage: string
  grossMarginTarget: string
}

export interface CostStructure {
  materialCosts: string
  inventoryCosts: string
  productionCosts: string
  shippingCosts: string
  paymentProcessingFees: string
  contractorCosts: string
  commissionCosts: string
  returnRates: string
  discountRates: string
}

export interface BusinessGoals {
  growthTarget: string
  profitTarget: string
  ebitdaTarget: string
  cashReserveTarget: string
  expansionPlans: string
  investmentPlans: string
  riskTolerance: string
}

export interface TaxSettings {
  taxRegistered: TaxRegistered | ""
  taxType: TaxType | ""
  standardTaxRate: string
  revenueAmountType: AmountType | ""
  expenseAmountType: AmountType | ""
  estimateTaxes: EstimateTaxes | ""
  taxEntries: TaxEntry[]
}

export interface CurrencySettings {
  primaryCurrency: string
  reportingCurrency: string
  otherCurrenciesUsed: string[]
}

export interface RevenueRules {
  revenueSources: string[]
  customerType: CustomerType | ""
  invoiceOrPaymentBased: InvoiceOrPayment | ""
  paymentProviders: string[]
  hasRefundsOrChargebacks: HasRefunds | ""
}

export interface ExpenseRules {
  expenseCategories: string[]
  hasMixedBusinessPrivateExpenses: MixedExpenses | ""
  receiptsAvailable: ReceiptsAvailable | ""
  hasRecurringExpenses: HasRecurring | ""
}

export interface InsuranceSettings {
  hasBusinessInsurance: HasInsurance | ""
  insuranceTypes: string[]
  insurancePremiumAmount: string
  insurancePaymentFrequency: InsurancePaymentFrequency | ""
  insuranceBusinessUsePercentage: InsuranceBusinessUse | ""
  insuranceEntries: InsuranceEntry[]
}

export interface LoanLeasingSettings {
  hasBusinessLoans: HasLoans | ""
  hasLeasing: HasLoans | ""
  hasCreditCards: HasLoans | ""
  hasOverdraft: HasLoans | ""
  monthlyDebtPayment: string
  loanInterestKnown: InterestKnown | ""
  principalInterestSplitKnown: InterestKnown | ""
}

export interface SetupStatus {
  setupAccuracy: number
  completedSections: string[]
  missingFields: string[]
  accountantReviewFlags: string[]
  completed: boolean
}

export interface CompanySetupPayload {
  companyInfo: CompanyInfo
  taxSettings: TaxSettings
  currencySettings: CurrencySettings
  revenueRules: RevenueRules
  expenseRules: ExpenseRules
  insuranceSettings: InsuranceSettings
  loanLeasingSettings: LoanLeasingSettings
  employerContributions: EmployerContribution[]
  fixedCosts: FixedCostEntry[]
  revenueModel: RevenueModel
  costStructure: CostStructure
  businessGoals: BusinessGoals
  setupStatus: SetupStatus
}

function isFilled(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0
  return typeof value === "string" ? value.trim().length > 0 : Boolean(value)
}

const SECTION_WEIGHTS: Record<string, number> = {
  companyInfo: 18,
  taxSettings: 12,
  employerContributions: 8,
  insuranceSettings: 8,
  fixedCosts: 10,
  revenueModel: 14,
  costStructure: 12,
  businessGoals: 10,
  currencySettings: 4,
  revenueRules: 2,
  expenseRules: 2,
}

function calculateSectionCompletion(payload: CompanySetupPayload, section: string): number {
  const fields = getSectionFields(payload, section)
  const filled = fields.filter((field) => isFilled(field.value)).length
  return fields.length > 0 ? Math.round((filled / fields.length) * 100) : 0
}

function getSectionFields(payload: CompanySetupPayload, section: string): { key: string; value: unknown }[] {
  switch (section) {
    case "companyInfo":
      return [
        "companyName", "country", "stateRegion", "industry", "businessType",
        "legalStructure", "companySize", "employeeCount", "fiscalYearStart",
        "fiscalYearEnd",
      ].map((key) => ({ key, value: payload.companyInfo[key as keyof CompanyInfo] }))
    case "taxSettings":
      return [{ key: "taxEntries", value: payload.taxSettings.taxEntries }]
    case "employerContributions":
      return [{ key: "employerContributions", value: payload.employerContributions }]
    case "insuranceSettings":
      return [{ key: "insuranceEntries", value: payload.insuranceSettings.insuranceEntries }]
    case "fixedCosts":
      return [{ key: "fixedCosts", value: payload.fixedCosts }]
    case "revenueModel":
      return Object.entries(payload.revenueModel).map(([key, value]) => ({ key, value }))
    case "costStructure":
      return Object.entries(payload.costStructure).map(([key, value]) => ({ key, value }))
    case "businessGoals":
      return Object.entries(payload.businessGoals).map(([key, value]) => ({ key, value }))
    case "currencySettings":
      return [{ key: "primaryCurrency", value: payload.currencySettings.primaryCurrency }]
    case "revenueRules":
      return [{ key: "revenueSources", value: payload.revenueRules.revenueSources }]
    case "expenseRules":
      return [{ key: "expenseCategories", value: payload.expenseRules.expenseCategories }]
    default:
      return []
  }
}

export function computeSetupAccuracy(payload: CompanySetupPayload): number {
  let totalScore = 0
  for (const section of Object.keys(SECTION_WEIGHTS)) {
    totalScore += Math.round((calculateSectionCompletion(payload, section) / 100) * (SECTION_WEIGHTS[section] || 0))
  }
  return Math.min(totalScore, 100)
}

export function computeAccountantReviewFlags(payload: CompanySetupPayload): string[] {
  const flags: string[] = []
  const { companyInfo, taxSettings, insuranceSettings, loanLeasingSettings, expenseRules } = payload

  if (!companyInfo.country) flags.push("Country is missing - tax and currency suggestions remain generic")
  if (!companyInfo.legalStructure || companyInfo.legalStructure === "not_sure") flags.push("Legal structure needs confirmation")
  if (taxSettings.taxEntries.length === 0) flags.push("Tax profile is empty - tax analysis will not estimate obligations")
  if (taxSettings.taxEntries.some((tax) => !tax.confirmed)) flags.push("Suggested tax entries need user confirmation")
  if (companyInfo.accountingMethod === "not_sure") flags.push("Accounting method is unknown - profit calculations may need review")
  if (taxSettings.taxRegistered === "not_sure") flags.push("Tax registration status is unknown - verify with tax advisor")
  if (taxSettings.taxType === "not_sure") flags.push("Tax type is unknown - verify applicable tax regime")
  if (taxSettings.revenueAmountType === "mixed" || taxSettings.revenueAmountType === "not_sure") flags.push("Revenue amount type needs clarification")
  if (taxSettings.expenseAmountType === "mixed" || taxSettings.expenseAmountType === "not_sure") flags.push("Expense amount type needs clarification")
  if (insuranceSettings.hasBusinessInsurance === "yes" && insuranceSettings.insuranceBusinessUsePercentage === "not_sure") flags.push("Business insurance percentage is unknown")
  if (loanLeasingSettings.hasBusinessLoans === "yes" && loanLeasingSettings.loanInterestKnown === "not_sure") flags.push("Loan interest details are unknown")
  if (loanLeasingSettings.principalInterestSplitKnown === "no" || loanLeasingSettings.principalInterestSplitKnown === "not_sure") flags.push("Principal/interest split unknown")
  if (expenseRules.hasMixedBusinessPrivateExpenses === "yes" || expenseRules.hasMixedBusinessPrivateExpenses === "not_sure") flags.push("Mixed business/private expenses need separation")

  return flags
}

export function computeMissingFields(payload: CompanySetupPayload): string[] {
  const missing: string[] = []
  const required: [string, string, unknown][] = [
    ["companyInfo", "companyName", payload.companyInfo.companyName],
    ["companyInfo", "country", payload.companyInfo.country],
    ["companyInfo", "industry", payload.companyInfo.industry],
    ["companyInfo", "businessType", payload.companyInfo.businessType],
    ["companyInfo", "legalStructure", payload.companyInfo.legalStructure],
    ["companyInfo", "primaryCurrency", payload.currencySettings.primaryCurrency],
    ["taxSettings", "taxEntries", payload.taxSettings.taxEntries],
    ["revenueModel", "businessModels", payload.revenueModel.businessModels],
  ]

  for (const [, key, value] of required) {
    if (!isFilled(value)) missing.push(key)
  }
  return missing
}

export function computeCompletedSections(payload: CompanySetupPayload): string[] {
  return Object.keys(SECTION_WEIGHTS).filter((section) => calculateSectionCompletion(payload, section) >= 80)
}

export function buildSetupStatus(payload: CompanySetupPayload): SetupStatus {
  const setupAccuracy = computeSetupAccuracy(payload)
  return {
    setupAccuracy,
    completedSections: computeCompletedSections(payload),
    missingFields: computeMissingFields(payload),
    accountantReviewFlags: computeAccountantReviewFlags(payload),
    completed: setupAccuracy >= 80 && computeMissingFields(payload).length === 0,
  }
}

export function emptyCompanySetupPayload(): CompanySetupPayload {
  return {
    companyInfo: {
      companyName: "",
      countryOfRegistration: "",
      taxResidenceCountry: "",
      country: "",
      stateRegion: "",
      industry: "",
      businessType: "",
      legalStructure: "",
      companySize: "",
      employeeCount: "",
      fiscalYearStart: "",
      fiscalYearEnd: "",
      accountingMethod: "",
    },
    taxSettings: {
      taxRegistered: "",
      taxType: "",
      standardTaxRate: "",
      revenueAmountType: "",
      expenseAmountType: "",
      estimateTaxes: "",
      taxEntries: [],
    },
    currencySettings: { primaryCurrency: "", reportingCurrency: "", otherCurrenciesUsed: [] },
    revenueRules: { revenueSources: [], customerType: "", invoiceOrPaymentBased: "", paymentProviders: [], hasRefundsOrChargebacks: "" },
    expenseRules: { expenseCategories: [], hasMixedBusinessPrivateExpenses: "", receiptsAvailable: "", hasRecurringExpenses: "" },
    insuranceSettings: {
      hasBusinessInsurance: "",
      insuranceTypes: [],
      insurancePremiumAmount: "",
      insurancePaymentFrequency: "",
      insuranceBusinessUsePercentage: "",
      insuranceEntries: [],
    },
    loanLeasingSettings: {
      hasBusinessLoans: "",
      hasLeasing: "",
      hasCreditCards: "",
      hasOverdraft: "",
      monthlyDebtPayment: "",
      loanInterestKnown: "",
      principalInterestSplitKnown: "",
    },
    employerContributions: [],
    fixedCosts: [],
    revenueModel: {
      businessModels: [],
      averageDealValue: "",
      averageCustomerValue: "",
      averageCustomerLifetime: "",
      recurringRevenuePercentage: "",
      grossMarginTarget: "",
    },
    costStructure: {
      materialCosts: "",
      inventoryCosts: "",
      productionCosts: "",
      shippingCosts: "",
      paymentProcessingFees: "",
      contractorCosts: "",
      commissionCosts: "",
      returnRates: "",
      discountRates: "",
    },
    businessGoals: {
      growthTarget: "",
      profitTarget: "",
      ebitdaTarget: "",
      cashReserveTarget: "",
      expansionPlans: "",
      investmentPlans: "",
      riskTolerance: "",
    },
    setupStatus: { setupAccuracy: 0, completedSections: [], missingFields: [], accountantReviewFlags: [], completed: false },
  }
}

export function normalizeCompanySetupPayload(input: Partial<CompanySetupPayload> | null | undefined): CompanySetupPayload {
  const empty = emptyCompanySetupPayload()
  if (!input || typeof input !== "object") return empty
  const merged: CompanySetupPayload = {
    ...empty,
    ...input,
    companyInfo: { ...empty.companyInfo, ...input.companyInfo },
    taxSettings: { ...empty.taxSettings, ...input.taxSettings, taxEntries: input.taxSettings?.taxEntries || [] },
    currencySettings: { ...empty.currencySettings, ...input.currencySettings },
    revenueRules: { ...empty.revenueRules, ...input.revenueRules },
    expenseRules: { ...empty.expenseRules, ...input.expenseRules },
    insuranceSettings: { ...empty.insuranceSettings, ...input.insuranceSettings, insuranceEntries: input.insuranceSettings?.insuranceEntries || [] },
    loanLeasingSettings: { ...empty.loanLeasingSettings, ...input.loanLeasingSettings },
    employerContributions: input.employerContributions || [],
    fixedCosts: input.fixedCosts || [],
    revenueModel: { ...empty.revenueModel, ...input.revenueModel },
    costStructure: { ...empty.costStructure, ...input.costStructure },
    businessGoals: { ...empty.businessGoals, ...input.businessGoals },
    setupStatus: empty.setupStatus,
  }
  merged.companyInfo.country ||= merged.companyInfo.countryOfRegistration || merged.companyInfo.taxResidenceCountry
  merged.companyInfo.countryOfRegistration ||= merged.companyInfo.country
  merged.companyInfo.taxResidenceCountry ||= merged.companyInfo.country
  merged.currencySettings.reportingCurrency ||= merged.currencySettings.primaryCurrency
  merged.setupStatus = buildSetupStatus(merged)
  return merged
}

export function buildBusinessProfileContext(payload: CompanySetupPayload): string {
  const setup = normalizeCompanySetupPayload(payload)
  const lines = [
    `Company: ${setup.companyInfo.companyName || "not provided"}`,
    `Country/region: ${setup.companyInfo.country || "not provided"}${setup.companyInfo.stateRegion ? `, ${setup.companyInfo.stateRegion}` : ""}`,
    `Industry: ${setup.companyInfo.industry || "not provided"}`,
    `Business type/model: ${[setup.companyInfo.businessType, ...setup.revenueModel.businessModels].filter(Boolean).join(", ") || "not provided"}`,
    `Legal structure: ${setup.companyInfo.legalStructure || "not provided"}`,
    `Size/employees: ${setup.companyInfo.companySize || "not provided"} / ${setup.companyInfo.employeeCount || "not provided"}`,
    `Fiscal year: ${setup.companyInfo.fiscalYearStart || "not provided"} to ${setup.companyInfo.fiscalYearEnd || "not provided"}`,
    `Currency: ${setup.currencySettings.primaryCurrency || "not provided"}`,
    `Confirmed taxes: ${setup.taxSettings.taxEntries.map((tax) => `${tax.taxType}${tax.percentage ? ` ${tax.percentage}%` : ""}${tax.fixedAmount ? ` fixed ${tax.fixedAmount}` : ""}`).join("; ") || "none provided"}`,
    `Employer contributions: ${setup.employerContributions.map((entry) => `${entry.contributionType}${entry.percentage ? ` ${entry.percentage}%` : ""}${entry.monthlyCost ? ` monthly ${entry.monthlyCost}` : ""}${entry.annualCost ? ` annual ${entry.annualCost}` : ""}`).join("; ") || "none provided"}`,
    `Business insurance: ${setup.insuranceSettings.insuranceEntries.map((entry) => `${entry.insuranceType}${entry.monthlyCost ? ` monthly ${entry.monthlyCost}` : ""}${entry.annualCost ? ` annual ${entry.annualCost}` : ""}`).join("; ") || setup.insuranceSettings.insuranceTypes.join(", ") || "none provided"}`,
    `Fixed costs: ${setup.fixedCosts.map((entry) => `${entry.costCategory}${entry.monthlyCost ? ` monthly ${entry.monthlyCost}` : ""}${entry.annualCost ? ` annual ${entry.annualCost}` : ""}`).join("; ") || "none provided"}`,
    `Cost assumptions: inventory/material ${setup.costStructure.inventoryCosts || setup.costStructure.materialCosts || "not provided"}, shipping ${setup.costStructure.shippingCosts || "not provided"}, payment fees ${setup.costStructure.paymentProcessingFees || "not provided"}, returns/refunds ${setup.costStructure.returnRates || "not provided"}`,
    `Goals: growth ${setup.businessGoals.growthTarget || "not provided"}, gross margin ${setup.revenueModel.grossMarginTarget || "not provided"}, net margin ${setup.businessGoals.profitTarget || "not provided"}, cash reserve ${setup.businessGoals.cashReserveTarget || "not provided"}, risk tolerance ${setup.businessGoals.riskTolerance || "not provided"}`,
  ]
  return lines.join("\n")
}
