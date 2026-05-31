import { requireSuperAdmin } from "@/lib/auth/require-session";
import { getBillingSettings, saveBillingSettings } from "@/lib/billing/settings-store";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function GET() {
  const auth = await requireSuperAdmin()
  if (!auth.success) return auth.error

  const settings = await getBillingSettings()
  return NextResponse.json({ levels: settings.levels ?? [] })
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin()
  if (!auth.success) return auth.error

  const body = await request.json().catch(() => null)
  if (!body?.levels || !Array.isArray(body.levels)) {
    return NextResponse.json({ error: "Expected { levels: [...] }" }, { status: 400 })
  }
  const current = await getBillingSettings()
  const next = await saveBillingSettings({ ...current, levels: body.levels })
  return NextResponse.json({ success: true, settings: next })
}
