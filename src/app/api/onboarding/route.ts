import { auth } from "@/lib/auth/auth"
import { requireBuiltinUserRecord } from "@/lib/auth/builtin-user-store"
import { getOnboardingStatus } from "@/lib/onboarding/status"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) {
    return NextResponse.json(await getOnboardingStatus(null))
  }

  await requireBuiltinUserRecord(userId)
  return NextResponse.json(await getOnboardingStatus(userId))
}

export async function POST() {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId) return NextResponse.json({ ok: true })

  await requireBuiltinUserRecord(userId)
  return NextResponse.json({ ok: true })
}
