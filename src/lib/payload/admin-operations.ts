import { parseCSVString } from "@/lib/data/csvLoader"
import { getDb } from "@/lib/db"
import { businesses, datasetRows, datasets, users } from "@/lib/db/schema"
import { desc, eq } from "drizzle-orm"
import type { Endpoint, PayloadRequest } from "payload"

import {
  archiveBusiness,
  createBusiness,
  deleteBusiness,
  getBusinessById,
  listBusinesses,
  listBusinessEntities,
  restoreBusiness,
  updateBusiness,
} from "./admin-business-store"

import {
  deleteDataset,
  getDatasetById,
  getDatasetPreview,
  listDatasets,
  uploadDataset,
} from "./admin-dataset-store"

type CmsOperator = {
  email?: string | null
  role?: "base" | "superadmin"
}

function requireSuperAdmin(req: PayloadRequest) {
  const operator = req.user as CmsOperator | null
  if (!operator || operator.role !== "superadmin") return null
  return operator
}

function cleanText(value: unknown, maxLength = 1000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

export const payloadAdminOperationEndpoints: Endpoint[] = [
  // ─── BUSINESS ENDPOINTS ────────────────────────────────────────
  {
    path: "/admin-operations/businesses",
    method: "get",
    handler: async (req) => {
      if (!requireSuperAdmin(req)) return Response.json({ error: "Forbidden" }, { status: 403 })
      try {
        const data = await listBusinesses()
        return Response.json(data)
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
        if (!req.json) {
          return Response.json({ error: "Request body is unavailable." }, { status: 400 })
        }
        const body = (await req.json()) as Record<string, unknown>
        const id = cleanText(body.id, 160)

        if (id) {
          await updateBusiness(id, {
            name: cleanText(body.name, 255) || undefined,
            email: cleanText(body.email, 255) || undefined,
            industry: cleanText(body.industry, 255) || undefined,
            address: cleanText(body.address, 500) || undefined,
            website: cleanText(body.website, 500) || undefined,
            description: cleanText(body.description, 4000) || undefined,
            companyNumber: cleanText(body.companyNumber, 100) || undefined,
            status: typeof body.status === "string" ? body.status : undefined,
            userId: cleanText(body.userId, 160) || undefined,
          })
          return Response.json({ success: true, id })
        }

        const newId = await createBusiness({
          userId: cleanText(body.userId, 160),
          name: cleanText(body.name, 255),
          email: cleanText(body.email, 255) || undefined,
          industry: cleanText(body.industry, 255) || undefined,
          address: cleanText(body.address, 500) || undefined,
          website: cleanText(body.website, 500) || undefined,
          description: cleanText(body.description, 4000) || undefined,
          companyNumber: cleanText(body.companyNumber, 100) || undefined,
        })
        return Response.json({ success: true, id: newId })
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not save the business profile."
        return Response.json({ error: message }, { status: 500 })
      }
    },
  },
  {
    path: "/admin-operations/businesses/:id",
    method: "get",
    handler: async (req) => {
      if (!requireSuperAdmin(req)) return Response.json({ error: "Forbidden" }, { status: 403 })
      try {
        const { id } = req.routeParams || {}
        if (!id || typeof id !== "string") {
          return Response.json({ error: "Business ID is required." }, { status: 400 })
        }
        const business = await getBusinessById(id)
        return Response.json(business)
      } catch {
        return Response.json({ error: "Could not load the business profile." }, { status: 500 })
      }
    },
  },
  {
    path: "/admin-operations/businesses/:id/archive",
    method: "post",
    handler: async (req) => {
      if (!requireSuperAdmin(req)) return Response.json({ error: "Forbidden" }, { status: 403 })
      try {
        const { id } = req.routeParams || {}
        if (!id || typeof id !== "string") {
          return Response.json({ error: "Business ID is required." }, { status: 400 })
        }
        await archiveBusiness(id)
        return Response.json({ success: true })
      } catch (err) {
        return Response.json(
          { error: err instanceof Error ? err.message : "Could not archive the business." },
          { status: 500 },
        )
      }
    },
  },
  {
    path: "/admin-operations/businesses/:id/restore",
    method: "post",
    handler: async (req) => {
      if (!requireSuperAdmin(req)) return Response.json({ error: "Forbidden" }, { status: 403 })
      try {
        const { id } = req.routeParams || {}
        if (!id || typeof id !== "string") {
          return Response.json({ error: "Business ID is required." }, { status: 400 })
        }
        await restoreBusiness(id)
        return Response.json({ success: true })
      } catch (err) {
        return Response.json(
          { error: err instanceof Error ? err.message : "Could not restore the business." },
          { status: 500 },
        )
      }
    },
  },
  {
    path: "/admin-operations/businesses/:id",
    method: "delete",
    handler: async (req) => {
      if (!requireSuperAdmin(req)) return Response.json({ error: "Forbidden" }, { status: 403 })
      try {
        const { id } = req.routeParams || {}
        if (!id || typeof id !== "string") {
          return Response.json({ error: "Business ID is required." }, { status: 400 })
        }
        await deleteBusiness(id)
        return Response.json({ success: true })
      } catch (err) {
        return Response.json(
          { error: err instanceof Error ? err.message : "Could not delete the business." },
          { status: 500 },
        )
      }
    },
  },
  {
    path: "/admin-operations/businesses/:id/entities",
    method: "get",
    handler: async (req) => {
      if (!requireSuperAdmin(req)) return Response.json({ error: "Forbidden" }, { status: 403 })
      try {
        const { id } = req.routeParams || {}
        if (!id || typeof id !== "string") {
          return Response.json({ error: "Business ID is required." }, { status: 400 })
        }
        const entities = await listBusinessEntities(id)
        return Response.json({ entities })
      } catch {
        return Response.json({ error: "Could not load business entities." }, { status: 500 })
      }
    },
  },

  // ─── DATASET ENDPOINTS ─────────────────────────────────────────
  {
    path: "/admin-operations/datasets",
    method: "get",
    handler: async (req) => {
      if (!requireSuperAdmin(req)) return Response.json({ error: "Forbidden" }, { status: 403 })
      try {
        const data = await listDatasets()
        return Response.json(data)
      } catch {
        return Response.json({ error: "Could not load datasets." }, { status: 500 })
      }
    },
  },
  {
    path: "/admin-operations/datasets",
    method: "post",
    handler: async (req) => {
      if (!requireSuperAdmin(req)) return Response.json({ error: "Forbidden" }, { status: 403 })
      try {
        if (!req.formData) {
          return Response.json({ error: "Upload body is unavailable." }, { status: 400 })
        }
        const formData = await req.formData()
        const file = formData.get("file")
        const userId = cleanText(formData.get("userId"), 160)

        if (!(file instanceof File) || !userId) {
          return Response.json(
            { error: "Dashboard owner and CSV file are required." },
            { status: 400 },
          )
        }

        const result = await uploadDataset(file, userId)
        return Response.json({ success: true, dataset: result })
      } catch (err) {
        return Response.json(
          { error: err instanceof Error ? err.message : "Could not upload the dataset." },
          { status: 500 },
        )
      }
    },
  },
  {
    path: "/admin-operations/datasets/:id",
    method: "get",
    handler: async (req) => {
      if (!requireSuperAdmin(req)) return Response.json({ error: "Forbidden" }, { status: 403 })
      try {
        const { id } = req.routeParams || {}
        if (!id || typeof id !== "string") {
          return Response.json({ error: "Dataset ID is required." }, { status: 400 })
        }
        const dataset = await getDatasetById(id)
        if (!dataset) {
          return Response.json({ error: "Dataset was not found." }, { status: 404 })
        }
        return Response.json(dataset)
      } catch {
        return Response.json({ error: "Could not load the dataset." }, { status: 500 })
      }
    },
  },
  {
    path: "/admin-operations/datasets/:id",
    method: "delete",
    handler: async (req) => {
      if (!requireSuperAdmin(req)) return Response.json({ error: "Forbidden" }, { status: 403 })
      try {
        const { id } = req.routeParams || {}
        if (!id || typeof id !== "string") {
          return Response.json({ error: "Dataset ID is required." }, { status: 400 })
        }
        await deleteDataset(id)
        return Response.json({ success: true })
      } catch (err) {
        return Response.json(
          { error: err instanceof Error ? err.message : "Could not delete the dataset." },
          { status: 500 },
        )
      }
    },
  },
  {
    path: "/admin-operations/datasets/:id/preview",
    method: "get",
    handler: async (req) => {
      if (!requireSuperAdmin(req)) return Response.json({ error: "Forbidden" }, { status: 403 })
      try {
        const { id } = req.routeParams || {}
        if (!id || typeof id !== "string") {
          return Response.json({ error: "Dataset ID is required." }, { status: 400 })
        }
        const url = new URL(req.url || "", "http://localhost")
        const limit = Math.min(Number(url.searchParams.get("limit")) || 20, 100)
        const offset = Number(url.searchParams.get("offset")) || 0
        const rows = await getDatasetPreview(id, limit, offset)
        return Response.json({ rows, limit, offset })
      } catch {
        return Response.json({ error: "Could not load dataset preview." }, { status: 500 })
      }
    },
  },
]
