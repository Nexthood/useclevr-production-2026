import { auth } from "@/lib/auth/auth"
import { searchApp } from "@/lib/search/app-search"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get("q") || ""

  if (!query.trim()) {
    return NextResponse.json({ results: [] })
  }

  const results = await searchApp({
    query,
    userId: session.user.id,
    role: session.user.role,
  })

  return NextResponse.json({ results })
}
