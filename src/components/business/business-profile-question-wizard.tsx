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
  CONTRIBUTION_TYPES,
  CURRENCIES,
  FIXED_COST_CATEGORIES,
  INSURANCE_TYPES,
  LEGAL_STRUCTURES,
  TAX_ENTRY_TYPES,
  buildSetupStatus,
  emptyCompanySetupPayload,
  normalizeCompanySetupPayload,
  type CompanySetupPayload,
  type EmployerContribution,
  type FixedCostEntry,
  type InsuranceEntry,
  type TaxEntry,
} from "@/lib/business/company-setup"
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Plus, Save, Sparkles, Trash2 } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

type QuestionId =
  | "companyName"
  | "country"
  | "stateRegion"
  | "legalStructure"
  | "industry"
  | "currency"
  | "fiscalYear"
  | "taxRegistered"
  | "taxEntries"
  | "employees"
  | "contributions"
  | "insurance"
  | "fixedCosts"
  | "revenueModel"
  | "targetMargin"
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
  { id: "currency", title: "What currency do you use?", helper: "Analysis uses this for KPIs, reports, tax estimates, and margin calculations." },
  { id: "fiscalYear", title: "What is your fiscal year?", helper: "Add the start and end used for business reporting." },
  { id: "taxRegistered", title: "Are you VAT or sales-tax registered?", helper: "This controls whether VAT/sales-tax details appear in the next step.", optional: true },
  { id: "employees", title: "Do you have employees?", helper: "Payroll assumptions are used only when employees or payroll data exist.", optional: true },
  { id: "taxEntries", title: "Add relevant taxes, one by one.", helper: "Suggestions are editable. Nothing is treated as fact until you add and confirm it.", optional: true },
  { id: "contributions", title: "Add employer contributions, one by one.", helper: "Include health, pension, social security, unemployment, or local employer costs.", optional: true },
  { id: "insurance", title: "Add business insurances, one by one.", helper: "Insurance costs improve operating cost, cashflow, and risk analysis.", optional: true },
  { id: "fixedCosts", title: "Add fixed monthly costs, one by one.", helper: "Recurring fixed costs are included even when the uploaded file omits them.", optional: true },
  { id: "revenueModel", title: "What is your revenue model?", helper: "Select the models that best describe how revenue is generated." },
  { id: "targetMargin", title: "What is your target margin?", helper: "Analysis compares uploaded margins against this target.", optional: true },
  { id: "review", title: "Review and confirm.", helper: "Edit any answer before saving the Business Profile as analysis context." },
]

const EU_COUNTRIES = new Set([
  "austria", "belgium", "bulgaria", "croatia", "cyprus", "czech republic", "czechia", "denmark",
  "estonia", "finland", "france", "germany", "deutschland", "greece", "hungary", "ireland",
  "italy", "latvia", "lithuania", "luxembourg", "malta", "netherlands", "nederland", "poland",
  "portugal", "romania", "slovakia", "slovenia", "spain", "sweden",
])

const COUNTRY_TAX_SUGGESTIONS: Record<string, string[]> = {
  germany: ["VAT", "Corporate Tax", "Trade Tax", "Payroll Tax"],
  deutschland: ["VAT", "Corporate Tax", "Trade Tax", "Payroll Tax"],
  usa: ["Federal Tax", "State Tax", "Sales Tax", "Payroll Tax"],
  "united states": ["Federal Tax", "State Tax", "Sales Tax", "Payroll Tax"],
  netherlands: ["BTW", "Corporate Tax", "Payroll Tax"],
  nederland: ["BTW", "Corporate Tax", "Payroll Tax"],
  romania: ["VAT", "Corporate Tax", "CAS", "CASS"],
  uk: ["VAT", "Corporation Tax", "PAYE", "National Insurance"],
  "united kingdom": ["VAT", "Corporation Tax", "PAYE", "National Insurance"],
  canada: ["GST/HST", "Corporate Tax", "Payroll Tax"],
  australia: ["GST", "Company Tax", "Payroll Tax", "Superannuation"],
  switzerland: ["VAT", "Corporate Tax", "Cantonal Tax", "Social Security"],
}

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

function countrySuggestions(country: string, taxRegistered: string) {
  const suggestions = COUNTRY_TAX_SUGGESTIONS[normalizedCountry(country)] || []
  if (taxRegistered === "no") {
    return suggestions.filter((item) => !/vat|sales tax|gst|hst|btw/i.test(item))
  }
  return suggestions
}

function selectOptions(options: string[]) {
  return options.map((option) => ({ value: option, label: option }))
}

export function BusinessProfileQuestionWizard() {
  const [payload, setPayload] = useState<CompanySetupPayload>(emptyCompanySetupPayload)
  const [isLoading, setIsLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [completed, setCompleted] = useState(false)
  const [draftTax, setDraftTax] = useState<TaxEntry>(() => emptyTaxEntry())
  const [draftContribution, setDraftContribution] = useState<EmployerContribution>(() => emptyContribution())
  const [draftInsurance, setDraftInsurance] = useState<InsuranceEntry>(() => emptyInsurance())
  const [draftFixedCost, setDraftFixedCost] = useState<FixedCostEntry>(() => emptyFixedCost())

  const status = useMemo(() => buildSetupStatus(payload), [payload])
  const hasEmployees = payload.companyInfo.employeeCount !== "0"
  const visibleQuestions = useMemo(() => {
    return BASE_QUESTIONS.filter((question) => {
      if (question.id === "stateRegion") return isUSA(payload.companyInfo.country) || Boolean(payload.companyInfo.stateRegion)
      if (question.id === "contributions") return hasEmployees
      return true
    })
  }, [hasEmployees, payload.companyInfo.country, payload.companyInfo.stateRegion])
  const activeQuestion = visibleQuestions[Math.min(activeIndex, visibleQuestions.length - 1)] || visibleQuestions[0]
  const progress = Math.round(((Math.min(activeIndex, visibleQuestions.length - 1) + 1) / visibleQuestions.length) * 100)
  const suggestions = countrySuggestions(payload.companyInfo.country, payload.taxSettings.taxRegistered)

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

  function addTax(entry: TaxEntry = draftTax) {
    const taxType = entry.taxType.trim()
    if (!taxType && !entry.percentage && !entry.fixedAmount) return
    update("taxSettings", {
      taxEntries: [
        ...payload.taxSettings.taxEntries,
        { ...entry, id: uid("tax"), taxType: taxType || "Other", confirmed: true },
      ],
    })
    setDraftTax(emptyTaxEntry())
  }

  function addSuggestedTax(taxType: string) {
    addTax({ ...emptyTaxEntry(), taxType })
  }

  function addContribution() {
    if (!draftContribution.contributionType && !draftContribution.percentage && !draftContribution.monthlyCost && !draftContribution.annualCost) return
    replace({ employerContributions: [...payload.employerContributions, { ...draftContribution, id: uid("contribution") }] })
    setDraftContribution(emptyContribution())
  }

  function addInsurance() {
    if (!draftInsurance.insuranceType && !draftInsurance.provider && !draftInsurance.monthlyCost && !draftInsurance.annualCost) return
    update("insuranceSettings", {
      hasBusinessInsurance: "yes",
      insuranceEntries: [...payload.insuranceSettings.insuranceEntries, { ...draftInsurance, id: uid("insurance") }],
    })
    setDraftInsurance(emptyInsurance())
  }

  function addFixedCost() {
    if (!draftFixedCost.costCategory && !draftFixedCost.monthlyCost && !draftFixedCost.annualCost) return
    replace({ fixedCosts: [...payload.fixedCosts, { ...draftFixedCost, id: uid("fixed") }] })
    setDraftFixedCost(emptyFixedCost())
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
      case "taxEntries":
        return (
          <RepeatableQuestion
            suggestions={suggestions}
            onSuggestion={addSuggestedTax}
            entries={payload.taxSettings.taxEntries.map((entry) => `${entry.taxType}${entry.percentage ? ` ${entry.percentage}%` : ""}`)}
            onRemove={(index) => update("taxSettings", { taxEntries: payload.taxSettings.taxEntries.filter((_, itemIndex) => itemIndex !== index) })}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectInput label="Tax type" value={draftTax.taxType} options={TAX_ENTRY_TYPES} onChange={(value) => setDraftTax((entry) => ({ ...entry, taxType: value }))} />
              <LabeledInput label="Percentage" value={draftTax.percentage} onChange={(value) => setDraftTax((entry) => ({ ...entry, percentage: value }))} placeholder="19" />
              <LabeledInput label="Fixed amount" value={draftTax.fixedAmount} onChange={(value) => setDraftTax((entry) => ({ ...entry, fixedAmount: value }))} placeholder="Optional" />
              <SelectInput label="Frequency" value={draftTax.frequency} options={["monthly", "quarterly", "annual"]} onChange={(value) => setDraftTax((entry) => ({ ...entry, frequency: value as TaxEntry["frequency"] }))} />
            </div>
            <Button type="button" variant="outline" onClick={() => addTax()} className="w-full">
              <Plus className="mr-2 h-4 w-4" /> Add this tax
            </Button>
          </RepeatableQuestion>
        )
      case "employees":
        return (
          <ChoiceAnswer
            value={payload.companyInfo.employeeCount === "0" ? "no" : payload.companyInfo.employeeCount ? "yes" : ""}
            options={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
              { value: "not_sure", label: "Not sure" },
            ]}
            onChange={(value) => {
              update("companyInfo", { employeeCount: value === "no" ? "0" : value === "not_sure" ? "not_sure" : payload.companyInfo.employeeCount || "1+" })
              if (value === "no") replace({ employerContributions: [] })
            }}
          />
        )
      case "contributions":
        return (
          <RepeatableQuestion
            entries={payload.employerContributions.map((entry) => `${entry.contributionType}${entry.percentage ? ` ${entry.percentage}%` : ""}`)}
            onRemove={(index) => replace({ employerContributions: payload.employerContributions.filter((_, itemIndex) => itemIndex !== index) })}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectInput label="Contribution" value={draftContribution.contributionType} options={CONTRIBUTION_TYPES} onChange={(value) => setDraftContribution((entry) => ({ ...entry, contributionType: value }))} />
              <LabeledInput label="Percentage" value={draftContribution.percentage} onChange={(value) => setDraftContribution((entry) => ({ ...entry, percentage: value }))} placeholder="20" />
              <LabeledInput label="Monthly cost" value={draftContribution.monthlyCost} onChange={(value) => setDraftContribution((entry) => ({ ...entry, monthlyCost: value }))} placeholder="Optional" />
              <LabeledInput label="Annual cost" value={draftContribution.annualCost} onChange={(value) => setDraftContribution((entry) => ({ ...entry, annualCost: value }))} placeholder="Optional" />
            </div>
            <Button type="button" variant="outline" onClick={addContribution} className="w-full">
              <Plus className="mr-2 h-4 w-4" /> Add contribution
            </Button>
          </RepeatableQuestion>
        )
      case "insurance":
        return (
          <RepeatableQuestion
            entries={payload.insuranceSettings.insuranceEntries.map((entry) => `${entry.insuranceType}${entry.provider ? ` - ${entry.provider}` : ""}`)}
            onRemove={(index) => update("insuranceSettings", { insuranceEntries: payload.insuranceSettings.insuranceEntries.filter((_, itemIndex) => itemIndex !== index) })}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectInput label="Insurance type" value={draftInsurance.insuranceType} options={INSURANCE_TYPES} onChange={(value) => setDraftInsurance((entry) => ({ ...entry, insuranceType: value }))} />
              <LabeledInput label="Provider" value={draftInsurance.provider} onChange={(value) => setDraftInsurance((entry) => ({ ...entry, provider: value }))} placeholder="Provider name" />
              <LabeledInput label="Monthly cost" value={draftInsurance.monthlyCost} onChange={(value) => setDraftInsurance((entry) => ({ ...entry, monthlyCost: value }))} placeholder="Optional" />
              <LabeledInput label="Coverage amount" value={draftInsurance.coverageAmount} onChange={(value) => setDraftInsurance((entry) => ({ ...entry, coverageAmount: value }))} placeholder="Optional" />
            </div>
            <Button type="button" variant="outline" onClick={addInsurance} className="w-full">
              <Plus className="mr-2 h-4 w-4" /> Add insurance
            </Button>
          </RepeatableQuestion>
        )
      case "fixedCosts":
        return (
          <RepeatableQuestion
            entries={payload.fixedCosts.map((entry) => `${entry.costCategory}${entry.monthlyCost ? ` - ${entry.monthlyCost}/mo` : ""}`)}
            onRemove={(index) => replace({ fixedCosts: payload.fixedCosts.filter((_, itemIndex) => itemIndex !== index) })}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectInput label="Cost category" value={draftFixedCost.costCategory} options={FIXED_COST_CATEGORIES} onChange={(value) => setDraftFixedCost((entry) => ({ ...entry, costCategory: value }))} />
              <LabeledInput label="Monthly cost" value={draftFixedCost.monthlyCost} onChange={(value) => setDraftFixedCost((entry) => ({ ...entry, monthlyCost: value }))} placeholder="500" />
              <LabeledInput label="Annual cost" value={draftFixedCost.annualCost} onChange={(value) => setDraftFixedCost((entry) => ({ ...entry, annualCost: value }))} placeholder="Optional" />
            </div>
            <Button type="button" variant="outline" onClick={addFixedCost} className="w-full">
              <Plus className="mr-2 h-4 w-4" /> Add fixed cost
            </Button>
          </RepeatableQuestion>
        )
      case "revenueModel":
        return <MultiChoiceAnswer values={payload.revenueModel.businessModels} options={BUSINESS_TYPES} onChange={(values) => update("revenueModel", { businessModels: values })} />
      case "targetMargin":
        return <TextAnswer value={payload.revenueModel.grossMarginTarget} onChange={(value) => update("revenueModel", { grossMarginTarget: value })} placeholder="30%" />
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

function RepeatableQuestion({
  children,
  entries,
  suggestions = [],
  onSuggestion,
  onRemove,
}: {
  children: React.ReactNode
  entries: string[]
  suggestions?: string[]
  onSuggestion?: (value: string) => void
  onRemove: (index: number) => void
}) {
  return (
    <div className="space-y-4">
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Editable country suggestions</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <Button key={suggestion} type="button" variant="outline" size="sm" onClick={() => onSuggestion?.(suggestion)}>
                <Plus className="mr-2 h-4 w-4" /> {suggestion}
              </Button>
            ))}
          </div>
        </div>
      )}
      {entries.length > 0 && (
        <div className="space-y-2">
          {entries.map((entry, index) => (
            <div key={`${entry}_${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm">
              <span>{entry}</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(index)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function SuggestionNote({ text }: { text: string }) {
  return <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">{text}</div>
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
    { label: "Currency", value: payload.currencySettings.primaryCurrency || "Missing", id: "currency" },
    { label: "Fiscal year", value: [payload.companyInfo.fiscalYearStart, payload.companyInfo.fiscalYearEnd].filter(Boolean).join(" to ") || "Missing", id: "fiscalYear" },
    { label: "Taxes", value: `${payload.taxSettings.taxEntries.length} entries`, id: "taxEntries" },
    { label: "Contributions", value: `${payload.employerContributions.length} entries`, id: "contributions" },
    { label: "Insurance", value: `${payload.insuranceSettings.insuranceEntries.length} entries`, id: "insurance" },
    { label: "Fixed costs", value: `${payload.fixedCosts.length} entries`, id: "fixedCosts" },
    { label: "Revenue model", value: payload.revenueModel.businessModels.join(", ") || "Missing", id: "revenueModel" },
    { label: "Target margin", value: payload.revenueModel.grossMarginTarget || "Missing", id: "targetMargin" },
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
