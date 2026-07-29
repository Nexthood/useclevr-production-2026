"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  BUSINESS_TYPES,
  CURRENCIES,
  INSURANCE_TYPES,
  LEGAL_STRUCTURES,
  buildSetupStatus,
  emptyCompanySetupPayload,
  normalizeCompanySetupPayload,
  type CompanySetupPayload,
  type EmployerContribution,
  type FixedCostEntry,
  type InsuranceEntry,
  type TaxEntry,
} from "@/lib/business/company-setup"
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Save, Sparkles } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"

type QuestionId =
  | "companyName"
  | "country"
  | "stateRegion"
  | "legalStructure"
  | "industry"
  | "businessModel"
  | "currency"
  | "fiscalYear"
  | "taxRegistered"
  | "taxRate"
  | "corporateTaxRate"
  | "localStateTradeTax"
  | "taxFrequency"
  | "employees"
  | "averageGrossSalary"
  | "employerContribution"
  | "healthInsuranceContribution"
  | "pensionContribution"
  | "unemploymentContribution"
  | "workersCompContribution"
  | "insuranceTypes"
  | "insuranceMonthlyCost"
  | "rentOfficeCost"
  | "utilitiesCost"
  | "softwareSaasCost"
  | "marketingCost"
  | "logisticsShippingCost"
  | "loanLeasingPayments"
  | "inventoryMaterialCost"
  | "paymentProcessingFees"
  | "returnRefundRate"
  | "targetGrossMargin"
  | "targetNetMargin"
  | "cashReserveTarget"
  | "growthTarget"
  | "review"

type Question = {
  id: QuestionId
  title: string
  helper: string
  optional?: boolean
}

type BusinessContext = "saas" | "retail" | "manufacturing" | "services" | "general"

const BASE_QUESTIONS: Question[] = [
  { id: "companyName", title: "What is your company name?", helper: "Use the legal or operating name you want analysis reports to use." },
  { id: "country", title: "Which country is your business registered in?", helper: "Country only loads suggestions. You confirm every value before analysis uses it." },
  { id: "stateRegion", title: "Which state or region applies?", helper: "Required for USA and useful anywhere regional taxes or compliance apply.", optional: true },
  { id: "legalStructure", title: "What is your legal structure?", helper: "Choose the closest option. You can change it later." },
  { id: "industry", title: "What industry are you in?", helper: "This helps the AI understand normal revenue, cost, and risk patterns." },
  { id: "businessModel", title: "What is your business model?", helper: "Pick every model that fits so revenue and cost assumptions match your actual operation." },
  { id: "currency", title: "What currency do you use?", helper: "Analysis uses this for KPIs, reports, tax estimates, and margin calculations." },
  { id: "fiscalYear", title: "What is your fiscal year?", helper: "Add the start and end used for business reporting." },
  { id: "taxRegistered", title: "Do you collect VAT, GST, or sales tax?", helper: "Use the status you file under today. This keeps tax analysis tied to confirmed business context.", optional: true },
  { id: "taxRate", title: "What standard indirect tax rate should UseClevr apply?", helper: "Use the rate that applies to most revenue. Skip this when rates vary by product, region, or customer.", optional: true },
  { id: "corporateTaxRate", title: "What profit tax rate should be used for planning?", helper: "Use the effective corporate or income tax rate you want cash-flow and profit estimates to reference.", optional: true },
  { id: "localStateTradeTax", title: "What regional business tax rate applies?", helper: "USA businesses can add state or local tax; EU businesses can add trade or local business tax.", optional: true },
  { id: "taxFrequency", title: "How often do you pay tax?", helper: "Payment timing improves cash-flow and tax reserve analysis.", optional: true },
  { id: "employees", title: "How many employees do you have?", helper: "Enter 0 if there are no employees. Payroll questions are skipped when this is 0.", optional: true },
  { id: "averageGrossSalary", title: "What is the average gross salary?", helper: "Use the average monthly gross salary per employee for payroll estimates.", optional: true },
  { id: "employerContribution", title: "What employer contribution percentage applies?", helper: "Include social security or employer payroll burden not covered by the employee salary.", optional: true },
  { id: "healthInsuranceContribution", title: "What health insurance contribution applies?", helper: "Add the employer-side health insurance percentage or monthly cost.", optional: true },
  { id: "pensionContribution", title: "What pension or retirement contribution applies?", helper: "Add the employer-side pension, retirement, or superannuation amount.", optional: true },
  { id: "unemploymentContribution", title: "What unemployment insurance contribution applies?", helper: "Add the unemployment insurance burden used in payroll analysis.", optional: true },
  { id: "workersCompContribution", title: "What accident or workers compensation contribution applies?", helper: "Add accident insurance or workers compensation rates where required.", optional: true },
  { id: "insuranceTypes", title: "Which insurance policies protect the business?", helper: "Select policies that affect operating cost, exposure, and analysis confidence. Skip policies that do not apply.", optional: true },
  { id: "insuranceMonthlyCost", title: "What is your monthly insurance cost?", helper: "Use total business insurance premiums per month.", optional: true },
  { id: "rentOfficeCost", title: "What is your monthly rent or office cost?", helper: "Recurring property costs are included even when uploaded data omits them.", optional: true },
  { id: "utilitiesCost", title: "What is your monthly utilities cost?", helper: "Include electricity, water, heating, internet, or similar operating utilities.", optional: true },
  { id: "softwareSaasCost", title: "What is your monthly software or SaaS cost?", helper: "Include tools, subscriptions, hosting, and cloud services.", optional: true },
  { id: "marketingCost", title: "What is your monthly marketing cost?", helper: "Marketing spend helps compare acquisition cost against revenue and margin.", optional: true },
  { id: "logisticsShippingCost", title: "What is your monthly logistics or shipping cost?", helper: "Shipping and logistics improve product, retail, and fulfillment margin analysis.", optional: true },
  { id: "loanLeasingPayments", title: "What monthly loan or leasing payments do you make?", helper: "Debt and leasing payments affect cash flow, reserves, and risk.", optional: true },
  { id: "inventoryMaterialCost", title: "What inventory or material cost percentage applies?", helper: "Use the average cost percentage of revenue for products, inventory, or materials.", optional: true },
  { id: "paymentProcessingFees", title: "What payment processing fee percentage applies?", helper: "Card, marketplace, or payment provider fees affect net margin.", optional: true },
  { id: "returnRefundRate", title: "What return or refund rate applies?", helper: "Return rates help analysis account for revenue leakage and stock risk.", optional: true },
  { id: "targetGrossMargin", title: "What is your target gross margin?", helper: "Analysis compares uploaded gross margin against this target.", optional: true },
  { id: "targetNetMargin", title: "What is your target net margin?", helper: "Net margin targets help evaluate total operating cost and profitability.", optional: true },
  { id: "cashReserveTarget", title: "What monthly cash reserve target do you want?", helper: "Set the cash buffer needed for tax, payroll, rent, debt, and risk.", optional: true },
  { id: "growthTarget", title: "What is your growth target?", helper: "Use a monthly or annual revenue growth target so forecasts have a benchmark.", optional: true },
  { id: "review", title: "Review and confirm.", helper: "Edit any answer before saving the Business Profile as analysis context." },
]

const EU_COUNTRIES = new Set([
  "austria", "belgium", "bulgaria", "croatia", "cyprus", "czech republic", "czechia", "denmark",
  "estonia", "finland", "france", "germany", "deutschland", "greece", "hungary", "ireland",
  "italy", "latvia", "lithuania", "luxembourg", "malta", "netherlands", "nederland", "poland",
  "portugal", "romania", "slovakia", "slovenia", "spain", "sweden",
])

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware",
  "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky",
  "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi",
  "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico",
  "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania",
  "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont",
  "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming",
]

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function normalizedCountry(country: string) {
  return country.trim().toLowerCase()
}

function isUSA(country: string) {
  const value = normalizedCountry(country)
  return value === "usa" || value === "united states" || value === "united states of america"
}

function isEU(country: string) {
  return EU_COUNTRIES.has(normalizedCountry(country))
}

function selectOptions(options: string[]) {
  return options.map((option) => ({ value: option, label: option }))
}

function taxEntryValue(entries: TaxEntry[], taxTypes: string[], field: "percentage" | "fixedAmount" | "frequency") {
  const match = entries.find((entry) => taxTypes.some((taxType) => entry.taxType.toLowerCase() === taxType.toLowerCase()))
  return match?.[field] || ""
}

function contributionValue(entries: EmployerContribution[], contributionType: string, field: "percentage" | "monthlyCost" | "annualCost") {
  const match = entries.find((entry) => entry.contributionType.toLowerCase() === contributionType.toLowerCase())
  return match?.[field] || ""
}

function fixedCostValue(entries: FixedCostEntry[], costCategory: string, field: "monthlyCost" | "annualCost") {
  const match = entries.find((entry) => entry.costCategory.toLowerCase() === costCategory.toLowerCase())
  return match?.[field] || ""
}

function taxTypeForIndirectTax(country: string) {
  if (isUSA(country)) return "Sales Tax"
  const normalized = normalizedCountry(country)
  if (normalized === "canada") return "GST/HST"
  if (normalized === "australia") return "GST"
  if (normalized === "netherlands" || normalized === "nederland") return "BTW"
  return "VAT"
}

function regionalTaxType(country: string) {
  return isUSA(country) ? "State Tax" : isEU(country) ? "Trade Tax" : "Local Tax"
}

function businessContext(payload: CompanySetupPayload): BusinessContext {
  const value = `${payload.companyInfo.industry} ${payload.companyInfo.businessType} ${payload.revenueModel.businessModels.join(" ")}`.toLowerCase()
  if (/\b(saas|software|subscription|cloud|app|platform)\b/.test(value)) return "saas"
  if (/\b(retail|shop|store|ecommerce|e-commerce|commerce|marketplace|consumer)\b/.test(value)) return "retail"
  if (/\b(manufacturing|factory|production|industrial|materials|hardware)\b/.test(value)) return "manufacturing"
  if (/\b(service|services|consulting|agency|professional|freelance)\b/.test(value)) return "services"
  return "general"
}

function contextualQuestion(question: Question, payload: CompanySetupPayload): Question {
  const context = businessContext(payload)
  const taxType = taxTypeForIndirectTax(payload.companyInfo.country)
  const regionalTax = regionalTaxType(payload.companyInfo.country)
  const copy: Partial<Record<QuestionId, Partial<Question>>> = {
    industry: {
      helper: "Use the plain industry label a customer or accountant would recognize. It shapes benchmarks without locking the profile.",
    },
    businessModel: {
      helper: "Pick every model that materially affects revenue or cost behavior. Multiple choices are expected for hybrid businesses.",
    },
    taxRegistered: {
      title: `Do you collect ${taxType}?`,
      helper: `Choose the filing status you use today. ${taxType} is only applied after you confirm or edit the rate.`,
    },
    taxRate: {
      title: `What standard ${taxType} rate should UseClevr apply?`,
      helper: `Use the rate that applies to most revenue. Skip this when ${taxType} changes by product, region, or customer.`,
    },
    localStateTradeTax: {
      title: `What ${regionalTax.toLowerCase()} rate applies?`,
      helper: "Add only the recurring regional business tax you want included in planning estimates.",
    },
    insuranceTypes: {
      helper: context === "saas"
        ? "Cyber, professional liability, and directors policies often matter for SaaS risk analysis."
        : context === "retail"
          ? "Property, product liability, and general liability policies often matter for retail risk analysis."
          : context === "manufacturing"
            ? "Property, product liability, vehicle, and workers policies often matter for manufacturing risk analysis."
            : "Select only policies that materially affect operating cost or business risk.",
    },
    rentOfficeCost: {
      title: context === "retail" ? "What is your monthly store, warehouse, or office cost?" : question.title,
      helper: context === "saas" ? "Include office, coworking, or remote-work space costs when they recur monthly." : question.helper,
    },
    softwareSaasCost: {
      helper: context === "saas" ? "Include hosting, cloud infrastructure, observability, support tools, and internal SaaS subscriptions." : question.helper,
    },
    logisticsShippingCost: {
      helper: context === "retail" || context === "manufacturing" ? "Include fulfillment, freight, carrier fees, packaging, or warehouse handling that is not already in uploaded data." : question.helper,
    },
    inventoryMaterialCost: {
      title: context === "saas" || context === "services" ? "What direct delivery cost percentage applies?" : question.title,
      helper: context === "saas" ? "Use hosting, support, or direct service delivery cost as a percentage of revenue. Enter 0 when it is not useful." : question.helper,
    },
    returnRefundRate: {
      title: context === "retail" ? "What return, refund, or chargeback rate applies?" : question.title,
      helper: context === "retail" ? "Use the percentage of orders or revenue usually lost to returns, refunds, exchanges, or chargebacks." : "Use the percentage of revenue usually reversed through refunds, credits, cancellations, or chargebacks.",
    },
    cashReserveTarget: {
      helper: "Use months of operating costs or a currency amount. This shapes cash-buffer and risk commentary in future analysis.",
    },
    review: {
      helper: "Review the values that will personalize future AI analysis. Missing optional values stay missing and reduce confidence only where relevant.",
    },
  }
  return { ...question, ...copy[question.id] }
}

function countryTaxPlaceholder(country: string) {
  const normalized = normalizedCountry(country)
  if (isUSA(country)) return "6.5"
  if (normalized === "netherlands" || normalized === "nederland") return "21"
  if (normalized === "germany" || normalized === "deutschland") return "19"
  if (normalized === "united kingdom" || normalized === "uk") return "20"
  if (normalized === "canada") return "5"
  if (normalized === "australia") return "10"
  return isEU(country) ? "21" : "20"
}

function corporateTaxPlaceholder(country: string) {
  const normalized = normalizedCountry(country)
  if (isUSA(country)) return "21"
  if (normalized === "netherlands" || normalized === "nederland") return "25.8"
  if (normalized === "germany" || normalized === "deutschland") return "15"
  if (normalized === "united kingdom" || normalized === "uk") return "25"
  return "20"
}

function costPlaceholder(id: QuestionId, payload: CompanySetupPayload) {
  const context = businessContext(payload)
  const values: Record<BusinessContext, Partial<Record<QuestionId, string>>> = {
    saas: {
      companyName: "Northstar SaaS Ltd.",
      industry: "B2B SaaS, vertical software, cloud platform",
      rentOfficeCost: "1200",
      utilitiesCost: "250",
      softwareSaasCost: "1800",
      marketingCost: "3000",
      logisticsShippingCost: "0",
      inventoryMaterialCost: "12",
      paymentProcessingFees: "2.9",
      returnRefundRate: "3",
      targetGrossMargin: "75%",
      targetNetMargin: "18%",
      cashReserveTarget: "6 months of operating costs",
      growthTarget: "20% annual recurring revenue growth",
    },
    retail: {
      companyName: "Bright Market Co.",
      industry: "Retail, e-commerce, specialty store",
      rentOfficeCost: "3500",
      utilitiesCost: "650",
      softwareSaasCost: "450",
      marketingCost: "1800",
      logisticsShippingCost: "1200",
      inventoryMaterialCost: "55",
      paymentProcessingFees: "2.9",
      returnRefundRate: "6",
      targetGrossMargin: "45%",
      targetNetMargin: "10%",
      cashReserveTarget: "3 months of operating costs",
      growthTarget: "12% annual sales growth",
    },
    manufacturing: {
      companyName: "Precision Works BV",
      industry: "Manufacturing, production, industrial goods",
      rentOfficeCost: "4500",
      utilitiesCost: "1500",
      softwareSaasCost: "700",
      marketingCost: "1200",
      logisticsShippingCost: "1800",
      inventoryMaterialCost: "48",
      paymentProcessingFees: "1.5",
      returnRefundRate: "2",
      targetGrossMargin: "38%",
      targetNetMargin: "12%",
      cashReserveTarget: "4 months of operating costs",
      growthTarget: "8% annual revenue growth",
    },
    services: {
      companyName: "Clever Advisory Studio",
      industry: "Consulting, agency, professional services",
      rentOfficeCost: "900",
      utilitiesCost: "200",
      softwareSaasCost: "650",
      marketingCost: "900",
      logisticsShippingCost: "0",
      inventoryMaterialCost: "0",
      paymentProcessingFees: "1.8",
      returnRefundRate: "1",
      targetGrossMargin: "60%",
      targetNetMargin: "22%",
      cashReserveTarget: "3 months of payroll and fixed costs",
      growthTarget: "15% annual revenue growth",
    },
    general: {
      companyName: "Acme Business Ltd.",
      industry: "SaaS, retail, manufacturing, services...",
      rentOfficeCost: "2500",
      utilitiesCost: "400",
      softwareSaasCost: "600",
      marketingCost: "1500",
      logisticsShippingCost: "900",
      inventoryMaterialCost: "45",
      paymentProcessingFees: "2.9",
      returnRefundRate: "4",
      targetGrossMargin: "35%",
      targetNetMargin: "12%",
      cashReserveTarget: "3 months of operating costs",
      growthTarget: "10% annual revenue growth",
    },
  }
  return values[context][id] || values.general[id] || ""
}

function numberFromInput(value: string) {
  const cleaned = value.trim().replace(/[%,$€£\s]/g, "").replace(",", ".")
  if (!cleaned) return null
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function percentageError(label: string, value: string, max = 100) {
  if (!value.trim()) return null
  const parsed = numberFromInput(value)
  if (parsed === null) return `${label} must be a number. Use digits such as 21 or 21%.`
  if (parsed < 0) return `${label} cannot be negative.`
  if (parsed > max) return `${label} looks too high. Use a value up to ${max}%.`
  return null
}

function amountError(label: string, value: string) {
  if (!value.trim()) return null
  const parsed = numberFromInput(value)
  if (parsed === null) return `${label} must be a number.`
  if (parsed < 0) return `${label} cannot be negative.`
  if (parsed > 100000000) return `${label} looks unusually high. Check the amount before continuing.`
  return null
}

function validateQuestion(question: Question, payload: CompanySetupPayload, requireCompletion = true): string | null {
  const required = (value: string | string[], label: string) => {
    if (!requireCompletion) return null
    const filled = Array.isArray(value) ? value.length > 0 : value.trim().length > 0
    return filled ? null : `${label} is required to personalize the profile.`
  }

  switch (question.id) {
    case "companyName":
      return required(payload.companyInfo.companyName, "Company name")
    case "country":
      return required(payload.companyInfo.country, "Country")
    case "stateRegion":
      return isUSA(payload.companyInfo.country) ? required(payload.companyInfo.stateRegion, "State") : null
    case "legalStructure":
      return required(payload.companyInfo.legalStructure, "Legal structure")
    case "industry":
      return required(payload.companyInfo.industry, "Industry")
    case "businessModel":
      return required(payload.revenueModel.businessModels, "Business model")
    case "currency":
      return required(payload.currencySettings.primaryCurrency, "Currency")
    case "fiscalYear":
      if (!payload.companyInfo.fiscalYearStart.trim() && !payload.companyInfo.fiscalYearEnd.trim() && !requireCompletion) return null
      if (!payload.companyInfo.fiscalYearStart.trim() || !payload.companyInfo.fiscalYearEnd.trim()) {
        return requireCompletion ? "Add both fiscal year start and end, or save progress and return later." : "Add both fiscal year start and end, or leave both blank for now."
      }
      return null
    case "taxRate":
      return percentageError(`${taxTypeForIndirectTax(payload.companyInfo.country)} rate`, payload.taxSettings.standardTaxRate || taxEntryValue(payload.taxSettings.taxEntries, [taxTypeForIndirectTax(payload.companyInfo.country), "VAT", "Sales Tax", "GST", "GST/HST", "BTW"], "percentage"), 35)
    case "corporateTaxRate":
      return percentageError("Profit tax rate", taxEntryValue(payload.taxSettings.taxEntries, ["Corporate Tax", "Income Tax", "Federal Tax", "Corporation Tax"], "percentage"), 60)
    case "localStateTradeTax":
      return percentageError(`${regionalTaxType(payload.companyInfo.country)} rate`, taxEntryValue(payload.taxSettings.taxEntries, [regionalTaxType(payload.companyInfo.country), "Local Tax", "State Tax", "Trade Tax"], "percentage"), 40)
    case "employees": {
      const value = payload.companyInfo.employeeCount.trim()
      if (!value) return null
      const parsed = numberFromInput(value)
      if (parsed === null || !Number.isInteger(parsed)) return "Employee count must be a whole number."
      if (parsed < 0) return "Employee count cannot be negative."
      if (parsed > 100000) return "Employee count looks unusually high. Check the number before continuing."
      return null
    }
    case "averageGrossSalary":
      return amountError("Average gross salary", contributionValue(payload.employerContributions, "Average Gross Salary", "monthlyCost"))
    case "employerContribution":
      return percentageError("Employer contribution", contributionValue(payload.employerContributions, "Employer Contribution", "percentage"), 60)
    case "healthInsuranceContribution":
      return percentageError("Health insurance contribution", contributionValue(payload.employerContributions, "Health Insurance", "percentage"), 40)
    case "pensionContribution":
      return percentageError("Pension contribution", contributionValue(payload.employerContributions, "Pension", "percentage"), 40)
    case "unemploymentContribution":
      return percentageError("Unemployment contribution", contributionValue(payload.employerContributions, "Unemployment Insurance", "percentage"), 20)
    case "workersCompContribution":
      return percentageError("Workers compensation contribution", contributionValue(payload.employerContributions, "Workers Compensation", "percentage"), 20)
    case "insuranceMonthlyCost":
      return amountError("Insurance cost", payload.insuranceSettings.insurancePremiumAmount)
    case "rentOfficeCost":
      return amountError("Rent or office cost", fixedCostValue(payload.fixedCosts, "Rent", "monthlyCost"))
    case "utilitiesCost":
      return amountError("Utilities cost", fixedCostValue(payload.fixedCosts, "Utilities", "monthlyCost"))
    case "softwareSaasCost":
      return amountError("Software or SaaS cost", fixedCostValue(payload.fixedCosts, "Software", "monthlyCost"))
    case "marketingCost":
      return amountError("Marketing cost", fixedCostValue(payload.fixedCosts, "Marketing", "monthlyCost"))
    case "logisticsShippingCost":
      return amountError("Logistics or shipping cost", fixedCostValue(payload.fixedCosts, "Logistics", "monthlyCost"))
    case "loanLeasingPayments":
      return amountError("Loan or leasing payments", payload.loanLeasingSettings.monthlyDebtPayment)
    case "inventoryMaterialCost":
      return percentageError("Inventory or delivery cost", payload.costStructure.inventoryCosts || payload.costStructure.materialCosts, 100)
    case "paymentProcessingFees":
      return percentageError("Payment processing fee", payload.costStructure.paymentProcessingFees, 20)
    case "returnRefundRate":
      return percentageError("Return or refund rate", payload.costStructure.returnRates, 100)
    default:
      return null
  }
}

export function BusinessProfileQuestionWizard() {
  const router = useRouter()
  const [payload, setPayload] = useState<CompanySetupPayload>(emptyCompanySetupPayload)
  const [isLoading, setIsLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [validationMessage, setValidationMessage] = useState<string | null>(null)
  const [completed, setCompleted] = useState(false)
  const questionHeadingRef = useRef<HTMLHeadingElement>(null)

  const status = useMemo(() => buildSetupStatus(payload), [payload])
  const employeeCount = payload.companyInfo.employeeCount.trim().toLowerCase()
  const hasEmployees = Boolean(employeeCount) && employeeCount !== "0" && employeeCount !== "no" && employeeCount !== "not_sure"
  const isUsBusiness = isUSA(payload.companyInfo.country)
  const isEuBusiness = isEU(payload.companyInfo.country)
  const visibleQuestions = useMemo(() => {
    return BASE_QUESTIONS.filter((question) => {
      if (question.id === "stateRegion") return isUsBusiness || Boolean(payload.companyInfo.stateRegion)
      if (question.id === "taxRate") return payload.taxSettings.taxRegistered === "yes"
      if (
        [
          "averageGrossSalary",
          "employerContribution",
          "healthInsuranceContribution",
          "pensionContribution",
          "unemploymentContribution",
          "workersCompContribution",
        ].includes(question.id)
      ) {
        return hasEmployees
      }
      if (question.id === "localStateTradeTax") return isUsBusiness || isEuBusiness || Boolean(taxEntryValue(payload.taxSettings.taxEntries, ["Local Tax", "State Tax", "Trade Tax"], "percentage"))
      return true
    })
  }, [hasEmployees, isEuBusiness, isUsBusiness, payload.companyInfo.stateRegion, payload.taxSettings.taxEntries, payload.taxSettings.taxRegistered])
  const activeQuestion = visibleQuestions[Math.min(activeIndex, visibleQuestions.length - 1)] || visibleQuestions[0]
  const displayQuestion = useMemo(() => contextualQuestion(activeQuestion, payload), [activeQuestion, payload])
  const progress = Math.round(((Math.min(activeIndex, visibleQuestions.length - 1) + 1) / visibleQuestions.length) * 100)

  const update = useCallback(<K extends keyof CompanySetupPayload>(section: K, values: Partial<CompanySetupPayload[K]>) => {
    setPayload((previous) => {
      const next = normalizeCompanySetupPayload({
        ...previous,
        [section]: { ...previous[section], ...values },
      } as Partial<CompanySetupPayload>)
      next.setupStatus = buildSetupStatus(next)
      return next
    })
  }, [])

  const replace = useCallback((values: Partial<CompanySetupPayload>) => {
    setPayload((previous) => {
      const next = normalizeCompanySetupPayload({ ...previous, ...values })
      next.setupStatus = buildSetupStatus(next)
      return next
    })
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/business/setup", { cache: "no-store" })
        if (!res.ok) return
        const data = await res.json()
        if (data.payload) {
          const normalized = normalizeCompanySetupPayload(data.payload as Partial<CompanySetupPayload>)
          setPayload(normalized)
          setCompleted(normalized.setupStatus.completed)
        }
      } finally {
        setIsLoading(false)
      }
    }
    void load()
  }, [])

  useEffect(() => {
    if (activeIndex > visibleQuestions.length - 1) setActiveIndex(Math.max(visibleQuestions.length - 1, 0))
  }, [activeIndex, visibleQuestions.length])

  useEffect(() => {
    setValidationMessage(null)
    if (isOpen && !completed) questionHeadingRef.current?.focus()
  }, [activeIndex, completed, isOpen])

  async function save(nextIndex?: number, markComplete = false, validateCurrent = false) {
    if (validateCurrent) {
      const message = validateQuestion(activeQuestion, payload, markComplete || typeof nextIndex === "number")
      if (message) {
        setValidationMessage(message)
        return
      }
    }
    setIsSaving(true)
    setSaveMessage(null)
    setValidationMessage(null)
    try {
      const normalized = normalizeCompanySetupPayload(payload)
      const res = await fetch("/api/business/setup", {
        method: "PUT",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: normalized }),
      })
      if (!res.ok) throw new Error("Save failed")
      const data = await res.json()
      const savedPayload = data.payload
        ? normalizeCompanySetupPayload(data.payload as Partial<CompanySetupPayload>)
        : normalized
      setPayload(savedPayload)
      setSaveMessage(markComplete ? "Business Profile completed and ready for future analysis." : "Progress saved.")
      if (markComplete) setCompleted(savedPayload.setupStatus.completed)
      if (typeof nextIndex === "number") setActiveIndex(Math.max(0, Math.min(nextIndex, visibleQuestions.length - 1)))
      router.refresh()
    } catch {
      setSaveMessage("Business profile was not saved. Try again.")
    } finally {
      setIsSaving(false)
      window.setTimeout(() => setSaveMessage(null), 3500)
    }
  }

  function next() {
    if (activeQuestion.id === "review") {
      void save(activeIndex, true, true)
      return
    }
    void save(activeIndex + 1, false, true)
  }

  function skip() {
    setValidationMessage(null)
    if (activeQuestion.id === "taxRegistered") update("taxSettings", { taxRegistered: "not_sure" })
    void save(activeIndex + 1)
  }

  function upsertTaxEntry(taxType: string, values: Partial<TaxEntry>) {
    const existing = payload.taxSettings.taxEntries.findIndex((entry) => entry.taxType.toLowerCase() === taxType.toLowerCase())
    const nextEntry: TaxEntry = {
      ...emptyTaxEntry(),
      ...(existing >= 0 ? payload.taxSettings.taxEntries[existing] : {}),
      ...values,
      id: existing >= 0 ? payload.taxSettings.taxEntries[existing].id : uid("tax"),
      taxType,
      confirmed: true,
    }
    const taxEntries = existing >= 0
      ? payload.taxSettings.taxEntries.map((entry, index) => (index === existing ? nextEntry : entry))
      : [...payload.taxSettings.taxEntries, nextEntry]
    update("taxSettings", { taxEntries })
  }

  function upsertContribution(contributionType: string, values: Partial<EmployerContribution>) {
    const existing = payload.employerContributions.findIndex((entry) => entry.contributionType.toLowerCase() === contributionType.toLowerCase())
    const nextEntry: EmployerContribution = {
      ...emptyContribution(),
      ...(existing >= 0 ? payload.employerContributions[existing] : {}),
      ...values,
      id: existing >= 0 ? payload.employerContributions[existing].id : uid("contribution"),
      contributionType,
    }
    const employerContributions = existing >= 0
      ? payload.employerContributions.map((entry, index) => (index === existing ? nextEntry : entry))
      : [...payload.employerContributions, nextEntry]
    replace({ employerContributions })
  }

  function upsertFixedCost(costCategory: string, values: Partial<FixedCostEntry>) {
    const existing = payload.fixedCosts.findIndex((entry) => entry.costCategory.toLowerCase() === costCategory.toLowerCase())
    const nextEntry: FixedCostEntry = {
      ...emptyFixedCost(),
      ...(existing >= 0 ? payload.fixedCosts[existing] : {}),
      ...values,
      id: existing >= 0 ? payload.fixedCosts[existing].id : uid("fixed"),
      costCategory,
    }
    const fixedCosts = existing >= 0
      ? payload.fixedCosts.map((entry, index) => (index === existing ? nextEntry : entry))
      : [...payload.fixedCosts, nextEntry]
    replace({ fixedCosts })
  }

  function setBusinessModels(values: string[]) {
    update("companyInfo", { businessType: values[0] || "" })
    update("revenueModel", { businessModels: values })
  }

  function renderQuestion() {
    switch (activeQuestion.id) {
      case "companyName":
        return <TextAnswer value={payload.companyInfo.companyName} onChange={(value) => update("companyInfo", { companyName: value })} placeholder={costPlaceholder("companyName", payload)} />
      case "country":
        return (
          <div className="space-y-3">
            <TextAnswer
              value={payload.companyInfo.country}
              onChange={(value) => update("companyInfo", { country: value, countryOfRegistration: value, taxResidenceCountry: value })}
              placeholder="Germany, USA, Netherlands..."
            />
            {payload.companyInfo.country && (
              <SuggestionNote text={isUSA(payload.companyInfo.country) ? "USA selected: state, federal tax, state tax, and sales tax suggestions become available." : isEU(payload.companyInfo.country) ? "EU country selected: VAT and corporate or income tax suggestions become available." : "Country selected. Suggestions remain editable and optional."} />
            )}
          </div>
        )
      case "stateRegion":
        return isUSA(payload.companyInfo.country) ? (
          <SelectAnswer value={payload.companyInfo.stateRegion} options={US_STATES} onChange={(value) => update("companyInfo", { stateRegion: value })} />
        ) : (
          <TextAnswer value={payload.companyInfo.stateRegion} onChange={(value) => update("companyInfo", { stateRegion: value })} placeholder="State, province, canton, region..." />
        )
      case "legalStructure":
        return <ChoiceAnswer value={payload.companyInfo.legalStructure} options={LEGAL_STRUCTURES.map((item) => ({ value: item.value, label: item.label }))} onChange={(value) => update("companyInfo", { legalStructure: value as CompanySetupPayload["companyInfo"]["legalStructure"] })} />
      case "industry":
        return <TextAnswer value={payload.companyInfo.industry} onChange={(value) => update("companyInfo", { industry: value })} placeholder={costPlaceholder("industry", payload)} />
      case "businessModel":
        return <MultiChoiceAnswer values={payload.revenueModel.businessModels} options={BUSINESS_TYPES} onChange={setBusinessModels} />
      case "currency":
        return <ChoiceAnswer value={payload.currencySettings.primaryCurrency} options={selectOptions(CURRENCIES)} onChange={(value) => update("currencySettings", { primaryCurrency: value, reportingCurrency: value })} />
      case "fiscalYear":
        return (
          <div className="grid gap-3 sm:grid-cols-2">
            <LabeledInput label="Fiscal year start" value={payload.companyInfo.fiscalYearStart} onChange={(value) => update("companyInfo", { fiscalYearStart: value })} placeholder="January 1" />
            <LabeledInput label="Fiscal year end" value={payload.companyInfo.fiscalYearEnd} onChange={(value) => update("companyInfo", { fiscalYearEnd: value })} placeholder="December 31" />
          </div>
        )
      case "taxRegistered":
        return (
          <ChoiceAnswer
            value={payload.taxSettings.taxRegistered}
            options={[
              { value: "yes", label: isUSA(payload.companyInfo.country) ? "Yes, sales-tax registered" : "Yes, VAT/GST registered" },
              { value: "no", label: "No" },
              { value: "not_sure", label: "Not sure" },
            ]}
            onChange={(value) => update("taxSettings", { taxRegistered: value as CompanySetupPayload["taxSettings"]["taxRegistered"] })}
          />
        )
      case "taxRate": {
        const taxType = taxTypeForIndirectTax(payload.companyInfo.country)
        return (
          <div className="space-y-3">
            <LabeledInput
              label={`${taxType} rate (%)`}
              value={payload.taxSettings.standardTaxRate || taxEntryValue(payload.taxSettings.taxEntries, [taxType, "VAT", "Sales Tax", "GST", "GST/HST", "BTW"], "percentage")}
              onChange={(value) => {
                update("taxSettings", {
                  standardTaxRate: value,
                  taxType: isUSA(payload.companyInfo.country) ? "sales_tax" : "vat",
                })
                upsertTaxEntry(taxType, { percentage: value })
              }}
              placeholder={countryTaxPlaceholder(payload.companyInfo.country)}
            />
            <SuggestionNote text={`${taxType} is stored as a confirmed tax assumption for future uploaded-data analysis.`} />
          </div>
        )
      }
      case "corporateTaxRate":
        return (
          <LabeledInput
            label={isUSA(payload.companyInfo.country) ? "Federal or income tax rate (%)" : "Corporate or income tax rate (%)"}
            value={taxEntryValue(payload.taxSettings.taxEntries, ["Corporate Tax", "Income Tax", "Federal Tax", "Corporation Tax"], "percentage")}
            onChange={(value) => upsertTaxEntry(isUSA(payload.companyInfo.country) ? "Federal Tax" : "Corporate Tax", { percentage: value })}
            placeholder={corporateTaxPlaceholder(payload.companyInfo.country)}
          />
        )
      case "localStateTradeTax": {
        const taxType = regionalTaxType(payload.companyInfo.country)
        return (
          <LabeledInput
            label={`${taxType} rate (%)`}
            value={taxEntryValue(payload.taxSettings.taxEntries, [taxType, "Local Tax", "State Tax", "Trade Tax"], "percentage")}
            onChange={(value) => upsertTaxEntry(taxType, { percentage: value })}
            placeholder={isUSA(payload.companyInfo.country) ? "6.5" : isEU(payload.companyInfo.country) ? "14" : "5"}
          />
        )
      }
      case "taxFrequency":
        return (
          <ChoiceAnswer
            value={taxEntryValue(payload.taxSettings.taxEntries, ["Corporate Tax", "Income Tax", "Federal Tax", "VAT", "Sales Tax", "GST", "GST/HST", "BTW"], "frequency")}
            options={[
              { value: "monthly", label: "Monthly" },
              { value: "quarterly", label: "Quarterly" },
              { value: "annual", label: "Annual" },
            ]}
            onChange={(value) => {
              const baseTaxType = payload.taxSettings.taxRegistered === "yes" ? taxTypeForIndirectTax(payload.companyInfo.country) : isUSA(payload.companyInfo.country) ? "Federal Tax" : "Corporate Tax"
              upsertTaxEntry(baseTaxType, { frequency: value as TaxEntry["frequency"] })
            }}
          />
        )
      case "employees":
        return <TextAnswer value={payload.companyInfo.employeeCount} onChange={(value) => {
          update("companyInfo", { employeeCount: value })
          if (value.trim() === "0") replace({ employerContributions: [] })
        }} placeholder={businessContext(payload) === "saas" || businessContext(payload) === "services" ? "0, 2, 8..." : "0, 5, 24..."} />
      case "averageGrossSalary":
        return (
          <LabeledInput
            label="Average monthly gross salary"
            value={contributionValue(payload.employerContributions, "Average Gross Salary", "monthlyCost")}
            onChange={(value) => upsertContribution("Average Gross Salary", { monthlyCost: value })}
            placeholder="3500"
          />
        )
      case "employerContribution":
        return <ContributionAnswer label="Employer contribution (%)" type="Employer Contribution" placeholder="20" entries={payload.employerContributions} onChange={upsertContribution} />
      case "healthInsuranceContribution":
        return <ContributionAnswer label="Health insurance contribution (%)" type="Health Insurance" placeholder="7.3" entries={payload.employerContributions} onChange={upsertContribution} />
      case "pensionContribution":
        return <ContributionAnswer label="Pension / retirement contribution (%)" type="Pension" placeholder="9.3" entries={payload.employerContributions} onChange={upsertContribution} />
      case "unemploymentContribution":
        return <ContributionAnswer label="Unemployment insurance contribution (%)" type="Unemployment Insurance" placeholder="1.3" entries={payload.employerContributions} onChange={upsertContribution} />
      case "workersCompContribution":
        return <ContributionAnswer label="Accident / workers compensation (%)" type="Workers Compensation" placeholder="1.5" entries={payload.employerContributions} onChange={upsertContribution} />
      case "insuranceTypes":
        return (
          <MultiChoiceAnswer
            values={payload.insuranceSettings.insuranceTypes}
            options={INSURANCE_TYPES}
            onChange={(values) => update("insuranceSettings", {
              hasBusinessInsurance: values.length > 0 ? "yes" : "",
              insuranceTypes: values,
              insuranceEntries: values.map((insuranceType) => payload.insuranceSettings.insuranceEntries.find((entry) => entry.insuranceType === insuranceType) || { ...emptyInsurance(), id: uid("insurance"), insuranceType }),
            })}
          />
        )
      case "insuranceMonthlyCost":
        return (
          <LabeledInput
            label="Total monthly insurance cost"
            value={payload.insuranceSettings.insurancePremiumAmount}
            onChange={(value) => update("insuranceSettings", { hasBusinessInsurance: value ? "yes" : payload.insuranceSettings.hasBusinessInsurance, insurancePremiumAmount: value, insurancePaymentFrequency: "monthly" })}
            placeholder={businessContext(payload) === "manufacturing" ? "650" : businessContext(payload) === "retail" ? "420" : "250"}
          />
        )
      case "rentOfficeCost":
        return <FixedCostAnswer label="Monthly rent / office cost" category="Rent" placeholder={costPlaceholder("rentOfficeCost", payload)} entries={payload.fixedCosts} onChange={upsertFixedCost} />
      case "utilitiesCost":
        return <FixedCostAnswer label="Monthly utilities cost" category="Utilities" placeholder={costPlaceholder("utilitiesCost", payload)} entries={payload.fixedCosts} onChange={upsertFixedCost} />
      case "softwareSaasCost":
        return <FixedCostAnswer label="Monthly software / SaaS cost" category="Software" placeholder={costPlaceholder("softwareSaasCost", payload)} entries={payload.fixedCosts} onChange={upsertFixedCost} />
      case "marketingCost":
        return <FixedCostAnswer label="Monthly marketing cost" category="Marketing" placeholder={costPlaceholder("marketingCost", payload)} entries={payload.fixedCosts} onChange={upsertFixedCost} />
      case "logisticsShippingCost":
        return <FixedCostAnswer label="Monthly logistics / shipping cost" category="Logistics" placeholder={costPlaceholder("logisticsShippingCost", payload)} entries={payload.fixedCosts} onChange={(category, values) => {
          upsertFixedCost(category, values)
          update("costStructure", { shippingCosts: values.monthlyCost || payload.costStructure.shippingCosts })
        }} />
      case "loanLeasingPayments":
        return (
          <LabeledInput
            label="Monthly loan / leasing payments"
            value={payload.loanLeasingSettings.monthlyDebtPayment}
            onChange={(value) => {
              update("loanLeasingSettings", { hasBusinessLoans: value ? "yes" : payload.loanLeasingSettings.hasBusinessLoans, hasLeasing: value ? "yes" : payload.loanLeasingSettings.hasLeasing, monthlyDebtPayment: value })
              upsertFixedCost("Loan Payments", { monthlyCost: value })
            }}
            placeholder={businessContext(payload) === "manufacturing" ? "2500" : "1200"}
          />
        )
      case "inventoryMaterialCost":
        return (
          <LabeledInput
            label="Inventory / material cost (% of revenue)"
            value={payload.costStructure.inventoryCosts || payload.costStructure.materialCosts}
            onChange={(value) => update("costStructure", { inventoryCosts: value, materialCosts: value })}
            placeholder={costPlaceholder("inventoryMaterialCost", payload)}
          />
        )
      case "paymentProcessingFees":
        return <LabeledInput label="Payment processing fees (% of revenue)" value={payload.costStructure.paymentProcessingFees} onChange={(value) => update("costStructure", { paymentProcessingFees: value })} placeholder={costPlaceholder("paymentProcessingFees", payload)} />
      case "returnRefundRate":
        return <LabeledInput label="Return / refund rate (% of revenue or orders)" value={payload.costStructure.returnRates} onChange={(value) => update("costStructure", { returnRates: value })} placeholder={costPlaceholder("returnRefundRate", payload)} />
      case "targetGrossMargin":
        return <TextAnswer value={payload.revenueModel.grossMarginTarget} onChange={(value) => update("revenueModel", { grossMarginTarget: value })} placeholder={costPlaceholder("targetGrossMargin", payload)} />
      case "targetNetMargin":
        return <TextAnswer value={payload.businessGoals.profitTarget} onChange={(value) => update("businessGoals", { profitTarget: value })} placeholder={costPlaceholder("targetNetMargin", payload)} />
      case "cashReserveTarget":
        return <TextAnswer value={payload.businessGoals.cashReserveTarget} onChange={(value) => update("businessGoals", { cashReserveTarget: value })} placeholder={costPlaceholder("cashReserveTarget", payload)} />
      case "growthTarget":
        return (
          <TextAnswer
            value={payload.businessGoals.growthTarget}
            onChange={(value) => update("businessGoals", { growthTarget: value })}
            placeholder={costPlaceholder("growthTarget", payload)}
          />
        )
      case "review":
        return <ReviewAnswer payload={payload} status={status} onEdit={(id) => setActiveIndex(Math.max(0, visibleQuestions.findIndex((question) => question.id === id)))} />
      default:
        return null
    }
  }

  if (isLoading) {
    return <div className="text-center text-sm text-muted-foreground">Loading business profile...</div>
  }

  return (
    <div className="space-y-4 text-center">
      <Button type="button" onClick={() => setIsOpen(true)} size="lg" className="min-w-56">
        <Sparkles className="mr-2 h-4 w-4" />
        Business Profile Setup
      </Button>

      {(completed || status.completed) && <SavedProfileSummary payload={payload} status={status} />}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-md overflow-y-auto p-0">
          <div className="border-b border-border p-5">
            <DialogHeader className="pr-8">
              <DialogTitle>Business Profile Assistant</DialogTitle>
              <DialogDescription>Step {activeIndex + 1} of {visibleQuestions.length}</DialogDescription>
            </DialogHeader>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="space-y-5 p-5">
            {completed ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center text-emerald-700 shadow-sm transition-all duration-300 dark:text-emerald-300">
                <CheckCircle2 className="mb-3 h-14 w-14" />
                <h3 className="text-xl font-semibold">Business Profile completed</h3>
                <p className="mt-2 text-sm">Future AI analysis will use these confirmed business details to personalize tax, payroll, fixed-cost, margin, cash-flow, and risk commentary.</p>
                <p className="mt-2 text-xs text-emerald-800/80 dark:text-emerald-200/80">You can edit the profile any time as the business changes.</p>
                <Button type="button" className="mt-5" onClick={() => setIsOpen(false)}>
                  View saved profile summary
                </Button>
              </div>
            ) : (
              <>
                <div>
                  <h3 ref={questionHeadingRef} tabIndex={-1} className="text-xl font-semibold text-foreground outline-none">{displayQuestion.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{displayQuestion.helper}</p>
                </div>
                <div className="rounded-xl border border-border bg-background p-4 transition-colors duration-200">{renderQuestion()}</div>
              </>
            )}
            {validationMessage && (
              <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {validationMessage}
              </div>
            )}
            {saveMessage && (
              <div role="status" aria-live="polite" className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                {saveMessage}
              </div>
            )}
          </div>

          {!completed && (
            <DialogFooter className="gap-3 border-t border-border p-5 sm:justify-between">
              <Button type="button" variant="outline" onClick={() => setActiveIndex(Math.max(activeIndex - 1, 0))} disabled={activeIndex === 0 || isSaving} className="w-full sm:w-auto">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
                {activeQuestion.optional && activeQuestion.id !== "review" && (
                  <Button type="button" variant="ghost" onClick={skip} disabled={isSaving}>Skip optional question</Button>
                )}
                <Button type="button" variant="outline" onClick={() => save(undefined, false, true)} disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save progress
                </Button>
                <Button type="button" onClick={next} disabled={isSaving}>
                  {activeQuestion.id === "review" ? "Confirm profile" : "Next"}
                  {activeQuestion.id !== "review" && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
              </div>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function emptyTaxEntry(): TaxEntry {
  return { id: "", taxType: "", percentage: "", fixedAmount: "", frequency: "", notes: "", confirmed: false }
}

function emptyContribution(): EmployerContribution {
  return { id: "", contributionType: "", percentage: "", monthlyCost: "", annualCost: "" }
}

function emptyInsurance(): InsuranceEntry {
  return { id: "", insuranceType: "", provider: "", monthlyCost: "", annualCost: "", coverageAmount: "" }
}

function emptyFixedCost(): FixedCostEntry {
  return { id: "", costCategory: "", monthlyCost: "", annualCost: "" }
}

function LabeledInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  const inputId = useId()
  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId}>{label}</Label>
      <Input id={inputId} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </div>
  )
}

function TextAnswer({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-12 text-base" />
}

function SelectInput({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  const inputId = useId()
  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId}>{label}</Label>
      <select id={inputId} value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
        <option value="">Select...</option>
        {value && !options.includes(value) && <option value={value}>{value}</option>}
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>
  )
}

function SelectAnswer({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  return <SelectInput label="Answer" value={value} options={options} onChange={onChange} />
}

function ChoiceAnswer({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return (
    <div className="grid gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={[
            "rounded-lg border px-4 py-3 text-left text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            value === option.value
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted",
          ].join(" ")}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function MultiChoiceAnswer({ values, options, onChange }: { values: string[]; options: string[]; onChange: (values: string[]) => void }) {
  function toggle(option: string) {
    onChange(values.includes(option) ? values.filter((value) => value !== option) : [...values, option])
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => toggle(option)}
          aria-pressed={values.includes(option)}
          className={[
            "rounded-lg border px-4 py-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            values.includes(option)
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted",
          ].join(" ")}
        >
          {option}
        </button>
      ))}
    </div>
  )
}

function SuggestionNote({ text }: { text: string }) {
  return <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">{text}</div>
}

function ContributionAnswer({
  label,
  type,
  placeholder,
  entries,
  onChange,
}: {
  label: string
  type: string
  placeholder: string
  entries: EmployerContribution[]
  onChange: (type: string, values: Partial<EmployerContribution>) => void
}) {
  return (
    <LabeledInput
      label={label}
      value={contributionValue(entries, type, "percentage")}
      onChange={(value) => onChange(type, { percentage: value })}
      placeholder={placeholder}
    />
  )
}

function FixedCostAnswer({
  label,
  category,
  placeholder,
  entries,
  onChange,
}: {
  label: string
  category: string
  placeholder: string
  entries: FixedCostEntry[]
  onChange: (category: string, values: Partial<FixedCostEntry>) => void
}) {
  return (
    <LabeledInput
      label={label}
      value={fixedCostValue(entries, category, "monthlyCost")}
      onChange={(value) => onChange(category, { monthlyCost: value })}
      placeholder={placeholder}
    />
  )
}

function ReviewAnswer({
  payload,
  status,
  onEdit,
}: {
  payload: CompanySetupPayload
  status: CompanySetupPayload["setupStatus"]
  onEdit: (id: QuestionId) => void
}) {
  const rows: { label: string; value: string; id: QuestionId }[] = [
    { label: "Company", value: payload.companyInfo.companyName || "Missing", id: "companyName" },
    { label: "Country", value: [payload.companyInfo.country, payload.companyInfo.stateRegion].filter(Boolean).join(", ") || "Missing", id: "country" },
    { label: "Legal structure", value: payload.companyInfo.legalStructure || "Missing", id: "legalStructure" },
    { label: "Industry", value: payload.companyInfo.industry || "Missing", id: "industry" },
    { label: "Business model", value: payload.revenueModel.businessModels.join(", ") || "Missing", id: "businessModel" },
    { label: "Currency", value: payload.currencySettings.primaryCurrency || "Missing", id: "currency" },
    { label: "Fiscal year", value: [payload.companyInfo.fiscalYearStart, payload.companyInfo.fiscalYearEnd].filter(Boolean).join(" to ") || "Missing", id: "fiscalYear" },
    { label: "Taxes", value: `${payload.taxSettings.taxEntries.length} entries`, id: "taxRegistered" },
    { label: "Employees", value: payload.companyInfo.employeeCount || "Missing", id: "employees" },
    { label: "Payroll assumptions", value: `${payload.employerContributions.length} entries`, id: "employerContribution" },
    { label: "Insurance", value: payload.insuranceSettings.insuranceTypes.join(", ") || `${payload.insuranceSettings.insuranceEntries.length} entries`, id: "insuranceTypes" },
    { label: "Fixed costs", value: `${payload.fixedCosts.length} entries`, id: "rentOfficeCost" },
    { label: "Gross margin target", value: payload.revenueModel.grossMarginTarget || "Missing", id: "targetGrossMargin" },
    { label: "Net margin target", value: payload.businessGoals.profitTarget || "Missing", id: "targetNetMargin" },
    { label: "Cash reserve target", value: payload.businessGoals.cashReserveTarget || "Missing", id: "cashReserveTarget" },
    { label: "Growth target", value: payload.businessGoals.growthTarget || "Missing", id: "growthTarget" },
  ]

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">Completion</span>
          <span className="font-semibold text-primary">{status.setupAccuracy}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${status.setupAccuracy}%` }} />
        </div>
      </div>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm">
            <div>
              <p className="font-medium">{row.label}</p>
              <p className="text-muted-foreground">{row.value}</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => onEdit(row.id)}>Edit</Button>
          </div>
        ))}
      </div>
      {status.accountantReviewFlags.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
          <p className="font-medium">Analysis confidence warnings</p>
          <ul className="mt-2 space-y-1">
            {status.accountantReviewFlags.slice(0, 4).map((flag) => <li key={flag}>- {flag}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

function SavedProfileSummary({ payload, status }: { payload: CompanySetupPayload; status: CompanySetupPayload["setupStatus"] }) {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-border bg-card p-4 text-left shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="h-5 w-5" />
        <span className="font-semibold">Saved business profile</span>
      </div>
      <div className="grid gap-2 text-sm text-muted-foreground">
        <span>Company: {payload.companyInfo.companyName || "Not added"}</span>
        <span>Country: {[payload.companyInfo.country, payload.companyInfo.stateRegion].filter(Boolean).join(", ") || "Not added"}</span>
        <span>Currency: {payload.currencySettings.primaryCurrency || "Not added"}</span>
        <span>Taxes: {payload.taxSettings.taxEntries.length} entries</span>
        <span>Completion: {status.setupAccuracy}%</span>
      </div>
    </div>
  )
}
