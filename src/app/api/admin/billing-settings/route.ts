import { requireSuperAdmin } from "@/lib/auth/require-session";
import { getBillingSettings, saveBillingSettings } from "@/lib/billing/settings-store";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function GET() {
  const auth = await requireSuperAdmin()
  if (!auth.success) return auth.error

  return NextResponse.json(await getBillingSettings())
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin()
  if (!auth.success) return auth.error

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: "Invalid settings payload" }, { status: 400 })
  }

  const settings = await saveBillingSettings(body)
  return NextResponse.json({ success: true, settings })
}
