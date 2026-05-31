import { auth } from "@/lib/auth"
import type { Session } from "next-auth"
import { NextResponse } from "next/server"

type SessionSuccess = { success: true; session: Session; userId: string }
type SessionError = { success: false; error: NextResponse }
type SessionResult = SessionSuccess | SessionError

export async function requireSession(): Promise<SessionResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return {
      success: false,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }
  return { success: true, session, userId: session.user.id }
}

type SuperAdminResult = SessionResult | { success: false; error: NextResponse<{ error: string }> }

export async function requireSuperAdmin(): Promise<SuperAdminResult> {
  const result = await requireSession()
  if (!result.success) return result
  if (result.session.user.role !== "superadmin") {
    return {
      success: false,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }
  }
  return result
}
