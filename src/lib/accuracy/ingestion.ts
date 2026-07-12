import { createHash, randomUUID } from "node:crypto"

import { embedAccuracyText } from "@/lib/accuracy/embeddings"
import { findAccessibleDataset, loadDatasetData } from "@/lib/data/dataset-access"
import { normalizeDatasetCategory, type DatasetCategory } from "@/lib/data/dataset-category"
import { db } from "@/lib/db"
import {
  accuracyIngestionJobs,
  retrievalDocuments,
  type RetrievalDocumentSourceType,
} from "@/lib/db/schema"
import { debugError, debugWarn } from "@/lib/utils/debug"
import { and, eq, inArray, notInArray } from "drizzle-orm"

export type AccuracyIngestionResult = {
  ok: boolean
  jobId: string
  datasetId: string
  datasetType: DatasetCategory
  documentCount: number
  embeddedCount: number
  skippedCount: number
  error?: string
}

type CandidateDocument = {
  sourceType: RetrievalDocumentSourceType
  sourceRecordId: string
  content: string
  metadata: Record<string, unknown>
  language?: string
}

const MAX_DOCUMENTS = normalizeLimit(process.env.ACCURACY_MAX_DOCUMENTS_PER_DATASET, 100)
const MAX_CONTENT_CHARS = normalizeLimit(process.env.ACCURACY_MAX_DOCUMENT_CHARS, 1800)
const IDENTITY_ROW_LIMIT = normalizeLimit(process.env.ACCURACY_IDENTITY_ROW_LIMIT, 50)

export async function ingestDatasetForAccuracy(input: {
  datasetId: string
  userId: string
  role?: string | null
}): Promise<AccuracyIngestionResult> {
  const access = await findAccessibleDataset(input.datasetId, input.userId, input.role)
  if (access.dbUnavailable) throw new Error("Database is unavailable.")
  if (!access.dataset) throw new Error("Dataset not found or access denied.")

  const datasetType = normalizeDatasetCategory(access.dataset.datasetType) || "standard"
  const jobId = `acc_ing_${randomUUID().replaceAll("-", "").slice(0, 24)}`
  const now = new Date()

  await db.insert(accuracyIngestionJobs).values({
    id: jobId,
    userId: access.dataset.userId,
    datasetId: access.dataset.id,
    datasetType,
    status: "running",
    startedAt: now,
    createdAt: now,
    updatedAt: now,
  })

  try {
    const rows = await loadDatasetData(access.dataset.id, access.dataset)
    const candidates = buildRetrievalDocumentCandidates({
      datasetId: access.dataset.id,
      datasetName: access.dataset.name,
      fileName: access.dataset.fileName,
      datasetType,
      columns: Array.isArray(access.dataset.columns) ? access.dataset.columns : [],
      rowCount: access.dataset.rowCount || rows.length,
      rows,
      analysis: access.dataset.analysis,
      aiInsights: access.dataset.aiInsights,
      precomputedMetrics: access.dataset.precomputedMetrics,
    }).slice(0, MAX_DOCUMENTS)

    const existingRows = await db.query.retrievalDocuments.findMany({
      where: and(
        eq(retrievalDocuments.userId, access.dataset.userId),
        eq(retrievalDocuments.datasetId, access.dataset.id),
      ),
      columns: {
        sourceType: true,
        sourceRecordId: true,
        contentHash: true,
      },
    })
    const existingBySource = new Map(existingRows.map((row) => [sourceKey(row.sourceType, row.sourceRecordId), row.contentHash]))
    const activeSourceKeys: string[] = []
    let embeddedCount = 0
    let skippedCount = 0

    for (const candidate of candidates) {
      const content = truncateContent(candidate.content)
      if (!content) continue

      const contentHash = hashContent(content)
      const key = sourceKey(candidate.sourceType, candidate.sourceRecordId)
      activeSourceKeys.push(key)

      if (existingBySource.get(key) === contentHash) {
        skippedCount += 1
        continue
      }

      const embedding = await embedAccuracyText(content)
      embeddedCount += 1

      await db
        .insert(retrievalDocuments)
        .values({
          userId: access.dataset.userId,
          datasetId: access.dataset.id,
          datasetType,
          sourceType: candidate.sourceType,
          sourceRecordId: candidate.sourceRecordId,
          content,
          metadata: candidate.metadata,
          embedding: embedding.vector,
          embeddingModel: embedding.model,
          embeddingDimensions: embedding.dimensions,
          contentHash,
          language: candidate.language || "und",
          ingestionStatus: "ready",
          ingestionError: null,
          createdAt: now,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [
            retrievalDocuments.userId,
            retrievalDocuments.datasetId,
            retrievalDocuments.sourceType,
            retrievalDocuments.sourceRecordId,
          ],
          set: {
            datasetType,
            content,
            metadata: candidate.metadata,
            embedding: embedding.vector,
            embeddingModel: embedding.model,
            embeddingDimensions: embedding.dimensions,
            contentHash,
            language: candidate.language || "und",
            ingestionStatus: "ready",
            ingestionError: null,
            updatedAt: new Date(),
          },
        })
    }

    if (activeSourceKeys.length > 0) {
      const activeRecordIds = candidates.map((candidate) => candidate.sourceRecordId)
      await db.delete(retrievalDocuments).where(and(
        eq(retrievalDocuments.userId, access.dataset.userId),
        eq(retrievalDocuments.datasetId, access.dataset.id),
        notInArray(retrievalDocuments.sourceRecordId, activeRecordIds),
      ))
    } else {
      await db.delete(retrievalDocuments).where(and(
        eq(retrievalDocuments.userId, access.dataset.userId),
        eq(retrievalDocuments.datasetId, access.dataset.id),
      ))
    }

    await db.update(accuracyIngestionJobs).set({
      status: "completed",
      documentCount: candidates.length,
      embeddedCount,
      skippedCount,
      completedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(accuracyIngestionJobs.id, jobId))

    return {
      ok: true,
      jobId,
      datasetId: access.dataset.id,
      datasetType,
      documentCount: candidates.length,
      embeddedCount,
      skippedCount,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Accuracy ingestion failed."
    debugError("[ACCURACY] Dataset ingestion failed", {
      userId: input.userId,
      datasetId: input.datasetId,
      message,
    })
    await db.update(accuracyIngestionJobs).set({
      status: "failed",
      errorMessage: message,
      completedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(accuracyIngestionJobs.id, jobId))

    return {
      ok: false,
      jobId,
      datasetId: access.dataset.id,
      datasetType,
      documentCount: 0,
      embeddedCount: 0,
      skippedCount: 0,
      error: message,
    }
  }
}

export async function deleteAccuracyDocumentsForDatasets(datasetIds: string[]) {
  const ids = Array.from(new Set(datasetIds.filter(Boolean)))
  if (ids.length === 0) return

  await db.delete(retrievalDocuments).where(inArray(retrievalDocuments.datasetId, ids))
  await db.delete(accuracyIngestionJobs).where(inArray(accuracyIngestionJobs.datasetId, ids))
}

function buildRetrievalDocumentCandidates(input: {
  datasetId: string
  datasetName: string
  fileName: string
  datasetType: DatasetCategory
  columns: string[]
  rowCount: number
  rows: Record<string, unknown>[]
  analysis: unknown
  aiInsights: unknown
  precomputedMetrics: unknown
}): CandidateDocument[] {
  const candidates: CandidateDocument[] = []
  candidates.push({
    sourceType: "dataset_summary",
    sourceRecordId: "dataset-summary",
    content: [
      `Dataset: ${input.datasetName}`,
      `File: ${input.fileName}`,
      `Type: ${input.datasetType}`,
      `Rows: ${input.rowCount}`,
      `Columns: ${input.columns.join(", ")}`,
    ].join("\n"),
    metadata: {
      datasetId: input.datasetId,
      datasetType: input.datasetType,
      columnCount: input.columns.length,
      rowCount: input.rowCount,
    },
  })

  for (const column of input.columns) {
    candidates.push({
      sourceType: "column_description",
      sourceRecordId: `column:${column}`,
      content: `Column "${column}" in ${input.datasetName}. This field belongs to a ${input.datasetType} dataset and may help explain business context when exact KPI values are calculated separately.`,
      metadata: { column, datasetType: input.datasetType },
    })
  }

  addStructuredSummary(candidates, "report_explanation", "analysis", input.analysis, input.datasetType)
  addStructuredSummary(candidates, "controlled_summary", "ai-insights", input.aiInsights, input.datasetType)
  addStructuredSummary(candidates, "controlled_summary", "precomputed-metrics", input.precomputedMetrics, input.datasetType)
  addIdentityRows(candidates, input)

  return candidates.filter((candidate) => candidate.content.trim())
}

function addStructuredSummary(
  candidates: CandidateDocument[],
  sourceType: RetrievalDocumentSourceType,
  sourceRecordId: string,
  value: unknown,
  datasetType: DatasetCategory,
) {
  const text = extractText(value)
  if (!text) return
  candidates.push({
    sourceType,
    sourceRecordId,
    content: text,
    metadata: { datasetType, sourceRecordId },
  })
}

function addIdentityRows(
  candidates: CandidateDocument[],
  input: {
    datasetType: DatasetCategory
    columns: string[]
    rows: Record<string, unknown>[]
  },
) {
  const productColumns = findColumns(input.columns, ["product", "sku", "item", "article", "description", "name"])
  const supplierColumns = findColumns(input.columns, ["supplier", "vendor", "brand", "manufacturer"])
  const invoiceColumns = findColumns(input.columns, ["invoice", "receipt", "document", "reference", "number"])
  const identityColumns = Array.from(new Set([...productColumns, ...supplierColumns, ...invoiceColumns]))
  if (identityColumns.length === 0) return

  const seen = new Set<string>()
  for (const row of input.rows.slice(0, IDENTITY_ROW_LIMIT)) {
    const values = identityColumns
      .map((column) => [column, row[column]])
      .filter((entry): entry is [string, unknown] => entry[1] !== null && entry[1] !== undefined && String(entry[1]).trim().length > 0)
      .map(([column, value]) => `${column}: ${String(value).trim()}`)
    if (values.length === 0) continue

    const content = values.join(" | ")
    const key = hashContent(content).slice(0, 16)
    if (seen.has(key)) continue
    seen.add(key)

    const sourceType: RetrievalDocumentSourceType = invoiceColumns.some((column) => content.includes(`${column}:`))
      ? input.datasetType === "prebookkeeping" ? "invoice_text" : "document_chunk"
      : supplierColumns.some((column) => content.includes(`${column}:`))
        ? "supplier_identity"
        : "product_identity"

    candidates.push({
      sourceType,
      sourceRecordId: `identity:${key}`,
      content,
      metadata: {
        datasetType: input.datasetType,
        columns: identityColumns,
      },
    })
  }
}

function findColumns(columns: string[], keywords: string[]) {
  return columns.filter((column) => {
    const normalized = column.toLowerCase().replace(/[\s_-]+/g, "")
    return keywords.some((keyword) => normalized.includes(keyword))
  })
}

function extractText(value: unknown, depth = 0): string {
  if (depth > 4 || value === null || value === undefined) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return ""
  if (Array.isArray(value)) {
    return value.map((item) => extractText(item, depth + 1)).filter(Boolean).join("\n")
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, nested]) => {
        const text = extractText(nested, depth + 1)
        return text ? `${key}: ${text}` : ""
      })
      .filter(Boolean)
      .join("\n")
  }
  return ""
}

function truncateContent(content: string) {
  const normalized = normalizeText(content)
  if (normalized.length <= MAX_CONTENT_CHARS) return normalized
  debugWarn("[ACCURACY] Retrieval document truncated", { length: normalized.length, max: MAX_CONTENT_CHARS })
  return normalized.slice(0, MAX_CONTENT_CHARS).trim()
}

function normalizeText(content: string) {
  return content
    .normalize("NFKC")
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function hashContent(content: string) {
  return createHash("sha256").update(content).digest("hex")
}

function sourceKey(sourceType: string, sourceRecordId: string) {
  return `${sourceType}:${sourceRecordId}`
}

function normalizeLimit(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || "", 10)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return parsed
}
