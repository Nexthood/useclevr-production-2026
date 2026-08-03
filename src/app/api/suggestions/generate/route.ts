import { v4 as uuidv4 } from "uuid"
import { auth } from "@/lib/auth/auth"
import { prebookkeepingSuggestedQuestions } from "@/lib/accountancy/prebookkeeping-ai-assistant"
import { getDb } from "@/lib/db"
import { datasets, appSettings, datasetRows } from "@/lib/db/schema"
import { availableAnalyticalSuggestions } from "@/lib/data/analytical-intents"
import { resolveDatasetType } from "@/lib/data/dataset-category"
import type { DatasetKind, DatasetRecord } from "@/lib/data/dataset-intelligence"
import {
  buildDatasetIntelligence,
  detectDatasetTypeFromColumns,
  fallbackSuggestionsForDatasetType,
  generateSuggestions,
} from "@/lib/data/dataset-intelligence"
import { and, eq } from "drizzle-orm"
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
      where: and(eq(datasets.id, datasetId), eq(datasets.userId, session.user.id)),
    })

    if (!dataset) {
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 })
    }

    const datasetKey = `suggestions_dataset_v3_${datasetId}`
    const [cached] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, datasetKey))

    const cachedSuggestions = Array.isArray(cached?.value) ? cached.value : []
    if (cachedSuggestions.length >= 10) {
      return NextResponse.json({
        suggestions: cachedSuggestions,
        datasetId,
        datasetName: dataset.name,
        cached: true,
      })
    }

    let data = (dataset.data as Record<string, unknown>[]) || []
    if (data.length === 0) {
      const rows = await db.query.datasetRows.findMany({
        where: eq(datasetRows.datasetId, datasetId),
        columns: { data: true },
        orderBy: (rows, { asc }) => [asc(rows.rowIndex)],
        limit: 1000,
      })
      data = rows.map((row) => row.data as Record<string, unknown>)
    }

    const columns = Array.isArray(dataset.columns) ? dataset.columns : []
    const moduleDatasetType = resolveDatasetType(dataset.datasetType, dataset.analysis)
    const intelligenceDatasetType = detectDatasetTypeFromColumns(columns, dataset.name)
    const safeSuggestions = moduleDatasetType === "prebookkeeping"
      ? prebookkeepingSuggestedQuestions
      : buildStandardSuggestions({
          datasetId,
          datasetType: intelligenceDatasetType,
          columns: columns.length > 0 ? columns : Object.keys(data[0] || {}),
          rows: data,
          datasetName: dataset.name,
        })

    const savedSuggestions = safeSuggestions.map((s) => ({
      id: `sug_${uuidv4()}`,
      text: s,
      createdAt: new Date().toISOString(),
    }))

    await db
      .insert(appSettings)
      .values({
        key: datasetKey,
        value: savedSuggestions,
      })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: savedSuggestions },
      })

    return NextResponse.json({
      suggestions: savedSuggestions,
      datasetId,
      datasetName: dataset.name,
      datasetType: moduleDatasetType || intelligenceDatasetType,
      cached: false,
    })
  } catch (error) {
    const fallbackType = detectDatasetTypeFromColumns([], "")
    const fallbackSuggestions = fallbackSuggestionsForDatasetType(fallbackType).map((text) => ({
      id: `sug_${uuidv4()}`,
      text,
      createdAt: new Date().toISOString(),
    }))
    return NextResponse.json({
      suggestions: fallbackSuggestions,
      error: error instanceof Error ? error.message : "Failed to generate suggestions",
      fallback: true,
    })
  }
}

function buildStandardSuggestions(input: {
  datasetId: string
  datasetType: DatasetKind
  columns: string[]
  rows: Record<string, unknown>[]
  datasetName: string
}) {
  const analyticalSuggestions = availableAnalyticalSuggestions({
    datasetId: input.datasetId,
    datasetType: input.datasetType,
    columns: input.columns,
    rows: input.rows,
  })
  const generatedSuggestions = input.rows.length > 0
    ? generateSuggestions(buildDatasetIntelligence(input.rows as DatasetRecord[]), input.datasetName)
    : fallbackSuggestionsForDatasetType(input.datasetType)
  const grossMarginQuestion = "What is the current gross margin?"
  const filteredGeneratedSuggestions = generatedSuggestions.filter((suggestion) =>
    suggestion !== grossMarginQuestion || analyticalSuggestions.includes(grossMarginQuestion)
  )
  const filteredFallbackSuggestions = fallbackSuggestionsForDatasetType(input.datasetType).filter((suggestion) =>
    suggestion !== grossMarginQuestion || analyticalSuggestions.includes(grossMarginQuestion)
  )
  return [...new Set([...analyticalSuggestions, ...filteredGeneratedSuggestions, ...filteredFallbackSuggestions])].slice(0, 12)
}
