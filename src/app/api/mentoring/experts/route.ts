import { NextResponse } from "next/server"
import { listExpertMentors } from "@/lib/mentoring/mentoring-store"

function isMentoringEnabled() {
  return false
}

export async function GET() {
  if (!isMentoringEnabled()) {
    return NextResponse.json({ error: "Mentoring is unavailable." }, { status: 404 })
  }

  const experts = listExpertMentors()
  return NextResponse.json({ experts })
}
