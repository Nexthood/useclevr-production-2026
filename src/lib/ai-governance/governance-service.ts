import { randomUUID } from "node:crypto"

import {
  getAiMode,
  getUseClevrCloudFallbackAllowed,
  listPublicAiProviderConfigs,
  toPublicAiMode,
  type PublicAiProviderConfig,
} from "@/lib/ai/byoai-provider"
import { listAiRequestAuditLogs } from "@/lib/ai/ai-request-audit"
import { getDb } from "@/lib/db"
import {
  aiGovernanceOverrideActions,
  aiGovernanceOverrides,
  aiInteractionTraces,
  aiRequestAuditLogs,
  appSettings,
  type AiGovernanceOverrideAction,
} from "@/lib/db/schema"
import { debugError } from "@/lib/utils/debug"
import { and, count, desc, eq, ilike, or } from "drizzle-orm"

export type AiGovernanceUser = {
  id: string
  role?: string | null
}

export type AiGovernanceSettings = {
  preferredProviderId: string | null
  preferredModel: string | null
  mode: "automatic" | "local" | "byok" | "useclevr_cloud"
  fallbackProviderId: string | null
  temperature: number
  maxTokens: number
  loggingEnabled: boolean
  retentionDays: number
}

export type AiGovernanceAuditFilters = {
  query?: string | null
  provider?: string | null
  mode?: string | null
  status?: string | null
  limit?: number
}

export type AiGovernanceOverrideInput = {
  userId: string
  traceId?: string | null
  datasetId?: string | null
  action: AiGovernanceOverrideAction
  originalValue?: string | null
  editedValue?: string | null
  reason?: string | null
}

export async function getAiGovernanceSnapshot(user: AiGovernanceUser) {
  try {
    const [providers, settings, auditEntries, traces, overrideStats] = await Promise.all([
      safeListProviders(user.id),
      safeGetGovernanceSettings(user.id),
      safeListAudit(user, 100),
      safeListTraces(user, 50),
      safeGetOverrideStats(user),
    ])

    return buildGovernanceSnapshot({
      providers,
      settings,
      auditEntries,
      traces,
      overrideStats,
    })
  } catch (error) {
    logGovernanceDataError("snapshot-build", error)
    return buildGovernanceSnapshot({
      providers: [],
      settings: defaultGovernanceSettings("automatic", [], true),
      auditEntries: [],
      traces: [],
      overrideStats: emptyOverrideStats(),
    })
  }
}

function buildGovernanceSnapshot(input: {
  providers: PublicAiProviderConfig[]
  settings: AiGovernanceSettings
  auditEntries: Awaited<ReturnType<typeof listAiRequestAuditLogs>>
  traces: Awaited<ReturnType<typeof safeListTraces>>
  overrideStats: Awaited<ReturnType<typeof safeGetOverrideStats>>
}) {
  const providerStats = summarizeProviders(input.providers)
  const auditStats = summarizeAudit(input.auditEntries, input.traces, input.overrideStats.totalOverrides)
  const privacy = buildPrivacyPosture(input.settings, input.providers)
  const risk = buildRiskPosture(auditStats, providerStats, privacy)
  const compliance = buildComplianceScore({
    auditLogged: input.auditEntries.length > 0 || input.traces.length > 0,
    providerMonitoring: providerStats.total > 0,
    humanOversight: input.overrideStats.totalOverrides > 0,
    privacyConfigured: privacy.items.some((item) => item.status === "Configured"),
    feedbackAvailable: input.traces.some((trace) => trace.feedback),
    policiesAvailable: true,
  })

  return {
    generatedAt: new Date().toISOString(),
    settings: input.settings,
    providers: providerStats,
    audit: auditStats,
    privacy,
    risk,
    compliance,
    recentTraces: input.traces.map(toTraceSummary),
    recentAuditEntries: input.auditEntries.map(toAuditSummary),
    overrides: input.overrideStats,
    policies: getAiGovernancePolicies(),
    literacy: getAiLiteracyContent(),
    reports: buildReports(input.auditEntries, input.traces, input.providers, compliance.score),
  }
}

export async function listAiGovernanceAuditRows(user: AiGovernanceUser, filters: AiGovernanceAuditFilters = {}) {
  const db = getDb()
  if (!db) return []

  const limit = normalizeLimit(filters.limit)
  const isAdmin = user.role === "superadmin"
  const conditions = []
  if (!isAdmin) conditions.push(eq(aiRequestAuditLogs.userId, user.id))
  if (filters.provider) conditions.push(ilike(aiRequestAuditLogs.providerName, `%${filters.provider.trim()}%`))
  if (filters.mode) conditions.push(eq(aiRequestAuditLogs.mode, filters.mode.trim()))
  if (filters.status === "success") conditions.push(eq(aiRequestAuditLogs.success, true))
  if (filters.status === "failed") conditions.push(eq(aiRequestAuditLogs.success, false))
  if (filters.query) {
    const query = `%${filters.query.trim()}%`
    conditions.push(
      or(
        ilike(aiRequestAuditLogs.providerName, query),
        ilike(aiRequestAuditLogs.modelName, query),
        ilike(aiRequestAuditLogs.purpose, query),
        ilike(aiRequestAuditLogs.routingReason, query),
        ilike(aiRequestAuditLogs.errorReason, query),
      ),
    )
  }

  try {
    return await db.query.aiRequestAuditLogs.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: desc(aiRequestAuditLogs.createdAt),
      limit,
    })
  } catch (error) {
    logGovernanceDataError("audit-log-query", error)
    return []
  }
}

export async function getAiGovernanceSettings(userId: string): Promise<AiGovernanceSettings> {
  const db = getDb()
  const [mode, allowFallback, providers] = await Promise.all([
    getAiMode(userId).then(toPublicAiMode).catch(() => "automatic" as const),
    getUseClevrCloudFallbackAllowed(userId).catch(() => true),
    safeListProviders(userId),
  ])
  if (!db) return defaultGovernanceSettings(mode, providers, allowFallback)

  try {
    const [row] = await db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, settingsKey(userId)))
      .limit(1)
    return normalizeSettings(row?.value, mode, providers, allowFallback)
  } catch (error) {
    logGovernanceDataError("settings-query", error)
    return defaultGovernanceSettings(mode, providers, allowFallback)
  }
}

export async function saveAiGovernanceSettings(userId: string, input: Partial<AiGovernanceSettings>) {
  const current = await getAiGovernanceSettings(userId)
  const next: AiGovernanceSettings = {
    preferredProviderId: normalizeNullableId(input.preferredProviderId) ?? current.preferredProviderId,
    preferredModel: normalizeNullableText(input.preferredModel) ?? current.preferredModel,
    mode: normalizeGovernanceMode(input.mode) ?? current.mode,
    fallbackProviderId: normalizeNullableId(input.fallbackProviderId) ?? current.fallbackProviderId,
    temperature: clampNumber(input.temperature, 0, 2, current.temperature),
    maxTokens: Math.round(clampNumber(input.maxTokens, 256, 32000, current.maxTokens)),
    loggingEnabled: typeof input.loggingEnabled === "boolean" ? input.loggingEnabled : current.loggingEnabled,
    retentionDays: Math.round(clampNumber(input.retentionDays, 1, 730, current.retentionDays)),
  }

  const db = getDb()
  if (!db) throw new Error("Database connection is unavailable.")
  await db
    .insert(appSettings)
    .values({ key: settingsKey(userId), value: next, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: next, updatedAt: new Date() },
    })
  return next
}

export async function recordAiGovernanceOverride(input: AiGovernanceOverrideInput) {
  if (!aiGovernanceOverrideActions.includes(input.action)) {
    throw new Error("Unsupported AI governance override action.")
  }
  const db = getDb()
  if (!db) throw new Error("Database connection is unavailable.")
  const [row] = await db
    .insert(aiGovernanceOverrides)
    .values({
      id: `aigo_${randomUUID().replaceAll("-", "").slice(0, 24)}`,
      userId: input.userId,
      traceId: normalizeNullableText(input.traceId),
      datasetId: normalizeNullableText(input.datasetId),
      action: input.action,
      originalValue: normalizeLongText(input.originalValue),
      editedValue: normalizeLongText(input.editedValue),
      reason: normalizeLongText(input.reason),
      createdAt: new Date(),
    })
    .returning()
  return row
}

export async function getAiGovernanceProviderStatus(userId: string) {
  const providers = await safeListProviders(userId)
  return {
    generatedAt: new Date().toISOString(),
    providers: providers.map((provider) => ({
      id: provider.id,
      provider: labelProvider(provider.providerType, provider.providerName),
      model: provider.modelName,
      mode: provider.providerType === "ollama" || provider.providerType === "lm-studio" ? "Local AI" : "Hybrid AI",
      status: mapProviderStatus(provider),
      fallbackActive: provider.isFallback,
      lastCheckedAt: provider.lastTestedAt,
      latencyMs: provider.lastTestLatencyMs,
      endpointHost: safeHost(provider.baseUrl),
      hasApiKey: provider.hasApiKey,
    })),
  }
}

export function getAiGovernancePolicies() {
  return [
    {
      title: "Transparency Policy",
      summary: "AI outputs identify their provider, model, route, confidence, timestamp, and the reason summary available for the answer.",
    },
    {
      title: "Privacy Policy",
      summary: "Provider routing separates local, cloud, hybrid, and direct-data analysis paths and keeps provider credentials server-side.",
    },
    {
      title: "AI Usage Policy",
      summary: "UseClevr AI supports business intelligence, bookkeeping review, reporting, and dataset analysis with human review before action.",
    },
    {
      title: "Acceptable Use Policy",
      summary: "Users must not submit illegal content, secrets, unrelated personal data, or instructions that bypass tenant isolation or safety controls.",
    },
  ]
}

export function getAiLiteracyContent() {
  return [
    { title: "How AI Works", body: "UseClevr combines deterministic calculations, bounded dataset context, and configured AI providers to produce business answers." },
    { title: "Limitations", body: "AI can miss context, misunderstand poor-quality data, or fail when providers are unavailable. Direct calculations remain preferred for numeric answers." },
    { title: "Confidence", body: "Confidence reflects data completeness, provider route, deterministic support, and whether the answer used validated dataset fields." },
    { title: "Verification", body: "Users should review source data, formulas, provider route, and low-confidence warnings before using AI recommendations." },
    { title: "Human Review", body: "Users can accept, reject, edit, undo, and give feedback on AI suggestions. Manual decisions remain authoritative." },
  ]
}

function summarizeProviders(providers: PublicAiProviderConfig[]) {
  const total = providers.length
  const online = providers.filter((provider) => mapProviderStatus(provider) === "Online").length
  const fallbackActive = providers.filter((provider) => provider.isFallback).length
  const invalidKey = providers.filter((provider) => mapProviderStatus(provider) === "Invalid Key").length
  return {
    total,
    online,
    offline: providers.filter((provider) => mapProviderStatus(provider) === "Offline").length,
    rateLimited: providers.filter((provider) => mapProviderStatus(provider) === "Rate Limited").length,
    invalidKey,
    fallbackActive,
    models: providers.map((provider) => ({
      provider: labelProvider(provider.providerType, provider.providerName),
      model: provider.modelName,
      status: mapProviderStatus(provider),
      default: provider.isDefault,
      fallback: provider.isFallback,
      lastCheckedAt: provider.lastTestedAt,
      endpointHost: safeHost(provider.baseUrl),
    })),
  }
}

function summarizeAudit(
  auditEntries: Awaited<ReturnType<typeof listAiRequestAuditLogs>>,
  traces: Awaited<ReturnType<typeof safeListTraces>>,
  totalOverrides: number,
) {
  const failures = auditEntries.filter((entry) => !entry.success).length
  const feedbackCount = traces.filter((trace) => trace.feedback).length
  const averageLatencyMs = Math.round(
    average(auditEntries.map((entry) => entry.latencyMs).filter((value): value is number => typeof value === "number")),
  )
  return {
    aiRequests: auditEntries.length,
    interactionTraces: traces.length,
    feedbackCount,
    manualOverrides: totalOverrides,
    failures,
    failureRate: auditEntries.length > 0 ? Math.round((failures / auditEntries.length) * 100) : 0,
    averageLatencyMs,
    tokens: auditEntries.reduce((sum, entry) => sum + (entry.totalTokens || 0), 0),
  }
}

function buildPrivacyPosture(settings: AiGovernanceSettings, providers: PublicAiProviderConfig[]) {
  const localProviders = providers.filter((provider) => provider.providerType === "ollama" || provider.providerType === "lm-studio")
  const cloudProviders = providers.filter((provider) => !localProviders.includes(provider))
  return {
    items: [
      { label: "Data stays local?", value: settings.mode === "local" || localProviders.length > 0 ? "Available for local routes" : "No local provider configured", status: localProviders.length > 0 ? "Configured" : "Needs setup" },
      { label: "Cloud processing?", value: settings.mode === "local" ? "Disabled by selected mode" : cloudProviders.length > 0 || settings.mode === "useclevr_cloud" ? "Available" : "No cloud provider configured", status: settings.mode === "local" ? "Limited" : "Configured" },
      { label: "Provider used?", value: providers.find((provider) => provider.isDefault)?.providerName || "UseClevr Cloud fallback", status: "Configured" },
      { label: "Retention period?", value: `${settings.retentionDays} days`, status: "Configured" },
      { label: "Sensitive data detected?", value: "Trace redaction scans prompts and responses before storage", status: "Configured" },
    ],
  }
}

function buildRiskPosture(
  auditStats: ReturnType<typeof summarizeAudit>,
  providerStats: ReturnType<typeof summarizeProviders>,
  privacy: ReturnType<typeof buildPrivacyPosture>,
) {
  const risks = [
    { label: "Hallucination risk", level: auditStats.aiRequests === 0 ? "Medium" : "Managed", detail: "Direct calculations and confidence metadata reduce unsupported-answer risk." },
    { label: "Missing data", level: "Managed", detail: "Dataset-aware answers expose missing-schema and low-data explanations." },
    { label: "Low confidence", level: auditStats.feedbackCount === 0 ? "Medium" : "Managed", detail: "Feedback and manual overrides identify answers needing review." },
    { label: "Data quality", level: "Managed", detail: "Dataset scanners and deterministic checks flag incomplete fields before analysis." },
    { label: "Provider failures", level: providerStats.offline + providerStats.invalidKey + providerStats.rateLimited > 0 ? "Elevated" : "Managed", detail: "Provider health status and fallback routing show provider reliability." },
    { label: "Prompt injection detection", level: "Limited", detail: "Provider routing logs suspicious failures; dedicated injection classifiers are not yet a separate control." },
  ]
  return {
    risks,
    highCount: risks.filter((risk) => risk.level === "Elevated").length,
    privacyGaps: privacy.items.filter((item) => item.status === "Needs setup").length,
  }
}

function buildComplianceScore(input: {
  auditLogged: boolean
  providerMonitoring: boolean
  humanOversight: boolean
  privacyConfigured: boolean
  feedbackAvailable: boolean
  policiesAvailable: boolean
}) {
  const checks = [
    { label: "Transparency", complete: true },
    { label: "Logging", complete: input.auditLogged },
    { label: "Human oversight", complete: input.humanOversight },
    { label: "Provider monitoring", complete: input.providerMonitoring },
    { label: "Privacy", complete: input.privacyConfigured },
    { label: "Audit readiness", complete: input.policiesAvailable && input.auditLogged },
    { label: "Feedback", complete: input.feedbackAvailable },
  ]
  return {
    score: Math.round((checks.filter((check) => check.complete).length / checks.length) * 100),
    checks,
  }
}

function buildReports(
  auditEntries: Awaited<ReturnType<typeof listAiRequestAuditLogs>>,
  traces: Awaited<ReturnType<typeof safeListTraces>>,
  providers: PublicAiProviderConfig[],
  complianceScore: number,
) {
  return [
    { name: "AI usage report", metric: `${auditEntries.length} provider requests`, href: "/api/ai-governance/reports?type=usage" },
    { name: "Audit report", metric: `${traces.length} interaction traces`, href: "/api/ai-governance/reports?type=audit" },
    { name: "Provider statistics", metric: `${providers.length} configured providers`, href: "/api/ai-governance/reports?type=providers" },
    { name: "Error report", metric: `${auditEntries.filter((entry) => !entry.success).length} failed requests`, href: "/api/ai-governance/reports?type=errors" },
    { name: "Compliance report", metric: `${complianceScore}% readiness score`, href: "/api/ai-governance/reports?type=compliance" },
  ]
}

function toTraceSummary(trace: Awaited<ReturnType<typeof safeListTraces>>[number]) {
  return {
    id: trace.id,
    datasetId: trace.datasetId,
    prompt: trace.prompt,
    response: trace.response,
    providerName: trace.providerName,
    modelName: trace.modelName,
    tokenCount: trace.tokenCount,
    latencyMs: trace.latencyMs,
    feedback: trace.feedback,
    createdAt: trace.createdAt.toISOString(),
  }
}

function toAuditSummary(entry: Awaited<ReturnType<typeof listAiRequestAuditLogs>>[number]) {
  return {
    id: entry.id,
    userId: entry.userId,
    datasetId: entry.datasetId,
    providerName: entry.providerName,
    providerType: entry.providerType,
    modelName: entry.modelName,
    mode: entry.mode,
    timestamp: entry.createdAt.toISOString(),
    latencyMs: entry.latencyMs,
    tokens: entry.totalTokens,
    success: entry.success,
    fallbackUsed: entry.fallbackUsed,
    errorReason: entry.errorReason,
    result: entry.success ? "Success" : "Failed",
  }
}

async function getOverrideStats(user: AiGovernanceUser) {
  const db = getDb()
  if (!db) return { totalOverrides: 0, byAction: {} as Record<string, number>, recent: [] }
  const isAdmin = user.role === "superadmin"
  const where = isAdmin ? undefined : eq(aiGovernanceOverrides.userId, user.id)
  const [totalRow] = await db.select({ total: count() }).from(aiGovernanceOverrides).where(where)
  const rows = await db.query.aiGovernanceOverrides.findMany({
    where,
    orderBy: desc(aiGovernanceOverrides.createdAt),
    limit: 20,
  })
  const byAction = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.action] = (acc[row.action] || 0) + 1
    return acc
  }, {})
  return {
    totalOverrides: totalRow?.total || 0,
    byAction,
    recent: rows.map((row) => ({
      id: row.id,
      traceId: row.traceId,
      datasetId: row.datasetId,
      action: row.action,
      reason: row.reason,
      createdAt: row.createdAt.toISOString(),
    })),
  }
}

async function safeGetGovernanceSettings(userId: string) {
  try {
    return await getAiGovernanceSettings(userId)
  } catch (error) {
    logGovernanceDataError("settings-load", error)
    return defaultGovernanceSettings("automatic", [], true)
  }
}

async function safeGetOverrideStats(user: AiGovernanceUser) {
  try {
    return await getOverrideStats(user)
  } catch (error) {
    logGovernanceDataError("override-stats-query", error)
    return emptyOverrideStats()
  }
}

async function safeListProviders(userId: string) {
  return listPublicAiProviderConfigs(userId).catch((error) => {
    logGovernanceDataError("provider-list-query", error)
    return []
  })
}

async function safeListAudit(user: AiGovernanceUser, limit: number) {
  return listAiRequestAuditLogs({ userId: user.id, role: user.role, limit }).catch((error) => {
    logGovernanceDataError("request-audit-query", error)
    return []
  })
}

async function safeListTraces(user: AiGovernanceUser, limit: number) {
  const db = getDb()
  if (!db) return []
  const isAdmin = user.role === "superadmin"
  return db.query.aiInteractionTraces.findMany({
    where: isAdmin ? undefined : eq(aiInteractionTraces.userId, user.id),
    orderBy: desc(aiInteractionTraces.createdAt),
    limit,
  }).catch((error) => {
    logGovernanceDataError("interaction-trace-query", error)
    return []
  })
}

function emptyOverrideStats() {
  return {
    totalOverrides: 0,
    byAction: {} as Record<string, number>,
    recent: [] as Array<{ id: string; traceId: string | null; datasetId: string | null; action: string; reason: string | null; createdAt: string }>,
  }
}

function defaultGovernanceSettings(
  mode: AiGovernanceSettings["mode"],
  providers: PublicAiProviderConfig[],
  allowFallback: boolean,
): AiGovernanceSettings {
  return {
    preferredProviderId: providers.find((provider) => provider.isDefault)?.id || null,
    preferredModel: providers.find((provider) => provider.isDefault)?.modelName || null,
    mode,
    fallbackProviderId: allowFallback ? providers.find((provider) => provider.isFallback)?.id || null : null,
    temperature: 0.2,
    maxTokens: 4096,
    loggingEnabled: true,
    retentionDays: 90,
  }
}

function normalizeSettings(
  value: unknown,
  mode: AiGovernanceSettings["mode"],
  providers: PublicAiProviderConfig[],
  allowFallback: boolean,
) {
  const defaults = defaultGovernanceSettings(mode, providers, allowFallback)
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults
  const stored = value as Partial<AiGovernanceSettings>
  return {
    preferredProviderId: normalizeNullableId(stored.preferredProviderId) || defaults.preferredProviderId,
    preferredModel: normalizeNullableText(stored.preferredModel) || defaults.preferredModel,
    mode: normalizeGovernanceMode(stored.mode) || defaults.mode,
    fallbackProviderId: normalizeNullableId(stored.fallbackProviderId) || defaults.fallbackProviderId,
    temperature: clampNumber(stored.temperature, 0, 2, defaults.temperature),
    maxTokens: Math.round(clampNumber(stored.maxTokens, 256, 32000, defaults.maxTokens)),
    loggingEnabled: typeof stored.loggingEnabled === "boolean" ? stored.loggingEnabled : defaults.loggingEnabled,
    retentionDays: Math.round(clampNumber(stored.retentionDays, 1, 730, defaults.retentionDays)),
  }
}

function mapProviderStatus(provider: PublicAiProviderConfig) {
  const status = provider.lastTestStatus
  if (provider.isFallback && status && isHealthyStatus(status)) return "Fallback Active"
  if (!status || status === "not_tested") return "Offline"
  if (status === "connected" || status === "healthy" || status === "success") return "Online"
  if (status === "rate_limited") return "Rate Limited"
  if (status === "invalid_key" || status === "auth_failed") return "Invalid Key"
  return "Offline"
}

function labelProvider(type: string, name: string) {
  if (/gemini|google/i.test(type) || /gemini/i.test(name)) return "Gemini"
  if (/anthropic|claude/i.test(type) || /claude/i.test(name)) return "Claude"
  if (/azure/i.test(type) || /azure/i.test(name)) return "Azure OpenAI"
  if (/ollama/i.test(type) || /ollama/i.test(name)) return "Ollama"
  if (/openai/i.test(type) || /openai/i.test(name)) return "OpenAI"
  return name || type
}

function safeHost(value: string) {
  try {
    return new URL(value).host || "local"
  } catch {
    return value.startsWith("http://localhost") ? "localhost" : "configured endpoint"
  }
}

function isHealthyStatus(value: string) {
  return value === "connected" || value === "healthy" || value === "success"
}

function settingsKey(userId: string) {
  return `ai-governance-settings:${userId}`
}

function normalizeNullableText(value: unknown) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed || null
}

function normalizeNullableId(value: unknown) {
  const text = normalizeNullableText(value)
  return text ? text.slice(0, 160) : null
}

function normalizeLongText(value: unknown) {
  const text = normalizeNullableText(value)
  return text ? text.slice(0, 5000) : null
}

function normalizeGovernanceMode(value: unknown): AiGovernanceSettings["mode"] | null {
  if (value === "automatic" || value === "local" || value === "byok" || value === "useclevr_cloud") return value
  return null
}

function normalizeLimit(value: unknown) {
  const numeric = Number(value ?? 100)
  if (!Number.isFinite(numeric)) return 100
  return Math.max(1, Math.min(250, Math.floor(numeric)))
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(min, Math.min(max, numeric))
}

function average(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function logGovernanceDataError(stage: string, error: unknown) {
  debugError("[AI_GOVERNANCE] Data source failed", {
    stage,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  })
}
