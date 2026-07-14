import { auth } from "@/lib/auth/auth"
import { isSuperAdminUserId } from "@/lib/auth/builtin-users"
import { listAllActivities, listUserActivities } from "@/lib/activity/activity-store"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const limit = Number(url.searchParams.get("limit") ?? "20")
  const scope = url.searchParams.get("scope")
  const role = String(session.user.role ?? "")
  const isSuperAdmin = role === "superadmin" || role === "admin" || isSuperAdminUserId(session.user.id)

  const activities =
    scope === "all" && isSuperAdmin
      ? await listAllActivities(limit)
      : await listUserActivities(session.user.id, limit)

  return NextResponse.json({ activities })
}
