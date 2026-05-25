import { auth } from "@/lib/auth"
import { isBuiltinUserId } from "@/lib/auth/builtin-users"
import { recordActivity } from "@/lib/activity/activity-store"
import { getOnboardingStatus } from "@/lib/onboarding/status"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId || isBuiltinUserId(userId)) {
    return NextResponse.json(await getOnboardingStatus(null))
  }

  return NextResponse.json(await getOnboardingStatus(userId))
}

export async function POST() {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId || isBuiltinUserId(userId)) {
    return NextResponse.json({ ok: true })
  }

  await recordActivity({
    userId,
    userEmail: session.user.email,
    type: "onboarding_seen",
    feature: "onboarding",
    title: "Onboarding opened",
    description: "The dashboard onboarding process was shown.",
  })

  return NextResponse.json({ ok: true })
}
