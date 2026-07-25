import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { db } from "@/lib/db";
import { aiProviderConfigs, appSettings } from "@/lib/db/schema";
import { getHybridAiFeatureAccess } from "@/lib/hybrid-ai/feature-gate";
import { debugError, debugLog, debugWarn } from "@/lib/utils/debug";
import { normalizeProviderUsage, type ProviderUsage } from "@/lib/billing/provider-usage";
import { and, asc, desc, eq, ne } from "drizzle-orm";

export type AiProviderType =
  | "ollama"
  | "lm-studio"
  | "openai-compatible"
  | "openai_compatible"
  | "useclevr_cloud"
  | "openai"
  | "anthropic"
  | "google-gemini"
  | "google_gemini"
  | "azure-openai";

export type AiMode = "auto" | "local-only" | "cloud-only" | "automatic" | "local" | "byok" | "useclevr_cloud";
export type AiProviderHealthStatus =
  | "connected"
  | "invalid_key"
  | "model_unavailable"
  | "endpoint_unreachable"
  | "rate_limited"
  | "provider_error"
  | "configuration_error"
  | "healthy"
  | "unreachable"
  | "auth_failed"
  | "model_missing"
  | "failed"
  | "not_tested";

export type PublicAiProviderConfig = {
  id: string;
  providerType: AiProviderType;
  providerName: string;
  baseUrl: string;
  modelName: string;
  hasApiKey: boolean;
  apiKeyPreview: string | null;
  selected: boolean;
  enabled: boolean;
  isDefault: boolean;
  isFallback: boolean;
  priority: number;
  lastTestStatus: string | null;
  lastTestMessage: string | null;
  lastTestLatencyMs: number | null;
  lastTestModels: string[];
  lastTestedAt: string | null;
};

export type AiProviderInput = {
  id?: string;
  providerName: string;
  providerType: AiProviderType;
  baseUrl: string;
  modelName: string;
  apiKey?: string;
  enabled?: boolean;
  isDefault?: boolean;
  isFallback?: boolean;
  priority?: number;
};

type PrivateAiProviderConfig = PublicAiProviderConfig & {
  apiKey: string | null;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
    text?: unknown;
  }>;
  usage?: Record<string, unknown>;
  error?: unknown;
};

type AnthropicMessageResponse = {
  content?: Array<{ type?: string; text?: unknown }>;
  usage?: Record<string, unknown>;
  error?: { message?: unknown; type?: unknown };
};

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: unknown }>;
    };
  }>;
  usageMetadata?: Record<string, unknown>;
  error?: { message?: unknown; status?: unknown };
};

type ModelListResponse = {
  data?: Array<{ id?: unknown; name?: unknown }>;
  models?: Array<{ name?: unknown; id?: unknown } | string>;
};

export type AiProviderTestResult = {
  success: boolean;
  status: AiProviderHealthStatus;
  message: string;
  providerName: string;
  providerType: AiProviderType;
  modelName: string;
  latencyMs: number;
  availableModels: string[];
  modelConfirmed: boolean;
  sample: string;
  checkedAt: string;
};

export type AiProviderHealthCheckResult = {
  providerId: string;
  providerName: string;
  providerType: AiProviderType;
  modelName: string;
  status: AiProviderHealthStatus;
  success: boolean;
  message: string;
  latencyMs: number | null;
  availableModels: string[];
  modelConfirmed: boolean;
  checkedAt: string;
};

export type UniversalAiGenerateResult = {
  text: string;
  providerName: string;
  providerType: AiProviderType;
  modelName: string;
  fallbackUsed: boolean;
  mode: AiMode;
  route: "local" | "cloud";
  routingReason: string;
  latencyMs: number;
  usage?: ProviderUsage;
};

type ProviderChatResult = {
  text: string;
  usage?: ProviderUsage;
};

export class LocalAiUnavailableError extends Error {
  constructor(message = "Local provider unavailable.") {
    super(message);
    this.name = "LocalAiUnavailableError";
  }
}

const TEST_PROMPT = "Reply with exactly: UseClevr BYOAI OK";
const REQUEST_TIMEOUT_MS = 25_000;
const DEFAULT_BASE_URLS: Record<AiProviderType, string> = {
  ollama: "http://localhost:11434/v1",
  "lm-studio": "http://localhost:1234/v1",
  "openai-compatible": "",
  openai_compatible: "",
  useclevr_cloud: "",
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com",
  "google-gemini": "https://generativelanguage.googleapis.com/v1beta",
  google_gemini: "https://generativelanguage.googleapis.com/v1beta",
  "azure-openai": "",
};

export const AI_PROVIDER_TYPE_LABELS: Record<AiProviderType, string> = {
  ollama: "Ollama",
  "lm-studio": "LM Studio",
  "openai-compatible": "OpenAI Compatible",
  openai_compatible: "OpenAI Compatible",
  useclevr_cloud: "UseClevr Cloud",
  openai: "OpenAI",
  anthropic: "Anthropic",
  "google-gemini": "Google Gemini",
  google_gemini: "Google Gemini",
  "azure-openai": "Azure OpenAI",
};

const AI_MODE_KEY_PREFIX = "ai-provider-mode:";
const LOCAL_PROVIDER_TYPES: AiProviderType[] = ["ollama", "lm-studio"];
const CLOUD_PROVIDER_TYPES: AiProviderType[] = ["openai", "anthropic", "google-gemini", "google_gemini", "azure-openai", "openai-compatible", "openai_compatible"];
const ENCRYPTION_KEY_VERSION = 2;
const ENCRYPTION_KEY_LENGTH = 32;

export async function getAiMode(userId: string): Promise<AiMode> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, aiModeKey(userId)))
    .limit(1);
  const mode = typeof row?.value === "object" && row.value && "mode" in row.value
    ? (row.value as { mode?: unknown }).mode
    : null;
  return normalizeAiMode(mode);
}

export function toPublicAiMode(mode: AiMode): "automatic" | "local" | "byok" | "useclevr_cloud" {
  const normalized = normalizeAiMode(mode);
  if (normalized === "local-only") return "local";
  if (normalized === "cloud-only") return "useclevr_cloud";
  if (normalized === "byok") return "byok";
  return "automatic";
}

export async function setAiMode(userId: string, mode: AiMode, options: { allowUseclevrCloudFallback?: boolean } = {}) {
  const normalized = normalizeAiMode(mode);
  const allowUseclevrCloudFallback =
    options.allowUseclevrCloudFallback ??
    (normalized === "local-only" || normalized === "byok" ? false : await getUseClevrCloudFallbackAllowed(userId));
  await db
    .insert(appSettings)
    .values({
      key: aiModeKey(userId),
      value: { mode: normalized, allowUseclevrCloudFallback },
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value: { mode: normalized, allowUseclevrCloudFallback },
        updatedAt: new Date(),
      },
    });
}

export async function getUseClevrCloudFallbackAllowed(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, aiModeKey(userId)))
    .limit(1);
  const value = typeof row?.value === "object" && row.value && "allowUseclevrCloudFallback" in row.value
    ? (row.value as { allowUseclevrCloudFallback?: unknown }).allowUseclevrCloudFallback
    : undefined;
  if (value !== undefined) return value === true;

  const storedMode = typeof row?.value === "object" && row.value && "mode" in row.value
    ? (row.value as { mode?: unknown }).mode
    : undefined;
  const mode = normalizeAiMode(storedMode);
  return mode !== "local-only" && mode !== "byok";
}

export async function listPublicAiProviderConfigs(userId: string): Promise<PublicAiProviderConfig[]> {
  const rows = await db.query.aiProviderConfigs.findMany({
    where: eq(aiProviderConfigs.userId, userId),
    orderBy: [
      desc(aiProviderConfigs.isDefault),
      asc(aiProviderConfigs.priority),
      desc(aiProviderConfigs.updatedAt),
    ],
  });

  return rows.map(toPublicConfig);
}

export async function getPublicAiProviderConfig(userId: string): Promise<PublicAiProviderConfig | null> {
  const providers = await listPublicAiProviderConfigs(userId);
  return providers.find((provider) => provider.isDefault) || providers[0] || null;
}

export async function getPrivateAiProviderConfig(userId: string): Promise<PrivateAiProviderConfig | null> {
  const providers = await listPrivateAiProviderConfigs(userId);
  return providers[0] || null;
}

export async function listPrivateAiProviderConfigs(userId: string): Promise<PrivateAiProviderConfig[]> {
  const rows = await db.query.aiProviderConfigs.findMany({
    where: and(eq(aiProviderConfigs.userId, userId), eq(aiProviderConfigs.selected, true)),
    orderBy: [
      desc(aiProviderConfigs.isDefault),
      desc(aiProviderConfigs.isFallback),
      asc(aiProviderConfigs.priority),
      desc(aiProviderConfigs.updatedAt),
    ],
  });

  return rows
    .map((row) => ({
      ...toPublicConfig(row),
      providerType: normalizeProviderType(row.providerType),
      apiKey: row.encryptedApiKey ? decryptSecret(row.encryptedApiKey) : null,
    }))
    .filter((provider) => provider.enabled);
}

export async function listPrivateAiProviderConfigsForMode(userId: string, mode: AiMode): Promise<PrivateAiProviderConfig[]> {
  const providers = await listPrivateAiProviderConfigs(userId);
  const normalizedMode = normalizeAiMode(mode);
  if (normalizedMode === "local-only") return providers.filter((provider) => isLocalProvider(provider.providerType));
  if (normalizedMode === "cloud-only") return [];
  if (normalizedMode === "byok") return providers.filter((provider) => isByokProvider(provider.providerType));
  const localProviders = providers.filter((provider) => isLocalProvider(provider.providerType));
  const cloudProviders = providers.filter((provider) => isByokProvider(provider.providerType));
  return [...localProviders, ...cloudProviders];
}

export async function saveAiProviderConfig(userId: string, input: AiProviderInput) {
  const normalized = normalizeAiProviderInput(input);
  const existing = normalized.id
    ? await db.query.aiProviderConfigs.findFirst({
        where: and(eq(aiProviderConfigs.userId, userId), eq(aiProviderConfigs.id, normalized.id)),
      })
    : null;
  const encryptedApiKey =
    normalized.apiKey !== undefined
      ? normalized.apiKey
        ? encryptSecret(normalized.apiKey)
        : null
      : existing?.encryptedApiKey ?? null;
  const now = new Date();
  const id = existing?.id || `aip_${randomUUID().replaceAll("-", "").slice(0, 20)}`;

  if (normalized.isDefault) {
    await db
      .update(aiProviderConfigs)
      .set({ isDefault: false, updatedAt: now })
      .where(eq(aiProviderConfigs.userId, userId));
  }

  if (normalized.isFallback) {
    await db
      .update(aiProviderConfigs)
      .set({ isFallback: false, updatedAt: now })
      .where(eq(aiProviderConfigs.userId, userId));
  }

  if (existing) {
    await db
      .update(aiProviderConfigs)
      .set({
        providerType: normalized.providerType,
        providerName: normalized.providerName,
        baseUrl: normalized.baseUrl,
        modelName: normalized.modelName,
        encryptedApiKey,
        selected: normalized.enabled,
        isEnabled: normalized.enabled,
        isDefault: normalized.isDefault,
        isFallback: normalized.isFallback && !normalized.isDefault,
        priority: normalized.priority,
        updatedAt: now,
      })
      .where(and(eq(aiProviderConfigs.userId, userId), eq(aiProviderConfigs.id, id)));
  } else {
    const existingCount = await db.query.aiProviderConfigs.findMany({
      where: eq(aiProviderConfigs.userId, userId),
      columns: { id: true },
    });
    const shouldDefault = normalized.isDefault || existingCount.length === 0;
    if (shouldDefault) {
      await db
        .update(aiProviderConfigs)
        .set({ isDefault: false, updatedAt: now })
        .where(eq(aiProviderConfigs.userId, userId));
    }

    await db.insert(aiProviderConfigs).values({
      id,
      userId,
      providerType: normalized.providerType,
      providerName: normalized.providerName,
      baseUrl: normalized.baseUrl,
      modelName: normalized.modelName,
      encryptedApiKey,
      selected: normalized.enabled,
      isEnabled: normalized.enabled,
      isDefault: shouldDefault,
      isFallback: normalized.isFallback && !shouldDefault,
      priority: normalized.priority,
      createdAt: now,
      updatedAt: now,
    });
  }

  const saved = (await listPublicAiProviderConfigs(userId)).find((provider) => provider.id === id);
  if (!saved) throw new Error("Provider was not saved.");
  return saved;
}

export async function deleteAiProviderConfig(userId: string, providerId: string) {
  const id = providerId.trim();
  if (!id) throw new Error("Provider id is required.");

  const [deleted] = await db
    .delete(aiProviderConfigs)
    .where(and(eq(aiProviderConfigs.userId, userId), eq(aiProviderConfigs.id, id)))
    .returning();

  if (!deleted) throw new Error("Provider was not found.");

  const [nextProvider] = await db
    .select({ id: aiProviderConfigs.id })
    .from(aiProviderConfigs)
    .where(and(eq(aiProviderConfigs.userId, userId), eq(aiProviderConfigs.isEnabled, true)))
    .orderBy(asc(aiProviderConfigs.priority), desc(aiProviderConfigs.updatedAt))
    .limit(1);

  if (deleted.isDefault && nextProvider) {
    await setDefaultAiProvider(userId, nextProvider.id);
  }

  return { id: deleted.id };
}

export async function testAiProviderConfig(input: AiProviderInput) {
  const normalized = normalizeAiProviderInput(input);
  const privateProvider: PrivateAiProviderConfig = {
    id: normalized.id || "unsaved",
    providerType: normalized.providerType,
    providerName: normalized.providerName,
    baseUrl: normalized.baseUrl,
    modelName: normalized.modelName,
    hasApiKey: Boolean(normalized.apiKey),
    apiKeyPreview: normalized.apiKey ? maskSecretPreview(normalized.apiKey) : null,
    selected: normalized.enabled,
    enabled: normalized.enabled,
    isDefault: normalized.isDefault,
    isFallback: normalized.isFallback,
    priority: normalized.priority,
    lastTestStatus: null,
    lastTestMessage: null,
    lastTestLatencyMs: null,
    lastTestModels: [],
    lastTestedAt: null,
    apiKey: normalized.apiKey || null,
  };

  return testPrivateProvider(privateProvider);
}

export async function testSavedAiProviderConfig(userId: string, input?: Partial<AiProviderInput>) {
  const providers = await listPrivateAiProviderConfigs(userId);
  const requestedId = input?.id?.trim();
  const saved = requestedId
    ? providers.find((provider) => provider.id === requestedId)
    : providers[0];
  if (!saved) {
    throw new Error(requestedId ? "Provider was not found." : "Save an AI provider before testing without an API key.");
  }

  return testPrivateProvider({
    ...saved,
    providerName: input?.providerName || saved.providerName,
    providerType: input?.providerType || saved.providerType,
    baseUrl: input?.baseUrl ? normalizeBaseUrl(input.baseUrl, input?.providerType || saved.providerType) : saved.baseUrl,
    modelName: input?.modelName || saved.modelName,
    apiKey: input?.apiKey !== undefined ? input.apiKey || null : saved.apiKey,
    isFallback: input?.isFallback ?? saved.isFallback,
    priority: input?.priority ?? saved.priority,
  });
}

export async function setAiProviderRouting(
  userId: string,
  input: { defaultProviderId?: string; fallbackProviderId?: string },
) {
  const defaultProviderId = input.defaultProviderId?.trim();
  const fallbackProviderId = input.fallbackProviderId?.trim();
  const requestedIds = [defaultProviderId, fallbackProviderId].filter((value): value is string => Boolean(value));
  if (requestedIds.length) {
    const existingProviders = await db.query.aiProviderConfigs.findMany({
      where: eq(aiProviderConfigs.userId, userId),
      columns: { id: true },
    });
    const ownedIds = new Set(existingProviders.map((provider) => provider.id));
    const missingId = requestedIds.find((id) => !ownedIds.has(id));
    if (missingId) throw new Error("Provider was not found.");
  }

  const now = new Date();

  await db
    .update(aiProviderConfigs)
    .set({ isDefault: false, isFallback: false, updatedAt: now })
    .where(eq(aiProviderConfigs.userId, userId));

  if (defaultProviderId) {
    await db
      .update(aiProviderConfigs)
      .set({ isDefault: true, selected: true, isEnabled: true, priority: 0, updatedAt: now })
      .where(and(eq(aiProviderConfigs.userId, userId), eq(aiProviderConfigs.id, defaultProviderId)));
  }

  if (fallbackProviderId && fallbackProviderId !== defaultProviderId) {
    await db
      .update(aiProviderConfigs)
      .set({ isFallback: true, selected: true, isEnabled: true, priority: 10, updatedAt: now })
      .where(and(eq(aiProviderConfigs.userId, userId), eq(aiProviderConfigs.id, fallbackProviderId)));
  }
}

export async function setDefaultAiProvider(userId: string, providerId: string) {
  const id = providerId.trim();
  if (!id) throw new Error("Provider id is required.");
  const existing = await db.query.aiProviderConfigs.findFirst({
    where: and(eq(aiProviderConfigs.userId, userId), eq(aiProviderConfigs.id, id)),
    columns: { id: true },
  });
  if (!existing) throw new Error("Provider was not found.");

  const now = new Date();
  await db
    .update(aiProviderConfigs)
    .set({ isDefault: false, updatedAt: now })
    .where(and(eq(aiProviderConfigs.userId, userId), ne(aiProviderConfigs.id, id)));
  await db
    .update(aiProviderConfigs)
    .set({ isDefault: true, isFallback: false, selected: true, isEnabled: true, priority: 0, updatedAt: now })
    .where(and(eq(aiProviderConfigs.userId, userId), eq(aiProviderConfigs.id, id)));
}

export async function updateAiProviderPriority(userId: string, providerId: string, priority: number) {
  const id = providerId.trim();
  if (!id) throw new Error("Provider id is required.");
  const normalizedPriority = normalizePriority(priority);
  const [updated] = await db
    .update(aiProviderConfigs)
    .set({ priority: normalizedPriority, updatedAt: new Date() })
    .where(and(eq(aiProviderConfigs.userId, userId), eq(aiProviderConfigs.id, id)))
    .returning();
  if (!updated) throw new Error("Provider was not found.");
}

export function sanitizeProviderBaseUrlForLog(value: string) {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return "[invalid-base-url]";
  }
}

export async function generateWithUserAiProvider(userId: string, prompt: string) {
  return generateWithUniversalAiAdapter(userId, prompt);
}

export async function generateWithUniversalAiAdapter(userId: string, prompt: string, options: { mode?: AiMode } = {}) {
  const featureAccess = await getHybridAiFeatureAccess(userId);
  if (!featureAccess.enabledFeatureIds.includes("aiProviderManagement")) {
    debugLog("[AI_PROVIDER] Hybrid AI provider routing skipped by feature gate", { userId });
    return null;
  }

  const mode = normalizeAiMode(options.mode ?? await getAiMode(userId));
  const providersForMode = await listPrivateAiProviderConfigsForMode(userId, mode);
  const providers = featureAccess.providerLimit === null ? providersForMode : providersForMode.slice(0, featureAccess.providerLimit);
  if (providers.length === 0) {
    if (mode === "local-only") {
      debugWarn("[AI_PROVIDER] Offline mode has no enabled local providers", { userId, mode });
      throw new LocalAiUnavailableError("Offline mode is enabled, but your local AI provider is not reachable.");
    }
    debugLog("[AI_PROVIDER] No configured providers for selected AI mode", { userId, mode });
    return null;
  }

  let lastError: unknown = null;
  for (let index = 0; index < providers.length; index += 1) {
    const provider = providers[index];
    try {
      const providerStartedAt = Date.now();
      const healthStartedAt = Date.now();
      await checkProviderHealth(provider);
      await updateAiProviderTestStatus(userId, "connected", "Connection successful. Model confirmed.", {
        providerId: provider.id,
        latencyMs: Date.now() - healthStartedAt,
      }).catch((statusError) => {
        debugWarn("[AI_PROVIDER] Failed to update provider health status", {
          userId,
          providerName: provider.providerName,
          providerType: provider.providerType,
        error: safeProviderErrorMessage(statusError),
        });
      });
      const chatResult = await callProviderChat(provider, prompt, 900);
      if (index > 0) {
        debugWarn("[AI_PROVIDER] Fallback provider used after primary provider failed", {
          userId,
          mode,
          providerName: provider.providerName,
          providerType: provider.providerType,
          modelName: provider.modelName,
        });
      }

      return {
        text: chatResult.text,
        providerName: provider.providerName,
        providerType: provider.providerType,
        modelName: provider.modelName,
        fallbackUsed: index > 0,
        mode,
        route: isLocalProvider(provider.providerType) ? "local" : "cloud",
        routingReason: routingReasonForMode(mode, provider, index),
        latencyMs: Date.now() - providerStartedAt,
        usage: chatResult.usage,
      } satisfies UniversalAiGenerateResult;
    } catch (error) {
      lastError = error;
      const status = classifyProviderError(error);
      await updateAiProviderTestStatus(userId, status, safeProviderErrorMessage(error), {
        providerId: provider.id,
      }).catch((statusError) => {
        debugWarn("[AI_PROVIDER] Failed to update provider failure status", {
          userId,
          providerName: provider.providerName,
          providerType: provider.providerType,
          error: statusError instanceof Error ? statusError.message : String(statusError),
        });
      });
      debugWarn("[AI_PROVIDER] Provider unavailable, trying fallback", {
        userId,
        mode,
        providerName: provider.providerName,
        providerType: provider.providerType,
        modelName: provider.modelName,
        status,
        error: safeProviderErrorMessage(error),
      });
    }
  }

  if (mode === "local-only") {
    throw new LocalAiUnavailableError("Offline mode is enabled, but your local AI provider is not reachable.");
  }

  throw lastError instanceof Error ? lastError : new Error("All configured AI providers failed.");
}

export async function updateAiProviderTestStatus(
  userId: string,
  status: AiProviderHealthStatus | "success" | "failed",
  message: string,
  options: { providerId?: string; latencyMs?: number | null; availableModels?: string[] } = {},
) {
  const where = options.providerId
    ? and(eq(aiProviderConfigs.userId, userId), eq(aiProviderConfigs.id, options.providerId))
    : eq(aiProviderConfigs.userId, userId);
  const updateValues: Partial<typeof aiProviderConfigs.$inferInsert> = {
    lastTestStatus: status,
    lastTestMessage: message,
    lastTestLatencyMs: options.latencyMs ?? null,
    lastTestedAt: new Date(),
    updatedAt: new Date(),
  };
  if (options.availableModels !== undefined) {
    updateValues.lastTestModels = options.availableModels;
  }

  await db
    .update(aiProviderConfigs)
    .set(updateValues)
    .where(where);
}

export async function healthCheckEnabledAiProviders(userId: string): Promise<AiProviderHealthCheckResult[]> {
  const providers = await listPrivateAiProviderConfigs(userId);
  const results: AiProviderHealthCheckResult[] = [];

  for (const provider of providers) {
    try {
      const result = await testPrivateProvider(provider);
      await updateAiProviderTestStatus(userId, result.status, result.message, {
        providerId: provider.id,
        latencyMs: result.latencyMs,
        availableModels: result.availableModels,
      });
      results.push({
        providerId: provider.id,
        providerName: result.providerName,
        providerType: result.providerType,
        modelName: result.modelName,
        status: result.status,
        success: result.success,
        message: result.message,
        latencyMs: result.latencyMs,
        availableModels: result.availableModels,
        modelConfirmed: result.modelConfirmed,
        checkedAt: result.checkedAt,
      });
    } catch (error) {
      const status = classifyProviderError(error);
      const message = safeProviderErrorMessage(error);
      const checkedAt = new Date().toISOString();
      await updateAiProviderTestStatus(userId, status, message, {
        providerId: provider.id,
      });
      results.push({
        providerId: provider.id,
        providerName: provider.providerName,
        providerType: provider.providerType,
        modelName: provider.modelName,
        status,
        success: false,
        message,
        latencyMs: null,
        availableModels: [],
        modelConfirmed: false,
        checkedAt,
      });
    }
  }

  return results;
}

async function testPrivateProvider(provider: PrivateAiProviderConfig): Promise<AiProviderTestResult> {
  const startedAt = Date.now();
  const [availableModels, answer] = await Promise.all([
    listAvailableModels(provider).catch((error) => {
      debugWarn("[AI_PROVIDER] Model listing failed during test", {
        providerName: provider.providerName,
        providerType: provider.providerType,
      error: safeProviderErrorMessage(error),
      });
      return [] as string[];
    }),
    callProviderChat(provider, TEST_PROMPT, 20),
  ]);

  return {
    success: true,
    status: "connected",
    message: "Connection successful. Model confirmed.",
    providerName: provider.providerName,
    providerType: provider.providerType,
    modelName: provider.modelName,
    latencyMs: Date.now() - startedAt,
    availableModels,
    modelConfirmed: true,
    sample: answer.text.slice(0, 120),
    checkedAt: new Date().toISOString(),
  };
}

async function checkProviderHealth(provider: PrivateAiProviderConfig) {
  await callProviderChat(provider, TEST_PROMPT, 12);
}

function normalizeAiProviderInput(input: AiProviderInput) {
  const providerType = normalizeProviderType(input.providerType);
  const providerName = input.providerName.trim();
  const baseUrl = normalizeBaseUrl(input.baseUrl || DEFAULT_BASE_URLS[providerType], providerType);
  const modelName = input.modelName.trim();
  const apiKey = input.apiKey?.trim();

  if (!providerName) throw new Error("Provider name is required.");
  if (!modelName) throw new Error("Default model is required.");
  if (requiresApiKey(providerType) && !apiKey && !input.id) {
    throw new Error(`${AI_PROVIDER_TYPE_LABELS[providerType]} requires an API key.`);
  }

  return {
    id: input.id?.trim() || undefined,
    providerName,
    providerType,
    baseUrl,
    modelName,
    apiKey: apiKey === undefined ? undefined : apiKey,
    enabled: input.enabled ?? true,
    isDefault: input.isDefault ?? false,
    isFallback: input.isFallback ?? false,
    priority: normalizePriority(input.priority),
  };
}

function normalizePriority(value: number | undefined) {
  if (value === undefined || Number.isNaN(value)) return 100;
  return Math.max(0, Math.min(999, Math.round(value)));
}

function normalizeProviderType(value: string): AiProviderType {
  if (value === "openai_compatible") return "openai-compatible";
  if (value === "google_gemini") return "google-gemini";
  const allowed = Object.keys(AI_PROVIDER_TYPE_LABELS) as AiProviderType[];
  if (allowed.includes(value as AiProviderType)) return value as AiProviderType;
  throw new Error("Choose a supported provider type.");
}

function normalizeAiMode(value: unknown): AiMode {
  if (value === "automatic") return "auto";
  if (value === "local") return "local-only";
  if (value === "useclevr_cloud") return "cloud-only";
  if (value === "byok") return "byok";
  if (value === "local-only" || value === "cloud-only" || value === "auto") return value;
  return "auto";
}

function aiModeKey(userId: string) {
  return `${AI_MODE_KEY_PREFIX}${userId}`;
}

export function isLocalProvider(providerType: AiProviderType) {
  return LOCAL_PROVIDER_TYPES.includes(providerType);
}

export function isCloudProvider(providerType: AiProviderType) {
  return CLOUD_PROVIDER_TYPES.includes(providerType);
}

export function isByokProvider(providerType: AiProviderType) {
  return isCloudProvider(providerType) && !isUseClevrCloudProvider(providerType);
}

export function isUseClevrCloudProvider(providerType: AiProviderType) {
  return providerType === "useclevr_cloud";
}

export function isLocalAiUnavailableError(error: unknown) {
  return error instanceof LocalAiUnavailableError || (error instanceof Error && error.name === "LocalAiUnavailableError");
}

export function isHealthyProviderStatus(status: string | null | undefined) {
  return status === "connected" || status === "healthy" || status === "success";
}

export function classifyProviderError(error: unknown): AiProviderHealthStatus {
  const message = safeProviderErrorMessage(error).toLowerCase();

  if (
    message.includes("401") ||
    message.includes("403") ||
    message.includes("unauthorized") ||
    message.includes("forbidden") ||
    message.includes("api key") ||
    message.includes("authentication") ||
    message.includes("auth")
  ) {
    return "invalid_key";
  }

  if (
    message.includes("404") ||
    message.includes("model") ||
    message.includes("deployment") ||
    message.includes("not found")
  ) {
    return "model_unavailable";
  }

  if (message.includes("429") || message.includes("rate limit") || message.includes("rate_limited")) {
    return "rate_limited";
  }

  if (
    message.includes("timed out") ||
    message.includes("timeout") ||
    message.includes("fetch failed") ||
    message.includes("econnrefused") ||
    message.includes("econnreset") ||
    message.includes("enotfound") ||
    message.includes("network") ||
    message.includes("unreachable")
  ) {
    return "endpoint_unreachable";
  }

  if (message.includes("configuration") || message.includes("encryption") || message.includes("base url")) {
    return "configuration_error";
  }

  return "provider_error";
}

export function safeProviderErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return redactProviderSecretText(error.message);
  if (typeof error === "string" && error.trim()) return redactProviderSecretText(error);
  return "Connection failed.";
}

function normalizeBaseUrl(value: string, providerType: AiProviderType) {
  const fallback = DEFAULT_BASE_URLS[providerType];
  const raw = (value || fallback).trim().replace(/\/+$/, "");
  if (!raw) throw new Error("Base URL is required.");

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Base URL must be a valid URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Base URL must start with http:// or https://.");
  }

  if (url.username || url.password) {
    throw new Error("Base URL must not include credentials.");
  }

  if (!isExplicitLocalProvider(providerType)) {
    assertPublicHostname(url.hostname);
  }

  if ((providerType === "ollama" || providerType === "lm-studio") && !url.pathname.endsWith("/v1")) {
    url.pathname = `${url.pathname.replace(/\/+$/, "")}/v1`;
  }

  return url.toString().replace(/\/+$/, "");
}

function requiresApiKey(providerType: AiProviderType) {
  return [
    "openai",
    "anthropic",
    "google-gemini",
    "google_gemini",
    "azure-openai",
    "openai-compatible",
    "openai_compatible",
  ].includes(providerType);
}

async function callProviderChat(provider: PrivateAiProviderConfig, prompt: string, maxTokens: number): Promise<ProviderChatResult> {
  await assertProviderUrlAllowed(provider);
  switch (provider.providerType) {
    case "anthropic":
      return callAnthropicChat(provider, prompt, maxTokens);
    case "google-gemini":
    case "google_gemini":
      return callGeminiChat(provider, prompt, maxTokens);
    case "azure-openai":
      return callAzureOpenAiChat(provider, prompt, maxTokens);
    case "ollama":
    case "lm-studio":
    case "openai":
    case "openai-compatible":
    default:
      return callOpenAICompatibleChat(provider, prompt, maxTokens);
  }
}

async function callOpenAICompatibleChat(provider: PrivateAiProviderConfig, prompt: string, maxTokens: number) {
  const body = await fetchJsonWithTimeout<ChatCompletionResponse>(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: provider.modelName,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: maxTokens,
      stream: false,
    }),
  });

  const content = body.choices?.[0]?.message?.content ?? body.choices?.[0]?.text;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Provider returned an empty response.");
  }

  return {
    text: content.trim(),
    usage: normalizeProviderUsage({
      provider: normalizeBillingProvider(provider.providerType),
      model: provider.modelName,
      usage: body.usage,
      rawUsageReference: body.usage ? { source: "openai_compatible_usage" } : { source: "missing_provider_usage" },
    }),
  };
}

async function callAnthropicChat(provider: PrivateAiProviderConfig, prompt: string, maxTokens: number) {
  if (!provider.apiKey) throw new Error("Anthropic requires an API key.");
  const body = await fetchJsonWithTimeout<AnthropicMessageResponse>(`${provider.baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": provider.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: provider.modelName,
      max_tokens: maxTokens,
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const content = body.content?.find((part) => part.type === "text" && typeof part.text === "string")?.text;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Provider returned an empty response.");
  }

  return {
    text: content.trim(),
    usage: normalizeProviderUsage({
      provider: "anthropic",
      model: provider.modelName,
      usage: body.usage,
      rawUsageReference: body.usage ? { source: "anthropic_usage" } : { source: "missing_provider_usage" },
    }),
  };
}

async function callGeminiChat(provider: PrivateAiProviderConfig, prompt: string, maxTokens: number) {
  if (!provider.apiKey) throw new Error("Google Gemini requires an API key.");
  const url = `${provider.baseUrl}/models/${encodeURIComponent(provider.modelName)}:generateContent?key=${encodeURIComponent(provider.apiKey)}`;
  const body = await fetchJsonWithTimeout<GeminiGenerateResponse>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: maxTokens },
    }),
  });

  const content = body.candidates?.[0]?.content?.parts?.map((part) => part.text).filter(Boolean).join("\n");
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Provider returned an empty response.");
  }

  return {
    text: content.trim(),
    usage: normalizeProviderUsage({
      provider: "google",
      model: provider.modelName,
      usage: body.usageMetadata,
      rawUsageReference: body.usageMetadata ? { source: "gemini_usage_metadata" } : { source: "missing_provider_usage" },
    }),
  };
}

async function callAzureOpenAiChat(provider: PrivateAiProviderConfig, prompt: string, maxTokens: number) {
  if (!provider.apiKey) throw new Error("Azure OpenAI requires an API key.");
  const endpoint = `${provider.baseUrl}/openai/deployments/${encodeURIComponent(provider.modelName)}/chat/completions?api-version=2024-02-15-preview`;
  const body = await fetchJsonWithTimeout<ChatCompletionResponse>(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": provider.apiKey,
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: maxTokens,
      stream: false,
    }),
  });

  const content = body.choices?.[0]?.message?.content ?? body.choices?.[0]?.text;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Provider returned an empty response.");
  }

  return {
    text: content.trim(),
    usage: normalizeProviderUsage({
      provider: "openai",
      model: provider.modelName,
      usage: body.usage,
      rawUsageReference: body.usage ? { source: "azure_openai_usage" } : { source: "missing_provider_usage" },
    }),
  };
}

async function listAvailableModels(provider: PrivateAiProviderConfig) {
  await assertProviderUrlAllowed(provider);
  if (provider.providerType === "azure-openai") return [provider.modelName];

  if (provider.providerType === "google-gemini" || provider.providerType === "google_gemini") {
    if (!provider.apiKey) return [];
    const body = await fetchJsonWithTimeout<ModelListResponse>(
      `${provider.baseUrl}/models?key=${encodeURIComponent(provider.apiKey)}`,
      { method: "GET" },
    );
    return (body.models || [])
      .map((model) => (typeof model === "string" ? model : model.name || model.id))
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.replace(/^models\//, ""))
      .slice(0, 30);
  }

  const headers: Record<string, string> = {};
  if (provider.providerType === "anthropic") {
    if (!provider.apiKey) return [];
    headers["x-api-key"] = provider.apiKey;
    headers["anthropic-version"] = "2023-06-01";
  } else if (provider.apiKey) {
    headers.Authorization = `Bearer ${provider.apiKey}`;
  }

  const modelUrl = provider.providerType === "anthropic" ? `${provider.baseUrl}/v1/models` : `${provider.baseUrl}/models`;
  const body = await fetchJsonWithTimeout<ModelListResponse>(modelUrl, { method: "GET", headers });
  const values = body.data || body.models || [];

  return values
    .map((model) => (typeof model === "string" ? model : model.id || model.name))
    .filter((value): value is string => typeof value === "string")
    .slice(0, 30);
}

async function fetchJsonWithTimeout<T>(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      redirect: "error",
      signal: controller.signal,
    });
    const normalized = await readProviderResponse(response);
    const body = (normalized.data ?? {}) as T & { error?: unknown };

    if (!response.ok) {
      throw new Error(normalized.errorMessage || getProviderErrorMessage(response.status, body, normalized.rawText));
    }

    return body;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Connection timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function readProviderResponse(response: Response): Promise<{
  ok: boolean;
  status: number;
  data?: unknown;
  rawText: string;
  errorCode?: string;
  errorMessage?: string;
}> {
  const rawText = await response.text();
  let data: unknown;
  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = undefined;
    }
  }

  const body = data && typeof data === "object" ? data as { error?: unknown } : {};

  return {
    ok: response.ok,
    status: response.status,
    data,
    rawText,
    errorCode: response.ok ? undefined : `HTTP_${response.status}`,
    errorMessage: response.ok ? undefined : getProviderErrorMessage(response.status, body, rawText),
  };
}

function getProviderErrorMessage(status: number, body: { error?: unknown }, rawText?: string) {
  if (body.error && typeof body.error === "object") {
    const error = body.error as { message?: unknown; type?: unknown; code?: unknown; status?: unknown };
    const parts = [error.message, error.type, error.code, error.status].filter(Boolean).map(String);
    if (parts.length) return redactProviderSecretText(`Provider returned ${status}: ${parts.join(" / ")}`);
  }

  if (typeof body.error === "string") return redactProviderSecretText(`Provider returned ${status}: ${body.error}`);
  if (rawText?.trim()) return redactProviderSecretText(`Provider returned ${status}: ${rawText.trim().slice(0, 300)}`);

  return `Provider returned HTTP ${status}.`;
}

function toPublicConfig(row: typeof aiProviderConfigs.$inferSelect): PublicAiProviderConfig {
  return {
    id: row.id,
    providerType: publicProviderType(normalizeProviderType(row.providerType)),
    providerName: row.providerName,
    baseUrl: row.baseUrl,
    modelName: row.modelName,
    hasApiKey: Boolean(row.encryptedApiKey),
    apiKeyPreview: row.encryptedApiKey ? "Saved key" : null,
    selected: row.selected,
    enabled: row.isEnabled ?? row.selected,
    isDefault: row.isDefault ?? row.selected,
    isFallback: row.isFallback ?? false,
    priority: row.priority ?? 100,
    lastTestStatus: row.lastTestStatus,
    lastTestMessage: row.lastTestMessage,
    lastTestLatencyMs: row.lastTestLatencyMs,
    lastTestModels: Array.isArray(row.lastTestModels) ? row.lastTestModels.filter((value): value is string => typeof value === "string") : [],
    lastTestedAt: row.lastTestedAt?.toISOString() ?? null,
  };
}

function maskSecretPreview(secret: string) {
  const trimmed = secret.trim();
  if (!trimmed) return null;
  const suffix = trimmed.slice(-4);
  return `•••• ${suffix}`;
}

function publicProviderType(providerType: AiProviderType): AiProviderType {
  if (providerType === "openai-compatible") return "openai_compatible";
  if (providerType === "google-gemini") return "google_gemini";
  return providerType;
}

function redactProviderSecretText(value: string) {
  return value
    .replace(/Authorization=Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Authorization=Bearer [redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/(api[_-]?key|key|token)=([^&\s]+)/gi, "$1=[redacted]")
    .replace(/\b(sk-[A-Za-z0-9_-]{8,})\b/g, "[redacted-api-key]")
    .replace(/\b(AIza[0-9A-Za-z_-]{16,})\b/g, "[redacted-api-key]");
}

function encryptSecret(secret: string) {
  const iv = randomBytes(12);
  const key = getEncryptionKey();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return JSON.stringify({
    v: ENCRYPTION_KEY_VERSION,
    alg: "aes-256-gcm",
    key: "AI_PROVIDER_ENCRYPTION_KEY",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64"),
  });
}

function decryptSecret(payload: string) {
  try {
    const parsed = JSON.parse(payload) as { v?: number; iv: string; tag: string; data: string };
    const key = parsed.v === 1 ? getLegacyEncryptionKey() : getEncryptionKey();
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(parsed.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(parsed.tag, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(parsed.data, "base64")),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch (error) {
    debugError("[AI_PROVIDER] Failed to decrypt provider API key", error);
    throw new Error("Stored provider key cannot be decrypted.");
  }
}

function getEncryptionKey() {
  const secret = process.env.AI_PROVIDER_ENCRYPTION_KEY?.trim();
  if (!secret) {
    debugWarn("[AI_PROVIDER] Missing AI_PROVIDER_ENCRYPTION_KEY for provider key encryption.");
    throw new Error("AI provider encryption is not configured.");
  }

  const decoded = decodeEncryptionKey(secret);
  if (!decoded) {
    debugWarn("[AI_PROVIDER] Invalid AI_PROVIDER_ENCRYPTION_KEY. Use 32 raw bytes or base64 for 32 bytes.");
    throw new Error("AI provider encryption key is invalid.");
  }

  return decoded;
}

function getLegacyEncryptionKey() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("Legacy provider key encryption is not configured.");
  return createHash("sha256").update(secret).digest();
}

function decodeEncryptionKey(secret: string) {
  try {
    const decoded = Buffer.from(secret, "base64");
    if (decoded.length === ENCRYPTION_KEY_LENGTH) return decoded;
  } catch {
    return null;
  }
  if (Buffer.byteLength(secret, "utf8") >= ENCRYPTION_KEY_LENGTH) {
    return createHash("sha256").update(secret).digest();
  }
  return null;
}

export function getProviderTypeLabel(providerType: AiProviderType) {
  return AI_PROVIDER_TYPE_LABELS[providerType] || providerType;
}

export function getDefaultBaseUrl(providerType: AiProviderType) {
  return DEFAULT_BASE_URLS[providerType] || "";
}

export function logDefaultCloudFallback(userId: string, error: unknown) {
  debugWarn("[AI_PROVIDER] Falling back to default cloud AI", {
    userId,
    error: safeProviderErrorMessage(error),
  });
}

export function logUniversalAiResponse(result: UniversalAiGenerateResult) {
  debugLog("[AI_PROVIDER] Universal adapter response received", {
    providerName: result.providerName,
    providerType: result.providerType,
    modelName: result.modelName,
    fallbackUsed: result.fallbackUsed,
    mode: result.mode,
    route: result.route,
    routingReason: result.routingReason,
    usageCaptured: Boolean(result.usage),
  });
}

function normalizeBillingProvider(providerType: AiProviderType) {
  if (providerType === "anthropic") return "anthropic"
  if (providerType === "google-gemini") return "google"
  if (providerType === "google_gemini") return "google"
  if (providerType === "ollama") return "ollama"
  if (providerType === "lm-studio") return "local"
  return "openai"
}

function isExplicitLocalProvider(providerType: AiProviderType) {
  return providerType === "ollama" || providerType === "lm-studio";
}

async function assertProviderUrlAllowed(provider: Pick<PrivateAiProviderConfig, "providerType" | "baseUrl">) {
  if (isExplicitLocalProvider(provider.providerType)) return;
  const url = new URL(provider.baseUrl);
  assertPublicHostname(url.hostname);
  await assertPublicDnsTarget(url.hostname);
}

function assertPublicHostname(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/\.$/, "").replace(/^\[(.*)\]$/, "$1");
  if (!normalized) throw new Error("Base URL host is required.");
  if (normalized === "localhost" || normalized.endsWith(".localhost") || normalized.includes("localtest.me")) {
    throw new Error("Base URL must use a public host.");
  }
  if (normalized === "metadata.google.internal") {
    throw new Error("Base URL must not target cloud metadata services.");
  }
  if (isIP(normalized) && isPrivateIp(normalized)) {
    throw new Error("Base URL must not target private, loopback, link-local, or metadata addresses.");
  }
}

async function assertPublicDnsTarget(hostname: string) {
  if (isIP(hostname)) return;
  try {
    const records = await lookup(hostname, { all: true, verbatim: true });
    if (records.some((record) => isPrivateIp(record.address))) {
      throw new Error("Base URL resolves to a private, loopback, link-local, or metadata address.");
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Base URL resolves")) throw error;
    throw new Error("Base URL host could not be verified.");
  }
}

function isPrivateIp(address: string) {
  const family = isIP(address);
  if (family === 4) {
    const parts = address.split(".").map((part) => Number(part));
    const [a = 0, b = 0] = parts;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (family === 6) {
    const normalized = address.toLowerCase();
    const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
    if (mappedIpv4) return isPrivateIp(mappedIpv4);
    const mappedHexIpv4 = normalized.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (mappedHexIpv4) {
      const first = Number.parseInt(mappedHexIpv4[1] || "0", 16);
      const second = Number.parseInt(mappedHexIpv4[2] || "0", 16);
      const mappedAddress = [
        (first >> 8) & 255,
        first & 255,
        (second >> 8) & 255,
        second & 255,
      ].join(".");
      return isPrivateIp(mappedAddress);
    }
    return (
      normalized === "::1" ||
      normalized === "::" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80:") ||
      normalized.startsWith("::ffff:127.") ||
      normalized.startsWith("::ffff:10.") ||
      normalized.startsWith("::ffff:192.168.") ||
      normalized === "169.254.169.254"
    );
  }
  return false;
}

function routingReasonForMode(mode: AiMode, provider: PrivateAiProviderConfig, index: number) {
  if (mode === "local-only") return "local mode uses explicit local providers only";
  if (mode === "byok") return index === 0 ? "byok mode uses the default enabled provider" : "byok mode used the next enabled provider by priority";
  if (isLocalProvider(provider.providerType)) return "automatic mode prefers local providers";
  return index === 0 ? "automatic mode used the default enabled provider" : "automatic mode used fallback provider priority";
}

export const __aiProviderSecurityTestHooks = {
  decryptSecret,
  encryptSecret,
  normalizeBaseUrl,
};
