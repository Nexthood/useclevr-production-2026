import { randomUUID } from "node:crypto"
import { and, desc, eq } from "drizzle-orm"

import { getDb } from "@/lib/db"
import { businesses, profiles } from "@/lib/db/schema"
import type { BusinessDetails } from "./business-profile"

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
}

const emptyDetails: BusinessDetails = {
  businessName: "",
  businessEmail: "",
  industry: "",
  location: "",
  website: "",
  businessDescription: "",
}

function businessId() {
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

function toListRow(row: typeof businesses.$inferSelect): BusinessListRow {
  const details = toDetails(row)

  return {
    id: row.id,
    name: row.name || "Primary business profile",
    email: row.email || "Not set",
    industry: row.industry || "Not set",
    location: row.address || "Not set",
    website: row.website || "",
    description: row.description || "",
    status: row.status as BusinessStatus,
    isPrimary: row.isPrimary,
    completion: businessCompletion(details),
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
    archiveExpiresAt: row.archiveExpiresAt ? row.archiveExpiresAt.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listUserBusinesses(userId: string | null | undefined) {
  if (!userId) return []

  const db = getDb()
  if (!db) return []

  const rows = await db
    .select()
    .from(businesses)
    .where(eq(businesses.userId, userId))
    .orderBy(desc(businesses.isPrimary), desc(businesses.updatedAt))

  if (rows.length > 0) return rows.map(toListRow)

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

  const [row] = await db.insert(businesses).values({
    id: businessId(),
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
}

export async function getPrimaryBusinessDetails(userId: string | null | undefined): Promise<BusinessDetails> {
  if (!userId) return emptyDetails

  const db = getDb()
  if (!db) return emptyDetails

  const [business] = await db
    .select()
    .from(businesses)
    .where(and(eq(businesses.userId, userId), eq(businesses.isPrimary, true)))
    .limit(1)

  if (business) return toDetails(business)

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

export async function upsertPrimaryBusinessDetails(userId: string, details: BusinessDetails) {
  const db = getDb()
  if (!db) throw new Error("Database connection is unavailable.")

  const now = new Date()
  const status = businessCompletion(details) === 100 ? "active" : "draft"
  const [existing] = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(and(eq(businesses.userId, userId), eq(businesses.isPrimary, true)))
    .limit(1)

  const values = {
    name: details.businessName || "Primary business profile",
    email: details.businessEmail || null,
    industry: details.industry || null,
    address: details.location || null,
    website: details.website || null,
    description: details.businessDescription || null,
    status,
    archivedAt: null,
    archiveExpiresAt: null,
    updatedAt: now,
  }

  if (existing) {
    await db.update(businesses).set(values).where(eq(businesses.id, existing.id))
    return existing.id
  }

  const id = businessId()
  await db.insert(businesses).values({
    id,
    userId,
    ...values,
    isPrimary: true,
    localeSettings: {},
    invoiceSettings: {},
    createdAt: now,
  })
  return id
}

export async function archiveBusiness(userId: string, id: string) {
  const db = getDb()
  if (!db) throw new Error("Database connection is unavailable.")

  const now = new Date()
  await db.update(businesses).set({
    status: "archived",
    archivedAt: now,
    archiveExpiresAt: addMonths(now, 3),
    updatedAt: now,
  }).where(and(eq(businesses.userId, userId), eq(businesses.id, id)))
}

export async function restoreBusiness(userId: string, id: string) {
  const db = getDb()
  if (!db) throw new Error("Database connection is unavailable.")

  await db.update(businesses).set({
    status: "draft",
    archivedAt: null,
    archiveExpiresAt: null,
    updatedAt: new Date(),
  }).where(and(eq(businesses.userId, userId), eq(businesses.id, id)))
}
