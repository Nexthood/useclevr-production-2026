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
import { useCallback, useEffect, useMemo, useState } from "react"

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

const BASE_QUESTIONS: Question[] = [
  { id: "companyName", title: "What is your company name?", helper: "Use the legal or operating name you want analysis reports to use." },
  { id: "country", title: "Which country is your business registered in?", helper: "Country only loads suggestions. You confirm every value before analysis uses it." },
  { id: "stateRegion", title: "Which state or region applies?", helper: "Required for USA and useful anywhere regional taxes or compliance apply.", optional: true },
  { id: "legalStructure", title: "What is your legal structure?", helper: "Choose the closest option. You can change it later." },
  { id: "industry", title: "What industry are you in?", helper: "This helps the AI understand normal revenue, cost, and risk patterns." },
  { id: "businessModel", title: "What is your business model?", helper: "Pick every model that fits so revenue and cost assumptions match your actual operation." },
  { id: "currency", title: "What currency do you use?", helper: "Analysis uses this for KPIs, reports, tax estimates, and margin calculations." },
  { id: "fiscalYear", title: "What is your fiscal year?", helper: "Add the start and end used for business reporting." },
  { id: "taxRegistered", title: "Are you VAT or sales-tax registered?", helper: "This controls whether indirect tax rates are included in analysis.", optional: true },
  { id: "taxRate", title: "What VAT or sales-tax rate applies?", helper: "Use the standard rate that applies to most revenue, or skip if it varies by product.", optional: true },
  { id: "corporateTaxRate", title: "What corporate or income tax rate applies?", helper: "This helps estimate after-tax profit and cash reserve needs.", optional: true },
  { id: "localStateTradeTax", title: "What local, state, or trade tax rate applies?", helper: "USA businesses can add state/local tax; EU businesses can add trade or local business tax.", optional: true },
  { id: "taxFrequency", title: "How often do you pay tax?", helper: "Payment timing improves cash-flow and tax reserve analysis.", optional: true },
  { id: "employees", title: "How many employees do you have?", helper: "Enter 0 if there are no employees. Payroll questions are skipped when this is 0.", optional: true },
  { id: "averageGrossSalary", title: "What is the average gross salary?", helper: "Use the average monthly gross salary per employee for payroll estimates.", optional: true },
  { id: "employerContribution", title: "What employer contribution percentage applies?", helper: "Include social security or employer payroll burden not covered by the employee salary.", optional: true },
  { id: "healthInsuranceContribution", title: "What health insurance contribution applies?", helper: "Add the employer-side health insurance percentage or monthly cost.", optional: true },
  { id: "pensionContribution", title: "What pension or retirement contribution applies?", helper: "Add the employer-side pension, retirement, or superannuation amount.", optional: true },
  { id: "unemploymentContribution", title: "What unemployment insurance contribution applies?", helper: "Add the unemployment insurance burden used in payroll analysis.", optional: true },
  { id: "workersCompContribution", title: "What accident or workers compensation contribution applies?", helper: "Add accident insurance or workers compensation rates where required.", optional: true },
  { id: "insuranceTypes", title: "Which business insurance types do you carry?", helper: "Select policies that affect operating cost and risk calculations.", optional: true },
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

export function BusinessProfileQuestionWizard() {
  const [payload, setPayload] = useState<CompanySetupPayload>(emptyCompanySetupPayload)
  const [isLoading, setIsLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [completed, setCompleted] = useState(false)

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
        const res = await fetch("/api/business/setup")
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

  async function save(nextIndex?: number, markComplete = false) {
    setIsSaving(true)
    setSaveMessage(null)
    try {
      const normalized = normalizeCompanySetupPayload(payload)
      const res = await fetch("/api/business/setup", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: normalized }),
      })
      if (!res.ok) throw new Error("Save failed")
      setPayload(normalized)
      setSaveMessage(markComplete ? "Business Profile Completed" : "Progress saved")
      if (markComplete) setCompleted(true)
      if (typeof nextIndex === "number") setActiveIndex(Math.max(0, Math.min(nextIndex, visibleQuestions.length - 1)))
    } catch {
      setSaveMessage("Business profile was not saved. Try again.")
    } finally {
      setIsSaving(false)
      window.setTimeout(() => setSaveMessage(null), 3500)
    }
  }

  function next() {
    if (activeQuestion.id === "review") {
      void save(activeIndex, true)
      return
    }
    void save(activeIndex + 1)
  }

  function skip() {
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
        return <TextAnswer value={payload.companyInfo.companyName} onChange={(value) => update("companyInfo", { companyName: value })} placeholder="UseClevr GmbH" />
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
        return <TextAnswer value={payload.companyInfo.industry} onChange={(value) => update("companyInfo", { industry: value })} placeholder="SaaS, retail, accounting, logistics..." />
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
              placeholder="19"
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
            placeholder="21"
          />
        )
      case "localStateTradeTax": {
        const taxType = regionalTaxType(payload.companyInfo.country)
        return (
          <LabeledInput
            label={`${taxType} rate (%)`}
            value={taxEntryValue(payload.taxSettings.taxEntries, [taxType, "Local Tax", "State Tax", "Trade Tax"], "percentage")}
            onChange={(value) => upsertTaxEntry(taxType, { percentage: value })}
            placeholder={isUSA(payload.companyInfo.country) ? "6.5" : "14"}
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
        }} placeholder="0, 3, 12..." />
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
            placeholder="250"
          />
        )
      case "rentOfficeCost":
        return <FixedCostAnswer label="Monthly rent / office cost" category="Rent" placeholder="2500" entries={payload.fixedCosts} onChange={upsertFixedCost} />
      case "utilitiesCost":
        return <FixedCostAnswer label="Monthly utilities cost" category="Utilities" placeholder="400" entries={payload.fixedCosts} onChange={upsertFixedCost} />
      case "softwareSaasCost":
        return <FixedCostAnswer label="Monthly software / SaaS cost" category="Software" placeholder="600" entries={payload.fixedCosts} onChange={upsertFixedCost} />
      case "marketingCost":
        return <FixedCostAnswer label="Monthly marketing cost" category="Marketing" placeholder="1500" entries={payload.fixedCosts} onChange={upsertFixedCost} />
      case "logisticsShippingCost":
        return <FixedCostAnswer label="Monthly logistics / shipping cost" category="Logistics" placeholder="900" entries={payload.fixedCosts} onChange={(category, values) => {
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
            placeholder="1200"
          />
        )
      case "inventoryMaterialCost":
        return (
          <LabeledInput
            label="Inventory / material cost (% of revenue)"
            value={payload.costStructure.inventoryCosts || payload.costStructure.materialCosts}
            onChange={(value) => update("costStructure", { inventoryCosts: value, materialCosts: value })}
            placeholder="45"
          />
        )
      case "paymentProcessingFees":
        return <LabeledInput label="Payment processing fees (% of revenue)" value={payload.costStructure.paymentProcessingFees} onChange={(value) => update("costStructure", { paymentProcessingFees: value })} placeholder="2.9" />
      case "returnRefundRate":
        return <LabeledInput label="Return / refund rate (% of revenue or orders)" value={payload.costStructure.returnRates} onChange={(value) => update("costStructure", { returnRates: value })} placeholder="4" />
      case "targetGrossMargin":
        return <TextAnswer value={payload.revenueModel.grossMarginTarget} onChange={(value) => update("revenueModel", { grossMarginTarget: value })} placeholder="35%" />
      case "targetNetMargin":
        return <TextAnswer value={payload.businessGoals.profitTarget} onChange={(value) => update("businessGoals", { profitTarget: value })} placeholder="12%" />
      case "cashReserveTarget":
        return <TextAnswer value={payload.businessGoals.cashReserveTarget} onChange={(value) => update("businessGoals", { cashReserveTarget: value })} placeholder="3 months of operating costs or 50000" />
      case "growthTarget":
        return (
          <TextAnswer
            value={payload.businessGoals.growthTarget}
            onChange={(value) => update("businessGoals", { growthTarget: value })}
            placeholder="10% annual revenue growth"
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
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="space-y-5 p-5">
            {completed ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="mb-3 h-14 w-14" />
                <h3 className="text-xl font-semibold">Business Profile Completed</h3>
                <p className="mt-2 text-sm">Saved profile values now improve future CSV and Excel analysis.</p>
                <Button type="button" className="mt-5" onClick={() => setIsOpen(false)}>
                  View saved profile summary
                </Button>
              </div>
            ) : (
              <>
                <div>
                  <h3 className="text-xl font-semibold text-foreground">{activeQuestion.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{activeQuestion.helper}</p>
                </div>
                <div className="rounded-xl border border-border bg-background p-4">{renderQuestion()}</div>
              </>
            )}
            {saveMessage && <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{saveMessage}</div>}
          </div>

          {!completed && (
            <DialogFooter className="border-t border-border p-5 sm:justify-between">
              <Button type="button" variant="outline" onClick={() => setActiveIndex(Math.max(activeIndex - 1, 0))} disabled={activeIndex === 0 || isSaving}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <div className="flex flex-wrap justify-end gap-2">
                {activeQuestion.optional && activeQuestion.id !== "review" && (
                  <Button type="button" variant="ghost" onClick={skip} disabled={isSaving}>Skip optional question</Button>
                )}
                <Button type="button" variant="outline" onClick={() => save()} disabled={isSaving}>
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
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </div>
  )
}

function TextAnswer({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-12 text-base" />
}

function SelectInput({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground">
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
          className={[
            "rounded-lg border px-4 py-3 text-left text-sm font-medium transition",
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
          className={[
            "rounded-lg border px-4 py-3 text-sm font-medium transition",
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
