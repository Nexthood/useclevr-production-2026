import { getDb } from "@/lib/db"
import { businesses, businessEntities, users } from "@/lib/db/schema"
import { desc, eq, and, inArray } from "drizzle-orm"

type BusinessRow = typeof businesses.$inferSelect

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

  const userIds = [...new Set(businessRows.map((b) => b.userId))]
  const entityCounts = new Map<string, number>()

  if (userIds.length > 0) {
    const counts = await db
      .select({ businessId: businessEntities.businessId })
      .from(businessEntities)
      .where(inArray(businessEntities.businessId, userIds))

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
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
      archivedAt: b.archivedAt?.toISOString() || null,
    })),
    users: userRows
      .filter((u) => Boolean(u.email))
      .map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        businessCount: 0,
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
    ownerEmail: owner?.email || "Unknown",
    ownerName: owner?.name || null,
    status: row.status as "draft" | "active" | "archived",
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
