import { randomUUID } from "node:crypto"

import {
  getAiMode,
  getUseClevrCloudFallbackAllowed,
  listPublicAiProviderConfigs,
  toPublicAiMode,
  type PublicAiProviderConfig,
} from "@/lib/ai/byoai-provider"
import {
  classifyAuditFailureCategory,
  listAiRequestAuditLogs,
  type AiAuditFailureCategory,
  type AiRequestAuditEntry,
} from "@/lib/ai/ai-request-audit"
import {
  MANAGED_CLOUD_MODEL_NAME,
  MANAGED_CLOUD_PROVIDER_NAME,
  isManagedCloudConfigured,
} from "@/lib/ai/managed-cloud-provider"
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

export type GovernanceExecutionRoute = "managed_cloud" | "byok_cloud" | "local" | "deterministic"

export type GovernanceExecutionOrigin = {
  route: GovernanceExecutionRoute
  providerName: string
  modelName: string
  mode: string
  fallbackUsed: boolean
  occurredAt: string
}

export type GovernanceLatestAttempt = {
  success: boolean
  providerName: string
  modelName: string
  mode: string
  fallbackUsed: boolean
  failureCategory: AiAuditFailureCategory | null
  occurredAt: string
}

export type GovernanceProviderRuntime = {
  managedCloudConfigured: boolean
  managedCloudMonitored: boolean
  managedCloudModel: string
  recentAttempts: number
  recentSuccesses: number
  recentFailures: number
  recentFallbackUses: number
  failureCategories: Partial<Record<AiAuditFailureCategory, number>>
  lastSuccessAt: string | null
  lastFailureAt: string | null
  executionOrigin: GovernanceExecutionOrigin | null
  latestAttempt: GovernanceLatestAttempt | null
  latestManagedAttempt: GovernanceLatestAttempt | null
}

export async function getAiGovernanceSnapshot(user: AiGovernanceUser) {
  try {
    const [providers, settings, auditEntries, traces, overrideStats, allowUseclevrCloudFallback] = await Promise.all([
      safeListProviders(user.id),
      safeGetGovernanceSettings(user.id),
      safeListAudit(user, 100),
      safeListTraces(user, 50),
      safeGetOverrideStats(user),
      getUseClevrCloudFallbackAllowed(user.id).catch(() => true),
    ])

    return buildGovernanceSnapshot({
      providers,
      settings,
      auditEntries,
      traces,
      overrideStats,
      allowUseclevrCloudFallback,
    })
  } catch (error) {
    logGovernanceDataError("snapshot-build", error)
    return buildGovernanceSnapshot({
      providers: [],
      settings: defaultGovernanceSettings("automatic", [], true),
      auditEntries: [],
      traces: [],
      overrideStats: emptyOverrideStats(),
      allowUseclevrCloudFallback: true,
    })
  }
}

function buildGovernanceSnapshot(input: {
  providers: PublicAiProviderConfig[]
  settings: AiGovernanceSettings
  auditEntries: Awaited<ReturnType<typeof listAiRequestAuditLogs>>
  traces: Awaited<ReturnType<typeof safeListTraces>>
  overrideStats: Awaited<ReturnType<typeof safeGetOverrideStats>>
  allowUseclevrCloudFallback: boolean
}) {
  const runtime = buildProviderRuntime({
    providers: input.providers,
    auditEntries: input.auditEntries,
    traces: input.traces,
    allowUseclevrCloudFallback: input.allowUseclevrCloudFallback,
  })
  const providerStats = summarizeProviders(input.providers, runtime)
  const auditStats = summarizeAudit(input.auditEntries, input.traces, input.overrideStats.totalOverrides)
  const privacy = buildPrivacyPosture(input.settings, input.providers, runtime)
  const risk = buildRiskPosture(auditStats, providerStats, privacy, runtime)
  const compliance = buildComplianceScore({
    auditLogged: input.auditEntries.length > 0 || input.traces.length > 0,
    providerMonitoring: providerStats.total > 0,
    humanOversight: input.overrideStats.totalOverrides > 0,
    privacyConfigured: privacy.items.every((item) => item.status !== "Needs setup"),
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
    runtime,
    recentTraces: input.traces.map(toTraceSummary),
    recentAuditEntries: input.auditEntries.map(toAuditSummary),
    overrides: input.overrideStats,
    policies: getAiGovernancePolicies(),
    literacy: getAiLiteracyContent(),
    reports: buildReports(input.auditEntries, input.traces, providerStats.total, compliance.score),
  }
}

export function buildProviderRuntime(input: {
  providers: PublicAiProviderConfig[]
  auditEntries: AiRequestAuditEntry[]
  traces: Awaited<ReturnType<typeof safeListTraces>>
  allowUseclevrCloudFallback: boolean
}): GovernanceProviderRuntime {
  const managedEntries = input.auditEntries.filter((entry) => entry.providerType === "default-cloud")
  const managedCloudConfigured = isManagedCloudConfigured()
  const managedCloudMonitored = managedCloudConfigured || managedEntries.length > 0 || input.allowUseclevrCloudFallback

  const successful = input.auditEntries.filter((entry) => entry.success)
  const failed = input.auditEntries.filter((entry) => !entry.success)
  const failureCategories = failedEntriesByCategory(input.auditEntries)

  const successAudit = successful.find((entry) => entry.success) || null
  const successTrace = input.traces.find((trace) => !trace.error && trace.response) || null
  const executionOrigin = successAudit
    ? executionOriginFromAudit(successAudit)
    : successTrace
      ? executionOriginFromTrace(successTrace)
      : null

  const latestEntry = input.auditEntries[0] || null
  const latestAttempt: GovernanceLatestAttempt | null = latestEntry
    ? {
        success: latestEntry.success,
        providerName: latestEntry.providerName,
        modelName: latestEntry.modelName,
        mode: latestEntry.mode,
        fallbackUsed: latestEntry.fallbackUsed,
        failureCategory: latestEntry.success ? null : classifyAuditFailureCategory(latestEntry.errorReason),
        occurredAt: latestEntry.createdAt.toISOString(),
      }
    : null

  const latestManagedEntry = managedEntries[0] || null
  const latestManagedAttempt: GovernanceLatestAttempt | null = latestManagedEntry
    ? {
        success: latestManagedEntry.success,
        providerName: latestManagedEntry.providerName,
        modelName: latestManagedEntry.modelName,
        mode: latestManagedEntry.mode,
        fallbackUsed: latestManagedEntry.fallbackUsed,
        failureCategory: latestManagedEntry.success ? null : classifyAuditFailureCategory(latestManagedEntry.errorReason),
        occurredAt: latestManagedEntry.createdAt.toISOString(),
      }
    : null

  return {
    managedCloudConfigured,
    managedCloudMonitored,
    managedCloudModel: MANAGED_CLOUD_MODEL_NAME,
    recentAttempts: input.auditEntries.length,
    recentSuccesses: successful.length,
    recentFailures: failed.length,
    recentFallbackUses: input.auditEntries.filter((entry) => entry.fallbackUsed).length,
    failureCategories,
    lastSuccessAt: successAudit?.createdAt.toISOString() ?? null,
    lastFailureAt: failed[0]?.createdAt.toISOString() ?? null,
    executionOrigin,
    latestAttempt,
    latestManagedAttempt,
  }
}

function failedEntriesByCategory(entries: AiRequestAuditEntry[]) {
  return entries.reduce<Partial<Record<AiAuditFailureCategory, number>>>((acc, entry) => {
    if (entry.success) return acc
    const category = classifyAuditFailureCategory(entry.errorReason)
    acc[category] = (acc[category] || 0) + 1
    return acc
  }, {})
}

export function executionOriginFromAudit(entry: AiRequestAuditEntry): GovernanceExecutionOrigin {
  return {
    route: executionRouteFromEntry(entry.providerType, entry.providerName, entry.modelName),
    providerName: entry.providerName,
    modelName: entry.modelName,
    mode: entry.mode,
    fallbackUsed: entry.fallbackUsed,
    occurredAt: entry.createdAt.toISOString(),
  }
}

export function executionOriginFromTrace(trace: {
  providerName: string
  modelName: string
  createdAt: Date
}): GovernanceExecutionOrigin {
  return {
    route: executionRouteFromEntry("", trace.providerName, trace.modelName),
    providerName: trace.providerName,
    modelName: trace.modelName,
    mode: "auto",
    fallbackUsed: false,
    occurredAt: trace.createdAt.toISOString(),
  }
}

function executionRouteFromEntry(providerType: string, providerName: string, modelName: string): GovernanceExecutionRoute {
  const normalizedType = (providerType || "").toLowerCase()
  const normalizedName = (providerName || "").toLowerCase()
  const normalizedModel = (modelName || "").toLowerCase()
  if (/direct data analysis/.test(normalizedName) || /deterministic/.test(normalizedModel) || normalizedType === "none") {
    return "deterministic"
  }
  if (normalizedType === "default-cloud") return "managed_cloud"
  if (normalizedType === "ollama" || normalizedType === "lm-studio") return "local"
  return "byok_cloud"
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
  const [providers, auditEntries] = await Promise.all([
    safeListProviders(userId),
    safeListAudit({ id: userId, role: null }, 100),
  ])
  const runtime = buildProviderRuntime({
    providers,
    auditEntries,
    traces: [],
    allowUseclevrCloudFallback: await getUseClevrCloudFallbackAllowed(userId).catch(() => true),
  })
  return {
    generatedAt: new Date().toISOString(),
    providers: buildMonitoredProviderEntries(providers, runtime).map((provider) => ({
      id: provider.id,
      provider: provider.provider,
      model: provider.model,
      mode: provider.mode,
      status: provider.status,
      fallbackActive: provider.fallback,
      lastCheckedAt: provider.lastCheckedAt,
      latencyMs: provider.latencyMs,
      endpointHost: provider.endpointHost,
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

export type MonitoredProviderEntry = {
  id: string
  provider: string
  model: string
  mode: string
  status: string
  default: boolean
  fallback: boolean
  managed: boolean
  lastCheckedAt: string | null
  latencyMs: number | null
  endpointHost: string
  hasApiKey: boolean
}

export function buildMonitoredProviderEntries(
  providers: PublicAiProviderConfig[],
  runtime: GovernanceProviderRuntime,
): MonitoredProviderEntry[] {
  const tenantEntries: MonitoredProviderEntry[] = providers.map((provider) => ({
    id: provider.id,
    provider: labelProvider(provider.providerType, provider.providerName),
    model: provider.modelName,
    mode: provider.providerType === "ollama" || provider.providerType === "lm-studio" ? "Local AI" : "Hybrid AI",
    status: mapProviderStatus(provider),
    default: provider.isDefault,
    fallback: provider.isFallback,
    managed: false,
    lastCheckedAt: provider.lastTestedAt,
    latencyMs: provider.lastTestLatencyMs,
    endpointHost: safeHost(provider.baseUrl),
    hasApiKey: provider.hasApiKey,
  }))

  if (!runtime.managedCloudMonitored) return tenantEntries

  return [managedCloudProviderEntry(runtime), ...tenantEntries]
}

function managedCloudProviderEntry(runtime: GovernanceProviderRuntime): MonitoredProviderEntry {
  return {
    id: "managed-useclevr-cloud",
    provider: MANAGED_CLOUD_PROVIDER_NAME,
    model: MANAGED_CLOUD_MODEL_NAME,
    mode: "Cloud AI",
    status: managedCloudStatus(runtime),
    default: false,
    fallback: false,
    managed: true,
    lastCheckedAt: runtime.lastSuccessAt || runtime.lastFailureAt,
    latencyMs: null,
    endpointHost: "UseClevr-managed",
    hasApiKey: runtime.managedCloudConfigured,
  }
}

function managedCloudStatus(runtime: GovernanceProviderRuntime) {
  if (!runtime.managedCloudConfigured) return "Missing Key"
  const managedStatus = latestManagedCloudAuditStatus(runtime)
  if (managedStatus) return managedStatus
  return "Not tested"
}

export function latestManagedCloudAuditStatus(runtime: GovernanceProviderRuntime) {
  if (!runtime.latestManagedAttempt) return null
  if (runtime.latestManagedAttempt.success) return "Online"
  switch (runtime.latestManagedAttempt.failureCategory) {
    case "credential_missing":
      return "Missing Key"
    case "credential_invalid":
      return "Invalid Key"
    case "rate_limited":
      return "Rate Limited"
    default:
      return "Offline"
  }
}

function summarizeProviders(providers: PublicAiProviderConfig[], runtime: GovernanceProviderRuntime) {
  const entries = buildMonitoredProviderEntries(providers, runtime)
  const statusOf = (entry: MonitoredProviderEntry) => entry.status
  const online = entries.filter((entry) => statusOf(entry) === "Online" || statusOf(entry) === "Fallback Active").length
  const offline = entries.filter((entry) => statusOf(entry) === "Offline").length
  const rateLimited = entries.filter((entry) => statusOf(entry) === "Rate Limited").length
  const invalidKey = entries.filter((entry) => statusOf(entry) === "Invalid Key").length
  const missingCredential = entries.filter((entry) => statusOf(entry) === "Missing Key").length
  const notTested = entries.filter((entry) => statusOf(entry) === "Not tested").length
  return {
    total: entries.length,
    online,
    offline,
    rateLimited,
    invalidKey,
    missingCredential,
    notTested,
    fallbackConfigured: providers.filter((provider) => provider.isFallback).length,
    fallbackUsed: runtime.recentFallbackUses,
    fallbackActive: providers.filter((provider) => provider.isFallback).length,
    managedCloudConfigured: runtime.managedCloudConfigured,
    managedCloudMonitored: runtime.managedCloudMonitored,
    models: entries.map((entry) => ({
      provider: entry.provider,
      model: entry.model,
      status: entry.status,
      default: entry.default,
      fallback: entry.fallback,
      managed: entry.managed,
      lastCheckedAt: entry.lastCheckedAt,
      endpointHost: entry.endpointHost,
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

function buildPrivacyPosture(
  settings: AiGovernanceSettings,
  providers: PublicAiProviderConfig[],
  runtime: GovernanceProviderRuntime,
) {
  const localProviders = providers.filter((provider) => provider.providerType === "ollama" || provider.providerType === "lm-studio")
  const byokCloudProviders = providers.filter(
    (provider) => provider.providerType !== "ollama" && provider.providerType !== "lm-studio" && provider.providerType !== "useclevr_cloud",
  )
  const executionOrigin = runtime.executionOrigin

  let providerUsedValue: string
  let providerUsedStatus: "Configured" | "Needs data"
  if (executionOrigin) {
    const routeLabel = executionOrigin.route === "managed_cloud"
      ? " (UseClevr-managed cloud)"
      : executionOrigin.route === "deterministic"
        ? " (direct data analysis)"
        : executionOrigin.fallbackUsed
          ? " (fallback route)"
          : ""
    providerUsedValue = `${executionOrigin.providerName}${routeLabel}`
    providerUsedStatus = "Configured"
  } else if (runtime.latestAttempt && !runtime.latestAttempt.success) {
    providerUsedValue = "No successful provider response (last request failed)"
    providerUsedStatus = "Needs data"
  } else {
    providerUsedValue = "No AI provider responses recorded yet"
    providerUsedStatus = "Needs data"
  }

  const cloudValue = settings.mode === "local"
    ? "Disabled by selected mode"
    : runtime.managedCloudConfigured
      ? byokCloudProviders.length > 0
        ? "UseClevr-managed cloud available, plus BYOAI provider configured"
        : "UseClevr-managed cloud available"
      : byokCloudProviders.length > 0
        ? "BYOAI cloud provider configured"
        : "No cloud provider configured"

  const cloudStatus = settings.mode === "local"
    ? "Limited"
    : runtime.managedCloudConfigured || byokCloudProviders.length > 0
      ? "Configured"
      : "Needs setup"

  return {
    items: [
      { label: "Data stays local?", value: settings.mode === "local" || localProviders.length > 0 ? "Available for local routes" : "No local provider configured", status: localProviders.length > 0 ? "Configured" : "Needs setup" },
      { label: "Cloud processing?", value: cloudValue, status: cloudStatus },
      { label: "Provider used?", value: providerUsedValue, status: providerUsedStatus },
      { label: "Retention period?", value: `${settings.retentionDays} days`, status: "Configured" },
      { label: "Sensitive data detected?", value: "Trace redaction scans prompts and responses before storage", status: "Configured" },
    ],
  }
}

function buildRiskPosture(
  auditStats: ReturnType<typeof summarizeAudit>,
  providerStats: ReturnType<typeof summarizeProviders>,
  privacy: ReturnType<typeof buildPrivacyPosture>,
  runtime: GovernanceProviderRuntime,
) {
  const topFailureCategory = topFailureCategoryOf(runtime)
  const configProblems = providerStats.offline + providerStats.invalidKey + providerStats.rateLimited + providerStats.missingCredential
  const providerFailureElevated = runtime.recentFailures > 0 || configProblems > 0
  const risks = [
    { label: "Hallucination risk", level: auditStats.aiRequests === 0 ? "Medium" : "Managed", detail: "Direct calculations and confidence metadata reduce unsupported-answer risk." },
    { label: "Missing data", level: "Managed", detail: "Dataset-aware answers expose missing-schema and low-data explanations." },
    { label: "Low confidence", level: auditStats.feedbackCount === 0 ? "Medium" : "Managed", detail: "Feedback and manual overrides identify answers needing review." },
    { label: "Data quality", level: "Managed", detail: "Dataset scanners and deterministic checks flag incomplete fields before analysis." },
    {
      label: "Provider failures",
      level: providerFailureElevated ? "Elevated" : "Managed",
      detail: runtime.recentFailures > 0
        ? `${runtime.recentFailures} failed provider request${runtime.recentFailures === 1 ? "" : "s"} in the recent audit window${topFailureCategory ? ` (${topFailureCategory})` : ""}.`
        : "Provider health status and fallback routing show provider reliability.",
    },
    { label: "Prompt injection detection", level: "Limited", detail: "Provider routing logs suspicious failures; dedicated injection classifiers are not yet a separate control." },
  ]
  return {
    risks,
    highCount: risks.filter((risk) => risk.level === "Elevated").length,
    privacyGaps: privacy.items.filter((item) => item.status === "Needs setup").length,
  }
}

function topFailureCategoryOf(runtime: GovernanceProviderRuntime) {
  const categories = runtime.failureCategories
  let top: AiAuditFailureCategory | null = null
  let topCount = 0
  for (const [category, countValue] of Object.entries(categories)) {
    const typed = category as AiAuditFailureCategory
    if ((countValue ?? 0) > topCount) {
      top = typed
      topCount = countValue ?? 0
    }
  }
  return top
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
  providerTotal: number,
  complianceScore: number,
) {
  return [
    { name: "AI usage report", metric: `${auditEntries.length} provider requests`, href: "/api/ai-governance/reports?type=usage" },
    { name: "Audit report", metric: `${traces.length} interaction traces`, href: "/api/ai-governance/reports?type=audit" },
    { name: "Provider statistics", metric: `${providerTotal} monitored providers`, href: "/api/ai-governance/reports?type=providers" },
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

function toAuditSummary(entry: AiRequestAuditEntry) {
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
    failureCategory: entry.success ? null : classifyAuditFailureCategory(entry.errorReason),
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
  if (!status || status === "not_tested") return "Not tested"
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

export const __governanceTestHooks = {
  buildProviderRuntime,
  buildMonitoredProviderEntries,
  summarizeProviders,
  buildPrivacyPosture,
  buildRiskPosture,
  buildComplianceScore,
  executionOriginFromAudit,
  latestManagedCloudAuditStatus,
  managedCloudProviderEntry,
}
