import "server-only"

import { auth } from "@/lib/auth/auth"
import { requireBuiltinUserRecord } from "@/lib/auth/builtin-user-store"
import type { CompanySetupPayload, EmployerContribution, FixedCostEntry, TaxEntry } from "@/lib/business/company-setup"
import { getCompanySetupRecord, type CompanySetupRecordSource } from "@/lib/business/company-setup-store"

export const MISSING_BUSINESS_PROFILE_VALUE = "Not configured"

export type SharedBusinessProfileFields = {
  taxCountry: string | number | boolean | null
  currency: string | number | boolean | null
  fiscalYear: string | number | boolean | null
  vatSalesTax: string | number | boolean | null
  payroll: string | number | boolean | null
  fixedCosts: string | number | boolean | null
}

export type CurrentBusinessProfileResult = {
  status: "loaded" | "unauthenticated" | "error"
  userId: string | null
  organizationId: string | null
  source: CompanySetupRecordSource | "auth"
  setup: CompanySetupPayload | null
  profile: SharedBusinessProfileFields | null
  error: string | null
}

export async function getBusinessProfileForCurrentTenant(): Promise<CurrentBusinessProfileResult> {
  try {
    const session = await auth()
    const userId = session?.user?.id ?? null

    if (!userId) {
      return emptyCurrentProfileResult("unauthenticated", "auth", "Unauthorized")
    }

    await requireBuiltinUserRecord(userId)

    const record = await getCompanySetupRecord(userId)
    if (record.source === "repository_exception" || record.source === "database_unavailable") {
      return {
        status: "error",
        userId,
        organizationId: record.organizationId,
        source: record.source,
        setup: null,
        profile: null,
        error: record.error?.message ?? "Could not load Business Profile.",
      }
    }

    return {
      status: "loaded",
      userId,
      organizationId: record.organizationId,
      source: record.source,
      setup: record.payload,
      profile: normalizeSharedBusinessProfile(record.payload),
      error: null,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load Business Profile."
    console.error("[BUSINESS_PROFILE_CURRENT_TENANT] Failed to load shared Business Profile.", {
      error: serializeCurrentProfileError(error),
    })
    return emptyCurrentProfileResult("error", "auth", message)
  }
}

export function normalizeSharedBusinessProfile(setup: CompanySetupPayload | null): SharedBusinessProfileFields {
  if (!setup) {
    return {
      taxCountry: null,
      currency: null,
      fiscalYear: null,
      vatSalesTax: null,
      payroll: null,
      fixedCosts: null,
    }
  }

  return {
    taxCountry: configuredString(setup.companyInfo.taxResidenceCountry),
    currency: configuredString(setup.currencySettings.primaryCurrency),
    fiscalYear: formatFiscalYear(setup.companyInfo.fiscalYearStart, setup.companyInfo.fiscalYearEnd),
    vatSalesTax: formatTaxEntries(setup.taxSettings.taxEntries),
    payroll: formatEmployerContributions(setup.employerContributions),
    fixedCosts: formatFixedCosts(setup.fixedCosts),
  }
}

export function displayBusinessProfileValue(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) return MISSING_BUSINESS_PROFILE_VALUE
  if (typeof value === "number") return Number.isFinite(value) ? value.toLocaleString("en-US") : MISSING_BUSINESS_PROFILE_VALUE
  if (typeof value === "boolean") return value ? "Yes" : "No"
  const text = value.trim()
  return text.length > 0 ? text : MISSING_BUSINESS_PROFILE_VALUE
}

function emptyCurrentProfileResult(
  status: "unauthenticated" | "error",
  source: CurrentBusinessProfileResult["source"],
  error: string,
): CurrentBusinessProfileResult {
  return {
    status,
    userId: null,
    organizationId: null,
    source,
    setup: null,
    profile: null,
    error,
  }
}

function configuredString(value: string | null | undefined) {
  if (value === null || value === undefined) return null
  const text = value.trim()
  return text.length > 0 ? text : null
}

function formatFiscalYear(start: string | null | undefined, end: string | null | undefined) {
  const values = [configuredString(start), configuredString(end)].filter(Boolean)
  return values.length > 0 ? values.join(" to ") : null
}

function formatTaxEntries(entries: TaxEntry[]) {
  return formatEntryList(entries, (entry) => {
    const label = formatLabel(entry.taxType)
    const percentage = configuredString(entry.percentage)
    const fixedAmount = configuredString(entry.fixedAmount)
    const frequency = configuredString(entry.frequency)
    return [
      label,
      percentage ? `${percentage}%` : null,
      fixedAmount ? `fixed ${fixedAmount}` : null,
      frequency,
    ].filter(Boolean).join(" ")
  })
}

function formatEmployerContributions(entries: EmployerContribution[]) {
  return formatEntryList(entries, (entry) => {
    const label = formatLabel(entry.contributionType)
    const percentage = configuredString(entry.percentage)
    const monthlyCost = configuredString(entry.monthlyCost)
    const annualCost = configuredString(entry.annualCost)
    return [
      label,
      percentage ? `${percentage}%` : null,
      monthlyCost ? `${monthlyCost} monthly` : null,
      annualCost ? `${annualCost} annual` : null,
    ].filter(Boolean).join(" ")
  })
}

function formatFixedCosts(entries: FixedCostEntry[]) {
  return formatEntryList(entries, (entry) => {
    const label = formatLabel(entry.costCategory)
    const monthlyCost = configuredString(entry.monthlyCost)
    const annualCost = configuredString(entry.annualCost)
    return [
      label,
      monthlyCost ? `${monthlyCost} monthly` : null,
      annualCost ? `${annualCost} annual` : null,
    ].filter(Boolean).join(" ")
  })
}

function formatEntryList<T>(entries: T[], formatEntry: (entry: T) => string) {
  const formatted = entries.map(formatEntry).map((entry) => entry.trim()).filter(Boolean)
  return formatted.length > 0 ? formatted.join("; ") : null
}

function formatLabel(value: string | null | undefined) {
  const text = configuredString(value)
  if (!text) return null
  return text.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function serializeCurrentProfileError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }
  return { message: String(error) }
}
