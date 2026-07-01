import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";

import { db } from "@/lib/db";
import { aiProviderConfigs, appSettings } from "@/lib/db/schema";
import { debugError, debugLog, debugWarn } from "@/lib/utils/debug";
import { and, asc, desc, eq } from "drizzle-orm";

export type AiProviderType =
  | "ollama"
  | "lm-studio"
  | "openai-compatible"
  | "openai"
  | "anthropic"
  | "google-gemini"
  | "azure-openai";

export type AiMode = "auto" | "local-only" | "cloud-only";

export type PublicAiProviderConfig = {
  id: string;
  providerType: AiProviderType;
  providerName: string;
  baseUrl: string;
  modelName: string;
  hasApiKey: boolean;
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
  error?: unknown;
};

type AnthropicMessageResponse = {
  content?: Array<{ type?: string; text?: unknown }>;
  error?: { message?: unknown; type?: unknown };
};

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: unknown }>;
    };
  }>;
  error?: { message?: unknown; status?: unknown };
};

type ModelListResponse = {
  data?: Array<{ id?: unknown; name?: unknown }>;
  models?: Array<{ name?: unknown; id?: unknown } | string>;
};

export type AiProviderTestResult = {
  success: boolean;
  message: string;
  providerName: string;
  providerType: AiProviderType;
  modelName: string;
  latencyMs: number;
  availableModels: string[];
  sample: string;
};

export type UniversalAiGenerateResult = {
  text: string;
  providerName: string;
  providerType: AiProviderType;
  modelName: string;
  fallbackUsed: boolean;
  mode: AiMode;
  route: "local" | "cloud";
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
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com",
  "google-gemini": "https://generativelanguage.googleapis.com/v1beta",
  "azure-openai": "",
};

export const AI_PROVIDER_TYPE_LABELS: Record<AiProviderType, string> = {
  ollama: "Ollama",
  "lm-studio": "LM Studio",
  "openai-compatible": "OpenAI Compatible",
  openai: "OpenAI",
  anthropic: "Anthropic",
  "google-gemini": "Google Gemini",
  "azure-openai": "Azure OpenAI",
};

const AI_MODE_KEY_PREFIX = "ai-provider-mode:";
const LOCAL_PROVIDER_TYPES: AiProviderType[] = ["ollama", "lm-studio", "openai-compatible"];
const CLOUD_PROVIDER_TYPES: AiProviderType[] = ["openai", "anthropic", "google-gemini", "azure-openai"];

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

export async function setAiMode(userId: string, mode: AiMode) {
  const normalized = normalizeAiMode(mode);
  await db
    .insert(appSettings)
    .values({
      key: aiModeKey(userId),
      value: { mode: normalized },
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value: { mode: normalized },
        updatedAt: new Date(),
      },
    });
}

export async function listPublicAiProviderConfigs(userId: string): Promise<PublicAiProviderConfig[]> {
  const rows = await db.query.aiProviderConfigs.findMany({
    where: eq(aiProviderConfigs.userId, userId),
    orderBy: [
      desc(aiProviderConfigs.selected),
      desc(aiProviderConfigs.isDefault),
      desc(aiProviderConfigs.isFallback),
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
      apiKey: row.encryptedApiKey ? decryptSecret(row.encryptedApiKey) : null,
    }))
    .filter((provider) => provider.enabled);
}

export async function listPrivateAiProviderConfigsForMode(userId: string, mode: AiMode): Promise<PrivateAiProviderConfig[]> {
  const providers = await listPrivateAiProviderConfigs(userId);
  if (mode === "local-only") return providers.filter((provider) => isLocalProvider(provider.providerType));
  if (mode === "cloud-only") return providers.filter((provider) => isCloudProvider(provider.providerType));
  const localProviders = providers.filter((provider) => isLocalProvider(provider.providerType));
  const cloudProviders = providers.filter((provider) => isCloudProvider(provider.providerType));
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

export async function testAiProviderConfig(input: AiProviderInput) {
  const normalized = normalizeAiProviderInput(input);
  const privateProvider: PrivateAiProviderConfig = {
    id: normalized.id || "unsaved",
    providerType: normalized.providerType,
    providerName: normalized.providerName,
    baseUrl: normalized.baseUrl,
    modelName: normalized.modelName,
    hasApiKey: Boolean(normalized.apiKey),
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
  const saved = providers.find((provider) => provider.id === input?.id) || providers[0];
  if (!saved) throw new Error("Save an AI provider before testing without an API key.");

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
  const now = new Date();
  const defaultProviderId = input.defaultProviderId?.trim();
  const fallbackProviderId = input.fallbackProviderId?.trim();

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

export async function generateWithUserAiProvider(userId: string, prompt: string) {
  return generateWithUniversalAiAdapter(userId, prompt);
}

export async function generateWithUniversalAiAdapter(userId: string, prompt: string, options: { mode?: AiMode } = {}) {
  const mode = options.mode ?? await getAiMode(userId);
  const providers = await listPrivateAiProviderConfigsForMode(userId, mode);
  if (providers.length === 0) {
    if (mode === "local-only") {
      debugWarn("[AI_PROVIDER] Offline mode has no enabled local providers", { userId, mode });
      throw new LocalAiUnavailableError("Offline mode is active, but no enabled local provider is configured.");
    }
    debugLog("[AI_PROVIDER] No configured providers for selected AI mode", { userId, mode });
    return null;
  }

  let lastError: unknown = null;
  for (let index = 0; index < providers.length; index += 1) {
    const provider = providers[index];
    try {
      await checkProviderHealth(provider);
      const text = await callProviderChat(provider, prompt, 900);
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
        text,
        providerName: provider.providerName,
        providerType: provider.providerType,
        modelName: provider.modelName,
        fallbackUsed: index > 0,
        mode,
        route: isLocalProvider(provider.providerType) ? "local" : "cloud",
      } satisfies UniversalAiGenerateResult;
    } catch (error) {
      lastError = error;
      debugWarn("[AI_PROVIDER] Provider unavailable, trying fallback", {
        userId,
        mode,
        providerName: provider.providerName,
        providerType: provider.providerType,
        modelName: provider.modelName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (mode === "local-only") {
    throw new LocalAiUnavailableError(lastError instanceof Error ? lastError.message : "Local provider unavailable.");
  }

  throw lastError instanceof Error ? lastError : new Error("All configured AI providers failed.");
}

export async function updateAiProviderTestStatus(
  userId: string,
  status: "success" | "failed",
  message: string,
  options: { providerId?: string; latencyMs?: number | null; availableModels?: string[] } = {},
) {
  const where = options.providerId
    ? and(eq(aiProviderConfigs.userId, userId), eq(aiProviderConfigs.id, options.providerId))
    : eq(aiProviderConfigs.userId, userId);

  await db
    .update(aiProviderConfigs)
    .set({
      lastTestStatus: status,
      lastTestMessage: message,
      lastTestLatencyMs: options.latencyMs ?? null,
      lastTestModels: options.availableModels ?? [],
      lastTestedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(where);
}

async function testPrivateProvider(provider: PrivateAiProviderConfig): Promise<AiProviderTestResult> {
  const startedAt = Date.now();
  const [availableModels, answer] = await Promise.all([
    listAvailableModels(provider).catch((error) => {
      debugWarn("[AI_PROVIDER] Model listing failed during test", {
        providerName: provider.providerName,
        providerType: provider.providerType,
        error: error instanceof Error ? error.message : String(error),
      });
      return [] as string[];
    }),
    callProviderChat(provider, TEST_PROMPT, 20),
  ]);

  return {
    success: true,
    message: "Connection successful.",
    providerName: provider.providerName,
    providerType: provider.providerType,
    modelName: provider.modelName,
    latencyMs: Date.now() - startedAt,
    availableModels,
    sample: answer.slice(0, 120),
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
  const allowed = Object.keys(AI_PROVIDER_TYPE_LABELS) as AiProviderType[];
  if (allowed.includes(value as AiProviderType)) return value as AiProviderType;
  throw new Error("Choose a supported provider type.");
}

function normalizeAiMode(value: unknown): AiMode {
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

export function isLocalAiUnavailableError(error: unknown) {
  return error instanceof LocalAiUnavailableError || (error instanceof Error && error.name === "LocalAiUnavailableError");
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

  if ((providerType === "ollama" || providerType === "lm-studio") && !url.pathname.endsWith("/v1")) {
    url.pathname = `${url.pathname.replace(/\/+$/, "")}/v1`;
  }

  return url.toString().replace(/\/+$/, "");
}

function requiresApiKey(providerType: AiProviderType) {
  return ["openai", "anthropic", "google-gemini", "azure-openai"].includes(providerType);
}

async function callProviderChat(provider: PrivateAiProviderConfig, prompt: string, maxTokens: number) {
  switch (provider.providerType) {
    case "anthropic":
      return callAnthropicChat(provider, prompt, maxTokens);
    case "google-gemini":
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

  return content.trim();
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

  return content.trim();
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

  return content.trim();
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

  return content.trim();
}

async function listAvailableModels(provider: PrivateAiProviderConfig) {
  if (provider.providerType === "azure-openai") return [provider.modelName];

  if (provider.providerType === "google-gemini") {
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
    const body = (await response.json().catch(() => ({}))) as T & {
      error?: unknown;
    };

    if (!response.ok) {
      throw new Error(getProviderErrorMessage(response.status, body));
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

function getProviderErrorMessage(status: number, body: { error?: unknown }) {
  if (body.error && typeof body.error === "object") {
    const error = body.error as { message?: unknown; type?: unknown; code?: unknown; status?: unknown };
    const parts = [error.message, error.type, error.code, error.status].filter(Boolean).map(String);
    if (parts.length) return `Provider returned ${status}: ${parts.join(" / ")}`;
  }

  if (typeof body.error === "string") return `Provider returned ${status}: ${body.error}`;

  return `Provider returned HTTP ${status}.`;
}

function toPublicConfig(row: typeof aiProviderConfigs.$inferSelect): PublicAiProviderConfig {
  return {
    id: row.id,
    providerType: normalizeProviderType(row.providerType),
    providerName: row.providerName,
    baseUrl: row.baseUrl,
    modelName: row.modelName,
    hasApiKey: Boolean(row.encryptedApiKey),
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

function encryptSecret(secret: string) {
  const iv = randomBytes(12);
  const key = getEncryptionKey();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return JSON.stringify({
    v: 1,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64"),
  });
}

function decryptSecret(payload: string) {
  try {
    const parsed = JSON.parse(payload) as { iv: string; tag: string; data: string };
    const decipher = createDecipheriv(
      "aes-256-gcm",
      getEncryptionKey(),
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
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    debugWarn("[AI_PROVIDER] Missing AUTH_SECRET/NEXTAUTH_SECRET for provider key encryption.");
    throw new Error("AI provider encryption is not configured.");
  }

  return createHash("sha256").update(secret).digest();
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
    error: error instanceof Error ? error.message : String(error),
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
  });
}
