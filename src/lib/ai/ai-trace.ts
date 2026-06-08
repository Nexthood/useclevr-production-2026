import { getDb } from "@/lib/db"
import { aiInteractionTraces } from "@/lib/db/schema"
import { desc, eq, and, gte, lte, like, or, sql, count } from "drizzle-orm"

export interface CreateTraceInput {
  userId: string
  datasetId?: string | null
  prompt: string
  response: string
  providerName: string
  modelName: string
  promptVersion?: string | null
  latencyMs?: number | null
  tokenCount?: number | null
  estimatedCostUsd?: number | null
  error?: string | null
}

export interface TraceRecord {
  id: string
  userId: string
  datasetId: string | null
  prompt: string
  response: string
  providerName: string
  modelName: string
  promptVersion: string | null
  latencyMs: number | null
  tokenCount: number | null
  estimatedCostUsd: number | null
  error: string | null
  feedback: string | null
  feedbackText: string | null
  userAnonymized: boolean
  createdAt: Date
}

const PROMPT_VERSION = "1.1"
const TRACE_TEXT_LIMIT = 10000
const TRACE_RESPONSE_LIMIT = 50000

const traceRedactionPatterns = [
  { pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, replacement: "[email]" },
  { pattern: new RegExp("AI" + "za[0-9A-Za-z_-]{20,}", "g"), replacement: "[api-key]" },
  { pattern: /(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]{20,}/g, replacement: "[github-token]" },
  { pattern: new RegExp("s" + "k_(?:live|test)_[A-Za-z0-9_]{12,}", "g"), replacement: "[stripe-key]" },
  { pattern: new RegExp("r" + "k_(?:live|test)_[A-Za-z0-9_]{12,}", "g"), replacement: "[stripe-key]" },
  { pattern: new RegExp("w" + "hsec_[A-Za-z0-9_]{12,}", "g"), replacement: "[webhook-secret]" },
  {
    pattern: /(?<![A-Za-z])(?:api[_ -]?key|apikey|token|secret|password|private[_ -]?key)(?![A-Za-z])\s*[:=]\s*["']?(?!<|\$\{|process\.env\b)[A-Za-z0-9_./+=-]{20,}/gi,
    replacement: "[credential]",
  },
  {
    pattern: /\b(?=.*(?:api|key|secret|token|railway))[^\n]*\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
    replacement: "[token]",
  },
]

function sanitizeTraceText(value: string, limit: number) {
  let output = String(value || "").slice(0, limit)
  for (const { pattern, replacement } of traceRedactionPatterns) {
    output = output.replace(pattern, replacement)
  }
  return output
}

function sanitizeOptionalTraceText(value: string | null | undefined, limit: number) {
  if (!value) return null
  return sanitizeTraceText(value, limit)
}

export function getCurrentPromptVersion(): string {
  return PROMPT_VERSION
}

export async function createTrace(input: CreateTraceInput): Promise<TraceRecord | null> {
  try {
    const db = getDb()
    if (!db) return null

    const id = `trace_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`
    const trace = {
      id,
      userId: input.userId,
      datasetId: input.datasetId || null,
      prompt: sanitizeTraceText(input.prompt, TRACE_TEXT_LIMIT),
      response: sanitizeTraceText(input.response, TRACE_RESPONSE_LIMIT),
      providerName: input.providerName,
      modelName: input.modelName,
      promptVersion: input.promptVersion || PROMPT_VERSION,
      latencyMs: input.latencyMs ?? null,
      tokenCount: input.tokenCount ?? null,
      estimatedCostUsd: input.estimatedCostUsd ?? null,
      error: sanitizeOptionalTraceText(input.error, TRACE_TEXT_LIMIT),
      feedback: null,
      feedbackText: null,
      userAnonymized: false,
    }

    await db.insert(aiInteractionTraces).values(trace)
    return trace as unknown as TraceRecord
  } catch {
    return null
  }
}

export async function getUserTraces(
  userId: string,
  options: {
    limit?: number
    offset?: number
    fromDate?: Date
    toDate?: Date
  } = {}
): Promise<{ traces: TraceRecord[]; total: number }> {
  try {
    const db = getDb()
    if (!db) return { traces: [], total: 0 }

    const { limit = 50, offset = 0, fromDate, toDate } = options
    const conditions = [eq(aiInteractionTraces.userId, userId)]

    if (fromDate) conditions.push(gte(aiInteractionTraces.createdAt, fromDate))
    if (toDate) conditions.push(lte(aiInteractionTraces.createdAt, toDate))

    const [{ total }] = await db
      .select({ total: count() })
      .from(aiInteractionTraces)
      .where(and(...conditions))

    const traces = await db
      .select()
      .from(aiInteractionTraces)
      .where(and(...conditions))
      .orderBy(desc(aiInteractionTraces.createdAt))
      .limit(limit)
      .offset(offset)

    return { traces: traces as unknown as TraceRecord[], total }
  } catch {
    return { traces: [], total: 0 }
  }
}

export async function searchUserTraces(
  userId: string,
  query: string,
  options: { limit?: number; offset?: number } = {}
): Promise<{ traces: TraceRecord[]; total: number }> {
  try {
    const db = getDb()
    if (!db) return { traces: [], total: 0 }

    const { limit = 50, offset = 0 } = options
    const searchPattern = `%${query}%`
    const conditions = [
      eq(aiInteractionTraces.userId, userId),
      or(
        like(aiInteractionTraces.prompt, searchPattern),
        like(aiInteractionTraces.response, searchPattern)
      ),
    ]

    const [{ total }] = await db
      .select({ total: count() })
      .from(aiInteractionTraces)
      .where(and(...conditions))

    const traces = await db
      .select()
      .from(aiInteractionTraces)
      .where(and(...conditions))
      .orderBy(desc(aiInteractionTraces.createdAt))
      .limit(limit)
      .offset(offset)

    return { traces: traces as unknown as TraceRecord[], total }
  } catch {
    return { traces: [], total: 0 }
  }
}

export async function updateTraceFeedback(
  traceId: string,
  userId: string,
  feedback: "positive" | "negative" | null,
  feedbackText?: string
): Promise<boolean> {
  try {
    const db = getDb()
    if (!db) return false

    const updateData: Record<string, unknown> = { feedback }
    if (feedbackText !== undefined) updateData.feedbackText = feedbackText

    const [result] = await db
      .update(aiInteractionTraces)
      .set(updateData)
      .where(and(eq(aiInteractionTraces.id, traceId), eq(aiInteractionTraces.userId, userId)))
      .returning()

    return !!result
  } catch {
    return false
  }
}

export async function getAdminTraceAnalytics(options: {
  fromDate?: Date
  toDate?: Date
} = {}): Promise<{
  totalQueries: number
  providerDistribution: Record<string, number>
  averageLatencyMs: number
  errorRate: number
  uniqueUsers: number
  feedbackPositive: number
  feedbackNegative: number
  topQueries: Array<{ prompt: string; count: number }>
}> {
  try {
    const db = getDb()
    if (!db) {
      return {
        totalQueries: 0, providerDistribution: {}, averageLatencyMs: 0,
        errorRate: 0, uniqueUsers: 0, feedbackPositive: 0, feedbackNegative: 0, topQueries: []
      }
    }

    const { fromDate, toDate } = options
    const conditions: any[] = []
    if (fromDate) conditions.push(gte(aiInteractionTraces.createdAt, fromDate))
    if (toDate) conditions.push(lte(aiInteractionTraces.createdAt, toDate))
    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [{ total }] = await db
      .select({ total: count() })
      .from(aiInteractionTraces)
      .where(where)

    const providerRows = await db
      .select({
        provider: aiInteractionTraces.providerName,
        cnt: count(),
      })
      .from(aiInteractionTraces)
      .where(where)
      .groupBy(aiInteractionTraces.providerName)

    const providerDistribution: Record<string, number> = {}
    for (const row of providerRows) {
      providerDistribution[row.provider] = row.cnt
    }

    const latencyResult = await db
      .select({
        avg: sql<number>`avg(${aiInteractionTraces.latencyMs})`,
      })
      .from(aiInteractionTraces)
      .where(and(where ? where : sql`true`, sql`${aiInteractionTraces.latencyMs} is not null`))

    const averageLatencyMs = latencyResult[0]?.avg || 0

    const errorResult = await db
      .select({ cnt: count() })
      .from(aiInteractionTraces)
      .where(and(where ? where : sql`true`, sql`${aiInteractionTraces.error} is not null`))

    const errorRate = total > 0 ? (errorResult[0]?.cnt || 0) / total : 0

    const [uniqueResult] = await db
      .select({ cnt: sql<number>`count(distinct ${aiInteractionTraces.userId})` })
      .from(aiInteractionTraces)
      .where(where)

    const [positiveResult] = await db
      .select({ cnt: count() })
      .from(aiInteractionTraces)
      .where(and(where ? where : sql`true`, eq(aiInteractionTraces.feedback, "positive")))

    const [negativeResult] = await db
      .select({ cnt: count() })
      .from(aiInteractionTraces)
      .where(and(where ? where : sql`true`, eq(aiInteractionTraces.feedback, "negative")))

    const topQueryRows = await db
      .select({
        prompt: aiInteractionTraces.prompt,
        cnt: count(),
      })
      .from(aiInteractionTraces)
      .where(where)
      .groupBy(aiInteractionTraces.prompt)
      .orderBy(desc(sql`count(*)`))
      .limit(20)

    return {
      totalQueries: total,
      providerDistribution,
      averageLatencyMs,
      errorRate,
      uniqueUsers: uniqueResult?.cnt || 0,
      feedbackPositive: positiveResult?.cnt || 0,
      feedbackNegative: negativeResult?.cnt || 0,
      topQueries: topQueryRows.map((r) => ({ prompt: r.prompt, count: r.cnt })),
    }
  } catch {
    return {
      totalQueries: 0, providerDistribution: {}, averageLatencyMs: 0,
      errorRate: 0, uniqueUsers: 0, feedbackPositive: 0, feedbackNegative: 0, topQueries: []
    }
  }
}

export async function getBenchmarkingData(options: {
  fromDate?: Date
  toDate?: Date
} = {}): Promise<Array<{
  providerName: string
  modelName: string
  totalQueries: number
  averageLatencyMs: number
  errorRate: number
  averageTokens: number
  positiveFeedback: number
  negativeFeedback: number
}>> {
  try {
    const db = getDb()
    if (!db) return []

    const { fromDate, toDate } = options
    const conditions: any[] = []
    if (fromDate) conditions.push(gte(aiInteractionTraces.createdAt, fromDate))
    if (toDate) conditions.push(lte(aiInteractionTraces.createdAt, toDate))
    const where = conditions.length > 0 ? and(...conditions) : undefined

    const rows = await db
      .select({
        providerName: aiInteractionTraces.providerName,
        modelName: aiInteractionTraces.modelName,
        totalQueries: count(),
        averageLatencyMs: sql<number>`avg(${aiInteractionTraces.latencyMs})`,
        errorCount: sql<number>`count(*) filter (where ${aiInteractionTraces.error} is not null)`,
        averageTokens: sql<number>`avg(${aiInteractionTraces.tokenCount})`,
        positiveFeedback: sql<number>`count(*) filter (where ${aiInteractionTraces.feedback} = 'positive')`,
        negativeFeedback: sql<number>`count(*) filter (where ${aiInteractionTraces.feedback} = 'negative')`,
      })
      .from(aiInteractionTraces)
      .where(where)
      .groupBy(aiInteractionTraces.providerName, aiInteractionTraces.modelName)

    return rows.map((r) => ({
      providerName: r.providerName,
      modelName: r.modelName,
      totalQueries: r.totalQueries,
      averageLatencyMs: r.averageLatencyMs || 0,
      errorRate: r.totalQueries > 0 ? r.errorCount / r.totalQueries : 0,
      averageTokens: r.averageTokens || 0,
      positiveFeedback: r.positiveFeedback,
      negativeFeedback: r.negativeFeedback,
    }))
  } catch {
    return []
  }
}

export async function deleteOldTraces(retentionDays: number): Promise<number> {
  try {
    const db = getDb()
    if (!db) return 0

    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
    await db
      .delete(aiInteractionTraces)
      .where(lte(aiInteractionTraces.createdAt, cutoff))

    return 1
  } catch {
    return 0
  }
}

export async function recordMCPTrace(input: {
  userId?: string | null
  tokenId?: string | null
  tokenName?: string | null
  toolName: string
  input: string
  output: string
  latencyMs?: number | null
  error?: string | null
}): Promise<TraceRecord | null> {
  const userId = input.userId || `mcp-token-${input.tokenName || input.tokenId || "unknown"}`
  return createTrace({
    userId,
    prompt: `MCP tool invocation: ${input.toolName}\n\nInput:\n${input.input}`,
    response: input.error ? `Error: ${input.error}` : `Output:\n${input.output}`,
    providerName: "MCP",
    modelName: `tool:${input.toolName}`,
    promptVersion: PROMPT_VERSION,
    latencyMs: input.latencyMs ?? null,
    error: input.error || null,
  })
}

export async function recordMentoringTrace(input: {
  userId: string
  sessionType: string
  mentorName: string | null
  action: "booked" | "completed" | "cancelled"
  providerName?: string
  modelName?: string
}): Promise<TraceRecord | null> {
  return createTrace({
    userId: input.userId,
    prompt: `Mentoring session ${input.action}: ${input.sessionType}${input.mentorName ? ` with ${input.mentorName}` : ""}`,
    response: `Session type: ${input.sessionType}. Mentor: ${input.mentorName || "TBD"}. Action: ${input.action}.`,
    providerName: input.providerName || "mentoring",
    modelName: input.modelName || "system",
    promptVersion: PROMPT_VERSION,
  })
}

export async function anonymizeUserTraces(userId: string): Promise<boolean> {
  try {
    const db = getDb()
    if (!db) return false

    await db
      .update(aiInteractionTraces)
      .set({
        prompt: sql`regexp_replace(${aiInteractionTraces.prompt}, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}', '[email]', 'g')`,
        response: sql`regexp_replace(${aiInteractionTraces.response}, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}', '[email]', 'g')`,
        userAnonymized: true,
      })
      .where(and(eq(aiInteractionTraces.userId, userId), eq(aiInteractionTraces.userAnonymized, false)))

    return true
  } catch {
    return false
  }
}
