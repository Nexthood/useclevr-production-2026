import { auth } from "@/lib/auth/auth"
import { updateMentoringSession } from "@/lib/mentoring/mentoring-store"
import { mentoringSessionUpdateSchema, validateOrError } from "@/lib/validation"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

function getUser(session: any) {
  const userId = session?.user?.id
  const userEmail = session?.user?.email || ""
  if (!userId || !userEmail) return null
  return { id: userId, email: userEmail }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUser(await auth())
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()
    const validation = validateOrError(mentoringSessionUpdateSchema, { ...body, id })
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const session = await updateMentoringSession({
      id: validation.data.id,
      userId: user.id,
      status: validation.data.status,
      notes: validation.data.notes,
    })

    return NextResponse.json({ session })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update session."
    const status = message === "Session not found." ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
