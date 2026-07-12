import { detectAccuracyCapabilities, type AccuracySearchMode } from "@/lib/accuracy/capabilities"
import { cosineSimilarity, embedAccuracyText } from "@/lib/accuracy/embeddings"
import { findAccessibleDataset } from "@/lib/data/dataset-access"
import { normalizeDatasetCategory, type DatasetCategory } from "@/lib/data/dataset-category"
import { db } from "@/lib/db"
import { retrievalDocuments } from "@/lib/db/schema"
import { and, eq, sql } from "drizzle-orm"

export type SearchDatasetContextInput = {
  workspaceId?: string | null
  userId: string
  role?: string | null
  datasetId: string
  datasetType?: DatasetCategory | string | null
  query: string
  limit?: number
  filters?: {
    sourceType?: string
    language?: string
  }
}

export type SearchDatasetContextResult = {
  results: RetrievalSearchResult[]
  trace: {
    mode: AccuracySearchMode
    semanticCount: number
    keywordCount: number
    returnedCount: number
    fallbackReason?: string
  }
}

export type RetrievalSearchResult = {
  documentId: string
  datasetId: string
  sourceType: string
  sourceRecordId: string
  content: string
  metadata: Record<string, unknown>
  semanticRank: number | null
  keywordRank: number | null
  fusedScore: number
}

type RetrievalRow = typeof retrievalDocuments.$inferSelect
type RankedRow = RetrievalRow & { rank: number; score: number }

const RRF_K = 60
const DEFAULT_LIMIT = 8
const MAX_LIMIT = 20
const MAX_CONTEXT_CHARS = 12_000
const MIN_FUSED_SCORE = 0.01

export async function searchDatasetContext(input: SearchDatasetContextInput): Promise<SearchDatasetContextResult> {
  const query = input.query.trim()
  if (!query) {
    return emptyResult("fts_only", "empty_query")
  }

  const access = await findAccessibleDataset(input.datasetId, input.userId, input.role)
  if (access.dbUnavailable) throw new Error("Database is unavailable.")
  if (!access.dataset) throw new Error("Dataset not found or access denied.")

  const tenantUserId = access.dataset.userId
  const actualDatasetType = normalizeDatasetCategory(access.dataset.datasetType) || "standard"
  const requestedDatasetType = normalizeDatasetCategory(input.datasetType)
  if (requestedDatasetType && requestedDatasetType !== actualDatasetType) {
    return emptyResult("fts_only", "dataset_type_mismatch")
  }

  const capabilities = await detectAccuracyCapabilities()
  const limit = Math.min(MAX_LIMIT, Math.max(1, input.limit || DEFAULT_LIMIT))
  const candidates = await loadCandidateRows({
    userId: tenantUserId,
    datasetId: access.dataset.id,
    datasetType: actualDatasetType,
    sourceType: input.filters?.sourceType,
    language: input.filters?.language,
  })

  if (candidates.length === 0) {
    return emptyResult(capabilities.mode, "no_indexed_documents")
  }

  const queryEmbedding = await embedAccuracyText(query)
  const semantic = rankSemantic(candidates, queryEmbedding.vector).slice(0, Math.max(limit * 3, 12))
  const keyword = await rankKeyword({
    mode: capabilities.mode,
    userId: tenantUserId,
    datasetId: access.dataset.id,
    datasetType: actualDatasetType,
    query,
    sourceType: input.filters?.sourceType,
    language: input.filters?.language,
    limit: Math.max(limit * 3, 12),
  })
  const fused = reciprocalRankFusion(semantic, keyword)
    .filter((result) => result.fusedScore >= MIN_FUSED_SCORE)
    .slice(0, limit)
  const bounded = applyContextBudget(fused, MAX_CONTEXT_CHARS)

  return {
    results: bounded,
    trace: {
      mode: capabilities.mode,
      semanticCount: semantic.length,
      keywordCount: keyword.length,
      returnedCount: bounded.length,
    },
  }
}

async function loadCandidateRows(input: {
  userId: string
  datasetId: string
  datasetType: DatasetCategory
  sourceType?: string
  language?: string
}) {
  const filters = [
    eq(retrievalDocuments.userId, input.userId),
    eq(retrievalDocuments.datasetId, input.datasetId),
    eq(retrievalDocuments.datasetType, input.datasetType),
  ]
  if (input.sourceType) filters.push(eq(retrievalDocuments.sourceType, input.sourceType as never))
  if (input.language) filters.push(eq(retrievalDocuments.language, input.language))

  return db.query.retrievalDocuments.findMany({
    where: and(...filters),
    limit: 250,
  })
}

function rankSemantic(rows: RetrievalRow[], queryEmbedding: number[]): RankedRow[] {
  return rows
    .map((row) => ({
      ...row,
      score: cosineSimilarity(Array.isArray(row.embedding) ? row.embedding : null, queryEmbedding),
      rank: 0,
    }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((row, index) => ({ ...row, rank: index + 1 }))
}

async function rankKeyword(input: {
  mode: AccuracySearchMode
  userId: string
  datasetId: string
  datasetType: DatasetCategory
  query: string
  sourceType?: string
  language?: string
  limit: number
}): Promise<RankedRow[]> {
  if (input.mode === "lakebase_hybrid") {
    try {
      return await rankBm25Keyword(input)
    } catch {
      return rankPostgresKeyword(input)
    }
  }

  return rankPostgresKeyword(input)
}

async function rankBm25Keyword(input: {
  userId: string
  datasetId: string
  datasetType: DatasetCategory
  query: string
  sourceType?: string
  language?: string
  limit: number
}): Promise<RankedRow[]> {
  const rows = await db.execute(sql`
    SELECT
      *,
      "contentTsv" <@> to_bm25query(to_tsvector('simple', ${input.query}), 'RetrievalDocument_content_bm25_idx') AS "keywordScore"
    FROM "RetrievalDocument"
    WHERE "userId" = ${input.userId}
      AND "datasetId" = ${input.datasetId}
      AND "datasetType" = ${input.datasetType}
      AND (${input.sourceType || null}::text IS NULL OR "sourceType" = ${input.sourceType || null})
      AND (${input.language || null}::text IS NULL OR "language" = ${input.language || null})
    ORDER BY "keywordScore" ASC, "updatedAt" DESC
    LIMIT ${input.limit}
  `)

  return mapKeywordRows(rows)
}

async function rankPostgresKeyword(input: {
  userId: string
  datasetId: string
  datasetType: DatasetCategory
  query: string
  sourceType?: string
  language?: string
  limit: number
}): Promise<RankedRow[]> {
  const rows = await db.execute(sql`
    SELECT
      *,
      ts_rank_cd(to_tsvector('simple', "content"), plainto_tsquery('simple', ${input.query})) AS "keywordScore"
    FROM "RetrievalDocument"
    WHERE "userId" = ${input.userId}
      AND "datasetId" = ${input.datasetId}
      AND "datasetType" = ${input.datasetType}
      AND (${input.sourceType || null}::text IS NULL OR "sourceType" = ${input.sourceType || null})
      AND (${input.language || null}::text IS NULL OR "language" = ${input.language || null})
      AND to_tsvector('simple', "content") @@ plainto_tsquery('simple', ${input.query})
    ORDER BY "keywordScore" DESC, "updatedAt" DESC
    LIMIT ${input.limit}
  `)

  return mapKeywordRows(rows)
}

function mapKeywordRows(rows: unknown): RankedRow[] {
  return extractRows(rows).map((row, index) => ({
    id: String(row.id),
    userId: String(row.userId),
    datasetId: String(row.datasetId),
    datasetType: String(row.datasetType) as DatasetCategory,
    sourceType: String(row.sourceType) as RetrievalRow["sourceType"],
    sourceRecordId: String(row.sourceRecordId),
    content: String(row.content),
    metadata: isRecord(row.metadata) ? row.metadata : {},
    embedding: Array.isArray(row.embedding) ? row.embedding as number[] : null,
    embeddingModel: typeof row.embeddingModel === "string" ? row.embeddingModel : null,
    embeddingDimensions: typeof row.embeddingDimensions === "number" ? row.embeddingDimensions : null,
    contentHash: String(row.contentHash),
    language: String(row.language || "und"),
    ingestionStatus: String(row.ingestionStatus || "ready"),
    ingestionError: typeof row.ingestionError === "string" ? row.ingestionError : null,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(String(row.createdAt)),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(String(row.updatedAt)),
    score: Number(row.keywordScore || 0),
    rank: index + 1,
  }))
}

function reciprocalRankFusion(semantic: RankedRow[], keyword: RankedRow[]): RetrievalSearchResult[] {
  const byId = new Map<string, { row: RankedRow; semanticRank: number | null; keywordRank: number | null; fusedScore: number }>()

  for (const row of semantic) {
    byId.set(row.id, {
      row,
      semanticRank: row.rank,
      keywordRank: null,
      fusedScore: 1 / (RRF_K + row.rank),
    })
  }

  for (const row of keyword) {
    const existing = byId.get(row.id)
    if (existing) {
      existing.keywordRank = row.rank
      existing.fusedScore += 1 / (RRF_K + row.rank)
    } else {
      byId.set(row.id, {
        row,
        semanticRank: null,
        keywordRank: row.rank,
        fusedScore: 1 / (RRF_K + row.rank),
      })
    }
  }

  return Array.from(byId.values())
    .sort((a, b) => b.fusedScore - a.fusedScore)
    .map((item) => ({
      documentId: item.row.id,
      datasetId: item.row.datasetId,
      sourceType: item.row.sourceType,
      sourceRecordId: item.row.sourceRecordId,
      content: item.row.content,
      metadata: isRecord(item.row.metadata) ? item.row.metadata : {},
      semanticRank: item.semanticRank,
      keywordRank: item.keywordRank,
      fusedScore: Number(item.fusedScore.toFixed(6)),
    }))
}

function applyContextBudget(results: RetrievalSearchResult[], maxChars: number) {
  const output: RetrievalSearchResult[] = []
  let used = 0
  for (const result of results) {
    if (used + result.content.length > maxChars) break
    output.push(result)
    used += result.content.length
  }
  return output
}

function emptyResult(mode: AccuracySearchMode, fallbackReason: string): SearchDatasetContextResult {
  return {
    results: [],
    trace: {
      mode,
      semanticCount: 0,
      keywordCount: 0,
      returnedCount: 0,
      fallbackReason,
    },
  }
}

function extractRows(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) return result as Array<Record<string, unknown>>
  if (result && typeof result === "object" && "rows" in result && Array.isArray((result as { rows: unknown }).rows)) {
    return (result as { rows: Array<Record<string, unknown>> }).rows
  }
  return []
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}
