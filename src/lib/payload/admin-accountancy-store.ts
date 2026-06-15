import {
  buildSetupStatus,
  emptyCompanySetupPayload,
  type CompanySetupPayload,
} from "@/lib/business/company-setup"
import { getDb } from "@/lib/db"
import { businesses, datasets, profiles, users } from "@/lib/db/schema"
import { and, count, desc, eq, sum } from "drizzle-orm"

function mergeCompanySetup(value: unknown): CompanySetupPayload {
  const defaults = emptyCompanySetupPayload()
  const setup = value && typeof value === "object" ? (value as Partial<CompanySetupPayload>) : {}

  const merged: CompanySetupPayload = {
    companyInfo: { ...defaults.companyInfo, ...setup.companyInfo },
    taxSettings: { ...defaults.taxSettings, ...setup.taxSettings },
    currencySettings: { ...defaults.currencySettings, ...setup.currencySettings },
    revenueRules: { ...defaults.revenueRules, ...setup.revenueRules },
    expenseRules: { ...defaults.expenseRules, ...setup.expenseRules },
    insuranceSettings: { ...defaults.insuranceSettings, ...setup.insuranceSettings },
    loanLeasingSettings: { ...defaults.loanLeasingSettings, ...setup.loanLeasingSettings },
    setupStatus: defaults.setupStatus,
  }

  merged.setupStatus = buildSetupStatus(merged)
  return merged
}

export async function getAdminAccountancySnapshot(userId?: string, businessId?: string) {
  const db = getDb()
  if (!db) throw new Error("Database connection is unavailable.")

  const userRows = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .orderBy(users.email)

  const selectedUserId = userId || userRows[0]?.id || ""
  if (!selectedUserId) {
    return {
      users: [],
      businesses: [],
      selectedUserId: "",
      selectedBusinessId: "",
      metrics: { totalBusinesses: 0, totalDatasets: 0, totalRows: 0, readiness: 0 },
      financialSettings: { currency: "EUR", numberFormat: "auto" },
      business: null,
      setup: emptyCompanySetupPayload(),
    }
  }

  const businessRows = await db
    .select()
    .from(businesses)
    .where(eq(businesses.userId, selectedUserId))
    .orderBy(desc(businesses.isPrimary), desc(businesses.updatedAt))

  const selectedBusiness =
    businessRows.find((business) => business.id === businessId) || businessRows[0] || null

  const [[datasetCount], [datasetRows], profile] = await Promise.all([
    db.select({ value: count() }).from(datasets).where(eq(datasets.userId, selectedUserId)),
    db.select({ value: sum(datasets.rowCount) }).from(datasets).where(eq(datasets.userId, selectedUserId)),
    db.query.profiles.findFirst({
      where: eq(profiles.userId, selectedUserId),
      columns: { preferredCurrency: true, numberFormat: true },
    }),
  ])

  const totalDatasets = Number(datasetCount?.value || 0)
  const setup = mergeCompanySetup(selectedBusiness?.companySetup)
  const profileReady = Boolean(
    selectedBusiness?.name &&
      (selectedBusiness.industry || setup.companyInfo.industry) &&
      (selectedBusiness.address || setup.companyInfo.taxResidenceCountry),
  )
  const readinessChecks = [
    businessRows.length > 0,
    totalDatasets > 0,
    profileReady,
    setup.taxSettings.taxRegistered !== "",
  ]

  return {
    users: userRows
      .filter((user) => Boolean(user.email))
      .map((user) => ({ id: user.id, email: user.email, name: user.name })),
    businesses: businessRows.map((business) => ({
      id: business.id,
      name: business.name,
      status: business.status,
      isPrimary: business.isPrimary,
    })),
    selectedUserId,
    selectedBusinessId: selectedBusiness?.id || "",
    metrics: {
      totalBusinesses: businessRows.length,
      totalDatasets,
      totalRows: Number(datasetRows?.value || 0),
      readiness: Math.round(
        (readinessChecks.filter(Boolean).length / readinessChecks.length) * 100,
      ),
    },
    financialSettings: {
      currency: setup.currencySettings.primaryCurrency || profile?.preferredCurrency || "EUR",
      numberFormat: profile?.numberFormat || "auto",
    },
    business: selectedBusiness
      ? {
          id: selectedBusiness.id,
          name: selectedBusiness.name,
          industry: selectedBusiness.industry || setup.companyInfo.industry || "",
          location:
            selectedBusiness.address ||
            setup.companyInfo.taxResidenceCountry ||
            setup.companyInfo.countryOfRegistration ||
            "",
          status: selectedBusiness.status,
        }
      : null,
    setup,
  }
}

export async function updateAdminBusinessSetup(
  id: string,
  input: {
    countryOfRegistration?: string
    taxResidenceCountry?: string
    legalStructure?: string
    accountingMethod?: string
    taxRegistered?: string
    taxType?: string
    standardTaxRate?: string
    primaryCurrency?: string
    reportingCurrency?: string
  },
) {
  const db = getDb()
  if (!db) throw new Error("Database connection is unavailable.")

  const [business] = await db
    .select({ companySetup: businesses.companySetup })
    .from(businesses)
    .where(eq(businesses.id, id))
    .limit(1)

  if (!business) throw new Error("Business profile was not found.")

  const setup = mergeCompanySetup(business.companySetup)
  setup.companyInfo = {
    ...setup.companyInfo,
    countryOfRegistration: input.countryOfRegistration ?? setup.companyInfo.countryOfRegistration,
    taxResidenceCountry: input.taxResidenceCountry ?? setup.companyInfo.taxResidenceCountry,
    legalStructure: (input.legalStructure ?? setup.companyInfo.legalStructure) as CompanySetupPayload["companyInfo"]["legalStructure"],
    accountingMethod: (input.accountingMethod ?? setup.companyInfo.accountingMethod) as CompanySetupPayload["companyInfo"]["accountingMethod"],
  }
  setup.taxSettings = {
    ...setup.taxSettings,
    taxRegistered: (input.taxRegistered ?? setup.taxSettings.taxRegistered) as CompanySetupPayload["taxSettings"]["taxRegistered"],
    taxType: (input.taxType ?? setup.taxSettings.taxType) as CompanySetupPayload["taxSettings"]["taxType"],
    standardTaxRate: input.standardTaxRate ?? setup.taxSettings.standardTaxRate,
  }
  setup.currencySettings = {
    ...setup.currencySettings,
    primaryCurrency: input.primaryCurrency ?? setup.currencySettings.primaryCurrency,
    reportingCurrency: input.reportingCurrency ?? setup.currencySettings.reportingCurrency,
  }
  setup.setupStatus = buildSetupStatus(setup)

  await db
    .update(businesses)
    .set({
      companySetup: setup as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(and(eq(businesses.id, id)))
}
