import { auth } from "@/lib/auth/auth"
import { requireBuiltinUserRecord } from "@/lib/auth/builtin-user-store"
import { type CompanySetupPayload, emptyCompanySetupPayload } from "@/lib/business/company-setup"
import { getCompanySetup, saveCompanySetup } from "@/lib/business/company-setup-store"
import { revalidateBusinessProfileDependents } from "@/lib/business/business-profile-revalidation"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  const startedAt = Date.now()
  const requestUrl = request.url
  try {
    const session = await auth()
    if (!session?.user?.id) {
      const responseBody = { error: "Unauthorized" }
      logBusinessSetupApiDiagnostic("GET.finished", {
        requestUrl,
        authenticatedUserId: null,
        organizationId: null,
        requestPayload: null,
        responseStatus: 401,
        responseBody,
        durationMs: Date.now() - startedAt,
      })
      return NextResponse.json(responseBody, { status: 401 })
    }
    await requireBuiltinUserRecord(session.user.id)

    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get("businessId") || undefined

    const payload = await getCompanySetup(session.user.id, businessId)
    const responseBody = { payload }
    logBusinessSetupApiDiagnostic("GET.finished", {
      requestUrl,
      authenticatedUserId: session.user.id,
      organizationId: businessId ?? null,
      requestPayload: { businessId: businessId ?? null },
      responseStatus: 200,
      responseBody: summarizeBusinessSetupApiBody(responseBody),
      durationMs: Date.now() - startedAt,
    })
    return NextResponse.json(responseBody, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    const responseBody = { error: "Could not load Business Profile." }
    logBusinessSetupApiDiagnostic("GET.failed", {
      requestUrl,
      authenticatedUserId: null,
      organizationId: null,
      requestPayload: null,
      responseStatus: 500,
      responseBody,
      durationMs: Date.now() - startedAt,
      error: serializeErrorForBusinessSetupLogs(error),
    })
    return NextResponse.json(responseBody, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const startedAt = Date.now()
  const requestUrl = request.url
  let sessionUserId: string | null = null
  let body: { payload?: CompanySetupPayload; businessId?: string }
  try {
    const session = await auth()
    sessionUserId = session?.user?.id ?? null
    if (!sessionUserId) {
      const responseBody = { error: "Unauthorized" }
      logBusinessSetupApiDiagnostic("PUT.finished", {
        requestUrl,
        authenticatedUserId: null,
        organizationId: null,
        requestPayload: null,
        responseStatus: 401,
        responseBody,
        durationMs: Date.now() - startedAt,
      })
      return NextResponse.json(responseBody, { status: 401 })
    }
    await requireBuiltinUserRecord(sessionUserId)

    body = await request.json()
  } catch (error) {
    const responseBody = { error: "Invalid JSON body" }
    logBusinessSetupApiDiagnostic("PUT.failed", {
      requestUrl,
      authenticatedUserId: sessionUserId,
      organizationId: null,
      requestPayload: null,
      responseStatus: 400,
      responseBody,
      durationMs: Date.now() - startedAt,
      error: serializeErrorForBusinessSetupLogs(error),
    })
    return NextResponse.json(responseBody, { status: 400 })
  }

  if (!body.payload) {
    const responseBody = { error: "Missing payload" }
    logBusinessSetupApiDiagnostic("PUT.finished", {
      requestUrl,
      authenticatedUserId: sessionUserId,
      organizationId: body.businessId ?? null,
      requestPayload: summarizeBusinessSetupPayload(body.payload, body.businessId),
      responseStatus: 400,
      responseBody,
      durationMs: Date.now() - startedAt,
    })
    return NextResponse.json(responseBody, { status: 400 })
  }

  try {
    const ok = await saveCompanySetup(sessionUserId, body.payload, body.businessId)
    if (!ok) {
      const responseBody = { error: "Failed to save setup" }
      logBusinessSetupApiDiagnostic("PUT.finished", {
        requestUrl,
        authenticatedUserId: sessionUserId,
        organizationId: body.businessId ?? null,
        requestPayload: summarizeBusinessSetupPayload(body.payload, body.businessId),
        responseStatus: 500,
        responseBody,
        durationMs: Date.now() - startedAt,
      })
      return NextResponse.json(responseBody, { status: 500 })
    }

    revalidateBusinessProfileDependents()

    const payload = await getCompanySetup(sessionUserId, body.businessId)
    const responseBody = { success: true, payload }
    logBusinessSetupApiDiagnostic("PUT.finished", {
      requestUrl,
      authenticatedUserId: sessionUserId,
      organizationId: body.businessId ?? null,
      requestPayload: summarizeBusinessSetupPayload(body.payload, body.businessId),
      responseStatus: 200,
      responseBody: summarizeBusinessSetupApiBody(responseBody),
      durationMs: Date.now() - startedAt,
    })
    return NextResponse.json(responseBody, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    const responseBody = { error: "Failed to save setup" }
    logBusinessSetupApiDiagnostic("PUT.failed", {
      requestUrl,
      authenticatedUserId: sessionUserId,
      organizationId: body.businessId ?? null,
      requestPayload: summarizeBusinessSetupPayload(body.payload, body.businessId),
      responseStatus: 500,
      responseBody,
      durationMs: Date.now() - startedAt,
      error: serializeErrorForBusinessSetupLogs(error),
    })
    return NextResponse.json(responseBody, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const startedAt = Date.now()
  const requestUrl = request.url
  let sessionUserId: string | null = null
  try {
    const session = await auth()
    sessionUserId = session?.user?.id ?? null
    if (!sessionUserId) {
      const responseBody = { error: "Unauthorized" }
      logBusinessSetupApiDiagnostic("DELETE.finished", {
        requestUrl,
        authenticatedUserId: null,
        organizationId: null,
        requestPayload: null,
        responseStatus: 401,
        responseBody,
        durationMs: Date.now() - startedAt,
      })
      return NextResponse.json(responseBody, { status: 401 })
    }
    await requireBuiltinUserRecord(sessionUserId)

    const empty = emptyCompanySetupPayload()
    const ok = await saveCompanySetup(sessionUserId, empty)
    if (!ok) {
      const responseBody = { error: "Failed to reset setup" }
      logBusinessSetupApiDiagnostic("DELETE.finished", {
        requestUrl,
        authenticatedUserId: sessionUserId,
        organizationId: null,
        requestPayload: summarizeBusinessSetupPayload(empty),
        responseStatus: 500,
        responseBody,
        durationMs: Date.now() - startedAt,
      })
      return NextResponse.json(responseBody, { status: 500 })
    }

    revalidateBusinessProfileDependents()

    const payload = await getCompanySetup(sessionUserId)
    const responseBody = { success: true, payload }
    logBusinessSetupApiDiagnostic("DELETE.finished", {
      requestUrl,
      authenticatedUserId: sessionUserId,
      organizationId: null,
      requestPayload: summarizeBusinessSetupPayload(empty),
      responseStatus: 200,
      responseBody: summarizeBusinessSetupApiBody(responseBody),
      durationMs: Date.now() - startedAt,
    })
    return NextResponse.json(responseBody, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    const responseBody = { error: "Failed to reset setup" }
    logBusinessSetupApiDiagnostic("DELETE.failed", {
      requestUrl,
      authenticatedUserId: sessionUserId,
      organizationId: null,
      requestPayload: null,
      responseStatus: 500,
      responseBody,
      durationMs: Date.now() - startedAt,
      error: serializeErrorForBusinessSetupLogs(error),
    })
    return NextResponse.json(responseBody, { status: 500 })
  }
}

function logBusinessSetupApiDiagnostic(event: string, details: Record<string, unknown>) {
  console.warn("[BUSINESS_PROFILE_API]", JSON.stringify({ event, ...details }))
}

function serializeErrorForBusinessSetupLogs(error: unknown) {
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

function summarizeBusinessSetupPayload(payload: CompanySetupPayload | undefined, businessId?: string) {
  if (!payload) return { businessId: businessId ?? null, hasPayload: false }
  return {
    businessId: businessId ?? null,
    hasPayload: true,
    setupStatus: {
      completed: payload.setupStatus?.completed ?? null,
      setupAccuracy: payload.setupStatus?.setupAccuracy ?? null,
    },
    profileFields: {
      taxCountry: payload.companyInfo?.taxResidenceCountry || null,
      currency: payload.currencySettings?.primaryCurrency || null,
      fiscalYearStart: payload.companyInfo?.fiscalYearStart || null,
      fiscalYearEnd: payload.companyInfo?.fiscalYearEnd || null,
      taxEntryCount: payload.taxSettings?.taxEntries?.length ?? 0,
      payrollEntryCount: payload.employerContributions?.length ?? 0,
      fixedCostCount: payload.fixedCosts?.length ?? 0,
    },
  }
}

function summarizeBusinessSetupApiBody(body: { payload?: CompanySetupPayload; success?: boolean; error?: string }) {
  return {
    success: body.success ?? undefined,
    error: body.error ?? undefined,
    payload: body.payload ? summarizeBusinessSetupPayload(body.payload) : undefined,
  }
}
