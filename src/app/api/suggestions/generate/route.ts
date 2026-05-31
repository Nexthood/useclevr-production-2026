import { auth } from "@/lib/auth"
import { getDb } from "@/lib/db"
import { datasets, appSettings } from "@/lib/db/schema"
import type { DatasetRecord } from "@/lib/data/dataset-intelligence"
import { buildDatasetIntelligence, generateSuggestions } from "@/lib/data/dataset-intelligence"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { datasetId } = await request.json()

  if (!datasetId) {
    return NextResponse.json({ error: "Dataset ID required" }, { status: 400 })
  }

  const db = getDb()
  if (!db) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 500 })
  }

  try {
    const dataset = await db.query.datasets.findFirst({
      where: eq(datasets.id, datasetId),
    })

    if (!dataset) {
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 })
    }

    const data = (dataset.data as Record<string, unknown>[]) || []

    if (data.length === 0) {
      return NextResponse.json({ suggestions: [] })
    }

    const intelligence = buildDatasetIntelligence(data as DatasetRecord[])
    const newSuggestions = generateSuggestions(intelligence)

    // Save to appSettings
    const savedSuggestions = newSuggestions.map((s) => ({
      id: `sug_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      text: s,
      createdAt: new Date().toISOString(),
    }))

    await db
      .insert(appSettings)
      .values({
        key: "suggestions_global",
        value: savedSuggestions,
      })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: savedSuggestions },
      })

    return NextResponse.json({ suggestions: savedSuggestions })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate suggestions" },
      { status: 500 }
    )
  }
}