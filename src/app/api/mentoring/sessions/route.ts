import { recordMentoringTrace } from "@/lib/ai/ai-trace"
import { auth } from "@/lib/auth/auth"
import { listMentoringSessions, createMentoringSession } from "@/lib/mentoring/mentoring-store"
import { mentoringSessionCreateSchema, validateOrError } from "@/lib/validation"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

function getUser(session: any) {
  const userId = session?.user?.id
  const userEmail = session?.user?.email || ""
  if (!userId || !userEmail) return null
  return { id: userId, email: userEmail }
}

export async function GET() {
  const user = getUser(await auth())
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const sessions = await listMentoringSessions(user.id)
  return NextResponse.json({ sessions })
}

export async function POST(request: NextRequest) {
  const user = getUser(await auth())
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const validation = validateOrError(mentoringSessionCreateSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const session = await createMentoringSession({
      userId: user.id,
      type: validation.data.type,
      scheduledAt: validation.data.scheduledAt,
      mentorId: validation.data.mentorId,
      mentorName: validation.data.mentorName,
      mentorExpertise: validation.data.mentorExpertise,
      price: validation.data.price,
    })

    recordMentoringTrace({
      userId: user.id,
      sessionType: validation.data.type,
      mentorName: validation.data.mentorName || null,
      action: "booked",
    })

    return NextResponse.json({ session }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create session." },
      { status: 400 }
    )
  }
}
