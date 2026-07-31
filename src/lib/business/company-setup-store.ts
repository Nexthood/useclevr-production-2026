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
  const startedAt = Date.now()
  const db = getDb()
  if (!db) {
    logBusinessProfileDiagnostic("getCompanySetup.finished", {
      status: "database_unavailable",
      userId,
      businessId,
      durationMs: Date.now() - startedAt,
    })
    return emptyCompanySetupPayload()
  }

  try {
    const organization = await resolveBusinessProfileOrganization(userId, businessId)
    if (!organization) {
      logBusinessProfileDiagnostic("getCompanySetup.finished", {
        status: "missing_organization",
        userId,
        businessId,
        organizationId: null,
        durationMs: Date.now() - startedAt,
      })
      return emptyCompanySetupPayload()
    }

    const [profile] = await db
      .select({ payload: businessProfiles.payload })
      .from(businessProfiles)
      .where(eq(businessProfiles.organizationId, organization.id))
      .limit(1)

    if (profile?.payload && typeof profile.payload === "object" && Object.keys(profile.payload as object).length > 0) {
      const payload = normalizeCompanySetupPayload(profile.payload as Partial<CompanySetupPayload>)
      logBusinessProfileDiagnostic("getCompanySetup.finished", {
        status: "profile_loaded",
        userId,
        businessId,
        organizationId: organization.id,
        source: "business_profile",
        responseBody: summarizeCompanySetupPayload(payload),
        durationMs: Date.now() - startedAt,
      })
      return payload
    }

    if (organization.companySetup && typeof organization.companySetup === "object" && Object.keys(organization.companySetup as object).length > 0) {
      const payload = normalizeCompanySetupPayload(organization.companySetup as Partial<CompanySetupPayload>)
      logBusinessProfileDiagnostic("getCompanySetup.finished", {
        status: "profile_loaded",
        userId,
        businessId,
        organizationId: organization.id,
        source: "Business.companySetup",
        responseBody: summarizeCompanySetupPayload(payload),
        durationMs: Date.now() - startedAt,
      })
      return payload
    }

    logBusinessProfileDiagnostic("getCompanySetup.finished", {
      status: "null_query_result",
      userId,
      businessId,
      organizationId: organization.id,
      durationMs: Date.now() - startedAt,
    })
    return emptyCompanySetupPayload()
  } catch (error) {
    logBusinessProfileDiagnostic("getCompanySetup.failed", {
      status: "repository_exception",
      userId,
      businessId,
      durationMs: Date.now() - startedAt,
      error: serializeErrorForBusinessProfileLogs(error),
      sqlQuery: [
        'select "id", "companySetup" from "Business" where "userId" = $userId and ("id" = $businessId or "isPrimary" = true) limit 1',
        'select "payload" from "business_profile" where "organization_id" = $organizationId limit 1',
      ],
    })
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

function logBusinessProfileDiagnostic(event: string, details: Record<string, unknown>) {
  console.warn("[BUSINESS_PROFILE_DIAGNOSTIC]", JSON.stringify({ event, ...details }))
}

function serializeErrorForBusinessProfileLogs(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause instanceof Error
        ? { name: error.cause.name, message: error.cause.message, stack: error.cause.stack }
        : error.cause ? String(error.cause) : undefined,
    }
  }
  return { message: String(error) }
}

function summarizeCompanySetupPayload(payload: CompanySetupPayload) {
  return {
    setupStatus: {
      completed: payload.setupStatus.completed,
      setupAccuracy: payload.setupStatus.setupAccuracy,
      missingFieldCount: payload.setupStatus.missingFields.length,
    },
    normalizedProfile: {
      taxCountry: payload.companyInfo.taxResidenceCountry || null,
      currency: payload.currencySettings.primaryCurrency || null,
      fiscalYearStart: payload.companyInfo.fiscalYearStart || null,
      fiscalYearEnd: payload.companyInfo.fiscalYearEnd || null,
      vatSalesTaxCount: payload.taxSettings.taxEntries.length,
      payrollCount: payload.employerContributions.length,
      fixedCostsCount: payload.fixedCosts.length,
    },
  }
}
