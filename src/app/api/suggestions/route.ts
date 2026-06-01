import { auth } from "@/lib/auth/auth"
import { getDb } from "@/lib/db"
import { datasets, appSettings } from "@/lib/db/schema"
import type { DatasetRecord } from "@/lib/data/dataset-intelligence"
import { buildDatasetIntelligence, generateSuggestions } from "@/lib/data/dataset-intelligence"
import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ suggestions: [] })
  }

  const db = getDb()
  if (!db) {
    return NextResponse.json({ suggestions: [] })
  }

  try {
    const userKey = `suggestions_${session.user.id}`
    const [setting] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, userKey))

    const suggestions = Array.isArray(setting?.value) ? setting.value : []

    return NextResponse.json({
      suggestions: suggestions.map((s: any) => ({
        id: s.id || `sug_${Date.now()}`,
        text: s.text,
        createdAt: s.createdAt || new Date().toISOString(),
      })),
    })
  } catch {
    return NextResponse.json({ suggestions: [] })
  }
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { suggestions } = await request.json()

  const db = getDb()
  if (!db) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 500 })
  }

  try {
    const savedSuggestions = (suggestions || []).map((s: string, i: number) => ({
      id: `sug_${Date.now()}_${i}`,
      text: s,
      createdAt: new Date().toISOString(),
    }))

    const userKey = `suggestions_${session.user.id}`

    await db
      .insert(appSettings)
      .values({
        key: userKey,
        value: savedSuggestions,
      })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: savedSuggestions },
      })

    return NextResponse.json({ suggestions: savedSuggestions })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save suggestions" },
      { status: 500 }
    )
  }
}
