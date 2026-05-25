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

export async function POST(request: Request) {
  const session = await auth()
  const userId = session?.user?.id

  if (!userId || isBuiltinUserId(userId)) {
    return NextResponse.json({ ok: true })
  }

  let body: { action?: string; path?: string } = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  if (body.action === "page_visited") {
    const path = typeof body.path === "string" && body.path.startsWith("/app") ? body.path : "/app"
    await recordActivity({
      userId,
      userEmail: session.user.email,
      type: "page_visited",
      feature: "onboarding",
      title: "Page visited",
      description: "Dashboard page opened for setup progress.",
      metadata: { path },
    })

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
