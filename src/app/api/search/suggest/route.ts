import { auth } from "@/lib/auth/auth"
import { searchSuggest } from "@/lib/search/app-search"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ results: [] })
  }

  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get("q") || ""

  if (!query.trim() || query.trim().length < 2) {
    return NextResponse.json({ results: [] })
  }

  const results = await searchSuggest(query, session.user.role)

  return NextResponse.json({ results })
}
