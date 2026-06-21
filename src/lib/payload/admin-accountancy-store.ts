import {
  emptyCompanySetupPayload,
  normalizeCompanySetupPayload,
  type CompanySetupPayload,
} from "@/lib/business/company-setup"
import { getDb } from "@/lib/db"
import { businesses, datasets, profiles, users } from "@/lib/db/schema"
import { and, count, desc, eq, sum } from "drizzle-orm"

function mergeCompanySetup(value: unknown): CompanySetupPayload {
  return normalizeCompanySetupPayload(value && typeof value === "object" ? (value as Partial<CompanySetupPayload>) : null)
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
    revenueAmountType?: string
    expenseAmountType?: string
    estimateTaxes?: string
    primaryCurrency?: string
    reportingCurrency?: string
    otherCurrenciesUsed?: string[]
    revenueSources?: string[]
    customerType?: string
    invoiceOrPaymentBased?: string
    paymentProviders?: string[]
    hasRefundsOrChargebacks?: string
    expenseCategories?: string[]
    hasMixedBusinessPrivateExpenses?: string
    receiptsAvailable?: string
    hasRecurringExpenses?: string
    hasBusinessInsurance?: string
    insuranceTypes?: string[]
    insurancePremiumAmount?: string
    insurancePaymentFrequency?: string
    insuranceBusinessUsePercentage?: string
    hasBusinessLoans?: string
    hasLeasing?: string
    hasCreditCards?: string
    hasOverdraft?: string
    monthlyDebtPayment?: string
    loanInterestKnown?: string
    principalInterestSplitKnown?: string
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
    revenueAmountType: (input.revenueAmountType ?? setup.taxSettings.revenueAmountType) as CompanySetupPayload["taxSettings"]["revenueAmountType"],
    expenseAmountType: (input.expenseAmountType ?? setup.taxSettings.expenseAmountType) as CompanySetupPayload["taxSettings"]["expenseAmountType"],
    estimateTaxes: (input.estimateTaxes ?? setup.taxSettings.estimateTaxes) as CompanySetupPayload["taxSettings"]["estimateTaxes"],
  }
  setup.currencySettings = {
    ...setup.currencySettings,
    primaryCurrency: input.primaryCurrency ?? setup.currencySettings.primaryCurrency,
    reportingCurrency: input.reportingCurrency ?? setup.currencySettings.reportingCurrency,
    otherCurrenciesUsed: input.otherCurrenciesUsed ?? setup.currencySettings.otherCurrenciesUsed,
  }
  setup.revenueRules = {
    ...setup.revenueRules,
    revenueSources: input.revenueSources ?? setup.revenueRules.revenueSources,
    customerType: (input.customerType ?? setup.revenueRules.customerType) as CompanySetupPayload["revenueRules"]["customerType"],
    invoiceOrPaymentBased: (input.invoiceOrPaymentBased ?? setup.revenueRules.invoiceOrPaymentBased) as CompanySetupPayload["revenueRules"]["invoiceOrPaymentBased"],
    paymentProviders: input.paymentProviders ?? setup.revenueRules.paymentProviders,
    hasRefundsOrChargebacks: (input.hasRefundsOrChargebacks ?? setup.revenueRules.hasRefundsOrChargebacks) as CompanySetupPayload["revenueRules"]["hasRefundsOrChargebacks"],
  }
  setup.expenseRules = {
    ...setup.expenseRules,
    expenseCategories: input.expenseCategories ?? setup.expenseRules.expenseCategories,
    hasMixedBusinessPrivateExpenses: (input.hasMixedBusinessPrivateExpenses ?? setup.expenseRules.hasMixedBusinessPrivateExpenses) as CompanySetupPayload["expenseRules"]["hasMixedBusinessPrivateExpenses"],
    receiptsAvailable: (input.receiptsAvailable ?? setup.expenseRules.receiptsAvailable) as CompanySetupPayload["expenseRules"]["receiptsAvailable"],
    hasRecurringExpenses: (input.hasRecurringExpenses ?? setup.expenseRules.hasRecurringExpenses) as CompanySetupPayload["expenseRules"]["hasRecurringExpenses"],
  }
  setup.insuranceSettings = {
    ...setup.insuranceSettings,
    hasBusinessInsurance: (input.hasBusinessInsurance ?? setup.insuranceSettings.hasBusinessInsurance) as CompanySetupPayload["insuranceSettings"]["hasBusinessInsurance"],
    insuranceTypes: input.insuranceTypes ?? setup.insuranceSettings.insuranceTypes,
    insurancePremiumAmount: input.insurancePremiumAmount ?? setup.insuranceSettings.insurancePremiumAmount,
    insurancePaymentFrequency: (input.insurancePaymentFrequency ?? setup.insuranceSettings.insurancePaymentFrequency) as CompanySetupPayload["insuranceSettings"]["insurancePaymentFrequency"],
    insuranceBusinessUsePercentage: (input.insuranceBusinessUsePercentage ?? setup.insuranceSettings.insuranceBusinessUsePercentage) as CompanySetupPayload["insuranceSettings"]["insuranceBusinessUsePercentage"],
  }
  setup.loanLeasingSettings = {
    ...setup.loanLeasingSettings,
    hasBusinessLoans: (input.hasBusinessLoans ?? setup.loanLeasingSettings.hasBusinessLoans) as CompanySetupPayload["loanLeasingSettings"]["hasBusinessLoans"],
    hasLeasing: (input.hasLeasing ?? setup.loanLeasingSettings.hasLeasing) as CompanySetupPayload["loanLeasingSettings"]["hasLeasing"],
    hasCreditCards: (input.hasCreditCards ?? setup.loanLeasingSettings.hasCreditCards) as CompanySetupPayload["loanLeasingSettings"]["hasCreditCards"],
    hasOverdraft: (input.hasOverdraft ?? setup.loanLeasingSettings.hasOverdraft) as CompanySetupPayload["loanLeasingSettings"]["hasOverdraft"],
    monthlyDebtPayment: input.monthlyDebtPayment ?? setup.loanLeasingSettings.monthlyDebtPayment,
    loanInterestKnown: (input.loanInterestKnown ?? setup.loanLeasingSettings.loanInterestKnown) as CompanySetupPayload["loanLeasingSettings"]["loanInterestKnown"],
    principalInterestSplitKnown: (input.principalInterestSplitKnown ?? setup.loanLeasingSettings.principalInterestSplitKnown) as CompanySetupPayload["loanLeasingSettings"]["principalInterestSplitKnown"],
  }
  const normalizedSetup = normalizeCompanySetupPayload(setup)

  await db
    .update(businesses)
    .set({
      companySetup: normalizedSetup as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(and(eq(businesses.id, id)))
}
