"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  BUSINESS_TYPES,
  COMPANY_SIZES,
  CONTRIBUTION_TYPES,
  CURRENCIES,
  FIXED_COST_CATEGORIES,
  INSURANCE_TYPES,
  LEGAL_STRUCTURES,
  TAX_ENTRY_TYPES,
  buildSetupStatus,
  emptyCompanySetupPayload,
  normalizeCompanySetupPayload,
  type BusinessGoals,
  type CompanySetupPayload,
  type CostStructure,
  type EmployerContribution,
  type FixedCostEntry,
  type InsuranceEntry,
  type RevenueModel,
  type TaxEntry,
} from "@/lib/business/company-setup"
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Loader2, Plus, Save, Trash2 } from "lucide-react"
import type React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"

const STEPS = [
  { id: "company", label: "Company Information", optional: false },
  { id: "tax", label: "Tax Profile", optional: false },
  { id: "contributions", label: "Employer Contributions", optional: true },
  { id: "insurance", label: "Insurance Profile", optional: true },
  { id: "fixedCosts", label: "Fixed Costs", optional: true },
  { id: "revenue", label: "Revenue Model", optional: false },
  { id: "costs", label: "Cost Structure", optional: true },
  { id: "goals", label: "Business Goals", optional: true },
  { id: "review", label: "Review & Confirmation", optional: false },
] as const

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

function classNames(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function countrySuggestions(country: string) {
  const normalized = country.trim().toLowerCase()
  return COUNTRY_TAX_SUGGESTIONS[normalized] || []
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </div>
  )
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
      >
        <option value="">Select...</option>
        {value && !options.includes(value) && <option value={value}>{value}</option>}
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </div>
  )
}

function MultiChoice({
  label,
  values,
  options,
  onChange,
}: {
  label: string
  values: string[]
  options: string[]
  onChange: (values: string[]) => void
}) {
  function toggle(option: string) {
    onChange(values.includes(option) ? values.filter((value) => value !== option) : [...values, option])
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => toggle(option)}
            className={classNames(
              "rounded-md border px-3 py-2 text-sm font-medium transition",
              values.includes(option)
                ? "border-primary/70 bg-primary/10 text-primary"
                : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-muted",
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">{text}</div>
}

export function CompanySetupWizard() {
  const [step, setStep] = useState(0)
  const [payload, setPayload] = useState<CompanySetupPayload>(emptyCompanySetupPayload)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  const status = useMemo(() => buildSetupStatus(payload), [payload])
  const activeStep = STEPS[step]
  const suggestions = countrySuggestions(payload.companyInfo.country)
  const progress = Math.round(((step + 1) / STEPS.length) * 100)

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
    setPayload((previous) => normalizeCompanySetupPayload({ ...previous, ...values }))
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/business/setup")
        if (!res.ok) return
        const data = await res.json()
        if (data.payload) setPayload(normalizeCompanySetupPayload(data.payload as Partial<CompanySetupPayload>))
      } finally {
        setIsLoading(false)
      }
    }
    void load()
  }, [])

  async function save(nextStep?: number) {
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
      setSaveMessage("Business profile saved")
      if (typeof nextStep === "number") setStep(Math.max(0, Math.min(nextStep, STEPS.length - 1)))
    } catch {
      setSaveMessage("Business profile was not saved. Try again.")
    } finally {
      setIsSaving(false)
      window.setTimeout(() => setSaveMessage(null), 3500)
    }
  }

  function saveAndContinue() {
    void save(step + 1)
  }

  function skipOptional() {
    void save(step + 1)
  }

  function addTax(taxType = "") {
    const entry: TaxEntry = { id: uid("tax"), taxType, percentage: "", fixedAmount: "", frequency: "", notes: "", confirmed: Boolean(taxType) }
    update("taxSettings", { taxEntries: [...payload.taxSettings.taxEntries, entry] })
  }

  function updateTax(id: string, values: Partial<TaxEntry>) {
    update("taxSettings", { taxEntries: payload.taxSettings.taxEntries.map((entry) => entry.id === id ? { ...entry, ...values } : entry) })
  }

  function addContribution() {
    replace({ employerContributions: [...payload.employerContributions, { id: uid("contribution"), contributionType: "", percentage: "", monthlyCost: "", annualCost: "" }] })
  }

  function addInsurance() {
    update("insuranceSettings", {
      insuranceEntries: [...payload.insuranceSettings.insuranceEntries, { id: uid("insurance"), insuranceType: "", provider: "", monthlyCost: "", annualCost: "", coverageAmount: "" }],
    })
  }

  function addFixedCost() {
    replace({ fixedCosts: [...payload.fixedCosts, { id: uid("fixed"), costCategory: "", monthlyCost: "", annualCost: "" }] })
  }

  function removeById<T extends { id: string }>(items: T[], id: string) {
    return items.filter((item) => item.id !== id)
  }

  function renderCompany() {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <TextField label="Company name" value={payload.companyInfo.companyName} onChange={(value) => update("companyInfo", { companyName: value })} />
        <TextField label="Country" value={payload.companyInfo.country} onChange={(value) => update("companyInfo", { country: value, countryOfRegistration: value, taxResidenceCountry: value })} placeholder="Germany, USA, Netherlands..." />
        <TextField label="State / Province / Region" value={payload.companyInfo.stateRegion} onChange={(value) => update("companyInfo", { stateRegion: value })} />
        <TextField label="Industry" value={payload.companyInfo.industry} onChange={(value) => update("companyInfo", { industry: value })} />
        <SelectField label="Business type" value={payload.companyInfo.businessType} options={BUSINESS_TYPES} onChange={(value) => update("companyInfo", { businessType: value })} />
        <SelectField label="Legal structure" value={payload.companyInfo.legalStructure} options={LEGAL_STRUCTURES.map((item) => item.value)} onChange={(value) => update("companyInfo", { legalStructure: value as CompanySetupPayload["companyInfo"]["legalStructure"] })} />
        <SelectField label="Company size" value={payload.companyInfo.companySize} options={COMPANY_SIZES} onChange={(value) => update("companyInfo", { companySize: value })} />
        <TextField label="Number of employees" value={payload.companyInfo.employeeCount} onChange={(value) => update("companyInfo", { employeeCount: value })} type="number" />
        <TextField label="Fiscal year start" value={payload.companyInfo.fiscalYearStart} onChange={(value) => update("companyInfo", { fiscalYearStart: value })} placeholder="January 1" />
        <TextField label="Fiscal year end" value={payload.companyInfo.fiscalYearEnd} onChange={(value) => update("companyInfo", { fiscalYearEnd: value })} placeholder="December 31" />
        <SelectField label="Currency" value={payload.currencySettings.primaryCurrency} options={CURRENCIES} onChange={(value) => update("currencySettings", { primaryCurrency: value, reportingCurrency: value })} />
        {suggestions.length > 0 && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 md:col-span-2">
            <p className="text-sm font-semibold text-foreground">Country suggestions</p>
            <p className="mt-1 text-xs text-muted-foreground">Suggested common taxes for this country. Add only the ones that apply and confirm every value.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <Button key={suggestion} type="button" variant="outline" size="sm" onClick={() => addTax(suggestion)}>
                  <Plus className="mr-2 h-4 w-4" /> Add {suggestion}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  function renderTaxes() {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">What taxes are relevant for your business?</h3>
          <p className="text-sm text-muted-foreground">Add unlimited tax entries. Suggestions are never assumed; confirm or edit every value.</p>
        </div>
        {payload.taxSettings.taxEntries.length === 0 ? <EmptyState text="No taxes added yet. Add a suggested or custom tax." /> : null}
        {payload.taxSettings.taxEntries.map((entry) => (
          <Card key={entry.id} className="border-border bg-background">
            <CardContent className="grid gap-3 p-4 md:grid-cols-5">
              <SelectField label="Tax type" value={entry.taxType} options={TAX_ENTRY_TYPES} onChange={(value) => updateTax(entry.id, { taxType: value, confirmed: true })} />
              <TextField label="Percentage" value={entry.percentage} onChange={(value) => updateTax(entry.id, { percentage: value })} />
              <TextField label="Fixed amount" value={entry.fixedAmount} onChange={(value) => updateTax(entry.id, { fixedAmount: value })} />
              <SelectField label="Frequency" value={entry.frequency} options={["monthly", "quarterly", "annual"]} onChange={(value) => updateTax(entry.id, { frequency: value as TaxEntry["frequency"] })} />
              <div className="space-y-1.5">
                <Label>Actions</Label>
                <Button type="button" variant="outline" className="w-full" onClick={() => update("taxSettings", { taxEntries: removeById(payload.taxSettings.taxEntries, entry.id) })}>
                  <Trash2 className="mr-2 h-4 w-4" /> Remove
                </Button>
              </div>
              <div className="md:col-span-5">
                <TextField label="Notes" value={entry.notes} onChange={(value) => updateTax(entry.id, { notes: value })} />
              </div>
            </CardContent>
          </Card>
        ))}
        <Button type="button" variant="outline" onClick={() => addTax()}>
          <Plus className="mr-2 h-4 w-4" /> Add custom tax
        </Button>
      </div>
    )
  }

  function renderContributions() {
    return (
      <RepeatableSection
        title="What employer contributions do you pay?"
        empty="No employer contributions added."
        addLabel="Add contribution"
        onAdd={addContribution}
      >
        {payload.employerContributions.map((entry) => (
          <ContributionRow
            key={entry.id}
            entry={entry}
            onChange={(values) => replace({ employerContributions: payload.employerContributions.map((item) => item.id === entry.id ? { ...item, ...values } : item) })}
            onRemove={() => replace({ employerContributions: removeById(payload.employerContributions, entry.id) })}
          />
        ))}
      </RepeatableSection>
    )
  }

  function renderInsurance() {
    return (
      <RepeatableSection title="What business insurances do you maintain?" empty="No business insurance added." addLabel="Add insurance" onAdd={addInsurance}>
        {payload.insuranceSettings.insuranceEntries.map((entry) => (
          <InsuranceRow
            key={entry.id}
            entry={entry}
            onChange={(values) => update("insuranceSettings", { insuranceEntries: payload.insuranceSettings.insuranceEntries.map((item) => item.id === entry.id ? { ...item, ...values } : item) })}
            onRemove={() => update("insuranceSettings", { insuranceEntries: removeById(payload.insuranceSettings.insuranceEntries, entry.id) })}
          />
        ))}
      </RepeatableSection>
    )
  }

  function renderFixedCosts() {
    return (
      <RepeatableSection title="What recurring business costs do you have?" empty="No fixed costs added." addLabel="Add fixed cost" onAdd={addFixedCost}>
        {payload.fixedCosts.map((entry) => (
          <FixedCostRow
            key={entry.id}
            entry={entry}
            onChange={(values) => replace({ fixedCosts: payload.fixedCosts.map((item) => item.id === entry.id ? { ...item, ...values } : item) })}
            onRemove={() => replace({ fixedCosts: removeById(payload.fixedCosts, entry.id) })}
          />
        ))}
      </RepeatableSection>
    )
  }

  function renderRevenue() {
    const model = payload.revenueModel
    const updateModel = (values: Partial<RevenueModel>) => update("revenueModel", values)
    return (
      <div className="space-y-4">
        <MultiChoice label="Business model" values={model.businessModels} options={BUSINESS_TYPES} onChange={(values) => updateModel({ businessModels: values })} />
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Average deal value" value={model.averageDealValue} onChange={(value) => updateModel({ averageDealValue: value })} />
          <TextField label="Average customer value" value={model.averageCustomerValue} onChange={(value) => updateModel({ averageCustomerValue: value })} />
          <TextField label="Average customer lifetime" value={model.averageCustomerLifetime} onChange={(value) => updateModel({ averageCustomerLifetime: value })} />
          <TextField label="Recurring revenue percentage" value={model.recurringRevenuePercentage} onChange={(value) => updateModel({ recurringRevenuePercentage: value })} />
          <TextField label="Gross margin target" value={model.grossMarginTarget} onChange={(value) => updateModel({ grossMarginTarget: value })} />
        </div>
      </div>
    )
  }

  function renderCostStructure() {
    const costs = payload.costStructure
    const updateCosts = (values: Partial<CostStructure>) => update("costStructure", values)
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <TextField label="Material costs" value={costs.materialCosts} onChange={(value) => updateCosts({ materialCosts: value })} />
        <TextField label="Inventory costs" value={costs.inventoryCosts} onChange={(value) => updateCosts({ inventoryCosts: value })} />
        <TextField label="Production costs" value={costs.productionCosts} onChange={(value) => updateCosts({ productionCosts: value })} />
        <TextField label="Shipping costs" value={costs.shippingCosts} onChange={(value) => updateCosts({ shippingCosts: value })} />
        <TextField label="Payment processing fees" value={costs.paymentProcessingFees} onChange={(value) => updateCosts({ paymentProcessingFees: value })} />
        <TextField label="Contractor costs" value={costs.contractorCosts} onChange={(value) => updateCosts({ contractorCosts: value })} />
        <TextField label="Commission costs" value={costs.commissionCosts} onChange={(value) => updateCosts({ commissionCosts: value })} />
        <TextField label="Return rates" value={costs.returnRates} onChange={(value) => updateCosts({ returnRates: value })} />
        <TextField label="Discount rates" value={costs.discountRates} onChange={(value) => updateCosts({ discountRates: value })} />
      </div>
    )
  }

  function renderGoals() {
    const goals = payload.businessGoals
    const updateGoals = (values: Partial<BusinessGoals>) => update("businessGoals", values)
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <TextField label="Growth target" value={goals.growthTarget} onChange={(value) => updateGoals({ growthTarget: value })} />
        <TextField label="Profit target" value={goals.profitTarget} onChange={(value) => updateGoals({ profitTarget: value })} />
        <TextField label="EBITDA target" value={goals.ebitdaTarget} onChange={(value) => updateGoals({ ebitdaTarget: value })} />
        <TextField label="Cash reserve target" value={goals.cashReserveTarget} onChange={(value) => updateGoals({ cashReserveTarget: value })} />
        <TextField label="Expansion plans" value={goals.expansionPlans} onChange={(value) => updateGoals({ expansionPlans: value })} />
        <TextField label="Investment plans" value={goals.investmentPlans} onChange={(value) => updateGoals({ investmentPlans: value })} />
        <SelectField label="Risk tolerance" value={goals.riskTolerance} options={["Low", "Medium", "High", "Not sure"]} onChange={(value) => updateGoals({ riskTolerance: value })} />
      </div>
    )
  }

  function renderReview() {
    return (
      <div className="space-y-4">
        {status.completed ? (
          <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-8 w-8" />
            <div>
              <p className="font-semibold">Business Profile Completed</p>
              <p className="text-sm">This profile now improves future analysis context.</p>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
            Review and fill required missing fields before marking this profile complete.
          </div>
        )}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold">Profile completion</span>
            <span className="text-2xl font-bold text-primary">{status.setupAccuracy}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${status.setupAccuracy}%` }} />
          </div>
        </div>
        <ReviewGrid payload={payload} onEdit={(target) => setStep(target)} />
        {status.accountantReviewFlags.length > 0 && (
          <div className="rounded-lg border border-border bg-card p-4">
            <h4 className="mb-2 text-sm font-semibold">Review flags</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {status.accountantReviewFlags.map((flag) => <li key={flag}>- {flag}</li>)}
            </ul>
          </div>
        )}
      </div>
    )
  }

  function renderStep() {
    switch (activeStep.id) {
      case "company": return renderCompany()
      case "tax": return renderTaxes()
      case "contributions": return renderContributions()
      case "insurance": return renderInsurance()
      case "fixedCosts": return renderFixedCosts()
      case "revenue": return renderRevenue()
      case "costs": return renderCostStructure()
      case "goals": return renderGoals()
      case "review": return renderReview()
      default: return null
    }
  }

  if (isLoading) {
    return <Card className="border-border bg-card p-8 text-center text-sm text-muted-foreground">Loading business profile...</Card>
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Global Business Profile Wizard</CardTitle>
            <CardDescription>Step {step + 1} of {STEPS.length}: {activeStep.label}</CardDescription>
          </div>
          {status.completed && (
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-700 dark:text-emerald-300">
              <Check className="h-4 w-4" /> Complete
            </span>
          )}
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>{progress}% through wizard</span>
            <span>{status.setupAccuracy}% profile completion</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 lg:grid-cols-9">
          {STEPS.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setStep(index)}
              className={classNames(
                "rounded-md border px-2 py-2 text-xs font-medium transition",
                index === step ? "border-primary bg-primary text-primary-foreground" : index < step ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground",
              )}
            >
              {index + 1}. {item.label.split(" ")[0]}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {renderStep()}
        {saveMessage && <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{saveMessage}</div>}
        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="outline" onClick={() => setStep(Math.max(step - 1, 0))} disabled={step === 0}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            {activeStep.optional && step < STEPS.length - 1 && (
              <Button type="button" variant="ghost" onClick={skipOptional} disabled={isSaving}>Skip optional section</Button>
            )}
            <Button type="button" variant="outline" onClick={() => save()} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={saveAndContinue} disabled={isSaving}>
                Save and continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" onClick={() => save()} disabled={isSaving}>
                <CheckCircle2 className="mr-2 h-4 w-4" /> Confirm profile
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function RepeatableSection({ title, empty, addLabel, onAdd, children }: { title: string; empty: string; addLabel: string; onAdd: () => void; children: React.ReactNode }) {
  const hasChildren = Boolean(children && (!Array.isArray(children) || children.length > 0))
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">Add as many entries as needed. Leave unknown values blank until confirmed.</p>
      </div>
      {hasChildren ? children : <EmptyState text={empty} />}
      <Button type="button" variant="outline" onClick={onAdd}><Plus className="mr-2 h-4 w-4" /> {addLabel}</Button>
    </div>
  )
}

function ContributionRow({ entry, onChange, onRemove }: { entry: EmployerContribution; onChange: (values: Partial<EmployerContribution>) => void; onRemove: () => void }) {
  return (
    <Card className="border-border bg-background"><CardContent className="grid gap-3 p-4 md:grid-cols-5">
      <SelectField label="Contribution" value={entry.contributionType} options={CONTRIBUTION_TYPES} onChange={(value) => onChange({ contributionType: value })} />
      <TextField label="Percentage" value={entry.percentage} onChange={(value) => onChange({ percentage: value })} />
      <TextField label="Monthly cost" value={entry.monthlyCost} onChange={(value) => onChange({ monthlyCost: value })} />
      <TextField label="Annual cost" value={entry.annualCost} onChange={(value) => onChange({ annualCost: value })} />
      <div className="space-y-1.5"><Label>Actions</Label><Button type="button" variant="outline" className="w-full" onClick={onRemove}><Trash2 className="mr-2 h-4 w-4" /> Remove</Button></div>
    </CardContent></Card>
  )
}

function InsuranceRow({ entry, onChange, onRemove }: { entry: InsuranceEntry; onChange: (values: Partial<InsuranceEntry>) => void; onRemove: () => void }) {
  return (
    <Card className="border-border bg-background"><CardContent className="grid gap-3 p-4 md:grid-cols-6">
      <SelectField label="Insurance" value={entry.insuranceType} options={INSURANCE_TYPES} onChange={(value) => onChange({ insuranceType: value })} />
      <TextField label="Provider" value={entry.provider} onChange={(value) => onChange({ provider: value })} />
      <TextField label="Monthly cost" value={entry.monthlyCost} onChange={(value) => onChange({ monthlyCost: value })} />
      <TextField label="Annual cost" value={entry.annualCost} onChange={(value) => onChange({ annualCost: value })} />
      <TextField label="Coverage amount" value={entry.coverageAmount} onChange={(value) => onChange({ coverageAmount: value })} />
      <div className="space-y-1.5"><Label>Actions</Label><Button type="button" variant="outline" className="w-full" onClick={onRemove}><Trash2 className="mr-2 h-4 w-4" /> Remove</Button></div>
    </CardContent></Card>
  )
}

function FixedCostRow({ entry, onChange, onRemove }: { entry: FixedCostEntry; onChange: (values: Partial<FixedCostEntry>) => void; onRemove: () => void }) {
  return (
    <Card className="border-border bg-background"><CardContent className="grid gap-3 p-4 md:grid-cols-4">
      <SelectField label="Cost category" value={entry.costCategory} options={FIXED_COST_CATEGORIES} onChange={(value) => onChange({ costCategory: value })} />
      <TextField label="Monthly cost" value={entry.monthlyCost} onChange={(value) => onChange({ monthlyCost: value })} />
      <TextField label="Annual cost" value={entry.annualCost} onChange={(value) => onChange({ annualCost: value })} />
      <div className="space-y-1.5"><Label>Actions</Label><Button type="button" variant="outline" className="w-full" onClick={onRemove}><Trash2 className="mr-2 h-4 w-4" /> Remove</Button></div>
    </CardContent></Card>
  )
}

function ReviewGrid({ payload, onEdit }: { payload: CompanySetupPayload; onEdit: (step: number) => void }) {
  const cards = [
    { title: "Company", step: 0, value: [payload.companyInfo.companyName, payload.companyInfo.country, payload.companyInfo.industry].filter(Boolean).join(" / ") || "Not set" },
    { title: "Taxes", step: 1, value: `${payload.taxSettings.taxEntries.length} tax entries` },
    { title: "Contributions", step: 2, value: `${payload.employerContributions.length} contribution entries` },
    { title: "Insurance", step: 3, value: `${payload.insuranceSettings.insuranceEntries.length} insurance entries` },
    { title: "Fixed Costs", step: 4, value: `${payload.fixedCosts.length} fixed costs` },
    { title: "Revenue", step: 5, value: payload.revenueModel.businessModels.join(", ") || "Not set" },
    { title: "Cost Structure", step: 6, value: countNonEmpty(payload.costStructure) },
    { title: "Goals", step: 7, value: countNonEmpty(payload.businessGoals) },
  ]
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {cards.map((card) => (
        <div key={card.title} className="rounded-lg border border-border bg-background p-4">
          <div className="flex items-start justify-between gap-3">
            <div><p className="font-semibold">{card.title}</p><p className="mt-1 text-sm text-muted-foreground">{card.value}</p></div>
            <Button type="button" variant="outline" size="sm" onClick={() => onEdit(card.step)}>Edit</Button>
          </div>
        </div>
      ))}
    </div>
  )
}

function countNonEmpty(values: CostStructure | BusinessGoals) {
  const count = Object.values(values).filter((value) => value.trim()).length
  return `${count} fields completed`
}
