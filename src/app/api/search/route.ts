import { auth } from "@/lib/auth"
import { getDb } from "@/lib/db"
import { datasets } from "@/lib/db/schema"
import { ilike, or } from "drizzle-orm"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

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

  const db = getDb()
  if (!db) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 500 })
  }

  const results = await db
    .select({ id: datasets.id, name: datasets.name })
    .from(datasets)
    .where(
      or(
        ilike(datasets.name, `%${query}%`),
        ilike(datasets.fileName, `%${query}%`)
      )
    )
    .limit(20)

  return NextResponse.json({
    results: results.map((r) => ({
      id: r.id,
      type: "dataset",
      title: r.name,
    })),
  })
}