"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { CompanySetupPayload } from "@/lib/business/company-setup"
import {
  ACCOUNTING_METHODS,
  AMOUNT_TYPES,
  CURRENCIES,
  CUSTOMER_TYPES,
  EXPENSE_CATEGORIES,
  INVOICE_OR_PAYMENT,
  INSURANCE_TYPES,
  LEGAL_STRUCTURES,
  PAYMENT_PROVIDERS,
  REVENUE_SOURCES,
  TAX_REGISTERED_OPTIONS,
  TAX_TYPES,
  buildSetupStatus,
  emptyCompanySetupPayload,
} from "@/lib/business/company-setup"
import { ArrowLeft, ArrowRight, Check, ChevronRight, Save } from "lucide-react"
import { useCallback, useMemo, useState } from "react"

const STEPS = [
  { id: "company", label: "Company", icon: "🏢" },
  { id: "tax", label: "Tax", icon: "💰" },
  { id: "currency", label: "Currency", icon: "💱" },
  { id: "revenue", label: "Revenue", icon: "📈" },
  { id: "expenses", label: "Expenses", icon: "📉" },
  { id: "insurance", label: "Insurance", icon: "🛡️" },
  { id: "loans", label: "Loans & Leasing", icon: "🏦" },
  { id: "review", label: "Review", icon: "✅" },
] as const

function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}

function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
      >
        <option value="">{placeholder || `Select ${label.toLowerCase()}...`}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function MultiSelectField({
  label,
  selected,
  options,
  onChange,
}: {
  label: string
  selected: string[]
  options: string[]
  onChange: (selected: string[]) => void
}) {
  const toggle = (item: string) => {
    if (selected.includes(item)) {
      onChange(selected.filter((s) => s !== item))
    } else {
      onChange([...selected, item])
    }
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={classNames(
              "rounded-md px-2.5 py-1 text-xs font-medium transition",
              selected.includes(opt)
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent",
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  helperText,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  helperText?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full"
      />
      {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
    </div>
  )
}

export function CompanySetupWizard() {
  const [step, setStep] = useState(0)
  const [payload, setPayload] = useState<CompanySetupPayload>(emptyCompanySetupPayload)

  const status = useMemo(() => buildSetupStatus(payload), [payload])

  const update = useCallback(
    <K extends keyof CompanySetupPayload>(section: K, values: Partial<CompanySetupPayload[K]>) => {
      setPayload((prev) => ({
        ...prev,
        [section]: { ...prev[section], ...values },
        setupStatus: buildSetupStatus({ ...prev, [section]: { ...prev[section], ...values } }),
      }))
    },
    [],
  )

  const nextStep = () => setStep((s) => Math.min(s + 1, STEPS.length - 1))
  const prevStep = () => setStep((s) => Math.max(s - 1, 0))
  const goToStep = (s: number) => setStep(s)

  const handleSave = () => {
    console.log("[Company Setup] Payload ready for persistence:", JSON.stringify(payload, null, 2))
    // TODO: Save to backend database when persistence endpoint is available
  }

  const stepProgress = ((step + 1) / STEPS.length) * 100

  const renderStep = () => {
    switch (STEPS[step].id) {
      case "company":
        return (
          <div className="space-y-4">
            <TextField
              label="Company name"
              value={payload.companyInfo.companyName}
              onChange={(v) => update("companyInfo", { companyName: v })}
              placeholder="Acme Corp"
            />
            <TextField
              label="Country of registration"
              value={payload.companyInfo.countryOfRegistration}
              onChange={(v) => update("companyInfo", { countryOfRegistration: v })}
              placeholder="United States"
            />
            <TextField
              label="Tax residence country"
              value={payload.companyInfo.taxResidenceCountry}
              onChange={(v) => update("companyInfo", { taxResidenceCountry: v })}
              placeholder="United States"
            />
            <SelectField
              label="Legal structure"
              value={payload.companyInfo.legalStructure}
              options={LEGAL_STRUCTURES}
              onChange={(v) => update("companyInfo", { legalStructure: v as any })}
            />
            <TextField
              label="Industry"
              value={payload.companyInfo.industry}
              onChange={(v) => update("companyInfo", { industry: v })}
              placeholder="Technology, Retail, Healthcare..."
            />
            <SelectField
              label="Accounting method"
              value={payload.companyInfo.accountingMethod}
              options={ACCOUNTING_METHODS}
              onChange={(v) => update("companyInfo", { accountingMethod: v as any })}
              placeholder="Select accounting method..."
            />
            <p className="text-xs text-muted-foreground">
              Accounting method affects when revenue and expenses are recognized in reports.
            </p>
          </div>
        )

      case "tax":
        return (
          <div className="space-y-4">
            <SelectField
              label="Tax registered"
              value={payload.taxSettings.taxRegistered}
              options={TAX_REGISTERED_OPTIONS}
              onChange={(v) => update("taxSettings", { taxRegistered: v as any })}
            />
            <SelectField
              label="Tax type"
              value={payload.taxSettings.taxType}
              options={TAX_TYPES}
              onChange={(v) => update("taxSettings", { taxType: v as any })}
            />
            <TextField
              label="Standard tax rate (%)"
              value={payload.taxSettings.standardTaxRate}
              onChange={(v) => update("taxSettings", { standardTaxRate: v })}
              placeholder="20"
              helperText="Enter the standard rate as a percentage (e.g., 20 for 20%)"
            />
            <SelectField
              label="Revenue amounts are"
              value={payload.taxSettings.revenueAmountType}
              options={AMOUNT_TYPES}
              onChange={(v) => update("taxSettings", { revenueAmountType: v as any })}
            />
            <SelectField
              label="Expense amounts are"
              value={payload.taxSettings.expenseAmountType}
              options={AMOUNT_TYPES}
              onChange={(v) => update("taxSettings", { expenseAmountType: v as any })}
            />
            <SelectField
              label="Estimate taxes automatically?"
              value={payload.taxSettings.estimateTaxes}
              options={[
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
                { value: "not_sure", label: "Not sure" },
              ]}
              onChange={(v) => update("taxSettings", { estimateTaxes: v as any })}
            />
          </div>
        )

      case "currency":
        return (
          <div className="space-y-4">
            <SelectField
              label="Primary currency"
              value={payload.currencySettings.primaryCurrency}
              options={CURRENCIES.map((c) => ({ value: c, label: c }))}
              onChange={(v) => update("currencySettings", { primaryCurrency: v })}
            />
            <SelectField
              label="Reporting currency"
              value={payload.currencySettings.reportingCurrency}
              options={CURRENCIES.map((c) => ({ value: c, label: c }))}
              onChange={(v) => update("currencySettings", { reportingCurrency: v })}
            />
            <MultiSelectField
              label="Other currencies used"
              selected={payload.currencySettings.otherCurrenciesUsed}
              options={CURRENCIES}
              onChange={(v) => update("currencySettings", { otherCurrenciesUsed: v })}
            />
          </div>
        )

      case "revenue":
        return (
          <div className="space-y-4">
            <MultiSelectField
              label="Revenue sources"
              selected={payload.revenueRules.revenueSources}
              options={REVENUE_SOURCES}
              onChange={(v) => update("revenueRules", { revenueSources: v })}
            />
            <SelectField
              label="Customer type"
              value={payload.revenueRules.customerType}
              options={CUSTOMER_TYPES}
              onChange={(v) => update("revenueRules", { customerType: v as any })}
            />
            <SelectField
              label="Revenue recognition"
              value={payload.revenueRules.invoiceOrPaymentBased}
              options={INVOICE_OR_PAYMENT}
              onChange={(v) => update("revenueRules", { invoiceOrPaymentBased: v as any })}
            />
            <MultiSelectField
              label="Payment providers"
              selected={payload.revenueRules.paymentProviders}
              options={PAYMENT_PROVIDERS}
              onChange={(v) => update("revenueRules", { paymentProviders: v })}
            />
            <SelectField
              label="Has refunds or chargebacks?"
              value={payload.revenueRules.hasRefundsOrChargebacks}
              options={[
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
                { value: "not_sure", label: "Not sure" },
              ]}
              onChange={(v) => update("revenueRules", { hasRefundsOrChargebacks: v as any })}
            />
          </div>
        )

      case "expenses":
        return (
          <div className="space-y-4">
            <MultiSelectField
              label="Expense categories"
              selected={payload.expenseRules.expenseCategories}
              options={EXPENSE_CATEGORIES}
              onChange={(v) => update("expenseRules", { expenseCategories: v })}
            />
            <SelectField
              label="Mixed business/private expenses?"
              value={payload.expenseRules.hasMixedBusinessPrivateExpenses}
              options={[
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
                { value: "not_sure", label: "Not sure" },
              ]}
              onChange={(v) => update("expenseRules", { hasMixedBusinessPrivateExpenses: v as any })}
            />
            <SelectField
              label="Receipts available?"
              value={payload.expenseRules.receiptsAvailable}
              options={[
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
                { value: "partly", label: "Partly" },
                { value: "not_sure", label: "Not sure" },
              ]}
              onChange={(v) => update("expenseRules", { receiptsAvailable: v as any })}
            />
            <SelectField
              label="Has recurring expenses?"
              value={payload.expenseRules.hasRecurringExpenses}
              options={[
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
                { value: "not_sure", label: "Not sure" },
              ]}
              onChange={(v) => update("expenseRules", { hasRecurringExpenses: v as any })}
            />
          </div>
        )

      case "insurance":
        return (
          <div className="space-y-4">
            <SelectField
              label="Has business insurance?"
              value={payload.insuranceSettings.hasBusinessInsurance}
              options={[
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
                { value: "not_sure", label: "Not sure" },
              ]}
              onChange={(v) => update("insuranceSettings", { hasBusinessInsurance: v as any })}
            />

            {(payload.insuranceSettings.hasBusinessInsurance === "yes" || payload.insuranceSettings.hasBusinessInsurance === "not_sure") && (
              <>
                <MultiSelectField
                  label="Insurance types"
                  selected={payload.insuranceSettings.insuranceTypes}
                  options={INSURANCE_TYPES}
                  onChange={(v) => update("insuranceSettings", { insuranceTypes: v })}
                />
                <TextField
                  label="Premium amount"
                  value={payload.insuranceSettings.insurancePremiumAmount}
                  onChange={(v) => update("insuranceSettings", { insurancePremiumAmount: v })}
                  placeholder="1000"
                  helperText="Annual or per-period premium amount"
                />
                <SelectField
                  label="Payment frequency"
                  value={payload.insuranceSettings.insurancePaymentFrequency}
                  options={[
                    { value: "monthly", label: "Monthly" },
                    { value: "quarterly", label: "Quarterly" },
                    { value: "yearly", label: "Yearly" },
                    { value: "one_time", label: "One-time" },
                    { value: "not_sure", label: "Not sure" },
                  ]}
                  onChange={(v) => update("insuranceSettings", { insurancePaymentFrequency: v as any })}
                />
                <SelectField
                  label="Business use percentage"
                  value={payload.insuranceSettings.insuranceBusinessUsePercentage}
                  options={[
                    { value: "100", label: "100%" },
                    { value: "75", label: "75%" },
                    { value: "50", label: "50%" },
                    { value: "25", label: "25%" },
                    { value: "not_sure", label: "Not sure" },
                  ]}
                  onChange={(v) => update("insuranceSettings", { insuranceBusinessUsePercentage: v as any })}
                />
                <p className="text-xs text-muted-foreground">
                  Only the business-use portion of insurance is typically tax-deductible.
                </p>
              </>
            )}
          </div>
        )

      case "loans":
        return (
          <div className="space-y-4">
            <SelectField
              label="Has business loans?"
              value={payload.loanLeasingSettings.hasBusinessLoans}
              options={[
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
                { value: "not_sure", label: "Not sure" },
              ]}
              onChange={(v) => update("loanLeasingSettings", { hasBusinessLoans: v as any })}
            />
            <SelectField
              label="Has leasing?"
              value={payload.loanLeasingSettings.hasLeasing}
              options={[
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
                { value: "not_sure", label: "Not sure" },
              ]}
              onChange={(v) => update("loanLeasingSettings", { hasLeasing: v as any })}
            />
            <SelectField
              label="Has credit cards?"
              value={payload.loanLeasingSettings.hasCreditCards}
              options={[
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
                { value: "not_sure", label: "Not sure" },
              ]}
              onChange={(v) => update("loanLeasingSettings", { hasCreditCards: v as any })}
            />
            <SelectField
              label="Has overdraft?"
              value={payload.loanLeasingSettings.hasOverdraft}
              options={[
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
                { value: "not_sure", label: "Not sure" },
              ]}
              onChange={(v) => update("loanLeasingSettings", { hasOverdraft: v as any })}
            />
            <TextField
              label="Monthly debt payment"
              value={payload.loanLeasingSettings.monthlyDebtPayment}
              onChange={(v) => update("loanLeasingSettings", { monthlyDebtPayment: v })}
              placeholder="5000"
              helperText="Total monthly payment including principal and interest"
            />
            <p className="text-xs text-muted-foreground">
              Loan principal repayment is NOT a normal expense. Only the interest portion is typically tax-deductible.
            </p>
            <SelectField
              label="Loan interest known?"
              value={payload.loanLeasingSettings.loanInterestKnown}
              options={[
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
                { value: "not_sure", label: "Not sure" },
              ]}
              onChange={(v) => update("loanLeasingSettings", { loanInterestKnown: v as any })}
            />
            <SelectField
              label="Principal/interest split known?"
              value={payload.loanLeasingSettings.principalInterestSplitKnown}
              options={[
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
                { value: "not_sure", label: "Not sure" },
              ]}
              onChange={(v) => update("loanLeasingSettings", { principalInterestSplitKnown: v as any })}
            />
          </div>
        )

      case "review":
        return (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-4">
                <div className="flex-1">
                  <span className="text-sm font-semibold">Setup accuracy</span>
                  <div className="mt-1 h-2 w-full rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${status.setupAccuracy}%` }}
                    />
                  </div>
                </div>
                <span className="text-2xl font-bold text-primary">{status.setupAccuracy}%</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md bg-muted p-2">
                  <span className="text-muted-foreground">Sections done</span>
                  <p className="font-semibold">{status.completedSections.length} / 7</p>
                </div>
                <div className="rounded-md bg-muted p-2">
                  <span className="text-muted-foreground">Missing fields</span>
                  <p className="font-semibold">{status.missingFields.length}</p>
                </div>
              </div>
            </div>

            {status.accountantReviewFlags.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
                <h4 className="mb-2 text-sm font-semibold text-amber-800 dark:text-amber-200">
                  Accountant review flags
                </h4>
                <ul className="space-y-1">
                  {status.accountantReviewFlags.map((flag, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
                      <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500" />
                      {flag}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {status.missingFields.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-4">
                <h4 className="mb-2 text-sm font-semibold">Missing fields</h4>
                <div className="flex flex-wrap gap-1.5">
                  {status.missingFields.map((field) => (
                    <button
                      key={field}
                      type="button"
                      onClick={() => {
                        const stepIndex = STEPS.findIndex((s) => {
                          const sectionMap: Record<string, string> = {
                            companyName: "company", countryOfRegistration: "company",
                            legalStructure: "company", taxRegistered: "tax",
                            taxType: "tax", primaryCurrency: "currency",
                            revenueSources: "revenue", customerType: "revenue",
                            expenseCategories: "expenses",
                          }
                          return sectionMap[field] === s.id
                        })
                        if (stepIndex >= 0) goToStep(stepIndex)
                      }}
                      className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground hover:bg-accent transition"
                    >
                      {field}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <details className="rounded-lg border border-border bg-card">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground">
                View JSON payload
              </summary>
              <pre className="max-h-60 overflow-auto border-t border-border p-4 text-xs text-muted-foreground">
                {JSON.stringify(payload, null, 2)}
              </pre>
            </details>

            <Button onClick={handleSave} className="w-full gap-2">
              <Save className="h-4 w-4" />
              Save Company Setup
            </Button>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Company Setup Wizard</CardTitle>
            <CardDescription>
              Step {step + 1} of {STEPS.length}: {STEPS[step].label}
            </CardDescription>
          </div>
          <span className="text-2xl">{STEPS[step].icon}</span>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${stepProgress}%` }}
          />
        </div>
        <div className="mt-2 hidden gap-1 sm:flex">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => goToStep(i)}
              className={classNames(
                "flex-1 rounded-md py-1 text-[10px] font-medium transition",
                i === step
                  ? "bg-primary text-primary-foreground"
                  : i < step
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {renderStep()}

        {STEPS[step].id !== "review" && (
          <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
            <Button variant="outline" onClick={prevStep} disabled={step === 0}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            <div className="flex items-center gap-2">
              {step < STEPS.length - 1 ? (
                <Button onClick={nextStep}>
                  Next <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={() => goToStep(STEPS.length - 1)}>
                  Review <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
