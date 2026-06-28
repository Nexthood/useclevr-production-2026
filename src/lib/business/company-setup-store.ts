import { and, eq } from "drizzle-orm"
import { randomUUID } from "node:crypto"

import { getDb } from "@/lib/db"
import { businesses } from "@/lib/db/schema"
import { debugError } from "@/lib/utils/debug"
import { businessCompletion, getPrimaryBusinessDetails } from "./business-store"
import {
  type CompanySetupPayload,
  buildSetupStatus,
  emptyCompanySetupPayload,
  normalizeCompanySetupPayload,
} from "./company-setup"

export async function getCompanySetup(userId: string, businessId?: string): Promise<CompanySetupPayload> {
  const db = getDb()
  if (!db) return emptyCompanySetupPayload()

  try {
    const conditions = [eq(businesses.userId, userId)]
    if (businessId) {
      conditions.push(eq(businesses.id, businessId))
    } else {
      conditions.push(eq(businesses.isPrimary, true))
    }

    const [row] = await db
      .select({ companySetup: businesses.companySetup })
      .from(businesses)
      .where(and(...conditions))
      .limit(1)

    if (!row?.companySetup || typeof row.companySetup !== "object" || Object.keys(row.companySetup as object).length === 0) {
      return emptyCompanySetupPayload()
    }

    return normalizeCompanySetupPayload(row.companySetup as Partial<CompanySetupPayload>)
  } catch {
    return emptyCompanySetupPayload()
  }
}

export async function saveCompanySetup(
  userId: string,
  payload: CompanySetupPayload,
  businessId?: string,
): Promise<boolean> {
  const db = getDb()
  if (!db) return false

  const normalizedPayload = normalizeCompanySetupPayload(payload)
  const computed = buildSetupStatus(normalizedPayload)
  const fullPayload = { ...normalizedPayload, setupStatus: computed }

  try {
    const conditions = [eq(businesses.userId, userId)]
    if (businessId) {
      conditions.push(eq(businesses.id, businessId))
    } else {
      conditions.push(eq(businesses.isPrimary, true))
    }

    const updated = await db
      .update(businesses)
      .set({
        companySetup: fullPayload as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(and(...conditions))
      .returning()

    if (updated.length === 0 && !businessId) {
      await db.insert(businesses).values({
        id: `business_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
        userId,
        name: payload.companyInfo.companyName || "Primary business profile",
        status: "draft",
        isPrimary: true,
        localeSettings: {},
        invoiceSettings: {},
        companySetup: fullPayload as unknown as Record<string, unknown>,
      })
    }

    return true
  } catch (error) {
    debugError("[BUSINESS] Company setup save failed:", error)
    return false
  }
}

export async function getSetupStatus(
  userId: string,
  businessId?: string,
) {
  const payload = await getCompanySetup(userId, businessId)
  if (businessId) return payload.setupStatus

  try {
    const details = await getPrimaryBusinessDetails(userId)
    const profileCompletion = businessCompletion(details)
    if (profileCompletion > payload.setupStatus.setupAccuracy) {
      return {
        ...payload.setupStatus,
        setupAccuracy: profileCompletion,
        completed: profileCompletion >= 100,
        missingFields: profileCompletion >= 100 ? [] : payload.setupStatus.missingFields,
      }
    }
  } catch {
    return payload.setupStatus
  }

  return payload.setupStatus
}
