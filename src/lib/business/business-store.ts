import { randomUUID } from "node:crypto"
import { and, desc, eq } from "drizzle-orm"

import { getDb } from "@/lib/db"
import { businesses, businessProfiles, profiles } from "@/lib/db/schema"
import { debugError } from "@/lib/utils/debug"
import type { BusinessDetails } from "./business-profile"
import {
  buildSetupStatus,
  emptyCompanySetupPayload,
  normalizeCompanySetupPayload,
  type CompanySetupPayload,
} from "./company-setup"

export type BusinessStatus = "draft" | "active" | "archived"

export type BusinessListRow = {
  id: string
  name: string
  email: string
  industry: string
  location: string
  website: string
  description: string
  status: BusinessStatus
  isPrimary: boolean
  completion: number
  archivedAt: string | null
  archiveExpiresAt: string | null
  updatedAt: string
  canArchive?: boolean
}

const emptyDetails: BusinessDetails = {
  businessName: "",
  businessEmail: "",
  industry: "",
  location: "",
  website: "",
  businessDescription: "",
}

function createBusinessId() {
  return `business_${randomUUID().replace(/-/g, "").slice(0, 16)}`
}

function addMonths(date: Date, months: number) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return next
}

export function businessCompletion(details: BusinessDetails) {
  const filled = Object.values(details).filter((value) => value.trim().length > 0).length
  return Math.round((filled / Object.values(details).length) * 100)
}

export function getBusinessLimit(subscriptionTier?: string | null) {
  if (subscriptionTier === "business") return 5
  if (subscriptionTier === "pro") return 2
  return 1
}

function toDetails(row: {
  name?: string | null
  email?: string | null
  industry?: string | null
  address?: string | null
  website?: string | null
  description?: string | null
}): BusinessDetails {
  return {
    businessName: row.name ?? "",
    businessEmail: row.email ?? "",
    industry: row.industry ?? "",
    location: row.address ?? "",
    website: row.website ?? "",
    businessDescription: row.description ?? "",
  }
}

function setupToDetails(input: unknown): BusinessDetails {
  const setup = normalizeCompanySetupPayload(input as Partial<CompanySetupPayload>)
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>
  const text = (value: unknown) => (typeof value === "string" ? value : "")
  const location = [
    setup.companyInfo.country || setup.companyInfo.taxResidenceCountry || setup.companyInfo.countryOfRegistration,
    setup.companyInfo.stateRegion,
  ].filter(Boolean).join(", ")

  return {
    businessName: setup.companyInfo.companyName || text(raw.businessName),
    businessEmail: text(raw.businessEmail),
    industry: setup.companyInfo.industry || setup.companyInfo.businessType || text(raw.industry),
    location: location || text(raw.location),
    website: text(raw.website),
    businessDescription: text(raw.businessDescription),
  }
}

function mergeDetailsIntoSetup(input: unknown, details: BusinessDetails): CompanySetupPayload & Record<string, unknown> {
  const setup = normalizeCompanySetupPayload(input as Partial<CompanySetupPayload>)
  const next = {
    ...setup,
    businessName: details.businessName,
    businessEmail: details.businessEmail,
    industry: details.industry,
    location: details.location,
    website: details.website,
    businessDescription: details.businessDescription,
    companyInfo: {
      ...setup.companyInfo,
      companyName: details.businessName || setup.companyInfo.companyName,
      industry: details.industry || setup.companyInfo.industry,
      country: details.location || setup.companyInfo.country,
      taxResidenceCountry: details.location || setup.companyInfo.taxResidenceCountry,
      countryOfRegistration: details.location || setup.companyInfo.countryOfRegistration,
    },
  }
  next.setupStatus = buildSetupStatus(next)
  return next
}

async function getBusinessProfilePayload(organizationId: string) {
  const db = getDb()
  if (!db) return null

  const [profile] = await db
    .select({ payload: businessProfiles.payload })
    .from(businessProfiles)
    .where(eq(businessProfiles.organizationId, organizationId))
    .limit(1)

  return profile?.payload ?? null
}

async function upsertBusinessProfilePayload(organizationId: string, payload: Record<string, unknown>) {
  const db = getDb()
  if (!db) throw new Error("Database connection is unavailable.")

  const now = new Date()
  await db.insert(businessProfiles)
    .values({
      id: `business_profile_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
      organizationId,
      payload,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: businessProfiles.organizationId,
      set: {
        payload,
        updatedAt: now,
      },
    })
}

function toListRow(row: typeof businesses.$inferSelect): BusinessListRow {
  const details = toDetails(row)

  return {
    id: row.id,
    name: row.name || "Primary business profile",
    email: row.email || "Not configured",
    industry: row.industry || "Not configured",
    location: row.address || "Not configured",
    website: row.website || "",
    description: row.description || "",
    status: row.status as BusinessStatus,
    isPrimary: row.isPrimary,
    completion: businessCompletion(details),
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
    archiveExpiresAt: row.archiveExpiresAt ? row.archiveExpiresAt.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
    canArchive: !row.isPrimary,
  }
}

async function toBusinessProfileListRow(row: typeof businesses.$inferSelect): Promise<BusinessListRow> {
  const base = toListRow(row)
  const payload = await getBusinessProfilePayload(row.id)
  if (!payload) return base

  const details = setupToDetails(payload)
  const completion = businessCompletion(details)
  return {
    ...base,
    name: details.businessName || base.name,
    email: details.businessEmail || "Not configured",
    industry: details.industry || "Not configured",
    location: details.location || "Not configured",
    website: details.website,
    description: details.businessDescription,
    status: completion === 100 ? "active" : "draft",
    completion,
  }
}

async function getProfileBusinessDetails(userId: string): Promise<BusinessDetails> {
  const db = getDb()
  if (!db) return emptyDetails

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
    columns: {
      businessName: true,
      businessEmail: true,
      industry: true,
      location: true,
      website: true,
      businessDescription: true,
    },
  })

  return {
    businessName: profile?.businessName ?? "",
    businessEmail: profile?.businessEmail ?? "",
    industry: profile?.industry ?? "",
    location: profile?.location ?? "",
    website: profile?.website ?? "",
    businessDescription: profile?.businessDescription ?? "",
  }
}

async function getProfileBusinessListRow(userId: string): Promise<BusinessListRow[]> {
  const details = await getProfileBusinessDetails(userId)
  if (!details.businessName) return []

  return [
    {
      id: "profile-primary",
      name: details.businessName,
      email: details.businessEmail || "Not configured",
      industry: details.industry || "Not configured",
      location: details.location || "Not configured",
      website: details.website,
      description: details.businessDescription,
      status: businessCompletion(details) === 100 ? "active" : "draft",
      isPrimary: true,
      completion: businessCompletion(details),
      archivedAt: null,
      archiveExpiresAt: null,
      updatedAt: new Date().toISOString(),
      canArchive: false,
    },
  ]
}

export async function listUserBusinesses(userId: string | null | undefined) {
  if (!userId) return []

  const db = getDb()
  if (!db) return []

  let rows: (typeof businesses.$inferSelect)[] = []

  try {
    rows = await db
      .select()
      .from(businesses)
      .where(eq(businesses.userId, userId))
      .orderBy(desc(businesses.isPrimary), desc(businesses.updatedAt))
  } catch (error) {
    debugError("[BUSINESS] Business table unavailable, using profile fallback:", error)
    return getProfileBusinessListRow(userId)
  }

  if (rows.length > 0) return Promise.all(rows.map(toBusinessProfileListRow))

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
    columns: {
      businessName: true,
      businessEmail: true,
      industry: true,
      location: true,
      website: true,
      businessDescription: true,
      preferredCurrency: true,
    },
  })

  if (!profile?.businessName) return []

  try {
    const [row] = await db.insert(businesses).values({
      id: createBusinessId(),
      userId,
      name: profile.businessName,
      email: profile.businessEmail || null,
      industry: profile.industry || null,
      address: profile.location || null,
      website: profile.website || null,
      description: profile.businessDescription || null,
      status: "active",
      isPrimary: true,
      localeSettings: { currency: profile.preferredCurrency || "EUR" },
    }).returning()

    return [toListRow(row)]
  } catch (error) {
    debugError("[BUSINESS] Profile migration into business table failed:", error)
    return getProfileBusinessListRow(userId)
  }
}

export async function getPrimaryBusinessDetails(userId: string | null | undefined): Promise<BusinessDetails> {
  if (!userId) return emptyDetails

  const db = getDb()
  if (!db) return emptyDetails

  let business: typeof businesses.$inferSelect | undefined

  try {
    ;[business] = await db
      .select()
      .from(businesses)
      .where(and(eq(businesses.userId, userId), eq(businesses.isPrimary, true)))
      .limit(1)
  } catch (error) {
    debugError("[BUSINESS] Primary business lookup failed, using profile fallback:", error)
    return getProfileBusinessDetails(userId)
  }

  if (business) {
    const profilePayload = await getBusinessProfilePayload(business.id)
    if (profilePayload) {
      const profileDetails = setupToDetails(profilePayload)
      if (businessCompletion(profileDetails) > 0) return profileDetails
    }
    if (business.companySetup && typeof business.companySetup === "object" && Object.keys(business.companySetup as object).length > 0) {
      const legacyDetails = setupToDetails(business.companySetup)
      if (businessCompletion(legacyDetails) > 0) return legacyDetails
    }
    return toDetails(business)
  }

  return getProfileBusinessDetails(userId)
}

export async function getBusinessDetailsById(
  userId: string | null | undefined,
  businessId: string | null | undefined
): Promise<BusinessDetails> {
  if (!userId || !businessId || businessId === "profile-primary") {
    return getPrimaryBusinessDetails(userId)
  }

  const db = getDb()
  if (!db) return emptyDetails

  try {
    const [business] = await db
      .select()
      .from(businesses)
      .where(and(eq(businesses.userId, userId), eq(businesses.id, businessId)))
      .limit(1)

    if (business) return toDetails(business)
  } catch (error) {
    debugError("[BUSINESS] Business detail lookup failed:", error)
  }

  return emptyDetails
}

export async function upsertPrimaryBusinessDetails(userId: string, details: BusinessDetails) {
  const db = getDb()
  if (!db) throw new Error("Database connection is unavailable.")

  const now = new Date()
  const status = businessCompletion(details) === 100 ? "active" : "draft"
  let existing: { id: string } | undefined

  try {
    ;[existing] = await db
      .select({ id: businesses.id })
      .from(businesses)
      .where(and(eq(businesses.userId, userId), eq(businesses.isPrimary, true)))
      .limit(1)
  } catch (error) {
    debugError("[BUSINESS] Business table unavailable during profile save:", error)
    return "profile-primary"
  }

  const values = {
    name: "Primary business profile",
    email: null,
    industry: null,
    address: null,
    website: null,
    description: null,
    status,
    archivedAt: null,
    archiveExpiresAt: null,
    updatedAt: now,
    companySetup: {},
  }

  if (existing) {
    await db.update(businesses).set(values).where(eq(businesses.id, existing.id))
    const currentPayload = await getBusinessProfilePayload(existing.id)
    await upsertBusinessProfilePayload(existing.id, mergeDetailsIntoSetup(currentPayload, details))
    return existing.id
  }

  const id = createBusinessId()
  try {
    await db.insert(businesses).values({
      id,
      userId,
      ...values,
      isPrimary: true,
      localeSettings: {},
      invoiceSettings: {},
      createdAt: now,
    })
    await upsertBusinessProfilePayload(id, mergeDetailsIntoSetup(emptyCompanySetupPayload(), details))
  } catch (error) {
    debugError("[BUSINESS] Business table insert failed after profile save:", error)
    return "profile-primary"
  }
  return id
}

export async function upsertBusinessDetails(
  userId: string,
  businessId: string | null | undefined,
  details: BusinessDetails
) {
  if (!businessId || businessId === "profile-primary") {
    return upsertPrimaryBusinessDetails(userId, details)
  }

  const db = getDb()
  if (!db) throw new Error("Database connection is unavailable.")

  const now = new Date()
  const status = businessCompletion(details) === 100 ? "active" : "draft"
  const values = {
    name: "Business profile",
    email: null,
    industry: null,
    address: null,
    website: null,
    description: null,
    status,
    archivedAt: null,
    archiveExpiresAt: null,
    updatedAt: now,
    companySetup: {},
  }

  if (businessId !== "new") {
    const [updated] = await db
      .update(businesses)
      .set(values)
      .where(and(eq(businesses.userId, userId), eq(businesses.id, businessId)))
      .returning()

    if (updated?.id) {
      const currentPayload = await getBusinessProfilePayload(updated.id)
      await upsertBusinessProfilePayload(updated.id, mergeDetailsIntoSetup(currentPayload, details))
      return updated.id
    }
    throw new Error("Business profile was not found.")
  }

  const id = businessId === "new" ? createBusinessId() : businessId
  await db.insert(businesses).values({
    id,
    userId,
    ...values,
    isPrimary: false,
    localeSettings: {},
    invoiceSettings: {},
    createdAt: now,
  })
  await upsertBusinessProfilePayload(id, mergeDetailsIntoSetup(emptyCompanySetupPayload(), details))

  return id
}

export async function archiveBusiness(userId: string, id: string) {
  const db = getDb()
  if (!db) throw new Error("Database connection is unavailable.")

  const now = new Date()
  const [updated] = await db.update(businesses).set({
      status: "archived",
      archivedAt: now,
      archiveExpiresAt: addMonths(now, 3),
      updatedAt: now,
    }).where(and(
      eq(businesses.userId, userId),
      eq(businesses.id, id),
      eq(businesses.isPrimary, false),
    )).returning()

  return Boolean(updated)
}

export async function restoreBusiness(userId: string, id: string) {
  const db = getDb()
  if (!db) throw new Error("Database connection is unavailable.")

  const [updated] = await db.update(businesses).set({
      status: "draft",
      archivedAt: null,
      archiveExpiresAt: null,
      updatedAt: new Date(),
    }).where(and(
      eq(businesses.userId, userId),
      eq(businesses.id, id),
      eq(businesses.isPrimary, false),
    )).returning()

  return Boolean(updated)
}

export async function deleteBusiness(userId: string, id: string) {
  const db = getDb()
  if (!db) throw new Error("Database connection is unavailable.")

  const [deleted] = await db
    .delete(businesses)
    .where(and(
      eq(businesses.userId, userId),
      eq(businesses.id, id),
      eq(businesses.isPrimary, false),
      eq(businesses.status, "archived"),
    ))
    .returning()

  return Boolean(deleted)
}
