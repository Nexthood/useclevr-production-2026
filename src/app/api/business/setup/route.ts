import { auth } from "@/lib/auth/auth"
import { type CompanySetupPayload, emptyCompanySetupPayload } from "@/lib/business/company-setup"
import { getCompanySetup, saveCompanySetup } from "@/lib/business/company-setup-store"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get("businessId") || undefined

  const payload = await getCompanySetup(session.user.id, businessId)
  return NextResponse.json({ payload })
}

export async function PUT(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

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

  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const empty = emptyCompanySetupPayload()
  const ok = await saveCompanySetup(session.user.id, empty)
  if (!ok) {
    return NextResponse.json({ error: "Failed to reset setup" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
