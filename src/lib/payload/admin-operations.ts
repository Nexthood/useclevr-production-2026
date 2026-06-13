import { randomUUID } from "node:crypto"

import { parseCSVString } from "@/lib/data/csvLoader"
import { getDb } from "@/lib/db"
import { businesses, datasetRows, datasets, users } from "@/lib/db/schema"
import { listTickets, updateTicket } from "@/lib/support/ticket-store"
import { desc, eq } from "drizzle-orm"
import type { Endpoint, PayloadRequest } from "payload"

type CmsOperator = {
  email?: string | null
  role?: "base" | "superadmin"
}

function requireSuperAdmin(req: PayloadRequest) {
  const operator = req.user as CmsOperator | null
  if (!operator || operator.role !== "superadmin") {
    return null
  }
  return operator
}

function cleanText(value: unknown, maxLength = 1000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

async function listBusinessOperations() {
  const db = getDb()
  if (!db) throw new Error("Database connection is unavailable.")

  const [businessRows, userRows] = await Promise.all([
    db
      .select({
        id: businesses.id,
        userId: businesses.userId,
        name: businesses.name,
        email: businesses.email,
        industry: businesses.industry,
        address: businesses.address,
        website: businesses.website,
        description: businesses.description,
        status: businesses.status,
        isPrimary: businesses.isPrimary,
        updatedAt: businesses.updatedAt,
      })
      .from(businesses)
      .orderBy(desc(businesses.updatedAt)),
    db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
      })
      .from(users)
      .orderBy(users.email),
  ])

  const usersById = new Map(userRows.map((user) => [user.id, user]))
  return {
    businesses: businessRows.map((business) => ({
      ...business,
      ownerEmail: usersById.get(business.userId)?.email || "Unknown owner",
      updatedAt: business.updatedAt.toISOString(),
    })),
    users: userRows.filter((user) => Boolean(user.email)),
  }
}

async function saveBusiness(req: PayloadRequest) {
  const db = getDb()
  if (!db) throw new Error("Database connection is unavailable.")

  if (!req.json) return Response.json({ error: "Request body is unavailable." }, { status: 400 })
  const body = (await req.json()) as Record<string, unknown>
  const id = cleanText(body.id, 160)
  const userId = cleanText(body.userId, 160)
  const name = cleanText(body.name, 255)

  if (!userId || !name) {
    return Response.json({ error: "Owner and business name are required." }, { status: 400 })
  }

  const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1)
  if (!owner) {
    return Response.json({ error: "The selected dashboard user does not exist." }, { status: 400 })
  }

  const values = {
    userId,
    name,
    email: cleanText(body.email, 255) || null,
    industry: cleanText(body.industry, 255) || null,
    address: cleanText(body.address, 500) || null,
    website: cleanText(body.website, 500) || null,
    description: cleanText(body.description, 4000) || null,
    status: body.status === "archived" || body.status === "active" ? body.status : "draft",
    updatedAt: new Date(),
  }

  if (id) {
    const [updated] = await db
      .update(businesses)
      .set(values)
      .where(eq(businesses.id, id))
      .returning()
    if (!updated) {
      return Response.json({ error: "Business profile was not found." }, { status: 404 })
    }
    return Response.json({ success: true, id: updated.id })
  }

  const newId = `business_${randomUUID().replaceAll("-", "").slice(0, 16)}`
  await db.insert(businesses).values({
    id: newId,
    ...values,
    isPrimary: false,
    localeSettings: {},
    invoiceSettings: {},
    createdAt: new Date(),
  })
  return Response.json({ success: true, id: newId })
}

async function uploadDataset(req: PayloadRequest) {
  const db = getDb()
  if (!db) throw new Error("Database connection is unavailable.")

  if (!req.formData) return Response.json({ error: "Upload body is unavailable." }, { status: 400 })
  const formData = await req.formData()
  const file = formData.get("file")
  const userId = cleanText(formData.get("userId"), 160)

  if (!(file instanceof File) || !userId) {
    return Response.json({ error: "Dashboard owner and CSV file are required." }, { status: 400 })
  }
  if (!file.name.toLowerCase().endsWith(".csv") && !file.type.includes("csv")) {
    return Response.json({ error: "File must be a CSV file." }, { status: 400 })
  }
  if (file.size > 50 * 1024 * 1024) {
    return Response.json({ error: "File size must be less than 50MB." }, { status: 400 })
  }

  const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1)
  if (!owner) {
    return Response.json({ error: "The selected dashboard user does not exist." }, { status: 400 })
  }

  const parsed = parseCSVString(await file.text())
  if (parsed.rowCount === 0) {
    return Response.json({ error: "CSV file is empty." }, { status: 400 })
  }

  const id = `ds_${Date.now()}_${randomUUID().slice(0, 8)}`
  const rows = parsed.rows as Record<string, string | number | boolean | null>[]
  const now = new Date()

  await db.insert(datasets).values({
    id,
    userId,
    name: file.name.replace(/\.csv$/i, ""),
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || "text/csv",
    rowCount: parsed.rowCount,
    columnCount: parsed.columns.length,
    columns: parsed.columns,
    data: rows,
    columnTypes: {},
    status: "ready",
    analysisStatus: "ready",
    analysisProgress: 100,
    analysis: {},
    createdAt: now,
    updatedAt: now,
  })

  const batchSize = 100
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    await db.insert(datasetRows).values(
      rows.slice(offset, offset + batchSize).map((row, index) => ({
        id: `${id}-row-${offset + index}`,
        datasetId: id,
        rowIndex: offset + index,
        data: row,
      })),
    )
  }

  return Response.json({
    success: true,
    dataset: {
      id,
      name: file.name.replace(/\.csv$/i, ""),
      rowCount: parsed.rowCount,
      columnCount: parsed.columns.length,
    },
  })
}

export const payloadAdminOperationEndpoints: Endpoint[] = [
  {
    path: "/admin-operations/businesses",
    method: "get",
    handler: async (req) => {
      if (!requireSuperAdmin(req)) return Response.json({ error: "Forbidden" }, { status: 403 })
      try {
        return Response.json(await listBusinessOperations())
      } catch {
        return Response.json({ error: "Could not load business profiles." }, { status: 500 })
      }
    },
  },
  {
    path: "/admin-operations/businesses",
    method: "post",
    handler: async (req) => {
      if (!requireSuperAdmin(req)) return Response.json({ error: "Forbidden" }, { status: 403 })
      try {
        return await saveBusiness(req)
      } catch {
        return Response.json({ error: "Could not save the business profile." }, { status: 500 })
      }
    },
  },
  {
    path: "/admin-operations/issues",
    method: "get",
    handler: async (req) => {
      if (!requireSuperAdmin(req)) return Response.json({ error: "Forbidden" }, { status: 403 })
      try {
        return Response.json({ tickets: await listTickets({ includeAll: true }) })
      } catch {
        return Response.json({ error: "Could not load support issues." }, { status: 500 })
      }
    },
  },
  {
    path: "/admin-operations/issues",
    method: "patch",
    handler: async (req) => {
      const operator = requireSuperAdmin(req)
      if (!operator) return Response.json({ error: "Forbidden" }, { status: 403 })
      try {
        if (!req.json) return Response.json({ error: "Request body is unavailable." }, { status: 400 })
        const body = (await req.json()) as Record<string, unknown>
        const ticket = await updateTicket({
          id: body.id,
          status: body.status,
          adminNote: body.adminNote,
          adminName: operator.email || "Payload admin",
          userId: "",
          isSuperAdmin: true,
        })
        return Response.json({ success: true, ticket })
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not update support issue."
        return Response.json({ error: message }, { status: 400 })
      }
    },
  },
  {
    path: "/admin-operations/datasets",
    method: "post",
    handler: async (req) => {
      if (!requireSuperAdmin(req)) return Response.json({ error: "Forbidden" }, { status: 403 })
      try {
        return await uploadDataset(req)
      } catch {
        return Response.json({ error: "Could not upload the dataset." }, { status: 500 })
      }
    },
  },
]
