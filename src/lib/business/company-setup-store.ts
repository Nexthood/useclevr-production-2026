import { and, eq } from "drizzle-orm"
import { randomUUID } from "node:crypto"

import { getDb } from "@/lib/db"
import { businesses, businessProfiles } from "@/lib/db/schema"
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
    const organization = await resolveBusinessProfileOrganization(userId, businessId)
    if (!organization) return emptyCompanySetupPayload()

    const [profile] = await db
      .select({ payload: businessProfiles.payload })
      .from(businessProfiles)
      .where(eq(businessProfiles.organizationId, organization.id))
      .limit(1)

    if (profile?.payload && typeof profile.payload === "object" && Object.keys(profile.payload as object).length > 0) {
      return normalizeCompanySetupPayload(profile.payload as Partial<CompanySetupPayload>)
    }

    if (organization.companySetup && typeof organization.companySetup === "object" && Object.keys(organization.companySetup as object).length > 0) {
      return normalizeCompanySetupPayload(organization.companySetup as Partial<CompanySetupPayload>)
    }

    return emptyCompanySetupPayload()
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
    const organization = await resolveBusinessProfileOrganization(userId, businessId, true)
    if (!organization) return false

    const now = new Date()
    await db
      .insert(businessProfiles)
      .values({
        id: `business_profile_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
        organizationId: organization.id,
        payload: fullPayload as unknown as Record<string, unknown>,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: businessProfiles.organizationId,
        set: {
          payload: fullPayload as unknown as Record<string, unknown>,
          updatedAt: now,
        },
      })

    await db
      .update(businesses)
      .set({
        status: computed.completed ? "active" : "draft",
        updatedAt: now,
      })
      .where(eq(businesses.id, organization.id))

    if (organization.companySetup && typeof organization.companySetup === "object" && Object.keys(organization.companySetup as object).length > 0) {
      await db.update(businesses).set({ companySetup: {}, updatedAt: now }).where(eq(businesses.id, organization.id))
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

async function resolveBusinessProfileOrganization(
  userId: string,
  businessId?: string,
  createPrimary = false,
): Promise<{ id: string; companySetup: unknown } | null> {
  const db = getDb()
  if (!db) return null

  const conditions = [eq(businesses.userId, userId)]
  if (businessId) {
    conditions.push(eq(businesses.id, businessId))
  } else {
    conditions.push(eq(businesses.isPrimary, true))
  }

  const [organization] = await db
    .select({ id: businesses.id, companySetup: businesses.companySetup })
    .from(businesses)
    .where(and(...conditions))
    .limit(1)

  if (organization || businessId || !createPrimary) return organization ?? null

  const [created] = await db
    .insert(businesses)
    .values({
      id: `business_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
      userId,
      name: "Primary business profile",
      status: "draft",
      isPrimary: true,
      localeSettings: {},
      invoiceSettings: {},
      companySetup: {},
    })
    .returning()

  return created ? { id: created.id, companySetup: created.companySetup } : null
}
