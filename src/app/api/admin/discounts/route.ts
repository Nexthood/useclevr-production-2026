import { requireSuperAdmin } from "@/lib/auth/require-session";
import { getBillingSettings, saveBillingSettings } from "@/lib/billing/settings-store";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function GET() {
  const auth = await requireSuperAdmin()
  if (!auth.success) return auth.error

  const settings = await getBillingSettings()
  return NextResponse.json({ discountRules: settings.discountRules ?? [] })
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin()
  if (!auth.success) return auth.error

  const body = await request.json().catch(() => null)
  if (!body?.rules || !Array.isArray(body.rules)) {
    return NextResponse.json({ error: "Expected { rules: [...] }" }, { status: 400 })
  }
  const current = await getBillingSettings()
  const next = await saveBillingSettings({ ...current, discountRules: body.rules })
  return NextResponse.json({ success: true, settings: next })
}
