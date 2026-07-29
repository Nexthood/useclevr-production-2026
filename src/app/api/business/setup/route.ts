import { auth } from "@/lib/auth/auth"
import { requireBuiltinUserRecord } from "@/lib/auth/builtin-user-store"
import { type CompanySetupPayload, emptyCompanySetupPayload } from "@/lib/business/company-setup"
import { getCompanySetup, saveCompanySetup } from "@/lib/business/company-setup-store"
import { revalidateBusinessProfileDependents } from "@/lib/business/business-profile-revalidation"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  await requireBuiltinUserRecord(session.user.id)

  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get("businessId") || undefined

  const payload = await getCompanySetup(session.user.id, businessId)
  return NextResponse.json({ payload }, { headers: { "Cache-Control": "no-store" } })
}

export async function PUT(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  await requireBuiltinUserRecord(session.user.id)

  let body: { payload?: CompanySetupPayload; businessId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body.payload) {
    return NextResponse.json({ error: "Missing payload" }, { status: 400 })
  }

  const ok = await saveCompanySetup(session.user.id, body.payload, body.businessId)
  if (!ok) {
    return NextResponse.json({ error: "Failed to save setup" }, { status: 500 })
  }

  revalidateBusinessProfileDependents()

  const payload = await getCompanySetup(session.user.id, body.businessId)
  return NextResponse.json({ success: true, payload }, { headers: { "Cache-Control": "no-store" } })
}

export async function DELETE(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  await requireBuiltinUserRecord(session.user.id)

  const empty = emptyCompanySetupPayload()
  const ok = await saveCompanySetup(session.user.id, empty)
  if (!ok) {
    return NextResponse.json({ error: "Failed to reset setup" }, { status: 500 })
  }

  revalidateBusinessProfileDependents()

  const payload = await getCompanySetup(session.user.id)
  return NextResponse.json({ success: true, payload }, { headers: { "Cache-Control": "no-store" } })
}
