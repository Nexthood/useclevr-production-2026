import { getDb } from "@/lib/db"
import { businesses, businessEntities, users } from "@/lib/db/schema"
import { desc, eq, inArray } from "drizzle-orm"

type CompanySetupRecord = {
  companyInfo?: Record<string, unknown>
  taxSettings?: Record<string, unknown>
  currencySettings?: Record<string, unknown>
  revenueRules?: Record<string, unknown>
  expenseRules?: Record<string, unknown>
  insuranceSettings?: Record<string, unknown>
  loanLeasingSettings?: Record<string, unknown>
}

function setupText(setup: unknown, section: keyof CompanySetupRecord, field: string) {
  if (!setup || typeof setup !== "object") return ""
  const value = (setup as CompanySetupRecord)[section]?.[field]
  return typeof value === "string" ? value : ""
}

function setupList(setup: unknown, section: keyof CompanySetupRecord, field: string) {
  if (!setup || typeof setup !== "object") return []
  const value = (setup as CompanySetupRecord)[section]?.[field]
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

export type AdminBusinessView = {
  id: string
  userId: string
  ownerEmail: string
  ownerName: string | null
  name: string
  email: string | null
  industry: string | null
  address: string | null
  website: string | null
  description: string | null
  companyNumber: string | null
  status: "draft" | "active" | "archived"
  isPrimary: boolean
  entityCount: number
  createdAt: string
  updatedAt: string
  archivedAt: string | null
  completionPercent: number
  countryOfRegistration: string
  taxResidenceCountry: string
  legalStructure: string
  accountingMethod: string
  taxRegistered: string
  taxType: string
  standardTaxRate: string
  revenueAmountType: string
  expenseAmountType: string
  estimateTaxes: string
  primaryCurrency: string
  reportingCurrency: string
  otherCurrenciesUsed: string[]
  revenueSources: string[]
  customerType: string
  invoiceOrPaymentBased: string
  paymentProviders: string[]
  hasRefundsOrChargebacks: string
  expenseCategories: string[]
  hasMixedBusinessPrivateExpenses: string
  receiptsAvailable: string
  hasRecurringExpenses: string
  hasBusinessInsurance: string
  insuranceTypes: string[]
  insurancePremiumAmount: string
  insurancePaymentFrequency: string
  insuranceBusinessUsePercentage: string
  hasBusinessLoans: string
  hasLeasing: string
  hasCreditCards: string
  hasOverdraft: string
  monthlyDebtPayment: string
  loanInterestKnown: string
  principalInterestSplitKnown: string
}

const BUSINESS_COMPLETION_FIELDS: { field: "name" | "email" | "industry" | "address" | "website" | "description"; section: string }[] = [
  { field: "name", section: "Identity" },
  { field: "industry", section: "Identity" },
  { field: "description", section: "Identity" },
  { field: "email", section: "Contact" },
  { field: "website", section: "Contact" },
  { field: "address", section: "Operations" },
]

function computeCompletionPercent(business: {
  name: string | null
  email: string | null
  industry: string | null
  address: string | null
  website: string | null
  description: string | null
}) {
  const filled = BUSINESS_COMPLETION_FIELDS.filter(
    (f) => String(business[f.field] || "").trim().length > 0,
  ).length
  return Math.round((filled / BUSINESS_COMPLETION_FIELDS.length) * 100)
}

export type AdminDashboardUser = {
  id: string
  email: string | null
  name: string | null
  businessCount: number
}

function cleanText(value: unknown, fallback = "", maxLength = 1000): string {
  if (typeof value !== "string") return fallback
  return value.trim().slice(0, maxLength)
}

export async function listBusinesses(): Promise<{
  businesses: AdminBusinessView[]
  users: AdminDashboardUser[]
}> {
  const db = getDb()
  if (!db) throw new Error("Database connection is unavailable.")

  const [businessRows, userRows] = await Promise.all([
    db.select().from(businesses).orderBy(desc(businesses.updatedAt)),
    db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
      })
      .from(users)
      .orderBy(users.email),
  ])

  const businessIds = businessRows.map((business) => business.id)
  const entityCounts = new Map<string, number>()

  if (businessIds.length > 0) {
    const counts = await db
      .select({ businessId: businessEntities.businessId })
      .from(businessEntities)
      .where(inArray(businessEntities.businessId, businessIds))

    for (const c of counts) {
      entityCounts.set(c.businessId, (entityCounts.get(c.businessId) || 0) + 1)
    }
  }

  const usersById = new Map(userRows.map((u) => [u.id, u]))

  return {
    businesses: businessRows.map((b) => ({
      id: b.id,
      userId: b.userId,
      ownerEmail: usersById.get(b.userId)?.email || "Unknown",
      ownerName: usersById.get(b.userId)?.name || null,
      name: b.name,
      email: b.email,
      industry: b.industry,
      address: b.address,
      website: b.website,
      description: b.description,
      companyNumber: b.companyNumber,
      status: b.status as "draft" | "active" | "archived",
      isPrimary: b.isPrimary,
      entityCount: entityCounts.get(b.id) || 0,
      completionPercent: computeCompletionPercent(b),
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
      archivedAt: b.archivedAt?.toISOString() || null,
      countryOfRegistration: setupText(b.companySetup, "companyInfo", "countryOfRegistration"),
      taxResidenceCountry: setupText(b.companySetup, "companyInfo", "taxResidenceCountry"),
      legalStructure: setupText(b.companySetup, "companyInfo", "legalStructure"),
      accountingMethod: setupText(b.companySetup, "companyInfo", "accountingMethod"),
      taxRegistered: setupText(b.companySetup, "taxSettings", "taxRegistered"),
      taxType: setupText(b.companySetup, "taxSettings", "taxType"),
      standardTaxRate: setupText(b.companySetup, "taxSettings", "standardTaxRate"),
      revenueAmountType: setupText(b.companySetup, "taxSettings", "revenueAmountType"),
      expenseAmountType: setupText(b.companySetup, "taxSettings", "expenseAmountType"),
      estimateTaxes: setupText(b.companySetup, "taxSettings", "estimateTaxes"),
      primaryCurrency: setupText(b.companySetup, "currencySettings", "primaryCurrency"),
      reportingCurrency: setupText(b.companySetup, "currencySettings", "reportingCurrency"),
      otherCurrenciesUsed: setupList(b.companySetup, "currencySettings", "otherCurrenciesUsed"),
      revenueSources: setupList(b.companySetup, "revenueRules", "revenueSources"),
      customerType: setupText(b.companySetup, "revenueRules", "customerType"),
      invoiceOrPaymentBased: setupText(b.companySetup, "revenueRules", "invoiceOrPaymentBased"),
      paymentProviders: setupList(b.companySetup, "revenueRules", "paymentProviders"),
      hasRefundsOrChargebacks: setupText(b.companySetup, "revenueRules", "hasRefundsOrChargebacks"),
      expenseCategories: setupList(b.companySetup, "expenseRules", "expenseCategories"),
      hasMixedBusinessPrivateExpenses: setupText(b.companySetup, "expenseRules", "hasMixedBusinessPrivateExpenses"),
      receiptsAvailable: setupText(b.companySetup, "expenseRules", "receiptsAvailable"),
      hasRecurringExpenses: setupText(b.companySetup, "expenseRules", "hasRecurringExpenses"),
      hasBusinessInsurance: setupText(b.companySetup, "insuranceSettings", "hasBusinessInsurance"),
      insuranceTypes: setupList(b.companySetup, "insuranceSettings", "insuranceTypes"),
      insurancePremiumAmount: setupText(b.companySetup, "insuranceSettings", "insurancePremiumAmount"),
      insurancePaymentFrequency: setupText(b.companySetup, "insuranceSettings", "insurancePaymentFrequency"),
      insuranceBusinessUsePercentage: setupText(b.companySetup, "insuranceSettings", "insuranceBusinessUsePercentage"),
      hasBusinessLoans: setupText(b.companySetup, "loanLeasingSettings", "hasBusinessLoans"),
      hasLeasing: setupText(b.companySetup, "loanLeasingSettings", "hasLeasing"),
      hasCreditCards: setupText(b.companySetup, "loanLeasingSettings", "hasCreditCards"),
      hasOverdraft: setupText(b.companySetup, "loanLeasingSettings", "hasOverdraft"),
      monthlyDebtPayment: setupText(b.companySetup, "loanLeasingSettings", "monthlyDebtPayment"),
      loanInterestKnown: setupText(b.companySetup, "loanLeasingSettings", "loanInterestKnown"),
      principalInterestSplitKnown: setupText(b.companySetup, "loanLeasingSettings", "principalInterestSplitKnown"),
    })),
    users: userRows
      .filter((u) => Boolean(u.email))
      .map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
      businessCount: businessRows.filter((business) => business.userId === u.id).length,
      })),
  }
}

export async function createBusiness(input: {
  userId: string
  name: string
  email?: string
  industry?: string
  address?: string
  website?: string
  description?: string
  companyNumber?: string
}) {
  const db = getDb()
  if (!db) throw new Error("Database connection is unavailable.")

  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1)

  if (!owner) throw new Error("The selected dashboard user does not exist.")

  const id = `business_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`
  const now = new Date()

  await db.insert(businesses).values({
    id,
    userId: input.userId,
    name: cleanText(input.name, "Unnamed Business", 255),
    email: cleanText(input.email) || null,
    industry: cleanText(input.industry, "", 255) || null,
    address: cleanText(input.address, "", 500) || null,
    website: cleanText(input.website, "", 500) || null,
    description: cleanText(input.description, "", 4000) || null,
    companyNumber: cleanText(input.companyNumber, "", 100) || null,
    status: "draft",
    isPrimary: false,
    localeSettings: {},
    invoiceSettings: {},
    companySetup: {},
    createdAt: now,
    updatedAt: now,
  })

  return id
}

export async function updateBusiness(
  id: string,
  input: {
    name?: string
    email?: string
    industry?: string
    address?: string
    website?: string
    description?: string
    companyNumber?: string
    status?: string
    userId?: string
  },
) {
  const db = getDb()
  if (!db) throw new Error("Database connection is unavailable.")

  const values: Record<string, unknown> = { updatedAt: new Date() }

  if (input.name !== undefined) values.name = cleanText(input.name, "Unnamed Business", 255)
  if (input.email !== undefined) values.email = cleanText(input.email) || null
  if (input.industry !== undefined) values.industry = cleanText(input.industry, "", 255) || null
  if (input.address !== undefined) values.address = cleanText(input.address, "", 500) || null
  if (input.website !== undefined) values.website = cleanText(input.website, "", 500) || null
  if (input.description !== undefined)
    values.description = cleanText(input.description, "", 4000) || null
  if (input.companyNumber !== undefined)
    values.companyNumber = cleanText(input.companyNumber, "", 100) || null
  if (input.status !== undefined)
    values.status = ["draft", "active", "archived"].includes(input.status)
      ? input.status
      : "draft"
  if (input.userId !== undefined) {
    const [owner] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1)
    if (!owner) throw new Error("The selected dashboard user does not exist.")
    values.userId = input.userId
  }

  const [updated] = await db
    .update(businesses)
    .set(values)
    .where(eq(businesses.id, id))
    .returning()

  if (!updated) throw new Error("Business profile was not found.")
  return id
}

export async function archiveBusiness(id: string) {
  const db = getDb()
  if (!db) throw new Error("Database connection is unavailable.")

  const now = new Date()
  const expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

  const [updated] = await db
    .update(businesses)
    .set({
      status: "archived",
      archivedAt: now,
      archiveExpiresAt: expiresAt,
      updatedAt: now,
    })
    .where(eq(businesses.id, id))
    .returning()

  if (!updated) throw new Error("Business profile was not found.")
  return id
}

export async function restoreBusiness(id: string) {
  const db = getDb()
  if (!db) throw new Error("Database connection is unavailable.")

  const [updated] = await db
    .update(businesses)
    .set({
      status: "draft",
      archivedAt: null,
      archiveExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(businesses.id, id))
    .returning()

  if (!updated) throw new Error("Business profile was not found.")
  return id
}

export async function deleteBusiness(id: string) {
  const db = getDb()
  if (!db) throw new Error("Database connection is unavailable.")

  const [existing] = await db
    .select({ status: businesses.status, isPrimary: businesses.isPrimary })
    .from(businesses)
    .where(eq(businesses.id, id))
    .limit(1)

  if (!existing) throw new Error("Business profile was not found.")
  if (existing.status !== "archived") throw new Error("Only archived businesses can be deleted.")
  if (existing.isPrimary) throw new Error("Cannot delete the primary business.")

  await db.delete(businesses).where(eq(businesses.id, id))
}

export async function getBusinessById(id: string) {
  const db = getDb()
  if (!db) throw new Error("Database connection is unavailable.")

  const [row] = await db
    .select({
      id: businesses.id,
      userId: businesses.userId,
      name: businesses.name,
      email: businesses.email,
      industry: businesses.industry,
      address: businesses.address,
      website: businesses.website,
      description: businesses.description,
      companyNumber: businesses.companyNumber,
      status: businesses.status,
      isPrimary: businesses.isPrimary,
      companySetup: businesses.companySetup,
      createdAt: businesses.createdAt,
      updatedAt: businesses.updatedAt,
      archivedAt: businesses.archivedAt,
    })
    .from(businesses)
    .where(eq(businesses.id, id))
    .limit(1)

  if (!row) throw new Error("Business profile was not found.")

  const [owner] = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, row.userId))
    .limit(1)

  return {
    ...row,
    companySetup: row.companySetup as Record<string, unknown> | null,
    ownerEmail: owner?.email || "Unknown",
    ownerName: owner?.name || null,
    status: row.status as "draft" | "active" | "archived",
    completionPercent: computeCompletionPercent(row),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    archivedAt: row.archivedAt?.toISOString() || null,
  }
}

export async function listBusinessEntities(businessId: string) {
  const db = getDb()
  if (!db) throw new Error("Database connection is unavailable.")

  return db
    .select()
    .from(businessEntities)
    .where(eq(businessEntities.businessId, businessId))
    .orderBy(businessEntities.name)
}
