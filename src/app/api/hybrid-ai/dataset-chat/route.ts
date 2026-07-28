import { z } from "zod";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";

import {
  generateWithUniversalAiAdapter,
  getAiMode,
  getUseClevrCloudFallbackAllowed,
  isLocalAiUnavailableError,
  logDefaultCloudFallback,
  logUniversalAiResponse,
  type AiMode,
} from "@/lib/ai/universal-ai-adapter";
import { generateAntigravityCompletion } from "@/lib/ai/antigravity-client";
import { listPrivateAiProviderConfigs, isCloudProvider } from "@/lib/ai/byoai-provider";
import { auditInputFromAdapterResult, recordAiRequestAudit } from "@/lib/ai/ai-request-audit";
import { auth } from "@/lib/auth/auth";
import { normalizeProviderUsage } from "@/lib/billing/provider-usage";
import { detectBusinessColumns } from "@/lib/business/business-columns";
import {
  executeAnalyticalIntent,
  type AnalyticalUnsupportedCode,
} from "@/lib/data/analytical-intents";
import { answerDatasetQuestionDeterministically } from "@/lib/data/dataset-assistant-deterministic";
import { detectDatasetTypeFromColumns } from "@/lib/data/dataset-intelligence";
import { db } from "@/lib/db";
import { datasetRows, datasets } from "@/lib/db/schema";
import { requireHybridAiFeature } from "@/lib/hybrid-ai/feature-gate";
import { debugError, debugLog, debugWarn } from "@/lib/utils/debug";
import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type HybridProviderStatus = {
  label: string;
  state: "connection_healthy" | "fallback_active" | "provider_unavailable" | "offline_active" | "local_unavailable";
  message: string;
  fallbackActive: boolean;
  route: "local" | "cloud" | "direct" | "none";
};

type DatasetContextSummary = {
  dataset: {
    id: string;
    name: string;
    rowCount: number;
    columnCount: number;
    columns: string[];
    datasetType: string;
  };
  sample: {
    rowsAnalyzed: number;
    sampleRowsSent: number;
    fullDatasetSent: false;
  };
  detectedColumns: Record<string, unknown>;
  columnProfiles: Array<{
    name: string;
    type: string;
    nonEmpty: number;
    missing: number;
    unique: number;
    sum?: number;
    average?: number;
    min?: number;
    max?: number;
    sampleValues: string[];
  }>;
  kpis: Record<string, unknown>;
  topGroups: Array<{
    dimension: string;
    metric: string;
    rows: Array<{ label: string; value: number; count: number }>;
  }>;
  sampleRows: Record<string, unknown>[];
};

const MAX_PROFILE_ROWS = 1000;
const MAX_DETERMINISTIC_ROWS = 25000;
const MAX_SAMPLE_ROWS_SENT = 8;
const MAX_COLUMNS_IN_CONTEXT = 30;

const chatMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]).default("user"),
  content: z.string().min(1),
});

const datasetChatSchema = z.object({
  datasetId: z.string().min(1),
  message: z.string().optional(),
  messages: z.array(chatMessageSchema).optional(),
});

export async function GET() {
  const gate = await requireHybridAiFeature("datasetAwareChat");
  if (!gate.success) return gate.error;
  const userId = gate.session?.user?.id;
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      id: datasets.id,
      name: datasets.name,
      rowCount: datasets.rowCount,
      columnCount: datasets.columnCount,
      columns: datasets.columns,
      createdAt: datasets.createdAt,
    })
    .from(datasets)
    .where(eq(datasets.userId, userId))
    .orderBy(desc(datasets.createdAt));

  return NextResponse.json({
    success: true,
    datasets: rows.map((dataset) => ({
      ...dataset,
      columns: Array.isArray(dataset.columns) ? dataset.columns : [],
      createdAt: dataset.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return datasetAiErrorResponse({
    status: 401,
    code: "UNAUTHORIZED",
    message: "Sign in before asking dataset questions.",
    requestId,
    stage: "authentication",
    startedAt,
  });

  let parsed: z.infer<typeof datasetChatSchema>;
  try {
    parsed = datasetChatSchema.parse(await request.json());
  } catch {
    return datasetAiErrorResponse({
      status: 400,
      code: "NO_DATASET_SELECTED",
      message: "Select a dataset before asking questions.",
      requestId,
      userId,
      stage: "parse_request",
      startedAt,
    });
  }

  const messages = normalizeMessages(parsed);
  if (messages.length === 0) {
    return datasetAiErrorResponse({
      status: 400,
      code: "EMPTY_QUESTION",
      message: "Enter a question about the selected dataset.",
      requestId,
      userId,
      datasetId: parsed.datasetId,
      stage: "normalize_question",
      startedAt,
    });
  }

  debugLog("[DATASET_AI] Request started", {
    requestId,
    datasetId: parsed.datasetId,
    userId,
    tenant: userId,
    stage: "load_dataset",
  });

  const dataset = await db.query.datasets.findFirst({
    where: and(eq(datasets.id, parsed.datasetId), eq(datasets.userId, userId)),
    columns: {
      id: true,
      name: true,
      rowCount: true,
      columnCount: true,
      columns: true,
      data: true,
      precomputedMetrics: true,
      detectedColumns: true,
      analysis: true,
      datasetType: true,
      businessModel: true,
    },
  });

  if (!dataset) {
    return datasetAiErrorResponse({
      status: 404,
      code: "DATASET_NOT_FOUND",
      message: "The selected dataset could not be found for this account.",
      requestId,
      userId,
      datasetId: parsed.datasetId,
      stage: "load_dataset",
      startedAt,
    });
  }

  const storedRows = await db.query.datasetRows.findMany({
    where: eq(datasetRows.datasetId, parsed.datasetId),
    columns: { data: true },
    orderBy: (rows, { asc }) => [asc(rows.rowIndex)],
    limit: MAX_DETERMINISTIC_ROWS,
  });

  const analysisRows = normalizeRows(
    storedRows.length > 0 ? storedRows.map((row) => row.data) : Array.isArray(dataset.data) ? dataset.data.slice(0, MAX_DETERMINISTIC_ROWS) : [],
  );
  if (analysisRows.length === 0) {
    return datasetAiErrorResponse({
      status: 422,
      code: "EMPTY_DATASET",
      message: "This dataset does not contain enough usable information.",
      requestId,
      userId,
      datasetId: parsed.datasetId,
      datasetType: dataset.datasetType || "standard",
      stage: "load_rows",
      startedAt,
    });
  }
  const profileRows = analysisRows.slice(0, MAX_PROFILE_ROWS);
  const columns = normalizeColumns(dataset.columns, profileRows);
  const datasetType = dataset.datasetType || detectDatasetTypeFromColumns(columns, dataset.name);
  const context = buildDatasetContext({
    id: dataset.id,
    name: dataset.name,
    rowCount: dataset.rowCount || profileRows.length,
    columnCount: dataset.columnCount || columns.length,
    columns,
    rows: profileRows,
    detectedColumns: dataset.detectedColumns,
    precomputedMetrics: dataset.precomputedMetrics,
    analysis: dataset.analysis,
  });
  const latestQuestion = latestUserMessage(messages);
  if (latestQuestion) {
    const analyticalResult = executeAnalyticalIntent({
      question: latestQuestion,
      datasetId: dataset.id,
      datasetType,
      columns,
      rows: analysisRows,
    });
    if (analyticalResult.status === "success") {
      const providerStatus = directDataAnalysisStatus();
      recordAiRequestAudit({
        userId,
        datasetId: parsed.datasetId,
        providerName: "Direct data analysis",
        providerType: "deterministic",
        modelName: "none",
        mode: "direct",
        executionLocation: "none",
        fallbackUsed: false,
        purpose: "dataset_analysis",
        success: true,
      });
      return NextResponse.json({
        success: true,
        answer: analyticalResult.answer,
        content: analyticalResult.answer,
        insight: analyticalResult.insight,
        explanation: analyticalResult.explanation,
        recommendation: analyticalResult.recommendation,
        data: analyticalResult.data,
        chartType: analyticalResult.chartType,
        providerName: "Not required",
        modelName: "",
        mode: "direct",
        route: "direct",
        analyticalResult: analyticalResult.result,
        deterministicAnalysis: analyticalResult.intent === "segment_decline" ? analyticalResult.result : undefined,
        datasetContext: contextForClient(context),
        privacyWarning: null,
        providerStatus,
        requestId,
      });
    }

    const deterministicResult = answerDatasetQuestionDeterministically({
      question: latestQuestion,
      datasetId: dataset.id,
      datasetType,
      columns,
      rows: analysisRows,
    });
    if (deterministicResult) {
      const providerStatus = directDataAnalysisStatus();
      recordAiRequestAudit({
        userId,
        datasetId: parsed.datasetId,
        providerName: "Direct data analysis",
        providerType: "deterministic",
        modelName: "none",
        mode: "direct",
        executionLocation: "none",
        fallbackUsed: false,
        purpose: "dataset_analysis",
        success: true,
      });
      debugLog("[DATASET_AI] Direct dataset response generated", {
        requestId,
        datasetId: parsed.datasetId,
        datasetType,
        userId,
        tenant: userId,
        provider: "Direct data analysis",
        model: "none",
        stage: "direct_dataset_answer",
        durationMs: Date.now() - startedAt,
        httpStatus: 200,
      });
      return NextResponse.json({
        success: true,
        answer: deterministicResult.answer,
        content: deterministicResult.answer,
        insight: deterministicResult.insight,
        explanation: deterministicResult.explanation,
        recommendation: deterministicResult.recommendation,
        data: deterministicResult.data,
        chartType: deterministicResult.chartType,
        providerName: "Not required",
        modelName: "",
        mode: "direct",
        route: "direct",
        analyticalResult: deterministicResult.result,
        datasetContext: contextForClient(context),
        privacyWarning: null,
        providerStatus,
        requestId,
      });
    }

    if (analyticalResult.status === "unsupported") {
      const providerStatus = failedBeforeProviderStatus(analyticalResult.code);
      recordAiRequestAudit({
        userId,
        datasetId: parsed.datasetId,
        providerName: "Failed before provider execution",
        providerType: "deterministic",
        modelName: "none",
        mode: "direct",
        executionLocation: "none",
        fallbackUsed: false,
        purpose: "dataset_analysis",
        success: false,
        errorReason: analyticalResult.code,
      });
      return NextResponse.json({
        success: false,
        code: analyticalResult.code,
        message: analyticalResult.message,
        error: analyticalResult.message,
        answer: analyticalResult.message,
        content: analyticalResult.message,
        providerName: "Not used",
        modelName: "",
        mode: "direct",
        route: "none",
        analyticalResult,
        datasetContext: contextForClient(context),
        privacyWarning: null,
        providerStatus,
        requestId,
      }, { status: 422 });
    }
  }

  const prompt = buildDatasetChatPrompt(messages, context);
  const gate = await requireHybridAiFeature("datasetAwareChat");
  if (!gate.success) {
    return datasetAiErrorResponse({
      status: 503,
      code: "PROVIDER_UNAVAILABLE",
      message: "The AI assistant is temporarily unavailable. Please try again shortly.",
      requestId,
      userId,
      datasetId: parsed.datasetId,
      datasetType,
      providerName: "Hybrid AI",
      modelName: "none",
      stage: "provider_gate",
      startedAt,
    });
  }
  const { aiMode, allowUseclevrCloudFallback } = await resolveDatasetAiProviderSettings({
    userId,
    datasetId: parsed.datasetId,
    requestId,
  });
  let userProviderFailed = false;

  try {
    const result = await generateWithUniversalAiAdapter(userId, prompt, { mode: aiMode });
    if (result) {
      logUniversalAiResponse(result);
      recordAiRequestAudit(auditInputFromAdapterResult(userId, result, "dataset_analysis", parsed.datasetId));
      debugLog("[HYBRID_AI_DATASET_CHAT] User provider response generated", {
        userId,
        datasetId: parsed.datasetId,
        providerName: result.providerName,
        providerType: result.providerType,
        modelName: result.modelName,
        fallbackUsed: result.fallbackUsed,
        mode: result.mode,
        route: result.route,
      });

      return NextResponse.json({
        success: true,
        answer: result.text,
        content: result.text,
        providerName: result.providerName,
        modelName: result.modelName,
        mode: result.mode,
        route: result.route,
        datasetContext: contextForClient(context),
        privacyWarning: result.route === "cloud" && result.fallbackUsed
          ? "Cloud fallback is active. UseClevr sent summarized dataset context, not the full dataset."
          : null,
        providerStatus: providerStatusFromAdapterResult(
          result.providerType,
          result.providerName,
          result.fallbackUsed,
          result.mode,
          result.route,
        ),
        requestId,
      });
    }
  } catch (error) {
    if (isLocalAiUnavailableError(error)) {
      const message = "Offline mode is enabled, but your local AI provider is not reachable.";
      recordAiRequestAudit({
        userId,
        datasetId: parsed.datasetId,
        providerName: "Offline mode",
        providerType: "offline-mode",
        modelName: "none",
        mode: aiMode,
        executionLocation: "none",
        fallbackUsed: false,
        purpose: "dataset_analysis",
        success: false,
        errorReason: error instanceof Error ? error.message : String(error),
      });
      debugWarn("[HYBRID_AI_DATASET_CHAT] Offline mode blocked cloud fallback", {
        userId,
        datasetId: parsed.datasetId,
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({
        success: false,
        code: "PROVIDER_UNAVAILABLE",
        message,
        requestId,
        error: message,
        answer: message,
        content: message,
        providerName: "Offline mode",
        modelName: "",
        mode: "local-only",
        route: "none",
        datasetContext: contextForClient(context),
        privacyWarning: null,
        providerStatus: {
          label: "Offline mode",
          state: "local_unavailable",
          message: "Local provider unavailable",
          fallbackActive: false,
          route: "none",
        } satisfies HybridProviderStatus,
      }, { status: 503 });
    }

    logDefaultCloudFallback(userId, error);
    userProviderFailed = true;
    debugWarn("[HYBRID_AI_DATASET_CHAT] User provider failed; trying default cloud AI", {
      userId,
      datasetId: parsed.datasetId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const configuredProviders = await listDatasetAiProviders({
    userId,
    datasetId: parsed.datasetId,
    requestId,
  });
  if (!configuredProviders.loaded) {
    userProviderFailed = true;
  }
  const hasCloudProvider = configuredProviders.some((p) => p.enabled && isCloudProvider(p.providerType));

  if (!allowUseclevrCloudFallback && userProviderFailed) {
    const message = "UseClevr Cloud fallback is disabled. Please check AI provider settings.";
    debugWarn("[HYBRID_AI_DATASET_CHAT] Cloud fallback disabled by user preference", { userId, datasetId: parsed.datasetId, mode: aiMode });
    recordAiRequestAudit({
      userId,
      datasetId: parsed.datasetId,
      providerName: "UseClevr Cloud fallback disabled",
      providerType: "default-cloud",
      modelName: "none",
      mode: aiMode,
      executionLocation: "none",
      fallbackUsed: false,
      purpose: "dataset_analysis",
      success: false,
      errorReason: "Cloud fallback disabled",
    });
    return NextResponse.json({
      success: false,
      code: "PROVIDER_UNAVAILABLE",
      message,
      requestId,
      error: message,
      answer: message,
      content: message,
      providerName: "Hybrid AI",
      modelName: "",
      mode: aiMode,
      route: "none",
      datasetContext: contextForClient(context),
      privacyWarning: null,
      providerStatus: {
        label: "Hybrid AI",
        state: "provider_unavailable",
        message: "Cloud fallback disabled",
        fallbackActive: false,
        route: "none",
      } satisfies HybridProviderStatus,
    }, { status: 503 });
  }

  if (!hasCloudProvider) {
    const defaultCloudResult = await generateDefaultCloudDatasetAnswer({
      userId,
      datasetId: parsed.datasetId,
      prompt,
      context,
      aiMode,
      userProviderFailed,
      requestId,
    });
    if (defaultCloudResult) return defaultCloudResult;

    const message = "AI provider is not configured yet. Please check AI provider settings.";
    debugWarn("[HYBRID_AI_DATASET_CHAT] No cloud provider configured", { userId, datasetId: parsed.datasetId });
    recordAiRequestAudit({
      userId,
      datasetId: parsed.datasetId,
      providerName: "No provider configured",
      providerType: "none",
      modelName: "none",
      mode: aiMode,
      executionLocation: "none",
      fallbackUsed: userProviderFailed,
      purpose: "dataset_analysis",
      success: false,
      errorReason: "No cloud provider configured",
    });
    return NextResponse.json({
      success: false,
      code: "PROVIDER_MISSING",
      message,
      requestId,
      error: message,
      answer: message,
      content: message,
      providerName: "UseClevr Hybrid AI",
      modelName: "",
      mode: aiMode,
      route: "none",
      datasetContext: contextForClient(context),
      privacyWarning: null,
      providerStatus: {
        label: "Hybrid AI",
        state: "provider_unavailable",
        message: "Provider not configured",
        fallbackActive: false,
        route: "none",
      } satisfies HybridProviderStatus,
    }, { status: 503 });
  }

  try {
    const result = await generateWithUniversalAiAdapter(userId, prompt, { mode: "cloud-only" });
    if (result) {
      logUniversalAiResponse(result);
      recordAiRequestAudit(auditInputFromAdapterResult(userId, result, "dataset_analysis", parsed.datasetId));
      debugLog("[HYBRID_AI_DATASET_CHAT] Cloud fallback provider response generated", {
        userId,
        datasetId: parsed.datasetId,
        providerName: result.providerName,
        providerType: result.providerType,
        modelName: result.modelName,
        fallbackUsed: true,
        mode: result.mode,
        route: result.route,
      });

      return NextResponse.json({
        success: true,
        answer: result.text,
        content: result.text,
        providerName: result.providerName,
        modelName: result.modelName,
        mode: result.mode,
        route: result.route,
        datasetContext: contextForClient(context),
        privacyWarning: result.route === "cloud" ? "Cloud fallback is active. UseClevr sent summarized dataset context, not the full dataset." : null,
        providerStatus: providerStatusFromAdapterResult(
          result.providerType,
          result.providerName,
          true,
          result.mode,
          result.route,
        ),
        requestId,
      });
    }
    throw new Error("Cloud fallback provider returned no response.");
  } catch (cloudError) {
    debugError("[HYBRID_AI_DATASET_CHAT] Cloud fallback failed", { 
      userId, 
      datasetId: parsed.datasetId, 
      error: cloudError instanceof Error ? cloudError.message : String(cloudError) 
    });
    const defaultCloudResult = await generateDefaultCloudDatasetAnswer({
      userId,
      datasetId: parsed.datasetId,
      prompt,
      context,
      aiMode,
      userProviderFailed: true,
      requestId,
      previousError: cloudError,
    });
    if (defaultCloudResult) return defaultCloudResult;

    return providerFailureResponse({
      userId,
      datasetId: parsed.datasetId,
      requestId,
      context,
      aiMode,
      error: cloudError,
      fallbackUsed: true,
    });
  }
}

async function resolveDatasetAiProviderSettings(input: {
  userId: string;
  datasetId: string;
  requestId: string;
}): Promise<{ aiMode: AiMode; allowUseclevrCloudFallback: boolean }> {
  try {
    const [aiMode, allowUseclevrCloudFallback] = await Promise.all([
      getAiMode(input.userId),
      getUseClevrCloudFallbackAllowed(input.userId),
    ]);
    return { aiMode, allowUseclevrCloudFallback };
  } catch (error) {
    debugWarn("[HYBRID_AI_DATASET_CHAT] Provider settings lookup failed; using default cloud fallback", {
      userId: input.userId,
      datasetId: input.datasetId,
      requestId: input.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { aiMode: "auto", allowUseclevrCloudFallback: true };
  }
}

async function listDatasetAiProviders(input: {
  userId: string;
  datasetId: string;
  requestId: string;
}): Promise<Array<Awaited<ReturnType<typeof listPrivateAiProviderConfigs>>[number]> & { loaded: boolean }> {
  try {
    const providers = await listPrivateAiProviderConfigs(input.userId);
    return Object.assign(providers, { loaded: true });
  } catch (error) {
    debugWarn("[HYBRID_AI_DATASET_CHAT] Provider config lookup failed; using default cloud fallback", {
      userId: input.userId,
      datasetId: input.datasetId,
      requestId: input.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    return Object.assign([], { loaded: false });
  }
}

async function generateDefaultCloudDatasetAnswer(input: {
  userId: string;
  datasetId: string;
  prompt: string;
  context: DatasetContextSummary;
  aiMode: AiMode;
  userProviderFailed: boolean;
  requestId: string;
  previousError?: unknown;
}) {
  const startedAt = Date.now();
  try {
    const cloudResult = await generateDefaultCloudText(input.prompt);
    const answer = cloudResult.text.trim();
    if (!answer) throw new Error("Default cloud provider returned an empty response.");
    const normalizedUsage = normalizeProviderUsage({
      provider: "google",
      model: cloudResult.modelName,
      usage: cloudResult.usage,
      rawUsageReference: cloudResult.usage ? { source: cloudResult.usageSource } : { source: "missing_provider_usage" },
    });

    recordAiRequestAudit({
      userId: input.userId,
      datasetId: input.datasetId,
      providerName: cloudResult.providerName,
      providerType: "default-cloud",
      modelName: cloudResult.modelName,
      mode: input.aiMode,
      executionLocation: "cloud",
      fallbackUsed: input.userProviderFailed,
      purpose: "dataset_analysis",
      success: true,
      latencyMs: Date.now() - startedAt,
      inputTokens: normalizedUsage.inputTokens,
      outputTokens: normalizedUsage.outputTokens,
      totalTokens: normalizedUsage.inputTokens + normalizedUsage.outputTokens,
    });
    debugLog("[HYBRID_AI_DATASET_CHAT] Default cloud provider response generated", {
      userId: input.userId,
      datasetId: input.datasetId,
      requestId: input.requestId,
      providerName: cloudResult.providerName,
      modelName: cloudResult.modelName,
      fallbackUsed: input.userProviderFailed,
      mode: input.aiMode,
      route: "cloud",
    });

    return NextResponse.json({
      success: true,
      answer,
      content: answer,
      providerName: cloudResult.providerName,
      modelName: cloudResult.modelName,
      mode: input.aiMode,
      route: "cloud",
      datasetContext: contextForClient(input.context),
      privacyWarning: input.userProviderFailed
        ? "Cloud fallback is active. UseClevr sent summarized dataset context, not the full dataset."
        : null,
      providerStatus: {
        label: cloudResult.providerName,
        state: input.userProviderFailed ? "fallback_active" : "connection_healthy",
        message: input.userProviderFailed ? "Cloud fallback active" : "Connection healthy",
        fallbackActive: input.userProviderFailed,
        route: "cloud",
      } satisfies HybridProviderStatus,
      requestId: input.requestId,
    });
  } catch (error) {
    debugError("[HYBRID_AI_DATASET_CHAT] Default cloud provider failed", {
      userId: input.userId,
      datasetId: input.datasetId,
      requestId: input.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    recordAiRequestAudit({
      userId: input.userId,
      datasetId: input.datasetId,
      providerName: "Gemini Cloud",
      providerType: "default-cloud",
      modelName: "gemini-2.5-flash",
      mode: input.aiMode,
      executionLocation: "cloud",
      fallbackUsed: input.userProviderFailed,
      purpose: "dataset_analysis",
      success: false,
      latencyMs: Date.now() - startedAt,
      errorReason: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function generateDefaultCloudText(prompt: string): Promise<{
  text: string;
  providerName: string;
  modelName: string;
  usage?: Record<string, unknown>;
  usageSource: string;
}> {
  if (process.env.GEMINI_API_KEY) {
    const { text, usage } = await generateText({
      model: google("gemini-2.5-flash"),
      prompt,
      temperature: 0.3,
      maxOutputTokens: 900,
    });
    return {
      text,
      providerName: "Gemini Cloud",
      modelName: "gemini-2.5-flash",
      usage: usage as Record<string, unknown> | undefined,
      usageSource: "ai_sdk_usage",
    };
  }

  const text = await generateAntigravityCompletion({
    model: "gemini-2.5-flash",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 900,
  });
  return {
    text,
    providerName: "Gemini Cloud",
    modelName: "gemini-2.5-flash",
    usage: undefined,
    usageSource: "antigravity_usage_unavailable",
  };
}

function providerFailureResponse(input: {
  userId: string;
  datasetId: string;
  requestId: string;
  context: DatasetContextSummary;
  aiMode: AiMode;
  error: unknown;
  fallbackUsed: boolean;
}) {
  const code = providerErrorCode(input.error);
  const message = providerErrorMessage(input.error);
  recordAiRequestAudit({
    userId: input.userId,
    datasetId: input.datasetId,
    providerName: "Cloud fallback",
    providerType: "cloud",
    modelName: "none",
    mode: input.aiMode,
    executionLocation: "cloud",
    fallbackUsed: input.fallbackUsed,
    purpose: "dataset_analysis",
    success: false,
    errorReason: input.error instanceof Error ? input.error.message : String(input.error),
  });
  return NextResponse.json({
    success: false,
    code,
    message,
    requestId: input.requestId,
    error: message,
    datasetContext: contextForClient(input.context),
    privacyWarning: null,
    providerStatus: {
      label: "Hybrid AI",
      state: "provider_unavailable",
      message: "Provider unavailable",
      fallbackActive: false,
      route: "none",
    } satisfies HybridProviderStatus,
  }, { status: code === "PROVIDER_TIMEOUT" ? 504 : 503 });
}

function datasetAiErrorResponse(input: {
  status: number;
  code: string;
  message: string;
  requestId: string;
  userId?: string | null;
  datasetId?: string | null;
  datasetType?: string | null;
  providerName?: string;
  modelName?: string;
  stage: string;
  startedAt: number;
}) {
  debugWarn("[DATASET_AI] Request failed", {
    requestId: input.requestId,
    datasetId: input.datasetId || null,
    datasetType: input.datasetType || null,
    tenant: input.userId || null,
    userId: input.userId || null,
    provider: input.providerName || "none",
    model: input.modelName || "none",
    stage: input.stage,
    durationMs: Date.now() - input.startedAt,
    httpStatus: input.status,
    sanitizedProviderError: input.code,
  });
  return NextResponse.json({
    success: false,
    code: input.code,
    message: input.message,
    error: input.message,
    answer: input.message,
    content: input.message,
    requestId: input.requestId,
    providerName: input.providerName || "Dataset AI",
    modelName: input.modelName || "",
    providerStatus: {
      label: input.providerName || "Dataset AI",
      state: input.status === 401 || input.status === 404 || input.status === 422 ? "provider_unavailable" : "provider_unavailable",
      message: input.message,
      fallbackActive: false,
      route: "none",
    } satisfies HybridProviderStatus,
  }, { status: input.status });
}

function providerErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (message.includes("timeout") || message.includes("timed out")) return "The request timed out. Please retry.";
  if (message.includes("json") || message.includes("parse")) return "The AI provider returned an invalid response. Please retry.";
  return "The AI assistant is temporarily unavailable. Please try again shortly.";
}

function providerErrorCode(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (message.includes("timeout") || message.includes("timed out")) return "PROVIDER_TIMEOUT";
  if (message.includes("json") || message.includes("parse")) return "INVALID_PROVIDER_RESPONSE";
  return "PROVIDER_UNAVAILABLE";
}

function normalizeMessages(input: z.infer<typeof datasetChatSchema>) {
  if (Array.isArray(input.messages) && input.messages.length > 0) return input.messages;
  const message = input.message?.trim();
  return message ? [{ role: "user" as const, content: message }] : [];
}

function latestUserMessage(messages: Array<{ role: "system" | "user" | "assistant"; content: string }>) {
  return [...messages].reverse().find((message) => message.role === "user")?.content.trim() || "";
}

function buildDatasetChatPrompt(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  context: DatasetContextSummary,
) {
  const transcript = messages
    .slice(-10)
    .map((message) => `${message.role.toUpperCase()}: ${message.content.trim()}`)
    .join("\n\n");

  return [
    "You are UseClevr Hybrid AI, a dataset-aware business analyst.",
    "Answer only from the dataset context below. Do not invent rows, totals, products, customers, or dates.",
    "Use backend-derived KPIs and grouped summaries as the source of truth. If a metric is sample-based, say that clearly.",
    "For risks, best performers, and next actions, cite the columns or KPI extracts that support the answer.",
    "Do not ask for the full dataset unless the provided summary cannot answer the question.",
    "",
    "SAFE DATASET CONTEXT",
    JSON.stringify(context, null, 2),
    "",
    "CHAT",
    transcript,
    "",
    "ASSISTANT:",
  ].join("\n");
}

function buildDatasetContext(input: {
  id: string;
  name: string;
  rowCount: number;
  columnCount: number;
  columns: string[];
  rows: Record<string, unknown>[];
  detectedColumns: unknown;
  precomputedMetrics: unknown;
  analysis: unknown;
}): DatasetContextSummary {
  const columns = input.columns.slice(0, MAX_COLUMNS_IN_CONTEXT);
  const detectedColumns = normalizeRecord(input.detectedColumns) ?? detectBusinessColumns(input.rows);
  const datasetType = detectDatasetTypeFromColumns(columns, input.name);
  const columnProfiles = columns.map((column) => profileColumn(column, input.rows));
  const kpis = buildKpiExtract(input.rows, columns, input.precomputedMetrics, input.analysis);
  const topGroups = buildTopGroups(input.rows, columns);

  return {
    dataset: {
      id: input.id,
      name: input.name,
      rowCount: input.rowCount,
      columnCount: input.columnCount,
      columns,
      datasetType,
    },
    sample: {
      rowsAnalyzed: input.rows.length,
      sampleRowsSent: Math.min(input.rows.length, MAX_SAMPLE_ROWS_SENT),
      fullDatasetSent: false,
    },
    detectedColumns: normalizeRecord(detectedColumns) ?? {},
    columnProfiles,
    kpis,
    topGroups,
    sampleRows: input.rows.slice(0, MAX_SAMPLE_ROWS_SENT).map((row) => pickColumns(row, columns.slice(0, 12))),
  };
}

function contextForClient(context: DatasetContextSummary) {
  return {
    dataset: context.dataset,
    sample: context.sample,
    detectedColumns: context.detectedColumns,
    kpis: context.kpis,
  };
}

function normalizeRows(rows: unknown[]): Record<string, unknown>[] {
  return rows.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object" && !Array.isArray(row));
}

function normalizeColumns(columns: unknown, rows: Record<string, unknown>[]) {
  const stored = Array.isArray(columns) ? columns.filter((column): column is string => typeof column === "string") : [];
  if (stored.length > 0) return stored;
  return Object.keys(rows[0] || {});
}

function normalizeRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function profileColumn(column: string, rows: Record<string, unknown>[]) {
  const values = rows.map((row) => row[column]).filter((value) => value !== null && value !== undefined && value !== "");
  const numericValues = values.map(toNumber).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const sampleValues = Array.from(new Set(values.map((value) => String(value)).filter(Boolean))).slice(0, 5);
  const isNumeric = values.length > 0 && numericValues.length / values.length >= 0.6;

  if (isNumeric) {
    const sum = numericValues.reduce((total, value) => total + value, 0);
    return {
      name: column,
      type: "numeric",
      nonEmpty: values.length,
      missing: Math.max(0, rows.length - values.length),
      unique: new Set(values.map(String)).size,
      sum: round(sum),
      average: round(sum / Math.max(1, numericValues.length)),
      min: round(Math.min(...numericValues)),
      max: round(Math.max(...numericValues)),
      sampleValues,
    };
  }

  return {
    name: column,
    type: inferTextType(values),
    nonEmpty: values.length,
    missing: Math.max(0, rows.length - values.length),
    unique: new Set(values.map(String)).size,
    sampleValues,
  };
}

function buildKpiExtract(rows: Record<string, unknown>[], columns: string[], precomputedMetrics: unknown, analysis: unknown) {
  const detected = detectBusinessColumns(rows);
  const revenueColumn = stringOrNull(detected.revenueColumn);
  const costColumn = stringOrNull(detected.costColumn);
  const profitColumn = stringOrNull(detected.profitColumn);
  const quantityColumn = stringOrNull(detected.quantityColumn);
  const kpis: Record<string, unknown> = {
    rowSampleSize: rows.length,
    precomputedMetrics: normalizeRecord(precomputedMetrics),
    precomputedAnalysis: normalizeRecord(analysis),
    detectedRevenueColumn: revenueColumn,
    detectedCostColumn: costColumn,
    detectedProfitColumn: profitColumn,
    detectedQuantityColumn: quantityColumn,
  };

  if (revenueColumn) kpis.sampleRevenueTotal = round(sumColumn(rows, revenueColumn));
  if (costColumn) kpis.sampleCostTotal = round(sumColumn(rows, costColumn));
  if (profitColumn) kpis.sampleProfitTotal = round(sumColumn(rows, profitColumn));
  if (quantityColumn) kpis.sampleQuantityTotal = round(sumColumn(rows, quantityColumn));

  if (typeof kpis.sampleRevenueTotal === "number" && typeof kpis.sampleCostTotal === "number") {
    kpis.sampleGrossProfit = round(kpis.sampleRevenueTotal - kpis.sampleCostTotal);
    kpis.sampleGrossMarginPct = kpis.sampleRevenueTotal > 0
      ? round(((kpis.sampleGrossProfit as number) / kpis.sampleRevenueTotal) * 100)
      : null;
  }

  if (!revenueColumn) {
    const numericColumn = columns.find((column) => profileColumn(column, rows).type === "numeric");
    if (numericColumn) kpis.primaryNumericColumn = numericColumn;
  }

  return kpis;
}

function buildTopGroups(rows: Record<string, unknown>[], columns: string[]) {
  const detected = detectBusinessColumns(rows);
  const metric = stringOrNull(detected.revenueColumn) || stringOrNull(detected.profitColumn) || stringOrNull(detected.quantityColumn);
  if (!metric) return [];

  const candidateDimensions = [
    detected.productColumn,
    detected.regionColumn,
    detected.fallbackRegionColumn,
    columns.find((column) => /customer|client|account/i.test(column)),
    columns.find((column) => /category|segment|channel|supplier|vendor/i.test(column)),
  ].filter((value): value is string => typeof value === "string" && value !== metric);

  return Array.from(new Set(candidateDimensions)).slice(0, 4).map((dimension) => ({
    dimension,
    metric,
    rows: groupTopRows(rows, dimension, metric),
  }));
}

function groupTopRows(rows: Record<string, unknown>[], dimension: string, metric: string) {
  const groups = new Map<string, { value: number; count: number }>();
  for (const row of rows) {
    const label = String(row[dimension] ?? "Unknown").trim() || "Unknown";
    const current = groups.get(label) ?? { value: 0, count: 0 };
    current.value += toNumber(row[metric]) ?? 0;
    current.count += 1;
    groups.set(label, current);
  }
  return Array.from(groups.entries())
    .map(([label, value]) => ({ label, value: round(value.value), count: value.count }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}

function pickColumns(row: Record<string, unknown>, columns: string[]) {
  return columns.reduce<Record<string, unknown>>((picked, column) => {
    picked[column] = row[column];
    return picked;
  }, {});
}

function inferTextType(values: unknown[]) {
  const dateCount = values.filter((value) => !Number.isNaN(Date.parse(String(value)))).length;
  if (values.length > 0 && dateCount / values.length >= 0.6) return "date";
  if (values.every((value) => typeof value === "boolean" || String(value).toLowerCase() === "true" || String(value).toLowerCase() === "false")) {
    return "boolean";
  }
  return "categorical";
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function sumColumn(rows: Record<string, unknown>[], column: string) {
  return rows.reduce((total, row) => total + (toNumber(row[column]) ?? 0), 0);
}

function toNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const parsed = Number.parseFloat(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function providerStatusFromAdapterResult(
  providerType: string,
  providerName: string,
  fallbackUsed: boolean,
  mode?: string,
  route?: string,
): HybridProviderStatus {
  const isLocalRoute = route === "local";
  return {
    label: providerStatusLabel(providerType, providerName),
    state: mode === "local-only" ? "offline_active" : fallbackUsed ? "fallback_active" : "connection_healthy",
    message: mode === "local-only" ? "Offline mode active" : isLocalRoute ? "Local AI active" : fallbackUsed ? "Cloud fallback active" : "Connected",
    fallbackActive: fallbackUsed,
    route: isLocalRoute ? "local" : "cloud",
  };
}

function directDataAnalysisStatus(): HybridProviderStatus {
  return {
    label: "Direct data analysis",
    state: "connection_healthy",
    message: "Direct data analysis",
    fallbackActive: false,
    route: "direct",
  };
}

function failedBeforeProviderStatus(code: AnalyticalUnsupportedCode): HybridProviderStatus {
  const messageByCode: Partial<Record<AnalyticalUnsupportedCode, string>> = {
    missing_revenue_metric: "Missing revenue metric",
    missing_cogs_metric: "Missing COGS metric",
    ambiguous_cost_mapping: "Ambiguous cost mapping",
    zero_revenue: "Zero revenue",
    mixed_currency_dataset: "Mixed currency dataset",
    invalid_numeric_values: "Invalid numeric values",
    dataset_context_unavailable: "Dataset context unavailable",
    unsupported_dataset_type: "Unsupported dataset type",
    insufficient_data: "Insufficient data",
    unsupported_question: "Unsupported calculation",
    missing_segment_dimension: "Missing segment dimension",
    missing_time_dimension: "Missing time dimension",
    missing_sales_metric: "Missing sales metric",
    insufficient_periods: "Insufficient complete periods",
  };
  return {
    label: "Failed before provider execution",
    state: "provider_unavailable",
    message: messageByCode[code] ?? "Analysis unavailable",
    fallbackActive: false,
    route: "none",
  };
}

function providerStatusLabel(providerType: string, providerName: string) {
  if (providerType === "ollama") return "Ollama";
  if (providerType === "lm-studio") return "LM Studio";
  if (providerType === "openai-compatible") return "OpenAI Compatible";
  if (providerType === "azure-openai") return "Azure OpenAI";
  if (providerType === "google-gemini") return "Google Gemini";
  if (providerType === "openai") return "OpenAI";
  if (providerType === "anthropic") return "Anthropic";
  return providerName || "AI Provider";
}
