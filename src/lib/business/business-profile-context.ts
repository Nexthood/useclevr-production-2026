import {
  normalizeCompanySetupPayload,
  type CompanySetupPayload,
  type EmployerContribution,
  type FixedCostEntry,
  type TaxEntry,
} from "@/lib/business/company-setup"
import { getDb } from "@/lib/db"
import { businesses, businessProfiles } from "@/lib/db/schema"
import { debugError } from "@/lib/utils/debug"
import { and, eq } from "drizzle-orm"

export type NormalizedBusinessProfileContext = {
  taxCountry: string | null
  currency: string | null
  fiscalYear: string | null
  vatSalesTax: string | number | null
  payroll: string | number | null
  fixedCosts: string | number | null
}

export type BusinessProfileContextResult = {
  context: NormalizedBusinessProfileContext
  organizationId: string | null
  error: string | null
}

export async function getBusinessProfileContext(
  userId: string | null | undefined,
  businessId?: string,
): Promise<NormalizedBusinessProfileContext> {
  if (!userId) return emptyBusinessProfileContext()
  const result = await getBusinessProfileContextResult(userId, businessId)
  return result.context
}

export async function getBusinessProfileContextResult(
  userId: string | null | undefined,
  businessId?: string,
): Promise<BusinessProfileContextResult> {
  const empty = emptyBusinessProfileContext()
  if (!userId) return { context: empty, organizationId: null, error: null }

  const db = getDb()
  if (!db) {
    return { context: empty, organizationId: null, error: "Business Profile database is not configured." }
  }

  try {
    const conditions = [eq(businesses.userId, userId)]
    if (businessId) {
      conditions.push(eq(businesses.id, businessId))
    } else {
      conditions.push(eq(businesses.isPrimary, true))
    }

    const [organization] = await db
      .select({ id: businesses.id, companySetup: businesses.companySetup })
      .from(businesses)
      .where(and(...conditions))
      .limit(1)

    if (!organization) return { context: empty, organizationId: null, error: null }

    const [profile] = await db
      .select({ payload: businessProfiles.payload })
      .from(businessProfiles)
      .where(eq(businessProfiles.organizationId, organization.id))
      .limit(1)

    const source =
      profile?.payload && typeof profile.payload === "object" && Object.keys(profile.payload as object).length > 0
        ? profile.payload
        : organization.companySetup

    return {
      context: normalizeBusinessProfileContext(source as Partial<CompanySetupPayload> | Record<string, unknown> | null | undefined),
      organizationId: organization.id,
      error: null,
    }
  } catch (error) {
    debugError("[BUSINESS] Business Profile context lookup failed:", error)
    return {
      context: empty,
      organizationId: null,
      error: error instanceof Error ? error.message : "Business Profile context could not be loaded.",
    }
  }
}

export function emptyBusinessProfileContext(): NormalizedBusinessProfileContext {
  return {
    taxCountry: null,
    currency: null,
    fiscalYear: null,
    vatSalesTax: null,
    payroll: null,
    fixedCosts: null,
  }
}

export function normalizeBusinessProfileContext(input: Partial<CompanySetupPayload> | Record<string, unknown> | null | undefined): NormalizedBusinessProfileContext {
  const setup = normalizeCompanySetupPayload(input as Partial<CompanySetupPayload>)
  const raw = input && typeof input === "object" ? input as Record<string, unknown> : {}

  return {
    taxCountry: firstConfiguredString(
      setup.companyInfo.taxResidenceCountry,
      setup.companyInfo.country,
      setup.companyInfo.countryOfRegistration,
      raw.taxCountry,
      raw.tax_country,
      raw.taxResidenceCountry,
      raw.tax_residence_country,
      raw.country,
      raw.location,
    ),
    currency: firstConfiguredString(
      setup.currencySettings.primaryCurrency,
      setup.currencySettings.reportingCurrency,
      raw.currency,
      raw.primaryCurrency,
      raw.primary_currency,
      raw.preferredCurrency,
      nested(raw, ["financialSettings", "currency"]),
      nested(raw, ["localeSettings", "currency"]),
    ),
    fiscalYear: firstConfiguredString(
      formatFiscalYear(setup.companyInfo.fiscalYearStart, setup.companyInfo.fiscalYearEnd),
      raw.fiscalYear,
      raw.fiscal_year,
      formatFiscalYear(raw.fiscalYearStart, raw.fiscalYearEnd),
      formatFiscalYear(raw.fiscal_year_start, raw.fiscal_year_end),
    ),
    vatSalesTax: firstConfiguredValue(
      formatTaxEntries(setup.taxSettings.taxEntries),
      formatTaxRate(setup.taxSettings.taxType, setup.taxSettings.standardTaxRate),
      raw.vatSalesTax,
      raw.vat_sales_tax,
      raw.salesTax,
      raw.sales_tax,
      raw.vat,
      raw.taxRate,
      raw.tax_rate,
      nested(raw, ["taxSettings", "standardTaxRate"]),
    ),
    payroll: firstConfiguredValue(
      formatEmployerContributions(setup.employerContributions),
      raw.payroll,
      raw.payrollCost,
      raw.payroll_cost,
      raw.employeePayroll,
      raw.employee_payroll,
      nested(raw, ["payrollSettings", "payroll"]),
    ),
    fixedCosts: firstConfiguredValue(
      formatFixedCosts(setup.fixedCosts),
      raw.fixedCosts,
      raw.fixed_costs,
      raw.fixedCostsAnnual,
      raw.fixed_costs_annual,
      raw.monthlyFixedCosts,
      raw.monthly_fixed_costs,
      nested(raw, ["financialSettings", "fixedCosts"]),
    ),
  }
}

export function displayBusinessProfileValue(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) return "Not configured"
  if (typeof value === "number") return formatNumber(value)
  if (typeof value === "boolean") return value ? "Yes" : "No"
  const text = String(value).trim()
  return text.length > 0 ? text : "Not configured"
}

function firstConfiguredString(...values: unknown[]) {
  const value = firstConfiguredValue(...values)
  if (value === null) return null
  return String(value)
}

function firstConfiguredValue(...values: unknown[]): string | number | null {
  for (const value of values) {
    if (value === null || value === undefined) continue
    if (typeof value === "number") {
      if (!Number.isNaN(value)) return value
      continue
    }
    if (typeof value === "boolean") return value ? "Yes" : "No"
    if (Array.isArray(value)) {
      const formatted = value.map((item) => formatUnknownItem(item)).filter(Boolean).join(", ")
      if (formatted) return formatted
      continue
    }
    if (typeof value === "object") {
      const formatted = formatUnknownItem(value)
      if (formatted) return formatted
      continue
    }
    const text = String(value).trim()
    if (text.length > 0) return text
  }
  return null
}

function formatFiscalYear(start: unknown, end: unknown) {
  const startText = typeof start === "string" ? start.trim() : ""
  const endText = typeof end === "string" ? end.trim() : ""
  return [startText, endText].filter(Boolean).join(" to ") || null
}

function formatTaxRate(taxType: unknown, standardTaxRate: unknown) {
  if (standardTaxRate === null || standardTaxRate === undefined || String(standardTaxRate).trim() === "") {
    return typeof taxType === "string" && taxType.trim() ? taxType : null
  }
  const label = typeof taxType === "string" && taxType.trim() ? taxType : "Tax"
  return `${formatLabel(label)} ${standardTaxRate}%`
}

function formatTaxEntries(entries: TaxEntry[]) {
  return entries
    .map((entry) => {
      const label = formatLabel(entry.taxType)
      if (!label) return ""
      const details = [
        entry.percentage !== "" ? `${entry.percentage}%` : "",
        entry.fixedAmount !== "" ? formatNumberLike(entry.fixedAmount) : "",
        entry.frequency,
      ].filter(Boolean).join(" ")
      return details ? `${label} ${details}` : label
    })
    .filter(Boolean)
    .join(", ") || null
}

function formatEmployerContributions(entries: EmployerContribution[]) {
  return entries
    .map((entry) => {
      const label = formatLabel(entry.contributionType)
      if (!label) return ""
      const details = [
        entry.percentage !== "" ? `${entry.percentage}%` : "",
        entry.monthlyCost !== "" ? `${formatNumberLike(entry.monthlyCost)} monthly` : "",
        entry.annualCost !== "" ? `${formatNumberLike(entry.annualCost)} annual` : "",
      ].filter(Boolean).join(" ")
      return details ? `${label} ${details}` : label
    })
    .filter(Boolean)
    .join(", ") || null
}

function formatFixedCosts(entries: FixedCostEntry[]) {
  return entries
    .map((entry) => {
      const label = formatLabel(entry.costCategory)
      if (!label) return ""
      const details = [
        entry.monthlyCost !== "" ? `${formatNumberLike(entry.monthlyCost)} monthly` : "",
        entry.annualCost !== "" ? `${formatNumberLike(entry.annualCost)} annual` : "",
      ].filter(Boolean).join(" ")
      return details ? `${label} ${details}` : label
    })
    .filter(Boolean)
    .join(", ") || null
}

function formatUnknownItem(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "number") return Number.isNaN(value) ? "" : formatNumber(value)
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "string") return value.trim()
  if (Array.isArray(value)) return value.map(formatUnknownItem).filter(Boolean).join(", ")

  const record = value as Record<string, unknown>
  return firstConfiguredString(
    record.label,
    record.name,
    record.value,
    record.amount,
    record.total,
    record.costCategory ? formatFixedCosts([record as unknown as FixedCostEntry]) : null,
    record.contributionType ? formatEmployerContributions([record as unknown as EmployerContribution]) : null,
    record.taxType ? formatTaxEntries([record as unknown as TaxEntry]) : null,
  ) || ""
}

function formatNumberLike(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""))
  return Number.isFinite(parsed) ? formatNumber(parsed) : String(value)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)
}

function formatLabel(value: unknown) {
  return typeof value === "string"
    ? value.trim().replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
    : ""
}

function nested(record: Record<string, unknown>, path: string[]) {
  let value: unknown = record
  for (const key of path) {
    if (!value || typeof value !== "object") return undefined
    value = (value as Record<string, unknown>)[key]
  }
  return value
}
