import { auth } from "@/lib/auth";
import { getBillingSettings, saveBillingSettings } from "@/lib/billing/settings-store";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

async function requireSuperAdmin() {
  const session = await auth()
  return session?.user?.role === "superadmin"
}

export async function GET() {
  if (!(await requireSuperAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  return NextResponse.json(await getBillingSettings())
}

export async function POST(request: NextRequest) {
  if (!(await requireSuperAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: "Invalid settings payload" }, { status: 400 })
  }

  const settings = await saveBillingSettings(body)
  return NextResponse.json({ success: true, settings })
}
