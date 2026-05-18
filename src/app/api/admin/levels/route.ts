import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getBillingSettings, saveBillingSettings } from "@/lib/billing/settings-store"

async function requireSuperAdmin() {
  const session = await auth()
  return session?.user?.role === "superadmin"
}

export async function GET() {
  if (!(await requireSuperAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const settings = await getBillingSettings()
  return NextResponse.json({ levels: settings.levels ?? [] })
}

export async function POST(request: NextRequest) {
  if (!(await requireSuperAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const body = await request.json().catch(() => null)
  if (!body?.levels || !Array.isArray(body.levels)) {
    return NextResponse.json({ error: "Expected { levels: [...] }" }, { status: 400 })
  }
  const current = await getBillingSettings()
  const next = await saveBillingSettings({ ...current, levels: body.levels })
  return NextResponse.json({ success: true, settings: next })
}
