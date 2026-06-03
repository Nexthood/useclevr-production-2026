import { NextResponse } from "next/server"
import { listExpertMentors } from "@/lib/mentoring/mentoring-store"

export async function GET() {
  const experts = listExpertMentors()
  return NextResponse.json({ experts })
}
