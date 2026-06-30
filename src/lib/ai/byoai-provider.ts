import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";

import { db } from "@/lib/db";
import { aiProviderConfigs } from "@/lib/db/schema";
import { debugError, debugWarn } from "@/lib/utils/debug";
import { eq } from "drizzle-orm";

export type AiProviderType = "openai-compatible";

export type PublicAiProviderConfig = {
  id: string;
  providerType: AiProviderType;
  providerName: string;
  baseUrl: string;
  modelName: string;
  hasApiKey: boolean;
  selected: boolean;
  lastTestStatus: string | null;
  lastTestMessage: string | null;
  lastTestedAt: string | null;
};

export type AiProviderInput = {
  providerName: string;
  baseUrl: string;
  modelName: string;
  apiKey?: string;
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

const PROVIDER_TYPE: AiProviderType = "openai-compatible";
const TEST_PROMPT = "Reply with exactly: UseClevr BYOAI OK";
const REQUEST_TIMEOUT_MS = 20_000;

export async function getPublicAiProviderConfig(userId: string): Promise<PublicAiProviderConfig | null> {
  const row = await db.query.aiProviderConfigs.findFirst({
    where: eq(aiProviderConfigs.userId, userId),
  });

  return row ? toPublicConfig(row) : null;
}

export async function getPrivateAiProviderConfig(userId: string): Promise<PrivateAiProviderConfig | null> {
  const row = await db.query.aiProviderConfigs.findFirst({
    where: eq(aiProviderConfigs.userId, userId),
  });

  if (!row?.selected) return null;

  return {
    ...toPublicConfig(row),
    apiKey: row.encryptedApiKey ? decryptSecret(row.encryptedApiKey) : null,
  };
}

export async function saveAiProviderConfig(userId: string, input: AiProviderInput) {
  const normalized = normalizeAiProviderInput(input);
  const existing = await db.query.aiProviderConfigs.findFirst({
    where: eq(aiProviderConfigs.userId, userId),
  });
  const encryptedApiKey =
    normalized.apiKey !== undefined
      ? normalized.apiKey
        ? encryptSecret(normalized.apiKey)
        : null
      : existing?.encryptedApiKey ?? null;
  const now = new Date();

  if (existing) {
    await db
      .update(aiProviderConfigs)
      .set({
        providerType: PROVIDER_TYPE,
        providerName: normalized.providerName,
        baseUrl: normalized.baseUrl,
        modelName: normalized.modelName,
        encryptedApiKey,
        selected: true,
        updatedAt: now,
      })
      .where(eq(aiProviderConfigs.userId, userId));
  } else {
    await db.insert(aiProviderConfigs).values({
      id: `aip_${randomUUID().replaceAll("-", "").slice(0, 20)}`,
      userId,
      providerType: PROVIDER_TYPE,
      providerName: normalized.providerName,
      baseUrl: normalized.baseUrl,
      modelName: normalized.modelName,
      encryptedApiKey,
      selected: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  const saved = await getPublicAiProviderConfig(userId);
  if (!saved) throw new Error("Provider was not saved.");
  return saved;
}

export async function testAiProviderConfig(input: AiProviderInput) {
  const normalized = normalizeAiProviderInput(input);
  const startedAt = Date.now();
  const answer = await callOpenAICompatibleChat({
    baseUrl: normalized.baseUrl,
    modelName: normalized.modelName,
    apiKey: normalized.apiKey || null,
    prompt: TEST_PROMPT,
    maxTokens: 20,
  });

  return {
    success: true,
    message: "Connection successful.",
    providerName: normalized.providerName,
    modelName: normalized.modelName,
    latencyMs: Date.now() - startedAt,
    sample: answer.slice(0, 120),
  };
}

export async function testSavedAiProviderConfig(userId: string, input?: Partial<AiProviderInput>) {
  const saved = await getPrivateAiProviderConfig(userId);
  if (!saved) throw new Error("Save an AI provider before testing without an API key.");

  return testAiProviderConfig({
    providerName: input?.providerName || saved.providerName,
    baseUrl: input?.baseUrl || saved.baseUrl,
    modelName: input?.modelName || saved.modelName,
    apiKey: input?.apiKey !== undefined ? input.apiKey : saved.apiKey || undefined,
  });
}

export async function generateWithUserAiProvider(userId: string, prompt: string) {
  const provider = await getPrivateAiProviderConfig(userId);
  if (!provider) return null;

  const text = await callOpenAICompatibleChat({
    baseUrl: provider.baseUrl,
    modelName: provider.modelName,
    apiKey: provider.apiKey,
    prompt,
    maxTokens: 900,
  });

  return {
    text,
    providerName: provider.providerName,
    modelName: provider.modelName,
  };
}

export async function updateAiProviderTestStatus(
  userId: string,
  status: "success" | "failed",
  message: string,
) {
  await db
    .update(aiProviderConfigs)
    .set({
      lastTestStatus: status,
      lastTestMessage: message,
      lastTestedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(aiProviderConfigs.userId, userId));
}

function normalizeAiProviderInput(input: AiProviderInput) {
  const providerName = input.providerName.trim();
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const modelName = input.modelName.trim();
  const apiKey = input.apiKey?.trim();

  if (!providerName) throw new Error("Provider name is required.");
  if (!modelName) throw new Error("Model name is required.");

  return {
    providerName,
    baseUrl,
    modelName,
    apiKey: apiKey === undefined ? undefined : apiKey,
  };
}

function normalizeBaseUrl(value: string) {
  const raw = value.trim().replace(/\/+$/, "");
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

  return url.toString().replace(/\/+$/, "");
}

async function callOpenAICompatibleChat({
  baseUrl,
  modelName,
  apiKey,
  prompt,
  maxTokens,
}: {
  baseUrl: string;
  modelName: string;
  apiKey: string | null;
  prompt: string;
  maxTokens: number;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: maxTokens,
        stream: false,
      }),
      redirect: "error",
      signal: controller.signal,
    });
    const body = (await response.json().catch(() => ({}))) as ChatCompletionResponse;

    if (!response.ok) {
      throw new Error(getProviderErrorMessage(response.status, body));
    }

    const content = body.choices?.[0]?.message?.content ?? body.choices?.[0]?.text;
    if (typeof content !== "string" || !content.trim()) {
      throw new Error("Provider returned an empty response.");
    }

    return content.trim();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Connection timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function getProviderErrorMessage(status: number, body: ChatCompletionResponse) {
  if (body.error && typeof body.error === "object") {
    const error = body.error as { message?: unknown; type?: unknown; code?: unknown };
    const parts = [error.message, error.type, error.code].filter(Boolean).map(String);
    if (parts.length) return `Provider returned ${status}: ${parts.join(" / ")}`;
  }

  if (typeof body.error === "string") return `Provider returned ${status}: ${body.error}`;

  return `Provider returned HTTP ${status}.`;
}

function toPublicConfig(row: typeof aiProviderConfigs.$inferSelect): PublicAiProviderConfig {
  return {
    id: row.id,
    providerType: PROVIDER_TYPE,
    providerName: row.providerName,
    baseUrl: row.baseUrl,
    modelName: row.modelName,
    hasApiKey: Boolean(row.encryptedApiKey),
    selected: row.selected,
    lastTestStatus: row.lastTestStatus,
    lastTestMessage: row.lastTestMessage,
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
    debugError("[BYOAI] Failed to decrypt provider API key", error);
    throw new Error("Stored provider key cannot be decrypted.");
  }
}

function getEncryptionKey() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    debugWarn("[BYOAI] Missing AUTH_SECRET/NEXTAUTH_SECRET for provider key encryption.");
    throw new Error("AI provider encryption is not configured.");
  }

  return createHash("sha256").update(secret).digest();
}
